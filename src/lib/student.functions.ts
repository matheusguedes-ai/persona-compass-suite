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
