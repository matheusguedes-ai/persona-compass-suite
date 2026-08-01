/**
 * Área do aluno (avaliado).
 *
 * Diferente do mentor, o aluno não é dono de nada: ele enxerga apenas os
 * cadastros com o email dele (`people.user_id`) e o que pende daí. As policies
 * que permitem isso são as `*_student_read` da migração `20260728050000`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { urlOpcional } from "@/lib/url-segura";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assinarArquivosMentoria } from "@/lib/storage-assinado.server";
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

    const { data: pessoas, error: pErr } = await supabase
      .from("people")
      .select("id, full_name, email")
      .not("user_id", "is", null);
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
      .select("id, full_name, email, phone, avatar_url")
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
    z.object({
      full_name: z.string().trim().min(2).max(160),
      phone: z.string().trim().max(40).optional().nullable(),
      avatar_url: urlOpcional,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // A tela do aluno carrega a foto já ASSINADA (ver getMyStudentProfile) e
    // reenvia esse mesmo valor ao salvar nome/telefone junto, sem trocar a
    // foto — preserva o identificador já gravado em vez de persistir um link
    // que expira em minutos.
    const { ehUrlAssinadaNossa } = await import("@/lib/storage-assinado.server");
    let avatarUrl = data.avatar_url ?? null;
    if (ehUrlAssinadaNossa(avatarUrl)) {
      const { data: atual } = await context.supabase
        .from("people").select("avatar_url").eq("user_id", context.userId)
        .order("created_at").limit(1).maybeSingle();
      avatarUrl = atual?.avatar_url ?? null;
    }
    const { error } = await context.supabase.rpc("update_my_person", {
      _full_name: data.full_name,
      _phone: data.phone ?? null,
      _avatar_url: avatarUrl,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * As mentorias do próprio avaliado.
 *
 * Ele não executa nada além do checklist — nunca agenda, nunca conclui,
 * nunca edita o resumo. Vê as sessões agendadas (data, modalidade, link ou
 * endereço), vê o resumo das concluídas, e marca os itens do checklist.
 */
export const getMinhasMentorias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("mentorias")
      .select(
        "id, titulo, status, mentoria_sessoes(id, quando, termina_em, modalidade, local, link_url, status, duracao_real_min, resumo, checklist_titulo, concluida_em, avaliacao_estrelas, avaliacao_comentario, avaliada_em, mentoria_tarefas(id, titulo, ordem, concluida, concluida_em), mentoria_arquivos(id, nome, caminho, tamanho_bytes, tipo))",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    type SessaoRow = {
      id: string; quando: string; termina_em: string | null; modalidade: string;
      local: string | null; link_url: string | null; status: string;
      duracao_real_min: number | null; resumo: string | null; checklist_titulo: string | null;
      concluida_em: string | null;
      avaliacao_estrelas: number | null; avaliacao_comentario: string | null; avaliada_em: string | null;
      mentoria_tarefas: Array<{ id: string; titulo: string; ordem: number; concluida: boolean; concluida_em: string | null }> | null;
      mentoria_arquivos: Array<{ id: string; nome: string; caminho: string; tamanho_bytes: number; tipo: string }> | null;
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sessoes = await Promise.all(
      (data ?? []).flatMap((m) =>
        ((m.mentoria_sessoes ?? []) as SessaoRow[])
          .filter((s) => s.status !== "cancelada")
          .map(async (s) => ({
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
          })),
      ),
    );

    return { sessoes };
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
