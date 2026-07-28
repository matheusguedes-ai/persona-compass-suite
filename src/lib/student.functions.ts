/**
 * Área do aluno (avaliado).
 *
 * Diferente do mentor, o aluno não é dono de nada: ele enxerga apenas os
 * cadastros com o email dele (`people.user_id`) e o que pende daí. As policies
 * que permitem isso são as `*_student_read` da migração `20260728050000`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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

    const { data, error } = await supabase
      .from("people")
      .select("id, full_name, email, phone, avatar_url")
      .eq("user_id", userId)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const email = (context.claims as { email?: string })?.email ?? null;
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
      avatar_url: z.string().trim().max(600).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("update_my_person", {
      _full_name: data.full_name,
      _phone: data.phone ?? null,
      _avatar_url: data.avatar_url ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * As devolutivas do próprio avaliado.
 *
 * A tabela nasceu como ferramenta do mentor, e o aluno — que é quem mais
 * precisa saber que a conversa está marcada — não via nada. A policy
 * `devolutivas_read_aluno` abriu a leitura; aqui a lista sai pronta para a tela.
 *
 * O campo `notes` NÃO sai daqui. É onde o mentor anota impressões da conversa,
 * e nem tudo ali é escrito para o avaliado ler. O que ele recebe é a data, quem
 * conduziu, o que ficou combinado e o acesso ao relatório.
 */
export const getMinhasDevolutivas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    const { data, error } = await supabase
      .from("devolutivas")
      .select(
        "id, status, scheduled_at, completed_at, duration_min, agreements, next_at, response_id, assessment_id, created_by",
      )
      .neq("status", "cancelada")
      .order("completed_at", { ascending: false, nullsFirst: true })
      .order("scheduled_at", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);

    // Nome de quem conduziu. `profiles` não é legível pelo aluno — e não deve
    // ser, guarda marca e e-mail da conta —, então vem por função definidora.
    const autores = [...new Set((data ?? []).map((d) => d.created_by).filter(Boolean) as string[])];
    const nomes = new Map<string, string>();
    await Promise.all(
      autores.map(async (uid) => {
        const { data: nome } = await supabase.rpc("nome_do_mentor", { p_user_id: uid });
        if (nome) nomes.set(uid, nome as string);
      }),
    );

    return {
      devolutivas: (data ?? []).map((d) => ({
        id: d.id,
        status: d.status,
        scheduled_at: d.scheduled_at,
        completed_at: d.completed_at,
        duration_min: d.duration_min,
        agreements: d.agreements,
        next_at: d.next_at,
        mentor: (d.created_by && nomes.get(d.created_by)) || null,
        relatorio: d.assessment_id
          ? `/relatorio-bateria/${d.assessment_id}`
          : d.response_id
            ? `/relatorio/${d.response_id}`
            : null,
      })),
    };
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
