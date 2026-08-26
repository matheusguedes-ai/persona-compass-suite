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
      .select("id, status, submitted_at, created_at, assessment_response_id, attempt, test_versions(title)")
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
    const { data: minhas, error } = await q;
    if (error) throw new Error(error.message);
    if (!minhas || minhas.length === 0) return { resultados: [] };

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
            perfil: r.perfil_indefinido ? null : r.profile,
            fatores: r.factors
              .filter((f) => f.has_data !== false)
              .map((f) => ({
                key: f.key,
                label: f.label,
                color: f.color,
                valor: Math.round(f.natural_norm),
                faixa: f.band_natural?.title ?? null,
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
