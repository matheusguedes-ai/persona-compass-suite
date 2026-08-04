/**
 * Agendamento — Fatia 4a: o link de auto-agendamento.
 *
 * Especificação completa em docs/plano-mentorias-fatia4.md. Duas famílias de
 * função aqui:
 *
 * - PROFESSOR (autenticado, `exigirPermissao('mentorias')`): define
 *   `mentoria_disponibilidade` (quando atende) e cria `mentoria_links` (os
 *   endereços de auto-agendamento). Só dono ou colaborador com a permissão —
 *   diferente do resto de Mentorias (que também libera o papel "mentor" por
 *   grupo), porque disponibilidade/link não são recortados por pessoa/grupo:
 *   são a agenda pública da CONTA inteira, mesma natureza de Configurações.
 *
 * - PÚBLICO (`/agendar/$slug`, sem login, service role): confere o e-mail
 *   contra `people`, computa horários livres e confirma. Cada chamada
 *   pública resolve a pessoa DE NOVO a partir de {slug, email} — sem token
 *   nem id solto entre chamadas, pra não ter o que um cliente adulterado
 *   possa falsificar.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissao } from "@/lib/permissao.server";
import type { Database } from "@/integrations/supabase/types";

type Cliente = SupabaseClient<Database>;
type LinkRow = Database["public"]["Tables"]["mentoria_links"]["Row"];

const FUSO = "America/Sao_Paulo";
/** Mesmo fallback que `sincronizar()` já usa em google.server.ts. */
const DURACAO_PADRAO_MIN = 60;

async function admin(): Promise<Cliente> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// ============================================================
// Professor — disponibilidade
// ============================================================

export const listarDisponibilidade = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPermissao(context.supabase, context.userId, "mentorias");
    const { data, error } = await context.supabase
      .from("mentoria_disponibilidade")
      .select("id, dia_semana, hora_inicio, hora_fim, ativo")
      .order("dia_semana", { ascending: true })
      .order("hora_inicio", { ascending: true });
    if (error) throw new Error(error.message);
    return { faixas: data ?? [] };
  });

const horaSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida.");

const faixaSchema = z.object({
  dia_semana: z.number().int().min(0).max(6),
  hora_inicio: horaSchema,
  hora_fim: horaSchema,
});

export const criarFaixaDisponibilidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => faixaSchema.parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "mentorias");
    if (data.hora_fim <= data.hora_inicio) throw new Error("O fim tem de ser depois do início.");
    const { data: conta } = await context.supabase.rpc("acting_account");
    const { data: row, error } = await context.supabase
      .from("mentoria_disponibilidade")
      .insert({
        mentor_id: conta as string,
        dia_semana: data.dia_semana,
        hora_inicio: data.hora_inicio,
        hora_fim: data.hora_fim,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const atualizarFaixaSchema = z.object({
  id: z.string().uuid(),
  hora_inicio: horaSchema.optional(),
  hora_fim: horaSchema.optional(),
  ativo: z.boolean().optional(),
});

export const atualizarFaixaDisponibilidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => atualizarFaixaSchema.parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "mentorias");
    const { id, ...campos } = data;
    if (campos.hora_inicio && campos.hora_fim && campos.hora_fim <= campos.hora_inicio) {
      throw new Error("O fim tem de ser depois do início.");
    }
    const patch: Database["public"]["Tables"]["mentoria_disponibilidade"]["Update"] = {};
    if (campos.hora_inicio !== undefined) patch.hora_inicio = campos.hora_inicio;
    if (campos.hora_fim !== undefined) patch.hora_fim = campos.hora_fim;
    if (campos.ativo !== undefined) patch.ativo = campos.ativo;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase.from("mentoria_disponibilidade").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removerFaixaDisponibilidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "mentorias");
    const { error } = await context.supabase.from("mentoria_disponibilidade").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Professor — links
// ============================================================

function gerarSlugBase(titulo: string): string {
  const base = titulo
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "agendamento";
}

/**
 * Único no schema INTEIRO, não só por mentor (ver a migração) — por isso a
 * checagem passa pelo service role: o cliente autenticado só enxergaria os
 * próprios links via RLS, e um choque com outra conta passaria batido.
 */
async function slugUnico(titulo: string): Promise<string> {
  const supabaseAdmin = await admin();
  const base = gerarSlugBase(titulo);
  let candidato = base;
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    const { data } = await supabaseAdmin.from("mentoria_links").select("id").eq("slug", candidato).maybeSingle();
    if (!data) return candidato;
    candidato = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  throw new Error("Não consegui gerar um endereço único para este link. Tente um título diferente.");
}

export const listarLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPermissao(context.supabase, context.userId, "mentorias");
    const { data, error } = await context.supabase
      .from("mentoria_links")
      .select(
        "id, slug, titulo, descricao, duracao_min, intervalo_min, antecedencia_min_horas, antecedencia_max_dias, teto_por_dia, ativo, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { links: data ?? [] };
  });

const linkSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(2000).optional().nullable(),
  duracao_min: z.number().int().min(5).max(480),
  intervalo_min: z.number().int().min(0).max(480).default(0),
  antecedencia_min_horas: z.number().int().min(0).max(999).default(0),
  antecedencia_max_dias: z.number().int().min(1).max(365).default(60),
  teto_por_dia: z.number().int().min(1).max(50).optional().nullable(),
});

export const criarLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => linkSchema.parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "mentorias");
    const { data: conta } = await context.supabase.rpc("acting_account");
    const slug = await slugUnico(data.titulo);
    const { data: row, error } = await context.supabase
      .from("mentoria_links")
      .insert({
        mentor_id: conta as string,
        slug,
        titulo: data.titulo,
        descricao: data.descricao?.trim() || null,
        duracao_min: data.duracao_min,
        intervalo_min: data.intervalo_min,
        antecedencia_min_horas: data.antecedencia_min_horas,
        antecedencia_max_dias: data.antecedencia_max_dias,
        teto_por_dia: data.teto_por_dia ?? null,
      })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const atualizarLinkSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string().trim().min(1).max(200).optional(),
  descricao: z.string().trim().max(2000).optional().nullable(),
  duracao_min: z.number().int().min(5).max(480).optional(),
  intervalo_min: z.number().int().min(0).max(480).optional(),
  antecedencia_min_horas: z.number().int().min(0).max(999).optional(),
  antecedencia_max_dias: z.number().int().min(1).max(365).optional(),
  teto_por_dia: z.number().int().min(1).max(50).optional().nullable(),
  ativo: z.boolean().optional(),
});

// slug de propósito fora daqui: muda-lo quebraria um endereço já
// compartilhado. Recriar o link é o caminho se o endereço precisar mudar.
export const atualizarLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => atualizarLinkSchema.parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "mentorias");
    const { id, ...campos } = data;
    const patch: Database["public"]["Tables"]["mentoria_links"]["Update"] = {};
    if (campos.titulo !== undefined) patch.titulo = campos.titulo;
    if ("descricao" in campos) patch.descricao = campos.descricao?.trim() || null;
    if (campos.duracao_min !== undefined) patch.duracao_min = campos.duracao_min;
    if (campos.intervalo_min !== undefined) patch.intervalo_min = campos.intervalo_min;
    if (campos.antecedencia_min_horas !== undefined) patch.antecedencia_min_horas = campos.antecedencia_min_horas;
    if (campos.antecedencia_max_dias !== undefined) patch.antecedencia_max_dias = campos.antecedencia_max_dias;
    if ("teto_por_dia" in campos) patch.teto_por_dia = campos.teto_por_dia ?? null;
    if (campos.ativo !== undefined) patch.ativo = campos.ativo;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase.from("mentoria_links").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removerLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "mentorias");
    const { error } = await context.supabase.from("mentoria_links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// O núcleo: cálculo de horários livres
// ============================================================

type FaixaCalc = { dia_semana: number; hora_inicio: string; hora_fim: string };
type OcupadaCalc = { quando: string; termina_em: string | null; link_id: string | null };

/** Y-M-D em America/Sao_Paulo a partir de um instante UTC. */
function diaLocal(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** 0=domingo .. 6=sábado, em America/Sao_Paulo. */
function diaDaSemanaLocal(d: Date): number {
  const texto = new Intl.DateTimeFormat("en-US", { timeZone: FUSO, weekday: "short" }).format(d);
  const mapa: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return mapa[texto] ?? 0;
}

/**
 * Instante (epoch ms) de um horário local fixo, num dia local dado.
 *
 * Seguro por causa do -03:00 fixo o ano inteiro (Brasil sem horário de verão
 * desde 2019 — ver o comentário na migração 20260804020000). Se isso mudar
 * de novo por lei, isto precisa virar um cálculo de verdade via Intl.
 */
function instanteLocal(diaYMD: string, hhmm: string): number {
  return new Date(`${diaYMD}T${hhmm.slice(0, 5)}:00-03:00`).getTime();
}

/**
 * Horários livres de UM link, dia a dia, dentro da janela bookável.
 *
 * As armadilhas da spec (docs/plano-mentorias-fatia4.md), e onde cada uma é
 * resolvida:
 *
 * 1. a sessão tem de CABER na faixa — `cursor + duração <= fimFaixa` no
 *    guard do laço, antes de qualquer outra checagem.
 * 2. bloqueia contra TODAS as sessões do mentor, não só as deste link — quem
 *    chama já busca `ocupadas` sem filtrar por link_id.
 * 3. o intervalo conta DEPOIS da sessão existente: o bloqueio de cada
 *    ocupada vai até (fim + intervalo_min), e ao bater nele o cursor pula
 *    DIRETO pro fim do bloqueio — não para o próximo passo da grade.
 * 4. (Fatia 4b) o Google pessoal bloqueia do mesmo jeito — `bloqueiosGoogle`
 *    entra na mesma lista de `bloqueios`, já com o intervalo_min aplicado
 *    por quem montou (`bloqueiosGoogleDoLink`). O laço nem sabe a origem.
 */
function horariosLivresDoLink(params: {
  faixas: FaixaCalc[];
  ocupadas: OcupadaCalc[];
  bloqueiosGoogle: { inicio: number; fim: number }[];
  duracaoMin: number;
  intervaloMin: number;
  agora: Date;
  antecedenciaMinHoras: number;
  antecedenciaMaxDias: number;
  tetoPorDia: number | null;
  linkId: string;
}): { data: string; horarios: string[] }[] {
  const { faixas, duracaoMin, intervaloMin, agora, antecedenciaMinHoras, antecedenciaMaxDias, tetoPorDia, linkId } = params;
  const duracaoMs = duracaoMin * 60_000;

  const bloqueios = [
    ...params.ocupadas.map((o) => {
      const inicio = new Date(o.quando).getTime();
      const fimBase = o.termina_em ? new Date(o.termina_em).getTime() : inicio + DURACAO_PADRAO_MIN * 60_000;
      return { inicio, fim: fimBase + intervaloMin * 60_000 };
    }),
    ...params.bloqueiosGoogle,
  ];

  const contagemPorDia = new Map<string, number>();
  if (tetoPorDia != null) {
    for (const o of params.ocupadas) {
      if (o.link_id !== linkId) continue;
      const dia = diaLocal(new Date(o.quando));
      contagemPorDia.set(dia, (contagemPorDia.get(dia) ?? 0) + 1);
    }
  }

  const limiteMin = agora.getTime() + antecedenciaMinHoras * 3_600_000;
  const limiteMax = agora.getTime() + antecedenciaMaxDias * 86_400_000;

  const resultado: { data: string; horarios: string[] }[] = [];
  const diasNaJanela = Math.ceil(antecedenciaMaxDias) + 1;

  for (let offset = 0; offset <= diasNaJanela; offset++) {
    const dia = new Date(agora.getTime() + offset * 86_400_000);
    const diaYMD = diaLocal(dia);
    if (tetoPorDia != null && (contagemPorDia.get(diaYMD) ?? 0) >= tetoPorDia) continue;

    const semana = diaDaSemanaLocal(dia);
    const faixasDoDia = faixas.filter((f) => f.dia_semana === semana);
    if (faixasDoDia.length === 0) continue;

    const horariosDoDia: string[] = [];
    for (const faixa of faixasDoDia) {
      let cursor = instanteLocal(diaYMD, faixa.hora_inicio);
      const fimFaixa = instanteLocal(diaYMD, faixa.hora_fim);
      while (cursor + duracaoMs <= fimFaixa) {
        const fimCandidato = cursor + duracaoMs;
        const bloqueio = bloqueios.find((b) => cursor < b.fim && fimCandidato > b.inicio);
        if (bloqueio) {
          cursor = bloqueio.fim;
          continue;
        }
        if (cursor >= limiteMin && cursor <= limiteMax) {
          horariosDoDia.push(new Date(cursor).toISOString());
        }
        cursor = fimCandidato;
      }
    }
    if (horariosDoDia.length > 0) {
      resultado.push({ data: diaYMD, horarios: horariosDoDia.sort() });
    }
  }
  return resultado;
}

/**
 * Ocupado no Google PESSOAL do professor, dentro da janela — Fatia 4b.
 *
 * Cuidados combinados: se a conexão caiu ou a chamada falhar, o link NÃO
 * pode parar — devolve vazio (mostra sem o bloqueio pessoal) e registra o
 * erro em `google_conexoes.ultimo_erro`, mesmo padrão de sincronizar() em
 * google.server.ts. Uma chamada só para a janela inteira, nunca uma por
 * horário — freebusy tem custo.
 *
 * Calendário consultado: "primary" — o principal da conta, que é onde um
 * compromisso pessoal (dentista, barbeiro) cai por padrão no Google. Se
 * outro calendário também devesse bloquear, é decisão do professor, não
 * escolhida aqui — ver a lista em Configurações → Agenda.
 */
async function bloqueiosGoogleDoLink(
  supabaseAdmin: Cliente,
  link: LinkRow,
  janelaInicio: Date,
  janelaFim: Date,
): Promise<{ inicio: number; fim: number }[]> {
  if (!link.usa_google_freebusy) return [];
  try {
    const { data: conexao } = await supabaseAdmin
      .from("google_conexoes")
      .select("refresh_token")
      .eq("user_id", link.mentor_id)
      .maybeSingle();
    if (!conexao?.refresh_token) return [];

    const { renovarAcesso, consultarOcupado } = await import("@/lib/google.server");
    const acesso = await renovarAcesso(conexao.refresh_token);
    const ocupados = await consultarOcupado(acesso, ["primary"], janelaInicio.toISOString(), janelaFim.toISOString());
    return ocupados.map((o) => ({
      inicio: new Date(o.inicio).getTime(),
      fim: new Date(o.fim).getTime() + link.intervalo_min * 60_000,
    }));
  } catch (e) {
    try {
      await supabaseAdmin.from("google_conexoes")
        .update({ ultimo_erro: (e as Error).message.slice(0, 500) })
        .eq("user_id", link.mentor_id);
    } catch {
      // Nem o registro do erro pode derrubar o link.
    }
    return [];
  }
}

/** Busca única (disponibilidade + sessões ocupadas + Google pessoal) reaproveitada por listar e por confirmar. */
async function contextoDoLink(supabaseAdmin: Cliente, link: LinkRow, agora: Date) {
  const { data: faixas } = await supabaseAdmin
    .from("mentoria_disponibilidade")
    .select("dia_semana, hora_inicio, hora_fim")
    .eq("mentor_id", link.mentor_id)
    .eq("ativo", true);

  const janelaInicio = new Date(agora.getTime() - 86_400_000);
  const janelaFim = new Date(agora.getTime() + (link.antecedencia_max_dias + 1) * 86_400_000);
  const { data: sessoes } = await supabaseAdmin
    .from("mentoria_sessoes")
    .select("quando, termina_em, link_id")
    .eq("mentor_id", link.mentor_id)
    .eq("status", "agendada")
    .gte("quando", janelaInicio.toISOString())
    .lte("quando", janelaFim.toISOString());

  const bloqueiosGoogle = await bloqueiosGoogleDoLink(supabaseAdmin, link, janelaInicio, janelaFim);

  return { faixas: faixas ?? [], ocupadas: sessoes ?? [], bloqueiosGoogle };
}

function calcularDias(
  link: LinkRow,
  faixas: FaixaCalc[],
  ocupadas: OcupadaCalc[],
  bloqueiosGoogle: { inicio: number; fim: number }[],
  agora: Date,
) {
  return horariosLivresDoLink({
    faixas,
    ocupadas,
    bloqueiosGoogle,
    duracaoMin: link.duracao_min,
    intervaloMin: link.intervalo_min,
    agora,
    antecedenciaMinHoras: link.antecedencia_min_horas,
    antecedenciaMaxDias: link.antecedencia_max_dias,
    tetoPorDia: link.teto_por_dia,
    linkId: link.id,
  });
}

// ============================================================
// Público — /agendar/$slug (sem login)
// ============================================================

/** O que a página mostra antes mesmo de pedir o e-mail. */
export const dadosDoLink = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const supabaseAdmin = await admin();
    const { data: link } = await supabaseAdmin
      .from("mentoria_links")
      .select("titulo, descricao, duracao_min")
      .eq("slug", data.slug)
      .eq("ativo", true)
      .maybeSingle();
    if (!link) return { encontrado: false as const };
    return { encontrado: true as const, ...link };
  });

type Resolucao =
  | { status: "link_invalido" }
  | { status: "nao_cadastrado" }
  | { status: "sem_pacote_ativo" }
  | {
      status: "ok";
      link: LinkRow;
      pessoa: { id: string; full_name: string | null; email: string | null; user_id: string | null };
      mentoriaId: string;
    };

/**
 * Resolve {slug, email} → pessoa + pacote ativo, do zero, toda vez.
 *
 * Sem "não cadastrado" mascarado (diferente de `solicitarAcessoAluno`): a
 * spec pede clareza aqui porque a segurança do link está no slug secreto, não
 * em esconder quem está cadastrado — ver o cabeçalho do arquivo.
 *
 * "Sem pacote ativo" é uma decisão do meu lado, não pedida por escrito na
 * spec: recusar com mensagem clara em vez de criar um pacote sozinho. Pedir
 * pacote é decisão do professor (título, quantas sessões) — o link de
 * agendamento não deveria inventar isso. Se houver mais de um pacote ativo,
 * usa o mais recente.
 */
async function resolverPessoaEPacote(supabaseAdmin: Cliente, slug: string, email: string): Promise<Resolucao> {
  const { data: link } = await supabaseAdmin
    .from("mentoria_links")
    .select("*")
    .eq("slug", slug)
    .eq("ativo", true)
    .maybeSingle();
  if (!link) return { status: "link_invalido" };

  const { data: pessoa } = await supabaseAdmin
    .from("people")
    .select("id, full_name, email, user_id")
    .ilike("email", email.trim())
    .eq("mentor_id", link.mentor_id)
    .limit(1)
    .maybeSingle();
  if (!pessoa) return { status: "nao_cadastrado" };

  const { data: mentoria } = await supabaseAdmin
    .from("mentorias")
    .select("id")
    .eq("person_id", pessoa.id)
    .eq("status", "ativa")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!mentoria) return { status: "sem_pacote_ativo" };

  return { status: "ok", link, pessoa, mentoriaId: mentoria.id };
}

function mensagemDeRecusa(status: "link_invalido" | "nao_cadastrado" | "sem_pacote_ativo"): string {
  if (status === "link_invalido") return "Este link não existe ou foi desativado.";
  if (status === "nao_cadastrado") return "Este e-mail não está cadastrado. Fale com quem te enviou este link.";
  return "Você ainda não tem um pacote de mentoria ativo. Fale com quem te enviou este link.";
}

const emailSlugSchema = z.object({ slug: z.string().min(1).max(200), email: z.string().trim().email().max(200) });

export const verificarEmailAgendamento = createServerFn({ method: "POST" })
  .inputValidator((d) => emailSlugSchema.parse(d))
  .handler(async ({ data }) => {
    const supabaseAdmin = await admin();
    const r = await resolverPessoaEPacote(supabaseAdmin, data.slug, data.email);
    if (r.status !== "ok") return { status: r.status, mensagem: mensagemDeRecusa(r.status) };
    return { status: "ok" as const, nome: r.pessoa.full_name ?? "" };
  });

export const horariosLivresAgendamento = createServerFn({ method: "POST" })
  .inputValidator((d) => emailSlugSchema.parse(d))
  .handler(async ({ data }) => {
    const supabaseAdmin = await admin();
    const r = await resolverPessoaEPacote(supabaseAdmin, data.slug, data.email);
    if (r.status !== "ok") return { status: r.status, mensagem: mensagemDeRecusa(r.status) };

    const agora = new Date();
    const { faixas, ocupadas, bloqueiosGoogle } = await contextoDoLink(supabaseAdmin, r.link, agora);
    const dias = calcularDias(r.link, faixas, ocupadas, bloqueiosGoogle, agora);
    return { status: "ok" as const, duracao_min: r.link.duracao_min, dias };
  });

const confirmarSchema = z.object({
  slug: z.string().min(1).max(200),
  email: z.string().trim().email().max(200),
  quando: z.string().datetime({ offset: true }),
});

export const confirmarAgendamento = createServerFn({ method: "POST" })
  .inputValidator((d) => confirmarSchema.parse(d))
  .handler(async ({ data }) => {
    const supabaseAdmin = await admin();
    const r = await resolverPessoaEPacote(supabaseAdmin, data.slug, data.email);
    if (r.status !== "ok") throw new Error(mensagemDeRecusa(r.status));

    // Revalida contra um cálculo FRESCO — o horário pode ter sido ocupado
    // por outra pessoa entre a tela mostrar a lista e este clique (armadilha
    // 5 da spec). A trava de corrida no banco (EXCLUDE constraint) é o
    // último backstop, capturado abaixo.
    const agora = new Date();
    const { faixas, ocupadas, bloqueiosGoogle } = await contextoDoLink(supabaseAdmin, r.link, agora);
    const dias = calcularDias(r.link, faixas, ocupadas, bloqueiosGoogle, agora);
    const quandoNormalizado = new Date(data.quando).toISOString();
    const aindaLivre = dias.some((d) => d.horarios.includes(quandoNormalizado));
    if (!aindaLivre) throw new Error("Esse horário acabou de ser ocupado. Escolha outro, por favor.");

    const terminaEm = new Date(new Date(quandoNormalizado).getTime() + r.link.duracao_min * 60_000).toISOString();

    const { data: row, error } = await supabaseAdmin
      .from("mentoria_sessoes")
      .insert({
        mentoria_id: r.mentoriaId,
        mentor_id: r.link.mentor_id,
        quando: quandoNormalizado,
        termina_em: terminaEm,
        // Local/videoconferência ainda não são coletados nesta fatia (4c) —
        // "online" é o padrão mais flexível até o professor editar a sessão.
        modalidade: "online",
        origem: "link",
        link_id: r.link.id,
        confirmado_em: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) {
      if (error.message.includes("mentoria_sessoes_sem_sobreposicao")) {
        throw new Error("Esse horário acabou de ser ocupado. Escolha outro, por favor.");
      }
      throw new Error(error.message);
    }

    const { data: gruposDele } = await supabaseAdmin
      .from("group_members").select("group_id").eq("person_id", r.pessoa.id);
    const { notificar, quandoBr } = await import("@/lib/notificacoes.functions");
    await notificar(supabaseAdmin, {
      conta: r.link.mentor_id,
      tipo: "mentoria_agendada",
      titulo: `${r.pessoa.full_name ?? "Alguém"} agendou pelo link "${r.link.titulo}"`,
      corpo: quandoBr(quandoNormalizado),
      link: "/mentorias",
      ator: null,
      atorNome: r.pessoa.full_name,
      grupos: (gruposDele ?? []).map((g) => g.group_id),
      pessoaUser: r.pessoa.user_id,
    });

    // Mão única e silenciosa — mesmo princípio de agendarSessao.
    const { sincronizar } = await import("@/lib/google.server");
    await sincronizar(r.link.mentor_id, "mentoria", row.id, {
      titulo: `Mentoria · ${r.pessoa.full_name ?? "avaliado"}`,
      quando: quandoNormalizado,
      terminaEm,
    });

    await enviarConfirmacaoEmail(supabaseAdmin, r.link, r.pessoa, quandoNormalizado);

    return { ok: true as const, quando: quandoNormalizado, termina_em: terminaEm };
  });

async function enviarConfirmacaoEmail(
  supabaseAdmin: Cliente,
  link: LinkRow,
  pessoa: { full_name: string | null; email: string | null },
  quandoIso: string,
): Promise<void> {
  if (!pessoa.email) return;
  try {
    const { enviarEmail, montarHtml } = await import("@/lib/email.server");
    const { quandoBr } = await import("@/lib/notificacoes.functions");
    const { siteUrl } = await import("@/lib/site-url.server");
    const { data: perfil } = await supabaseAdmin
      .from("profiles")
      .select("company_name, brand_color, site_url, support_email, email_from")
      .eq("user_id", link.mentor_id)
      .maybeSingle();

    const nome = (pessoa.full_name ?? "").split(" ")[0] || "Olá";
    const marca = perfil?.company_name?.trim() || "Métrica Humana";
    const html = montarHtml({
      corpo:
        `${nome}, sua sessão "${link.titulo}" foi confirmada para ${quandoBr(quandoIso)} (horário de Brasília).\n\n` +
        "Se precisar remarcar ou tiver alguma dúvida, entre em contato com quem te enviou este link.",
      link: siteUrl(),
      rotuloBotao: "Visitar o site",
      marca: perfil ?? null,
    });
    await enviarEmail({
      to: pessoa.email,
      subject: `Sessão confirmada: ${link.titulo}`,
      html,
      from: perfil?.email_from ?? null,
      replyTo: perfil?.support_email ?? null,
    });
  } catch {
    // Nunca derruba o agendamento — mesmo princípio de sincronizar()/notificar().
  }
}
