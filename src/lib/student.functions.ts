/**
 * Área do aluno (avaliado).
 *
 * Diferente do mentor, o aluno não é dono de nada: ele enxerga apenas os
 * cadastros com o email dele (`people.user_id`) e o que pende daí. As policies
 * que permitem isso são as `*_student_read` da migração `20260728050000`.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Liga a conta aos cadastros com o mesmo email e devolve o que o aluno tem.
 *
 * O `claim` roda toda vez de propósito: se o mentor cadastrar a pessoa depois
 * de ela já ter criado a conta, o vínculo aparece no próximo acesso sem
 * ninguém precisar fazer nada.
 */
export const getStudentArea = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const { error: claimErr } = await supabase.rpc("claim_student_profile");
    if (claimErr) throw new Error(claimErr.message);

    const { data: pessoas, error: pErr } = await supabase
      .from("people")
      .select("id, full_name, email")
      .not("user_id", "is", null);
    if (pErr) throw new Error(pErr.message);

    if (!pessoas || pessoas.length === 0) {
      return { vinculado: false as const, nome: null, respostas: [], baterias: [] };
    }

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
  });
