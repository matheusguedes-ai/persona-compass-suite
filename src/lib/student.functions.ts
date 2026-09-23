/**
 * Área do aluno (avaliado).
 *
 * Diferente do mentor, o aluno não é dono de nada: ele enxerga apenas os
 * cadastros com o email dele (`people.user_id`) e o que pende daí. As policies
 * que permitem isso são as `*_student_read` da migração `20260728050000`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { urlOpcional, urlOuCaminhoInterno } from "@/lib/url-segura";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assinarArquivosMentoria } from "@/lib/storage-assinado.server";
import { calcularElegibilidade, type Elegibilidade } from "@/lib/agendamento.functions";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Liga a conta aos cadastros com o mesmo email e devolve o que o aluno tem.
 *
 * O `claim` roda toda vez de propósito: se o mentor cadastrar a pessoa depois
 * de ela já ter criado a conta, o vínculo aparece no próximo acesso sem
 * ninguém precisar fazer nada.
 */
export const getStudentArea = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      // "Ver como aluno": o mentor escolhe um avaliado e vê a área dele.
      // Não é personificação — o mentor já pode ler esses dados; aqui só
      // trocamos a **apresentação**. Quem autoriza continua sendo a RLS: se a
      // pessoa não for da conta dele, a consulta simplesmente não devolve nada.
      preview_person_id: z.string().uuid().optional().nullable(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    if (data.preview_person_id) {
      const { data: alvo, error: aErr } = await supabase
        .from("people")
        .select("id, full_name, email")
        .eq("id", data.preview_person_id)
        .maybeSingle();
      if (aErr) throw new Error(aErr.message);
      if (!alvo) throw new Error("Avaliado não encontrado ou fora do seu acesso.");
      return {
        ...(await montarArea(supabase, [alvo])),
        preview: true as const,
      };
    }

    const { error: claimErr } = await supabase.rpc("claim_student_profile");
    if (claimErr) throw new Error(claimErr.message);
    // Um mentor promovido "a frio" (nunca tinha logado) passa por este mesmo
    // caminho no primeiro acesso — ver migração 20260731070000.
    await supabase.rpc("claim_team_membership");

    // Filtra por user_id = auth.uid() em vez de confiar só na RLS de people:
    // para o aluno o resultado já era 1 linha (a policy limita a isso), mas
    // para o dono/colaborador abrindo /aluno sem preview, a RLS enxerga TODAS
    // as pessoas com login da conta — sem este filtro, a área do aluno
    // misturaria respostas e baterias de gente diferente. Mesmo risco do #258.
    const { data: pessoas, error: pErr } = await supabase
      .from("people")
      .select("id, full_name, email")
      .eq("user_id", context.userId);
    if (pErr) throw new Error(pErr.message);

    if (!pessoas || pessoas.length === 0) {
      return { vinculado: false as const, nome: null, respostas: [], baterias: [], preview: false as const };
    }

    return { ...(await montarArea(supabase, pessoas)), preview: false as const };
  });

/** Monta a lista de testes de um ou mais cadastros. */
async function montarArea(
  supabase: SupabaseClient<Database>,
  pessoas: Array<{ id: string; full_name: string }>,
) {
  const ids = pessoas.map((p) => p.id);
  const [respostas, baterias] = await Promise.all([
    supabase
      .from("test_responses")
      .select("id, status, submitted_at, started_at, created_at, assessment_response_id, attempt, test_versions(title)")
      .in("person_id", ids)
      .eq("kind", "self")
      .order("created_at", { ascending: false }),
    supabase
      .from("assessment_responses")
      .select("id, status, submitted_at, created_at, attempt")
      .in("person_id", ids)
      .order("created_at", { ascending: false }),
  ]);
  if (respostas.error) throw new Error(respostas.error.message);
  if (baterias.error) throw new Error(baterias.error.message);

  return {
    vinculado: true as const,
    nome: pessoas[0].full_name,
    respostas: respostas.data ?? [],
    baterias: baterias.data ?? [],
  };
}

/** Dados que o aluno pode editar do próprio cadastro. */
export const getMyStudentProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error: claimErr } = await supabase.rpc("claim_student_profile");
    if (claimErr) throw new Error(claimErr.message);
    // Um mentor promovido "a frio" (nunca tinha logado) passa por este mesmo
    // caminho no primeiro acesso — ver migração 20260731070000.
    await supabase.rpc("claim_team_membership");

    const { data, error } = await supabase
      .from("people")
      .select("id, full_name, email, phone, avatar_url, company_name, banner_url, linkedin_url, instagram_url, site_url")
      .eq("user_id", userId)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const email = (context.claims as { email?: string })?.email ?? null;
    if (data) {
      const { assinarUrl, TTL_AVATAR_SEGUNDOS } = await import("@/lib/storage-assinado.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      data.avatar_url = await assinarUrl(supabaseAdmin, data.avatar_url, TTL_AVATAR_SEGUNDOS);
      data.banner_url = await assinarUrl(supabaseAdmin, data.banner_url, TTL_AVATAR_SEGUNDOS);
    }
    return { pessoa: data, email_login: email, user_id: userId };
  });

/**
 * Salva nome, telefone e foto do aluno.
 *
 * Vai por função do banco (`update_my_person`) em vez de UPDATE direto: a RLS
 * decide por linha, não por coluna — com UPDATE aberto o aluno poderia mexer em
 * `mentor_id`, `role` ou nas anotações do mentor. Como grava na tabela `people`,
 * o mentor vê a mudança na hora seguinte que abrir a tela.
 */
export const updateMyStudentProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    // #263 — o toast cru de ZodError (JSON das issues) agora é traduzido no
    // ponto único onde o erro vira tela (mensagemDeErro, src/lib/erro-legivel.ts).
    // Isto aqui era o conserto pontual só deste formulário, antes desse tradutor
    // existir; virou caso particular do central, sem precisar de safeParse manual.
    z.object({
      full_name: z.string().trim().min(2).max(160),
      phone: z.string().trim().max(40).optional().nullable(),
      // #282 — avatar_url/banner_url chegam como identificador interno
      // (bucket/caminho), não URL — ver AvatarUpload/enviarBanner.
      avatar_url: urlOuCaminhoInterno,
      company_name: z.string().trim().max(160).optional().nullable(),
      banner_url: urlOuCaminhoInterno,
      linkedin_url: urlOpcional,
      instagram_url: urlOpcional,
      site_url: urlOpcional,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // A tela do aluno carrega foto e banner já ASSINADOS (ver
    // getMyStudentProfile) e reenvia esses mesmos valores ao salvar o resto
    // junto, sem trocar a imagem — preserva o identificador já gravado em vez
    // de persistir um link que expira em minutos. Mesma guarda para os dois.
    const { ehUrlAssinadaNossa } = await import("@/lib/storage-assinado.server");
    let avatarUrl = data.avatar_url ?? null;
    let bannerUrl = data.banner_url ?? null;
    if (ehUrlAssinadaNossa(avatarUrl) || ehUrlAssinadaNossa(bannerUrl)) {
      const { data: atual } = await context.supabase
        .from("people").select("avatar_url, banner_url").eq("user_id", context.userId)
        .order("created_at").limit(1).maybeSingle();
      if (ehUrlAssinadaNossa(avatarUrl)) avatarUrl = atual?.avatar_url ?? null;
      if (ehUrlAssinadaNossa(bannerUrl)) bannerUrl = atual?.banner_url ?? null;
    }
    const { error } = await context.supabase.rpc("update_my_person", {
      _full_name: data.full_name,
      _phone: data.phone ?? null,
      _avatar_url: avatarUrl,
      _company_name: data.company_name ?? null,
      _banner_url: bannerUrl,
      _linkedin_url: data.linkedin_url ?? null,
      _instagram_url: data.instagram_url ?? null,
      _site_url: data.site_url ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * As mentorias do próprio avaliado.
 *
 * Ele não executa nada de conteúdo além do checklist — nunca conclui, nunca
 * edita o resumo. Desde o #255, ele PODE agendar (se o pacote apontar um
 * link), cancelar e remarcar — pelas MESMAS regras e as MESMAS funções do
 * link por e-mail (#254): `calcularElegibilidade`, importada de
 * agendamento.functions.ts, nunca reimplementada aqui. Se a regra de
 * prazo/teto mudar um dia, muda num lugar só.
 */
export const getMinhasMentorias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ preview_person_id: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data: input }) => {
    // Sem filtro nenhum além da RLS, "minhas mentorias" na prévia "Ver como
    // aluno" vinha a conta INTEIRA: quem está autenticado ali é sempre o dono,
    // e para ele a RLS entrega tudo. Achado na varredura da demanda #243, no
    // mesmo formato do bug já achado em agendaDoMes.
    let q = context.supabase
      .from("mentorias")
      .select(
        "id, titulo, status, sessoes_contratadas, link_id, mentor_id, mentoria_sessoes(id, quando, termina_em, modalidade, local, link_url, status, duracao_real_min, resumo, checklist_titulo, concluida_em, avaliacao_estrelas, avaliacao_comentario, avaliada_em, link_id, remarcacoes, mentoria_tarefas(id, titulo, ordem, concluida, concluida_em), mentoria_arquivos(id, nome, caminho, tamanho_bytes, tipo))",
      )
      .order("created_at", { ascending: false });
    if (input.preview_person_id) q = q.eq("person_id", input.preview_person_id);
    const { data, error } = await q;
    if (error) throw new Error(error.message);

    type SessaoRow = {
      id: string; quando: string; termina_em: string | null; modalidade: string;
      local: string | null; link_url: string | null; status: string;
      duracao_real_min: number | null; resumo: string | null; checklist_titulo: string | null;
      concluida_em: string | null;
      avaliacao_estrelas: number | null; avaliacao_comentario: string | null; avaliada_em: string | null;
      link_id: string | null; remarcacoes: number;
      mentoria_tarefas: Array<{ id: string; titulo: string; ordem: number; concluida: boolean; concluida_em: string | null }> | null;
      mentoria_arquivos: Array<{ id: string; nome: string; caminho: string; tamanho_bytes: number; tipo: string }> | null;
    };
    type MentoriaRow = {
      id: string; titulo: string | null; status: string; sessoes_contratadas: number;
      link_id: string | null; mentor_id: string;
      mentoria_sessoes: SessaoRow[] | null;
    };
    const mentorias = (data ?? []) as unknown as MentoriaRow[];

    // Um lote só: o aluno não tem RLS sobre mentoria_links nem profiles de
    // outra conta (não é dono), então isto só sai por admin — mesmo motivo
    // de dadosDaSessao em agendamento.functions.ts.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const linkIds = new Set<string>();
    const mentorIds = new Set<string>();
    for (const m of mentorias) {
      mentorIds.add(m.mentor_id);
      if (m.link_id) linkIds.add(m.link_id);
      for (const s of m.mentoria_sessoes ?? []) if (s.link_id) linkIds.add(s.link_id);
    }
    const [{ data: links }, { data: profissionais }] = await Promise.all([
      linkIds.size > 0
        ? supabaseAdmin.from("mentoria_links").select("*").in("id", Array.from(linkIds))
        : Promise.resolve({ data: [] as Database["public"]["Tables"]["mentoria_links"]["Row"][] }),
      mentorIds.size > 0
        ? supabaseAdmin.from("profiles").select("user_id, full_name").in("user_id", Array.from(mentorIds))
        : Promise.resolve({ data: [] as Array<{ user_id: string; full_name: string | null }> }),
    ]);
    const linkPorId = new Map((links ?? []).map((l) => [l.id, l]));
    const nomePorMentor = new Map(
      (profissionais ?? []).map((p) => [p.user_id, p.full_name?.trim() || "quem te enviou este link"]),
    );

    const agora = Date.now();

    const sessoes = await Promise.all(
      mentorias.flatMap((m) =>
        (m.mentoria_sessoes ?? [])
          .filter((s) => s.status !== "cancelada")
          .map(async (s) => {
            const nomeProfessor = nomePorMentor.get(m.mentor_id) ?? "quem te enviou este link";
            const link = s.link_id ? linkPorId.get(s.link_id) ?? null : null;
            const naoAgendada: Elegibilidade = { sim: false, motivo: "" };
            const semLink: Elegibilidade = { sim: false, motivo: `Fale com ${nomeProfessor} para remarcar esta sessão.` };
            const podeCancelar: Elegibilidade = s.status !== "agendada"
              ? naoAgendada
              : !link ? semLink : calcularElegibilidade(s, link, "cancelar", nomeProfessor);
            const podeRemarcar: Elegibilidade = s.status !== "agendada"
              ? naoAgendada
              : !link ? semLink : calcularElegibilidade(s, link, "remarcar", nomeProfessor);
            return {
              id: s.id,
              mentoria_titulo: m.titulo,
              quando: s.quando,
              termina_em: s.termina_em,
              modalidade: s.modalidade,
              local: s.local,
              link_url: s.link_url,
              status: s.status,
              duracao_real_min: s.duracao_real_min,
              resumo: s.resumo,
              checklist_titulo: s.checklist_titulo,
              concluida_em: s.concluida_em,
              avaliacao_estrelas: s.avaliacao_estrelas,
              avaliacao_comentario: s.avaliacao_comentario,
              avaliada_em: s.avaliada_em,
              tarefas: (s.mentoria_tarefas ?? []).slice().sort((a, b) => a.ordem - b.ordem),
              arquivos: await assinarArquivosMentoria(supabaseAdmin, s.mentoria_arquivos ?? []),
              podeCancelar,
              podeRemarcar,
            };
          }),
      ),
    );

    // O botão "Agendar mentoria" — um por pacote ativo, nunca somado. As
    // quatro respostas da spec #255: sem saldo, sem link, link desativado (
    // mesma frase de "sem link"), ou tudo certo. "Sem pacote ativo" é só o
    // array vir vazio — a tela decide não mostrar nada.
    const pacotes = mentorias
      .filter((m) => m.status === "ativa")
      .map((m) => {
        const sessoesDoM = m.mentoria_sessoes ?? [];
        const realizadas = sessoesDoM.filter((s) => s.status === "concluida").length;
        const agendadas = sessoesDoM.filter((s) => s.status === "agendada" && new Date(s.quando).getTime() >= agora).length;
        const faltam = Math.max(0, m.sessoes_contratadas - realizadas - agendadas);
        const nomeProfessor = nomePorMentor.get(m.mentor_id) ?? "quem te enviou este link";
        const link = m.link_id ? linkPorId.get(m.link_id) ?? null : null;

        let podeAgendar: Elegibilidade;
        if (faltam <= 0) {
          podeAgendar = { sim: false, motivo: `Suas ${m.sessoes_contratadas} sessões já estão marcadas ou realizadas.` };
        } else if (!link || !link.ativo) {
          podeAgendar = { sim: false, motivo: `Ainda não dá para agendar sozinho por aqui. Fale com ${nomeProfessor} para marcar.` };
        } else {
          podeAgendar = { sim: true };
        }

        return { id: m.id, titulo: m.titulo, faltam, podeAgendar };
      });

    return { sessoes, pacotes };
  });

/**
 * O resultado do avaliado, em forma de gráfico.
 *
 * O painel dele listava os testes mas não mostrava nada do que saiu deles — o
 * resultado só existia dentro do relatório, que é um documento longo. Aqui sai
 * o resumo visual: as dimensões de cada teste concluído, para o painel abrir
 * mostrando alguma coisa em vez de uma lista de links.
 *
 * A ordem importa por segurança: a leitura das respostas passa pela RLS (só as
 * dele), e só depois o relatório é montado. `buildReport` roda com service role
 * e não filtra por dono — se a ordem fosse invertida, bastaria um id alheio.
 */
export const getMeusResultados = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ preview_person_id: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    let q = supabase
      .from("test_responses")
      .select("id, submitted_at, assessment_response_id, test_versions(title, instrument_id)")
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false });
    if (data.preview_person_id) q = q.eq("person_id", data.preview_person_id);
    const { data: todasSubmetidas, error } = await q;
    if (error) throw new Error(error.message);
    if (!todasSubmetidas || todasSubmetidas.length === 0) return { resultados: [] };

    // #298 — a tentativa vigente é a mais recente CONCLUÍDA (regra do dono):
    // já vem ordenado por submitted_at desc, então a primeira ocorrência de
    // cada instrumento é a vigente; as demais (refeitas) ficam de fora do
    // cartão — elas continuam no histórico, só não duplicam "Seus resultados".
    // Teste avulso sem `instrument_id` (não deveria existir, mas por segurança)
    // nunca é agrupado com outro — cada um aparece por si.
    const vistos = new Set<string>();
    const minhas = todasSubmetidas.filter((r) => {
      const instrumentId = r.test_versions?.instrument_id;
      if (!instrumentId) return true;
      if (vistos.has(instrumentId)) return false;
      vistos.add(instrumentId);
      return true;
    });

    const { buildReport } = await import("@/lib/report.server");
    const construidos = await Promise.all(minhas.slice(0, 8).map((r) => buildReport(r.id)));

    return {
      resultados: construidos
        .map((b, i) => {
          if (b.status !== 200) return null;
          const r = b.data;
          return {
            response_id: minhas[i].id,
            titulo: r.test_title,
            instrumento: r.instrument_id ?? null,
            respondido_em: minhas[i].submitted_at,
            da_bateria: minhas[i].assessment_response_id,
            is_mbti: !!r.is_mbti,
            tipo_mbti: r.mbti?.tipo ?? null,
            // Testes do motor ipsativo (#288 Etapa 2c): o mesmo retrato que abre o relatório — a sigla e
            // o gráfico NATURAL. Sigla e barras vêm do mesmo gráfico, senão o cartão se contradiz.
            perfil: r.intensidade ? r.intensidade.perfil.sigla : r.perfil_indefinido ? null : r.profile,
            fatores: r.intensidade
              ? r.intensidade.natural.letras
                  .map((l) => ({
                    key: l.key,
                    label: l.label,
                    color: l.color,
                    valor: Math.round(l.percentual),
                    faixa: null as string | null,
                    // #292: dimensão quase não marcada — o cartão avisa, como o relatório
                    pouca_informacao: l.pouca_informacao,
                  }))
                  .sort((a, b2) => b2.valor - a.valor)
              : r.factors
                  .filter((f) => f.has_data !== false)
                  .map((f) => ({
                    key: f.key,
                    label: f.label,
                    color: f.color,
                    valor: Math.round(f.natural_norm),
                    faixa: f.band_natural?.title ?? null,
                    pouca_informacao: false,
                  }))
                  .sort((a, b2) => b2.valor - a.valor),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x != null),
    };
  });

/**
 * Marca (ou desmarca) um item do checklist da mentoria. Só o aluno.
 *
 * Via RPC `marcar_tarefa_mentoria` — SECURITY DEFINER, confere ownership por
 * dentro. Não existe policy de UPDATE aberta em `mentoria_tarefas` para
 * ninguém: um UPDATE direto deixaria o aluno reescrever o título do item.
 */
export const marcarTarefaMentoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tarefa_id: z.string().uuid(), concluida: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("marcar_tarefa_mentoria", {
      _tarefa_id: data.tarefa_id,
      _concluida: data.concluida,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Avalia a sessão: estrelas (1-5) e comentário opcional. As três regras —
 * só o aluno, só concluída, uma vez só — vivem dentro da RPC
 * `avaliar_sessao_mentoria`, não aqui; esta função só repassa e traduz o erro.
 */
export const avaliarSessaoMentoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      sessao_id: z.string().uuid(),
      estrelas: z.number().int().min(1).max(5),
      comentario: z.string().trim().max(2000).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("avaliar_sessao_mentoria", {
      _sessao_id: data.sessao_id,
      _estrelas: data.estrelas,
      _comentario: data.comentario ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// #298 — menu Testes: o aluno encontra sozinho o que foi liberado
// ============================================================
//
// Antes desta demanda, a única porta para responder era o link que o mentor
// mandava — e ele "barrava quem já tinha cadastro" (bug real em
// api.public.invite.$id.ts, achado nesta mesma investigação e DEIXADO DE LADO
// de propósito: a demanda pede para não mexer no link de convite, é outra
// fatia da reforma). Esta fatia resolve o lado de dentro: quem já tem conta
// entra pelo painel e não depende de link nenhum.
//
// PRINCÍPIO: cadastro ≠ acesso. `group_instruments` diz quais INSTRUMENTOS um
// grupo libera (DISC, VAK…) — nunca uma versão específica, na prática (a
// coluna `version_id` existe mas a tela do mentor nunca a preenche). Cada
// instrumento vira aqui a VERSÃO que a pessoa de fato vai responder: a do
// próprio mentor quando ele tiver uma publicada, senão o template global.

async function getAdminStudent() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type VersaoCandidata = {
  id: string;
  instrument_id: string;
  mentor_id: string | null;
  is_template: boolean;
  is_anonymous: boolean;
  created_at: string;
};

/**
 * Entre as versões publicadas de um instrumento, qual a pessoa deveria
 * responder — a mesma regra de dono que `startResponse` já verifica na hora
 * de enviar (`is_template OR mentor_id === dono`), só que escolhendo em vez
 * de validar uma escolha que já veio da tela.
 *
 * Teste ANÔNIMO fica de fora: o motivo de existir "anônimo" é não saber quem
 * respondeu, e aqui é sempre a própria pessoa logada abrindo — gravar o
 * vínculo seria o comportamento certo, e é exatamente o que a trava do banco
 * (`valida_pessoa_da_resposta`) recusa. Preferimos nunca oferecer a escolher
 * errado a deixar a pessoa esbarrar num erro de banco.
 *
 * Empate entre duas versões PRÓPRIAS do mesmo mentor para o mesmo instrumento
 * (existe hoje para `instrument_id = 'personalizado'`, onde o mentor pode ter
 * vários testes personalizados diferentes sob o mesmo id) é decidido pela
 * mais recente — caso raro, fora do que esta fatia se propõe a arrumar (a
 * tela do mentor que libera por grupo não distingue qual dos personalizados
 * quis dizer; ver o relatório final).
 */
function resolverVersao(
  instrumentId: string,
  versionIdExplicito: string | null,
  mentorId: string,
  candidatas: VersaoCandidata[],
): VersaoCandidata | null {
  if (versionIdExplicito) {
    const v = candidatas.find((c) => c.id === versionIdExplicito && !c.is_anonymous);
    if (v) return v;
  }
  const doInstrumento = candidatas.filter((c) => c.instrument_id === instrumentId && !c.is_anonymous);
  const propria = doInstrumento
    .filter((c) => !c.is_template && c.mentor_id === mentorId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (propria) return propria;
  return doInstrumento.find((c) => c.is_template) ?? null;
}

export type TentativaDoAluno = {
  response_id: string;
  attempt: number;
  status: string;
  submitted_at: string | null;
  started_at: string | null;
  canceled_at: string | null;
};

export type TesteLiberado = {
  instrument_id: string;
  nome: string;
  short_name: string;
  category: string;
  duration_min: number;
  person_id: string;
  /** `null` = liberado no grupo, mas nenhuma versão publicada foi encontrada — a tela avisa, não trava. */
  version_id: string | null;
  /** Da mais recente para a mais antiga. A 1ª SUBMETIDA é a vigente (regra do dono, #298). */
  tentativas: TentativaDoAluno[];
};

/**
 * Os testes que a pessoa pode responder por conta própria: liberados no(s)
 * grupo(s) dela, com o estado de cada tentativa que ela já tiver.
 *
 * Mesmo cuidado de ordem de `getMeusResultados`: resolve a identidade pela
 * RLS (`context.supabase`) antes de qualquer leitura mais ampla.
 */
export const getMeusTestesLiberados = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z.object({ preview_person_id: z.string().uuid().optional().nullable() }).parse(d ?? {}),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let pessoas: { id: string; mentor_id: string }[];
    if (data.preview_person_id) {
      const { data: alvo, error } = await supabase
        .from("people").select("id, mentor_id").eq("id", data.preview_person_id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!alvo) throw new Error("Avaliado não encontrado ou fora do seu acesso.");
      pessoas = [alvo];
    } else {
      const { error: claimErr } = await supabase.rpc("claim_student_profile");
      if (claimErr) throw new Error(claimErr.message);
      await supabase.rpc("claim_team_membership");
      const { data: minhas, error } = await supabase
        .from("people").select("id, mentor_id").eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      pessoas = minhas ?? [];
    }
    if (pessoas.length === 0) return { vinculado: false as const, itens: [] };

    const personIds = pessoas.map((p) => p.id);
    const mentorPorPessoa = new Map(pessoas.map((p) => [p.id, p.mentor_id]));

    const { data: membros, error: mErr } = await supabase
      .from("group_members").select("person_id, group_id").in("person_id", personIds);
    if (mErr) throw new Error(mErr.message);
    if (!membros || membros.length === 0) return { vinculado: true as const, itens: [] };
    const gruposPorPessoa = new Map<string, string[]>();
    for (const m of membros) {
      const l = gruposPorPessoa.get(m.person_id) ?? [];
      l.push(m.group_id);
      gruposPorPessoa.set(m.person_id, l);
    }
    const groupIds = Array.from(new Set(membros.map((m) => m.group_id)));

    // Legível pelo aluno desde a migração desta demanda (`gi_student_read`).
    const { data: liberados, error: gErr } = await supabase
      .from("group_instruments")
      .select("group_id, instrument_id, version_id, instruments(id, name, short_name, category, duration_min)")
      .in("group_id", groupIds);
    if (gErr) throw new Error(gErr.message);
    if (!liberados || liberados.length === 0) return { vinculado: true as const, itens: [] };

    const instrumentIds = Array.from(new Set(liberados.map((l) => l.instrument_id)));
    const { data: versoes, error: vErr } = await supabase
      .from("test_versions")
      .select("id, instrument_id, mentor_id, is_template, is_anonymous, created_at")
      .in("instrument_id", instrumentIds)
      .eq("is_published", true);
    if (vErr) throw new Error(vErr.message);
    const candidatas = (versoes ?? []) as VersaoCandidata[];

    const { data: respostas, error: rErr } = await supabase
      .from("test_responses")
      .select("id, person_id, version_id, attempt, status, submitted_at, started_at, canceled_at, test_versions(instrument_id)")
      .in("person_id", personIds)
      .eq("kind", "self")
      .order("attempt", { ascending: false });
    if (rErr) throw new Error(rErr.message);

    const itens: TesteLiberado[] = [];
    for (const pessoa of pessoas) {
      const meusGrupos = new Set(gruposPorPessoa.get(pessoa.id) ?? []);
      if (meusGrupos.size === 0) continue;
      const meusLiberados = liberados.filter((l) => meusGrupos.has(l.group_id));
      const porInstrumento = new Map<string, (typeof liberados)[number]>();
      for (const l of meusLiberados) if (!porInstrumento.has(l.instrument_id)) porInstrumento.set(l.instrument_id, l);

      for (const [instrumentId, lib] of porInstrumento) {
        const versao = resolverVersao(instrumentId, lib.version_id, pessoa.mentor_id, candidatas);
        const tentativas = (respostas ?? [])
          .filter((r) => r.person_id === pessoa.id && r.test_versions?.instrument_id === instrumentId)
          .map((r) => ({
            response_id: r.id, attempt: r.attempt ?? 1, status: r.status,
            submitted_at: r.submitted_at, started_at: r.started_at, canceled_at: r.canceled_at,
          }));
        itens.push({
          instrument_id: instrumentId,
          nome: lib.instruments?.name ?? instrumentId,
          short_name: lib.instruments?.short_name ?? instrumentId,
          category: lib.instruments?.category ?? "comportamental",
          duration_min: lib.instruments?.duration_min ?? 15,
          person_id: pessoa.id,
          version_id: versao?.id ?? null,
          tentativas,
        });
      }
    }
    itens.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return { vinculado: true as const, itens };
  });

/**
 * Abre uma tentativa nova, ou devolve a que já está pela metade — a trava do
 * dono: "não pode abrir uma tentativa nova DO MESMO TESTE enquanto houver uma
 * pela metade" (#298, regra 5). "Mesmo teste" é o INSTRUMENTO (DISC continua
 * sendo DISC mesmo que o mentor troque a versão liberada no meio do caminho),
 * não a versão exata — por isso o achado usa `test_versions(instrument_id)`.
 *
 * Refazer um teste já concluído são NOVAS respostas: o histórico nunca é
 * apagado (regra 5 do dono) — a corrente `attempt`/`previous_response_id` já
 * existia para o reteste que o MENTOR autoriza (`authorizeRetake`); aqui é a
 * mesma corrente, só que quem aciona é a própria pessoa.
 */
export const iniciarOuRetomarTeste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ person_id: z.string().uuid(), instrument_id: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Dono verificado pela RLS de `people` (self) — nunca aceita o person_id
    // de outra pessoa, mesmo que o chamador tente forçar um id alheio.
    const { data: pessoa, error: pErr } = await supabase
      .from("people").select("id, mentor_id").eq("id", data.person_id).eq("user_id", context.userId).maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!pessoa) throw new Error("Cadastro não encontrado ou não é seu.");

    const { data: membro, error: mErr } = await supabase
      .from("group_members").select("group_id").eq("person_id", pessoa.id);
    if (mErr) throw new Error(mErr.message);
    const groupIds = (membro ?? []).map((m) => m.group_id);
    if (groupIds.length === 0) throw new Error("Você ainda não está em nenhum grupo.");

    const { data: liberado, error: gErr } = await supabase
      .from("group_instruments")
      .select("group_id, instrument_id, version_id")
      .in("group_id", groupIds)
      .eq("instrument_id", data.instrument_id)
      .limit(1)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!liberado) throw new Error("Este teste não está liberado para você.");

    const { data: versoes, error: vErr } = await supabase
      .from("test_versions")
      .select("id, instrument_id, mentor_id, is_template, is_anonymous, created_at")
      .eq("instrument_id", data.instrument_id)
      .eq("is_published", true);
    if (vErr) throw new Error(vErr.message);
    const versao = resolverVersao(data.instrument_id, liberado.version_id, pessoa.mentor_id, (versoes ?? []) as VersaoCandidata[]);
    if (!versao) throw new Error("Ainda não há uma versão publicada deste teste. Avise seu mentor.");

    const admin = await getAdminStudent();

    // Trava: já existe uma tentativa deste INSTRUMENTO pela metade? Devolve
    // ela direto — o botão da tela não precisa saber se é "começar" ou
    // "retomar", os dois casos terminam abrindo o mesmo /responder/$id.
    const { data: aberta, error: aErr } = await admin
      .from("test_responses")
      .select("id, test_versions!inner(instrument_id)")
      .eq("person_id", pessoa.id)
      .eq("kind", "self")
      .eq("test_versions.instrument_id", data.instrument_id)
      .is("submitted_at", null)
      .is("canceled_at", null)
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (aberta) return { response_id: aberta.id, retomando: true as const };

    // Encadeia com a última SUBMETIDA deste instrumento, se houver — mesmo
    // mecanismo do reteste autorizado pelo mentor (attempt + previous_response_id).
    const { data: ultimaSubmetida } = await admin
      .from("test_responses")
      .select("id, attempt, test_versions!inner(instrument_id)")
      .eq("person_id", pessoa.id)
      .eq("kind", "self")
      .eq("test_versions.instrument_id", data.instrument_id)
      .not("submitted_at", "is", null)
      .order("attempt", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: nova, error: iErr } = await admin
      .from("test_responses")
      .insert({
        version_id: versao.id,
        person_id: pessoa.id,
        group_id: liberado.group_id,
        mentor_id: pessoa.mentor_id,
        kind: "self",
        status: "pending",
        attempt: (ultimaSubmetida?.attempt ?? 0) + 1,
        previous_response_id: ultimaSubmetida?.id ?? null,
      })
      .select("id")
      .single();
    if (iErr) throw new Error(iErr.message);
    return { response_id: nova.id, retomando: false as const };
  });

/**
 * Cancela a própria tentativa pela metade — a saída que a trava da regra 5
 * exige oferecer ("ou ele conclui, ou cancela a anterior"). Mesmo mecanismo
 * do cancelamento que o mentor já tem (`setResponseCanceled`): marca
 * `canceled_at`, nunca apaga a linha — quem cancelou continua no histórico.
 */
export const cancelarMinhaTentativa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ response_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: resp, error } = await supabase
      .from("test_responses")
      .select("id, person_id, submitted_at, canceled_at, people!inner(user_id)")
      .eq("id", data.response_id)
      .eq("people.user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!resp) throw new Error("Tentativa não encontrada ou não é sua.");
    if (resp.submitted_at) throw new Error("Esta tentativa já foi concluída — não há o que cancelar.");
    if (resp.canceled_at) return { ok: true as const };

    const admin = await getAdminStudent();
    const { error: uErr } = await admin
      .from("test_responses")
      .update({ canceled_at: new Date().toISOString() })
      .eq("id", data.response_id);
    if (uErr) throw new Error(uErr.message);
    return { ok: true as const };
  });
