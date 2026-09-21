import { mensagemDeErro } from "@/lib/erro-legivel";
import { createFileRoute } from "@tanstack/react-router";
import { buildReport, buildMbtiFromFactors, formatDuration, podeVerPessoaAutenticado } from "@/lib/report.server";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/**
 * Relatório unificado de uma bateria: uma seção por teste efetivamente
 * respondido. Nada é exibido a partir de um teste que a pessoa não respondeu —
 * derivações do DISC seguem rotuladas como tal no cliente.
 */
async function buildBatteryReport(assessmentId: string) {
  const supabase = await getAdmin();

  const { data: assessment } = await supabase
    .from("assessment_responses")
    .select("id, status, started_at, submitted_at, created_at, person_id, people(full_name)")
    .eq("id", assessmentId)
    .maybeSingle();

  if (!assessment) return { status: 404 as const, error: "Bateria não encontrada." };

  // Mesma trava de report.server.ts: sem sessão, é o link público de sempre;
  // com sessão, ela precisa alcançar esta pessoa pela RLS de sempre. Barra
  // ANTES de devolver `assessment` para quem chamou — `people(full_name)` já
  // veio junto na consulta acima, e o nome também é dado da pessoa, não só
  // os escores das etapas.
  if (!(await podeVerPessoaAutenticado(assessment.person_id))) {
    return { status: 404 as const, error: "Você não tem acesso a este relatório." };
  }

  const { data: partRows, error: partsErr } = await supabase
    .from("test_responses")
    .select("id, assessment_sort, submitted_at, started_at, test_versions(title, instrument_id)")
    .eq("assessment_response_id", assessmentId)
    .eq("kind", "self")
    .order("assessment_sort");
  if (partsErr) throw new Error(partsErr.message);

  const all = partRows ?? [];
  const submitted = all.filter((p) => p.submitted_at);
  if (submitted.length === 0) {
    return { status: 404 as const, error: "Relatório indisponível: nenhuma etapa da bateria foi concluída ainda." };
  }

  const built = await Promise.all(submitted.map((p) => buildReport(p.id)));
  const parts = built
    .map((b, i) => (b.status === 200 ? { ...b.data, assessment_sort: submitted[i].assessment_sort ?? i } : null))
    .filter((p): p is NonNullable<typeof p> => p != null)
    .sort((a, b) => a.assessment_sort - b.assessment_sort);

  if (parts.length === 0) {
    return { status: 404 as const, error: "As etapas concluídas ainda não geram relatório." };
  }

  // MBTI respondido de verdade substitui a estimativa derivada do DISC.
  const mbtiPart = parts.find((p) => p.is_mbti);
  const mbtiReal = mbtiPart ? buildMbtiFromFactors(mbtiPart.factors) : null;

  // Tempo total: da primeira etapa iniciada à última submetida.
  const starts = submitted.map((p) => p.started_at).filter((v): v is string => !!v);
  const ends = submitted.map((p) => p.submitted_at).filter((v): v is string => !!v);
  const firstStart = starts.length > 0 ? starts.sort()[0] : assessment.started_at;
  const lastEnd = ends.length > 0 ? ends.sort()[ends.length - 1] : assessment.submitted_at;

  return {
    status: 200 as const,
    data: {
      assessment_id: assessmentId,
      // Todas as etapas são do mesmo mentor, então a marca da primeira vale
      // para a bateria inteira.
      brand: parts[0]?.brand ?? null,
      settings: parts[0]?.settings ?? null,
      person_name: assessment.people?.full_name ?? parts[0]?.person_name ?? null,
      submitted_at: lastEnd,
      duration: formatDuration(firstStart, lastEnd),
      total_parts: all.length,
      done_parts: submitted.length,
      pending_titles: all
        .filter((p) => !p.submitted_at)
        .map((p) => p.test_versions?.title ?? "Teste"),
      mbti_real: mbtiReal,
      parts,
    },
  };
}

export const Route = createFileRoute("/api/public/report-bateria/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const out = await buildBatteryReport(params.id);
          if (out.status === 404) return json({ error: out.error }, 404);
          return json(out.data);
        } catch (e) {
          const msg = mensagemDeErro(e);
          return json({ error: msg }, 500);
        }
      },
    },
  },
});
