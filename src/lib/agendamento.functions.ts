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
import { exigirPermissao, exigirPermissaoOuMentor } from "@/lib/permissao.server";
import { MODALIDADES } from "@/lib/mentorias.functions";
import { urlOpcional } from "@/lib/url-segura";
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
        "id, slug, titulo, descricao, duracao_min, intervalo_min, antecedencia_min_horas, antecedencia_max_dias, teto_por_dia, permite_cancelar, permite_remarcar, cancelamento_min_horas, max_remarcacoes, modalidade, local, link_url, ativo, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { links: data ?? [] };
  });

/**
 * Só o essencial para o seletor do formulário de pacote (#255) — não a
 * config completa do link. Gate mais largo que `listarLinks`
 * (`exigirPermissaoOuMentor`, não `exigirPermissao`): quem cria pacote como
 * mentor de grupo, sem a permissão inteira de administrar links, ainda
 * precisa poder ESCOLHER entre os links que já existem.
 */
export const listarLinksAtivos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPermissaoOuMentor(context.supabase, context.userId, "mentorias");
    const { data, error } = await context.supabase
      .from("mentoria_links")
      .select("id, titulo, duracao_min")
      .eq("ativo", true)
      .order("titulo", { ascending: true });
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
  permite_cancelar: z.boolean().default(false),
  permite_remarcar: z.boolean().default(false),
  cancelamento_min_horas: z.number().int().min(0).max(999).default(24),
  max_remarcacoes: z.number().int().min(0).max(50).default(2),
  // #248: de onde a sessão nasce. Mesmo raciocínio de agendarSessao
  // (mentorias.functions.ts) — "" é "sem link", não "URL inválida".
  modalidade: z.enum(MODALIDADES).default("online"),
  local: z.string().trim().max(500).optional().nullable(),
  link_url: urlOpcional,
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
        permite_cancelar: data.permite_cancelar,
        permite_remarcar: data.permite_remarcar,
        cancelamento_min_horas: data.cancelamento_min_horas,
        max_remarcacoes: data.max_remarcacoes,
        modalidade: data.modalidade,
        local: data.modalidade === "presencial" ? (data.local?.trim() || null) : null,
        link_url: data.modalidade === "online" ? (data.link_url?.trim() || null) : null,
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
  permite_cancelar: z.boolean().optional(),
  permite_remarcar: z.boolean().optional(),
  cancelamento_min_horas: z.number().int().min(0).max(999).optional(),
  max_remarcacoes: z.number().int().min(0).max(50).optional(),
  modalidade: z.enum(MODALIDADES).optional(),
  local: z.string().trim().max(500).optional().nullable(),
  link_url: urlOpcional,
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
    if (campos.permite_cancelar !== undefined) patch.permite_cancelar = campos.permite_cancelar;
    if (campos.permite_remarcar !== undefined) patch.permite_remarcar = campos.permite_remarcar;
    if (campos.cancelamento_min_horas !== undefined) patch.cancelamento_min_horas = campos.cancelamento_min_horas;
    if (campos.max_remarcacoes !== undefined) patch.max_remarcacoes = campos.max_remarcacoes;
    // Par dependente: só troca modalidade quando ela vem no mesmo salvar que
    // local/link_url (o formulário sempre manda os três juntos) — limpa o
    // campo que deixou de valer, mesma regra de criarLink.
    if (campos.modalidade !== undefined) {
      patch.modalidade = campos.modalidade;
      patch.local = campos.modalidade === "presencial" ? (campos.local?.trim() || null) : null;
      patch.link_url = campos.modalidade === "online" ? (campos.link_url?.trim() || null) : null;
    }
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

/**
 * Busca única (disponibilidade + sessões ocupadas + Google pessoal) reaproveitada
 * por listar, confirmar e remarcar.
 *
 * `excluirSessaoId` existe só para a remarcação (Fatia 4b Parte 2): o horário
 * ATUAL da sessão sendo remarcada não pode aparecer como ocupado por si mesma —
 * senão o próprio horário que a pessoa já tem sumiria da lista de opções.
 */
async function contextoDoLink(supabaseAdmin: Cliente, link: LinkRow, agora: Date, excluirSessaoId?: string) {
  const { data: faixas } = await supabaseAdmin
    .from("mentoria_disponibilidade")
    .select("dia_semana, hora_inicio, hora_fim")
    .eq("mentor_id", link.mentor_id)
    .eq("ativo", true);

  const janelaInicio = new Date(agora.getTime() - 86_400_000);
  const janelaFim = new Date(agora.getTime() + (link.antecedencia_max_dias + 1) * 86_400_000);
  let consultaSessoes = supabaseAdmin
    .from("mentoria_sessoes")
    .select("quando, termina_em, link_id")
    .eq("mentor_id", link.mentor_id)
    .eq("status", "agendada")
    .gte("quando", janelaInicio.toISOString())
    .lte("quando", janelaFim.toISOString());
  if (excluirSessaoId) consultaSessoes = consultaSessoes.neq("id", excluirSessaoId);
  const { data: sessoes } = await consultaSessoes;

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

/**
 * O que a página mostra antes mesmo de pedir o e-mail.
 *
 * `professor_foto_url` é o endereço ESTÁVEL de `/api/mentor-foto/$slug`
 * (nunca a URL assinada em si — mesmo padrão de `/api/icone/$tamanho`, ver o
 * cabeçalho daquele arquivo) — funciona mesmo sem saber de antemão se o
 * professor tem foto; sem foto, a rota devolve 404 e a tela esconde a
 * imagem sozinha.
 */
export const dadosDoLink = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const supabaseAdmin = await admin();
    const { data: link } = await supabaseAdmin
      .from("mentoria_links")
      .select("titulo, descricao, duracao_min, modalidade, local, link_url, mentor_id")
      .eq("slug", data.slug)
      .eq("ativo", true)
      .maybeSingle();
    if (!link) return { encontrado: false as const };
    const { mentor_id, ...resto } = link;
    return {
      encontrado: true as const,
      ...resto,
      professor_nome: await nomeDoProfessor(supabaseAdmin, mentor_id),
      professor_foto_url: `/api/mentor-foto/${data.slug}`,
    };
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
        // #248: o local/link vem do LINK — configurado uma vez, toda sessão
        // criada por ele já nasce certa.
        modalidade: r.link.modalidade,
        local: r.link.local,
        link_url: r.link.link_url,
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

    await enviarConfirmacaoEmail(supabaseAdmin, r.link, r.pessoa, quandoNormalizado, row.id);

    return { ok: true as const, quando: quandoNormalizado, termina_em: terminaEm };
  });

/** #248: "Presencial: endereço." ou "Online: link." — usada no email e em /sessao/$id (via a mesma leitura da sessão). */
function ondeTexto(modalidade: string, local: string | null, linkUrl: string | null): string {
  if (modalidade === "presencial") return local ? `Presencial: ${local}.` : "Presencial — endereço a combinar com quem te enviou este link.";
  return linkUrl ? `Online: ${linkUrl}` : "Online — link da chamada a combinar com quem te enviou este link.";
}

async function enviarConfirmacaoEmail(
  supabaseAdmin: Cliente,
  link: LinkRow,
  pessoa: { full_name: string | null; email: string | null },
  quandoIso: string,
  sessaoId: string,
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
    const onde = ondeTexto(link.modalidade, link.local, link.link_url);

    // Só troca para o texto/link da página de gerenciar quando pelo menos uma
    // das duas chaves está ligada NESTE link (Fatia 4b Parte 2) — com as duas
    // desligadas, o texto de sempre continua sendo o certo.
    const gerenciavel = link.permite_cancelar || link.permite_remarcar;
    const html = montarHtml({
      corpo: gerenciavel
        ? `${nome}, sua sessão "${link.titulo}" foi confirmada para ${quandoBr(quandoIso)} (horário de Brasília).\n\n` +
          `${onde}\n\n` +
          "Se precisar cancelar ou remarcar, use o botão abaixo."
        : `${nome}, sua sessão "${link.titulo}" foi confirmada para ${quandoBr(quandoIso)} (horário de Brasília).\n\n` +
          `${onde}\n\n` +
          "Se precisar remarcar ou tiver alguma dúvida, entre em contato com quem te enviou este link.",
      link: gerenciavel ? `${siteUrl()}/sessao/${sessaoId}` : siteUrl(),
      rotuloBotao: gerenciavel ? "Gerenciar sessão" : "Visitar o site",
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

// ============================================================
// Público — gerenciar sessão já marcada (/sessao/$id, sem login)
//
// Fatia 4b Parte 2. O `id` é o uuid da própria mentoria_sessoes, usado como
// token — mesmo padrão do slug do link: segredo o bastante por ser um uuid,
// sem exigir login. O endpoint devolve o MÍNIMO (título, quando, duração,
// nome do professor) — nunca e-mail, mentor_id ou id de pacote.
// ============================================================

const idSchema = z.object({ id: z.string().uuid() });

export type Elegibilidade = { sim: true } | { sim: false; motivo: string };

/**
 * A MESMA regra usada para decidir o que a tela mostra (aqui) e para barrar
 * de verdade no servidor (`exigirElegibilidade`, logo abaixo) — uma calcula,
 * a outra só decide se lança. Sem isto, era fácil os dois lados divergirem
 * com o tempo. Exportada porque o #255 reaproveita esta MESMA função para
 * decidir cancelar/remarcar dentro do painel logado do aluno — nunca uma
 * segunda cópia da regra (student.functions.ts:getMinhasMentorias).
 */
export function calcularElegibilidade(
  sessao: { quando: string; remarcacoes: number },
  link: LinkRow,
  acao: "cancelar" | "remarcar",
  nomeProfessor: string,
): Elegibilidade {
  const habilitado = acao === "cancelar" ? link.permite_cancelar : link.permite_remarcar;
  if (!habilitado) {
    return {
      sim: false,
      motivo: acao === "cancelar"
        ? `Cancelamentos não estão habilitados para esta sessão. Fale com ${nomeProfessor}.`
        : `Remarcações não estão habilitadas para esta sessão. Fale com ${nomeProfessor}.`,
    };
  }
  if (acao === "remarcar" && sessao.remarcacoes >= link.max_remarcacoes) {
    return {
      sim: false,
      motivo: `Você já remarcou esta sessão ${link.max_remarcacoes === 1 ? "1 vez" : `${link.max_remarcacoes} vezes`}. Fale com ${nomeProfessor} para trocar.`,
    };
  }
  const horasAteSessao = (new Date(sessao.quando).getTime() - Date.now()) / 3_600_000;
  if (horasAteSessao < link.cancelamento_min_horas) {
    const prazo = link.cancelamento_min_horas === 1 ? "1 hora" : `${link.cancelamento_min_horas} horas`;
    return {
      sim: false,
      motivo: acao === "cancelar"
        ? `Sessões só podem ser desmarcadas até ${prazo} antes.`
        : `Sessões só podem ser remarcadas até ${prazo} antes.`,
    };
  }
  return { sim: true };
}

/** Mesma checagem de `calcularElegibilidade`, mas lançando — para os endpoints que AGEM, não só mostram. */
function exigirElegibilidade(
  sessao: { quando: string; remarcacoes: number },
  link: LinkRow,
  acao: "cancelar" | "remarcar",
  nomeProfessor: string,
): void {
  const r = calcularElegibilidade(sessao, link, acao, nomeProfessor);
  if (!r.sim) throw new Error(r.motivo);
}

/** Nome do professor para as mensagens ("fale com fulano") — nunca o e-mail dele. */
export async function nomeDoProfessor(supabaseAdmin: Cliente, mentorId: string): Promise<string> {
  const { data } = await supabaseAdmin.from("profiles").select("full_name").eq("user_id", mentorId).maybeSingle();
  return data?.full_name?.trim() || "quem te enviou este link";
}

/** O que a página /sessao/$id mostra — nunca e-mail, mentor_id ou id de pacote. */
export const dadosDaSessao = createServerFn({ method: "GET" })
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data }) => {
    const supabaseAdmin = await admin();
    const { data: sessao } = await supabaseAdmin
      .from("mentoria_sessoes")
      .select("id, quando, termina_em, status, remarcacoes, mentor_id, link_id, modalidade, local, link_url")
      .eq("id", data.id)
      .maybeSingle();
    if (!sessao) return { encontrada: false as const };

    const link = sessao.link_id
      ? (await supabaseAdmin.from("mentoria_links").select("*").eq("id", sessao.link_id).maybeSingle()).data
      : null;
    const nomeProfessor = await nomeDoProfessor(supabaseAdmin, sessao.mentor_id);
    const duracaoMin = link?.duracao_min
      ?? (sessao.termina_em
        ? Math.round((new Date(sessao.termina_em).getTime() - new Date(sessao.quando).getTime()) / 60_000)
        : 60);

    const base = {
      encontrada: true as const,
      titulo: link?.titulo ?? "Sessão de mentoria",
      quando: sessao.quando,
      duracao_min: duracaoMin,
      professor: nomeProfessor,
      // #248: onde é a sessão — o registro fica na SESSÃO (cópia feita na hora
      // de agendar), não recalculado do link, para não mudar de baixo de quem
      // já agendou se o professor editar o link depois.
      onde: ondeTexto(sessao.modalidade, sessao.local, sessao.link_url),
    };

    // Já cancelada ou concluída: modo leitura, sem botão nenhum — a spec pede
    // isto explicitamente, e faz sentido: não há mais o que desmarcar ou trocar.
    if (sessao.status !== "agendada") {
      return { ...base, status: sessao.status as "cancelada" | "concluida", podeCancelar: { sim: false as const }, podeRemarcar: { sim: false as const } };
    }

    if (!link) {
      const semLink: Elegibilidade = { sim: false, motivo: `Esta sessão não pode ser gerenciada por aqui. Fale com ${nomeProfessor}.` };
      return { ...base, status: "agendada" as const, podeCancelar: semLink, podeRemarcar: semLink };
    }

    return {
      ...base,
      status: "agendada" as const,
      podeCancelar: calcularElegibilidade(sessao, link, "cancelar", nomeProfessor),
      podeRemarcar: calcularElegibilidade(sessao, link, "remarcar", nomeProfessor),
    };
  });

/**
 * Avisa o professor de um cancelamento ou remarcação feito pelo ALUNO — os
 * dois canais que o Matheus decidiu: notificação no sino + e-mail. Silenciosa
 * de propósito, do início ao fim: o aluno já cancelou/remarcou, o aviso é
 * consequência, nunca condição (mesmo princípio de sincronizar()/notificar()).
 */
async function avisarProfessor(
  supabaseAdmin: Cliente,
  args: {
    mentorId: string;
    mentoriaId: string;
    linkTitulo: string;
    quandoOriginal: string;
    quandoNovo?: string;
    tipo: "cancelada" | "remarcada";
  },
): Promise<void> {
  try {
    const { data: mentoria } = await supabaseAdmin
      .from("mentorias").select("person_id").eq("id", args.mentoriaId).maybeSingle();
    const personId = mentoria?.person_id ?? null;
    const [{ data: pessoa }, { data: gruposDele }] = await Promise.all([
      personId
        ? supabaseAdmin.from("people").select("full_name, user_id").eq("id", personId).maybeSingle()
        : Promise.resolve({ data: null }),
      personId
        ? supabaseAdmin.from("group_members").select("group_id").eq("person_id", personId)
        : Promise.resolve({ data: [] as Array<{ group_id: string }> }),
    ]);

    const { notificar, quandoBr } = await import("@/lib/notificacoes.functions");
    const nome = pessoa?.full_name ?? "Alguém";
    const titulo = args.tipo === "cancelada"
      ? `${nome} cancelou a sessão "${args.linkTitulo}"`
      : `${nome} remarcou a sessão "${args.linkTitulo}"`;
    const corpo = args.tipo === "cancelada"
      ? `Era ${quandoBr(args.quandoOriginal)}.`
      : `Era ${quandoBr(args.quandoOriginal)}, agora é ${quandoBr(args.quandoNovo!)}.`;

    await notificar(supabaseAdmin, {
      conta: args.mentorId,
      tipo: args.tipo === "cancelada" ? "sessao_cancelada" : "sessao_remarcada",
      titulo,
      corpo,
      link: "/mentorias",
      ator: null,
      atorNome: nome,
      grupos: (gruposDele ?? []).map((g) => g.group_id),
      pessoaUser: pessoa?.user_id ?? null,
    });

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(args.mentorId);
    const emailProfessor = userData?.user?.email;
    if (emailProfessor) {
      const { enviarEmail, montarHtml } = await import("@/lib/email.server");
      const { siteUrl } = await import("@/lib/site-url.server");
      const { data: perfil } = await supabaseAdmin
        .from("profiles")
        .select("company_name, brand_color, site_url, support_email, email_from")
        .eq("user_id", args.mentorId)
        .maybeSingle();
      const html = montarHtml({
        corpo: `${titulo}. ${corpo}`,
        link: `${siteUrl()}/mentorias`,
        rotuloBotao: "Ver em Mentorias",
        marca: perfil ?? null,
      });
      await enviarEmail({
        to: emailProfessor,
        subject: args.tipo === "cancelada" ? `Sessão cancelada: ${args.linkTitulo}` : `Sessão remarcada: ${args.linkTitulo}`,
        html,
        from: perfil?.email_from ?? null,
        replyTo: perfil?.support_email ?? null,
      });
    }
  } catch {
    // Ver o comentário acima: o aviso nunca derruba a ação do aluno.
  }
}

export const cancelarSessaoAluno = createServerFn({ method: "POST" })
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data }) => {
    const supabaseAdmin = await admin();
    const { data: sessao, error: eS } = await supabaseAdmin
      .from("mentoria_sessoes")
      .select("id, mentor_id, mentoria_id, status, quando, link_id, remarcacoes")
      .eq("id", data.id)
      .maybeSingle();
    if (eS) throw new Error(eS.message);
    if (!sessao) throw new Error("Sessão não encontrada.");
    if (sessao.status !== "agendada") throw new Error("Esta sessão já não está mais agendada.");
    if (!sessao.link_id) throw new Error("Esta sessão não pode ser gerenciada por aqui.");

    const { data: link } = await supabaseAdmin.from("mentoria_links").select("*").eq("id", sessao.link_id).maybeSingle();
    if (!link) throw new Error("Esta sessão não pode ser gerenciada por aqui.");
    const nomeProfessor = await nomeDoProfessor(supabaseAdmin, sessao.mentor_id);
    // Revalida TUDO no servidor — a tela pode estar aberta há um tempo, e
    // quem guarda o endereço poderia tentar depois do prazo mudar sozinho.
    exigirElegibilidade(sessao, link, "cancelar", nomeProfessor);

    const { data: atualizado, error } = await supabaseAdmin
      .from("mentoria_sessoes")
      .update({ status: "cancelada", cancelada_em: new Date().toISOString(), cancelada_por: "aluno" })
      .eq("id", data.id)
      .eq("status", "agendada")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!atualizado) throw new Error("Esta sessão já não está mais agendada.");

    // Mão única, silenciosa — mesmo princípio de agendarSessao/confirmarAgendamento.
    const { sincronizar } = await import("@/lib/google.server");
    await sincronizar(sessao.mentor_id, "mentoria", sessao.id, null);

    await avisarProfessor(supabaseAdmin, {
      mentorId: sessao.mentor_id,
      mentoriaId: sessao.mentoria_id,
      linkTitulo: link.titulo,
      quandoOriginal: sessao.quando,
      tipo: "cancelada",
    });

    return { ok: true as const };
  });

/** Horários livres para REMARCAR — igual ao de /agendar/$slug, mas com o
 * horário atual da própria sessão excluído da lista de ocupados. */
export const horariosParaRemarcar = createServerFn({ method: "POST" })
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data }) => {
    const supabaseAdmin = await admin();
    const { data: sessao } = await supabaseAdmin
      .from("mentoria_sessoes")
      .select("id, mentor_id, status, quando, link_id, remarcacoes")
      .eq("id", data.id)
      .maybeSingle();
    if (!sessao) throw new Error("Sessão não encontrada.");
    if (sessao.status !== "agendada") throw new Error("Esta sessão já não está mais agendada.");
    if (!sessao.link_id) throw new Error("Esta sessão não pode ser gerenciada por aqui.");

    const { data: link } = await supabaseAdmin.from("mentoria_links").select("*").eq("id", sessao.link_id).maybeSingle();
    if (!link) throw new Error("Esta sessão não pode ser gerenciada por aqui.");
    const nomeProfessor = await nomeDoProfessor(supabaseAdmin, sessao.mentor_id);
    exigirElegibilidade(sessao, link, "remarcar", nomeProfessor);

    const agora = new Date();
    const { faixas, ocupadas, bloqueiosGoogle } = await contextoDoLink(supabaseAdmin, link, agora, sessao.id);
    const dias = calcularDias(link, faixas, ocupadas, bloqueiosGoogle, agora);
    return { status: "ok" as const, duracao_min: link.duracao_min, dias };
  });

const remarcarSchema = z.object({ id: z.string().uuid(), quando: z.string().datetime({ offset: true }) });

export const remarcarSessaoAluno = createServerFn({ method: "POST" })
  .inputValidator((d) => remarcarSchema.parse(d))
  .handler(async ({ data }) => {
    const supabaseAdmin = await admin();
    const { data: sessao, error: eS } = await supabaseAdmin
      .from("mentoria_sessoes")
      .select("id, mentor_id, mentoria_id, status, quando, link_id, remarcacoes")
      .eq("id", data.id)
      .maybeSingle();
    if (eS) throw new Error(eS.message);
    if (!sessao) throw new Error("Sessão não encontrada.");
    if (sessao.status !== "agendada") throw new Error("Esta sessão já não está mais agendada.");
    if (!sessao.link_id) throw new Error("Esta sessão não pode ser gerenciada por aqui.");

    const { data: link } = await supabaseAdmin.from("mentoria_links").select("*").eq("id", sessao.link_id).maybeSingle();
    if (!link) throw new Error("Esta sessão não pode ser gerenciada por aqui.");
    const nomeProfessor = await nomeDoProfessor(supabaseAdmin, sessao.mentor_id);
    exigirElegibilidade(sessao, link, "remarcar", nomeProfessor);

    // Revalida contra um cálculo FRESCO, excluindo a própria sessão — mesma
    // armadilha (e mesma solução) de confirmarAgendamento: o horário pode ter
    // sido ocupado por outra sessão entre a tela mostrar a lista e este clique.
    const agora = new Date();
    const { faixas, ocupadas, bloqueiosGoogle } = await contextoDoLink(supabaseAdmin, link, agora, sessao.id);
    const dias = calcularDias(link, faixas, ocupadas, bloqueiosGoogle, agora);
    const quandoNormalizado = new Date(data.quando).toISOString();
    const aindaLivre = dias.some((d) => d.horarios.includes(quandoNormalizado));
    if (!aindaLivre) throw new Error("Esse horário acabou de ser ocupado. Escolha outro, por favor.");

    const terminaEm = new Date(new Date(quandoNormalizado).getTime() + link.duracao_min * 60_000).toISOString();
    const quandoOriginal = sessao.quando;

    // Um UPDATE só: grava o horário novo NA MESMA LINHA e incrementa o
    // contador junto — nunca dois passos separados, que deixariam a sessão
    // sem horário nenhum por um instante. A trava de corrida de verdade é a
    // EXCLUDE constraint do banco, capturada abaixo (mesmo padrão de confirmarAgendamento).
    const { data: atualizado, error } = await supabaseAdmin
      .from("mentoria_sessoes")
      .update({ quando: quandoNormalizado, termina_em: terminaEm, remarcacoes: sessao.remarcacoes + 1 })
      .eq("id", data.id)
      .eq("status", "agendada")
      .select("id")
      .maybeSingle();
    if (error) {
      if (error.message.includes("mentoria_sessoes_sem_sobreposicao")) {
        throw new Error("Esse horário acabou de ser ocupado. Escolha outro, por favor.");
      }
      throw new Error(error.message);
    }
    if (!atualizado) throw new Error("Esta sessão já não está mais agendada.");

    // Mão única, silenciosa — sincronizar() já faz PATCH no evento existente
    // (não cria duplicata), então o compromisso no Google do professor
    // simplesmente muda de horário junto.
    const { sincronizar } = await import("@/lib/google.server");
    const { data: mentoriaComPessoa } = await supabaseAdmin
      .from("mentorias").select("people(full_name)").eq("id", sessao.mentoria_id).maybeSingle();
    const nomePessoa = (mentoriaComPessoa?.people as unknown as { full_name: string | null } | null)?.full_name;
    await sincronizar(sessao.mentor_id, "mentoria", sessao.id, {
      titulo: `Mentoria · ${nomePessoa ?? "avaliado"}`,
      quando: quandoNormalizado,
      terminaEm,
    });

    await avisarProfessor(supabaseAdmin, {
      mentorId: sessao.mentor_id,
      mentoriaId: sessao.mentoria_id,
      linkTitulo: link.titulo,
      quandoOriginal,
      quandoNovo: quandoNormalizado,
      tipo: "remarcada",
    });

    return { ok: true as const, quando: quandoNormalizado, termina_em: terminaEm };
  });

// ============================================================
// Autenticado — o aluno agenda pelo próprio painel (#255)
//
// Mesmo cálculo de horários livres (contextoDoLink/calcularDias) que o link
// público usa — só muda a porta de entrada: aqui o aluno já está logado,
// identificado pela sessão, nunca por e-mail solto. O pacote (mentorias)
// aponta o link a usar; o professor escolhe isso ao criar/editar o pacote.
//
// A armadilha do #243: em "Ver como aluno" quem está autenticado de verdade
// é o DONO, e a RLS dele libera tudo. `pessoaIdsDoAluno` resolve a pessoa (ou
// as pessoas) alcançável pela sessão atual — o alvo do preview, ou as
// pessoas do próprio aluno — e `mentoriaDoAlunoParaAgendar` confere que a
// mentoria pedida é de UMA DESSAS pessoas antes de fazer qualquer coisa.
// Nunca confia no preview_person_id sozinho.
// ============================================================

/** Pessoa(s) alcançável(is) pela sessão atual — o alvo do preview, ou as pessoas do próprio aluno logado. */
async function pessoaIdsDoAluno(supabase: Cliente, userId: string, previewPersonId?: string | null): Promise<string[]> {
  if (previewPersonId) {
    const { data, error } = await supabase.from("people").select("id").eq("id", previewPersonId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Avaliado não encontrado ou fora do seu acesso.");
    return [data.id];
  }
  const { error: claimErr } = await supabase.rpc("claim_student_profile");
  if (claimErr) throw new Error(claimErr.message);
  await supabase.rpc("claim_team_membership");
  // Filtra por user_id = auth.uid() em vez de confiar só na RLS de people: para
  // o aluno o resultado já era 1 linha (a policy limita a isso), mas para o
  // dono/colaborador abrindo o próprio painel de aluno sem preview, a RLS
  // enxerga TODAS as pessoas com login da conta — sem este filtro, agendaria
  // no pacote de qualquer uma delas sem passar pelo "Ver como aluno".
  const { data, error } = await supabase.from("people").select("id").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => p.id);
}

type MentoriaParaAgendar = {
  id: string; mentor_id: string; person_id: string; status: string; sessoes_contratadas: number; link_id: string | null;
};

/** Busca por admin (o aluno não tem RLS sobre o pacote de outra pessoa) e confere dono contra pessoaIds — nunca confia no preview sozinho. */
async function mentoriaDoAlunoParaAgendar(
  supabaseAdmin: Cliente,
  mentoriaId: string,
  pessoaIds: string[],
): Promise<MentoriaParaAgendar> {
  const { data: mentoria, error } = await supabaseAdmin
    .from("mentorias")
    .select("id, mentor_id, person_id, status, sessoes_contratadas, link_id")
    .eq("id", mentoriaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!mentoria || !pessoaIds.includes(mentoria.person_id)) {
    throw new Error("Mentoria não encontrada ou fora do seu acesso.");
  }
  if (mentoria.status !== "ativa") throw new Error("Este pacote não está mais ativo.");
  return mentoria;
}

/** Mesma frase nos dois casos (sem link / link desativado) — spec #255. */
async function linkAtivoDoPacote(supabaseAdmin: Cliente, mentoria: MentoriaParaAgendar, nomeProfessor: string): Promise<LinkRow> {
  const semLink = `Ainda não dá para agendar sozinho por aqui. Fale com ${nomeProfessor} para marcar.`;
  if (!mentoria.link_id) throw new Error(semLink);
  const { data: link } = await supabaseAdmin.from("mentoria_links").select("*").eq("id", mentoria.link_id).maybeSingle();
  if (!link || !link.ativo) throw new Error(semLink);
  return link;
}

/** Mesma fórmula de mentorias.functions.ts (listMentorias/getMentoria): contratadas − realizadas − agendadas futuras. Nunca recalculada com outra lógica. */
async function faltamDoPacote(supabaseAdmin: Cliente, mentoria: MentoriaParaAgendar): Promise<number> {
  const { data: sessoes } = await supabaseAdmin
    .from("mentoria_sessoes").select("status, quando").eq("mentoria_id", mentoria.id);
  const agora = Date.now();
  const lista = sessoes ?? [];
  const realizadas = lista.filter((s) => s.status === "concluida").length;
  const agendadas = lista.filter((s) => s.status === "agendada" && new Date(s.quando).getTime() >= agora).length;
  return Math.max(0, mentoria.sessoes_contratadas - realizadas - agendadas);
}

const mentoriaParaAgendarSchema = z.object({
  mentoria_id: z.string().uuid(),
  preview_person_id: z.string().uuid().nullable().optional(),
});

export const horariosParaAgendarNoPainel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => mentoriaParaAgendarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await admin();
    const pessoaIds = await pessoaIdsDoAluno(context.supabase, context.userId, data.preview_person_id);
    const mentoria = await mentoriaDoAlunoParaAgendar(supabaseAdmin, data.mentoria_id, pessoaIds);
    const nomeProfessor = await nomeDoProfessor(supabaseAdmin, mentoria.mentor_id);
    const link = await linkAtivoDoPacote(supabaseAdmin, mentoria, nomeProfessor);
    const faltam = await faltamDoPacote(supabaseAdmin, mentoria);
    if (faltam <= 0) throw new Error(`Suas ${mentoria.sessoes_contratadas} sessões já estão marcadas ou realizadas.`);

    const agora = new Date();
    const { faixas, ocupadas, bloqueiosGoogle } = await contextoDoLink(supabaseAdmin, link, agora);
    const dias = calcularDias(link, faixas, ocupadas, bloqueiosGoogle, agora);
    return { status: "ok" as const, duracao_min: link.duracao_min, dias };
  });

const agendarNoPainelSchema = z.object({
  mentoria_id: z.string().uuid(),
  quando: z.string().datetime({ offset: true }),
  preview_person_id: z.string().uuid().nullable().optional(),
});

export const agendarNoPainel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => agendarNoPainelSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await admin();
    const pessoaIds = await pessoaIdsDoAluno(context.supabase, context.userId, data.preview_person_id);
    const mentoria = await mentoriaDoAlunoParaAgendar(supabaseAdmin, data.mentoria_id, pessoaIds);
    const nomeProfessor = await nomeDoProfessor(supabaseAdmin, mentoria.mentor_id);
    const link = await linkAtivoDoPacote(supabaseAdmin, mentoria, nomeProfessor);
    const faltam = await faltamDoPacote(supabaseAdmin, mentoria);
    if (faltam <= 0) throw new Error(`Suas ${mentoria.sessoes_contratadas} sessões já estão marcadas ou realizadas.`);

    // Revalida contra um cálculo FRESCO — mesma armadilha de confirmarAgendamento:
    // o horário pode ter sido ocupado entre a tela mostrar a lista e este clique.
    const agora = new Date();
    const { faixas, ocupadas, bloqueiosGoogle } = await contextoDoLink(supabaseAdmin, link, agora);
    const dias = calcularDias(link, faixas, ocupadas, bloqueiosGoogle, agora);
    const quandoNormalizado = new Date(data.quando).toISOString();
    const aindaLivre = dias.some((d) => d.horarios.includes(quandoNormalizado));
    if (!aindaLivre) throw new Error("Esse horário acabou de ser ocupado. Escolha outro, por favor.");

    const terminaEm = new Date(new Date(quandoNormalizado).getTime() + link.duracao_min * 60_000).toISOString();
    const { data: pessoa } = await supabaseAdmin
      .from("people").select("full_name, user_id").eq("id", mentoria.person_id).maybeSingle();

    const { data: row, error } = await supabaseAdmin
      .from("mentoria_sessoes")
      .insert({
        mentoria_id: mentoria.id,
        mentor_id: mentoria.mentor_id,
        quando: quandoNormalizado,
        termina_em: terminaEm,
        // #248: mesma herança de confirmarAgendamento — o local/link vem do LINK.
        modalidade: link.modalidade,
        local: link.local,
        link_url: link.link_url,
        origem: "painel",
        link_id: link.id,
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
      .from("group_members").select("group_id").eq("person_id", mentoria.person_id);
    const { notificar, quandoBr } = await import("@/lib/notificacoes.functions");
    await notificar(supabaseAdmin, {
      conta: mentoria.mentor_id,
      tipo: "mentoria_agendada",
      titulo: `${pessoa?.full_name ?? "Alguém"} agendou pelo painel`,
      corpo: quandoBr(quandoNormalizado),
      link: "/mentorias",
      ator: null,
      atorNome: pessoa?.full_name ?? null,
      grupos: (gruposDele ?? []).map((g) => g.group_id),
      pessoaUser: pessoa?.user_id ?? null,
    });

    // Mão única, silenciosa — mesmo princípio de confirmarAgendamento.
    const { sincronizar } = await import("@/lib/google.server");
    await sincronizar(mentoria.mentor_id, "mentoria", row.id, {
      titulo: `Mentoria · ${pessoa?.full_name ?? "avaliado"}`,
      quando: quandoNormalizado,
      terminaEm,
    });

    return { ok: true as const, quando: quandoNormalizado, termina_em: terminaEm };
  });

// ============================================================
// Autenticado — o professor cancela e remarca pela própria tela (#257)
//
// As regras do aluno (prazo mínimo, teto de remarcações, grade de
// disponibilidade) existem para conter o ALUNO. O professor é o dono da
// agenda: desmarca a qualquer momento, remarca quantas vezes precisar, e
// escolhe QUALQUER horário livre — não fica preso à própria
// mentoria_disponibilidade, que é o que ele aceita pelo link público, não o
// que ele pode atender. Por isso `exigirElegibilidade` NUNCA entra aqui, e
// `remarcacoes` (o contador do teto do aluno) nunca é incrementado por uma
// remarcação do professor.
//
// `cancelarSessaoMentoria` (o cancelamento em si) mora em mentorias.functions.ts,
// junto do resto do CRUD de sessão do professor — só o aviso ao aluno
// (avisarAluno, abaixo) mora aqui, perto do seu espelho avisarProfessor.
// ============================================================

/** Janela ampla e fixa — não há link nem disponibilidade para definir o "horário de funcionamento" do professor remarcando por conta própria. */
const JANELA_PROFESSOR_INICIO = "07:00";
const JANELA_PROFESSOR_FIM = "21:00";
const JANELA_PROFESSOR_DIAS = 90;

/**
 * Horários livres do PROFESSOR remarcando — só evita bater em outra sessão
 * já agendada (o EXCLUDE constraint do banco é o backstop de verdade).
 * `excluirSessaoId` exclui a própria sessão sendo remarcada, mesma solução
 * que a #254 já resolveu para o aluno.
 */
async function horariosAmplosDoProfessor(
  supabaseAdmin: Cliente,
  mentorId: string,
  duracaoMin: number,
  agora: Date,
  excluirSessaoId: string,
): Promise<{ data: string; horarios: string[] }[]> {
  const janelaInicio = new Date(agora.getTime() - 86_400_000);
  const janelaFim = new Date(agora.getTime() + (JANELA_PROFESSOR_DIAS + 1) * 86_400_000);
  const { data: sessoes } = await supabaseAdmin
    .from("mentoria_sessoes")
    .select("quando, termina_em, link_id")
    .eq("mentor_id", mentorId)
    .eq("status", "agendada")
    .neq("id", excluirSessaoId)
    .gte("quando", janelaInicio.toISOString())
    .lte("quando", janelaFim.toISOString());

  const faixas: FaixaCalc[] = [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
    dia_semana: dia, hora_inicio: JANELA_PROFESSOR_INICIO, hora_fim: JANELA_PROFESSOR_FIM,
  }));

  return horariosLivresDoLink({
    faixas,
    ocupadas: (sessoes ?? []) as OcupadaCalc[],
    bloqueiosGoogle: [],
    duracaoMin,
    intervaloMin: 0,
    agora,
    antecedenciaMinHoras: 0,
    antecedenciaMaxDias: JANELA_PROFESSOR_DIAS,
    tetoPorDia: null,
    linkId: excluirSessaoId, // não lido: tetoPorDia null desativa o único ramo que usaria isto
  });
}

async function sessaoDoProfessor(context: { supabase: Cliente }, id: string) {
  const { data: sessao, error } = await context.supabase
    .from("mentoria_sessoes")
    .select("id, mentor_id, mentoria_id, quando, termina_em, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!sessao) throw new Error("Sessão não encontrada.");
  if (sessao.status !== "agendada") throw new Error("Só dá para remarcar uma sessão ainda agendada.");
  return sessao;
}

function duracaoDaSessao(sessao: { quando: string; termina_em: string | null }): number {
  return sessao.termina_em
    ? Math.max(5, Math.round((new Date(sessao.termina_em).getTime() - new Date(sessao.quando).getTime()) / 60_000))
    : DURACAO_PADRAO_MIN;
}

const sessaoMentorSchema = z.object({ id: z.string().uuid() });

export const horariosParaRemarcarProfessor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => sessaoMentorSchema.parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissaoOuMentor(context.supabase, context.userId, "mentorias");
    const sessao = await sessaoDoProfessor(context, data.id);
    const duracaoMin = duracaoDaSessao(sessao);

    const supabaseAdmin = await admin();
    const agora = new Date();
    const dias = await horariosAmplosDoProfessor(supabaseAdmin, sessao.mentor_id, duracaoMin, agora, sessao.id);
    return { status: "ok" as const, duracao_min: duracaoMin, dias };
  });

const remarcarProfessorSchema = z.object({ id: z.string().uuid(), quando: z.string().datetime({ offset: true }) });

export const remarcarSessaoMentoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => remarcarProfessorSchema.parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissaoOuMentor(context.supabase, context.userId, "mentorias");
    const sessao = await sessaoDoProfessor(context, data.id);
    const duracaoMin = duracaoDaSessao(sessao);

    const supabaseAdmin = await admin();
    const agora = new Date();
    // Revalida contra um cálculo FRESCO — mesma armadilha de sempre: o
    // horário pode ter sido ocupado entre a tela mostrar a lista e este clique.
    const dias = await horariosAmplosDoProfessor(supabaseAdmin, sessao.mentor_id, duracaoMin, agora, sessao.id);
    const quandoNormalizado = new Date(data.quando).toISOString();
    const aindaLivre = dias.some((d) => d.horarios.includes(quandoNormalizado));
    if (!aindaLivre) throw new Error("Esse horário acabou de ser ocupado. Escolha outro, por favor.");

    const terminaEm = new Date(new Date(quandoNormalizado).getTime() + duracaoMin * 60_000).toISOString();
    const quandoOriginal = sessao.quando;

    // Um UPDATE só, na MESMA linha — nunca cancelar-e-recriar, que quebraria
    // o vínculo com o pacote e faria "faltam agendar" oscilar. NÃO incrementa
    // `remarcacoes`: esse contador é o teto do ALUNO (#254); o professor
    // remarcando não pode consumir as remarcações que sobram pra ele.
    const { data: atualizado, error } = await context.supabase
      .from("mentoria_sessoes")
      .update({ quando: quandoNormalizado, termina_em: terminaEm })
      .eq("id", data.id)
      .eq("status", "agendada")
      .select("id")
      .maybeSingle();
    if (error) {
      if (error.message.includes("mentoria_sessoes_sem_sobreposicao")) {
        throw new Error("Esse horário acabou de ser ocupado. Escolha outro, por favor.");
      }
      throw new Error(error.message);
    }
    if (!atualizado) throw new Error("Esta sessão já não está mais agendada.");

    // Mão única, silenciosa — sincronizar() faz PATCH no evento existente:
    // move, não apaga-e-recria, então o aluno não recebe dois avisos do Google.
    const { sincronizar } = await import("@/lib/google.server");
    const { data: mentoriaComPessoa } = await supabaseAdmin
      .from("mentorias").select("person_id, people(full_name)").eq("id", sessao.mentoria_id).maybeSingle();
    const nomePessoa = (mentoriaComPessoa?.people as unknown as { full_name: string | null } | null)?.full_name;
    await sincronizar(sessao.mentor_id, "mentoria", sessao.id, {
      titulo: `Mentoria · ${nomePessoa ?? "avaliado"}`,
      quando: quandoNormalizado,
      terminaEm,
    });

    if (mentoriaComPessoa?.person_id) {
      await avisarAluno(supabaseAdmin, {
        mentorId: sessao.mentor_id,
        personId: mentoriaComPessoa.person_id,
        quandoOriginal,
        quandoNovo: quandoNormalizado,
        tipo: "remarcada",
      });
    }

    return { ok: true as const, quando: quandoNormalizado, termina_em: terminaEm };
  });

/**
 * Avisa o ALUNO de um cancelamento ou remarcação feito pelo PROFESSOR — o
 * inverso de `avisarProfessor` (acima). E-mail é o canal que não pode
 * faltar: cinco dos sete alunos não têm login, e para eles a notificação na
 * plataforma não existe — por isso lê `people.email` (existe sempre que há
 * cadastro) em vez de `auth.admin`, que só existe pra quem tem conta. Sem
 * e-mail cadastrado, segue sem avisar. Silenciosa do início ao fim: o
 * professor já cancelou/remarcou, o aviso é consequência, nunca condição.
 */
export async function avisarAluno(
  supabaseAdmin: Cliente,
  args: {
    mentorId: string;
    personId: string;
    quandoOriginal: string;
    quandoNovo?: string;
    motivo?: string | null;
    tipo: "cancelada" | "remarcada";
  },
): Promise<void> {
  try {
    const { data: pessoa } = await supabaseAdmin
      .from("people").select("full_name, email, user_id").eq("id", args.personId).maybeSingle();
    if (!pessoa) return;

    const { data: gruposDele } = await supabaseAdmin
      .from("group_members").select("group_id").eq("person_id", args.personId);

    const { notificar, quandoBr } = await import("@/lib/notificacoes.functions");
    const nomeProfessor = await nomeDoProfessor(supabaseAdmin, args.mentorId);
    const nome = (pessoa.full_name ?? "").split(" ")[0] || "Olá";

    const titulo = args.tipo === "cancelada"
      ? `${nomeProfessor} cancelou sua sessão`
      : `${nomeProfessor} remarcou sua sessão`;
    const corpo = args.tipo === "cancelada"
      ? (args.motivo
          ? `Era ${quandoBr(args.quandoOriginal)}. Motivo: ${args.motivo}`
          : `Era ${quandoBr(args.quandoOriginal)}.`)
      : `Era ${quandoBr(args.quandoOriginal)}, agora é ${quandoBr(args.quandoNovo!)}.`;

    await notificar(supabaseAdmin, {
      conta: args.mentorId,
      tipo: args.tipo === "cancelada" ? "sessao_cancelada_professor" : "sessao_remarcada_professor",
      titulo,
      corpo,
      link: "/aluno/mentorias",
      // ator: null, como avisarProfessor — nunca o mentorId. notificar()
      // exclui p_ator dos destinos (`u IS DISTINCT FROM p_ator`); se o aluno
      // e o professor compartilhassem o mesmo user_id (um mentor testando com
      // o próprio cadastro de aluno, por exemplo), ator: mentorId excluiria o
      // ÚNICO destinatário (pessoaUser = ator = conta), e o aviso desapareceria
      // por inteiro. atorNome (texto solto) já identifica quem agiu.
      ator: null,
      atorNome: nomeProfessor,
      grupos: (gruposDele ?? []).map((g) => g.group_id),
      pessoaUser: pessoa.user_id,
    });

    if (!pessoa.email) return;
    const { enviarEmail, montarHtml } = await import("@/lib/email.server");
    const { siteUrl } = await import("@/lib/site-url.server");
    const { data: perfil } = await supabaseAdmin
      .from("profiles")
      .select("company_name, brand_color, site_url, support_email, email_from")
      .eq("user_id", args.mentorId)
      .maybeSingle();

    const corpoEmail = args.tipo === "cancelada"
      ? (args.motivo
          ? `${nome}, sua sessão com ${nomeProfessor} agendada para ${quandoBr(args.quandoOriginal)} foi cancelada.\n\nMotivo: ${args.motivo}`
          : `${nome}, sua sessão com ${nomeProfessor} agendada para ${quandoBr(args.quandoOriginal)} foi cancelada.\n\nSe tiver dúvidas, fale com ${nomeProfessor}.`)
      : `${nome}, sua sessão com ${nomeProfessor} foi remarcada.\n\nEra ${quandoBr(args.quandoOriginal)}, agora é ${quandoBr(args.quandoNovo!)}.`;

    const html = montarHtml({
      corpo: corpoEmail,
      link: siteUrl(),
      rotuloBotao: "Visitar o site",
      marca: perfil ?? null,
    });
    await enviarEmail({
      to: pessoa.email,
      subject: args.tipo === "cancelada" ? "Sessão cancelada" : "Sessão remarcada",
      html,
      from: perfil?.email_from ?? null,
      replyTo: perfil?.support_email ?? null,
    });
  } catch {
    // Ver o comentário acima: o aviso nunca derruba a ação do professor.
  }
}
