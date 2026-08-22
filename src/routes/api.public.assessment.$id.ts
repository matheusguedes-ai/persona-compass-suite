import { mensagemDeErro } from "@/lib/erro-legivel";
import { createFileRoute } from "@tanstack/react-router";
import { loadBrandAndSettings } from "@/lib/brand.server";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadAssessment(id: string) {
  const supabase = await getAdmin();
  const { data: assessment } = await supabase
    .from("assessment_responses")
    .select("id, status, expires_at, canceled_at, mentor_id, people(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!assessment) return null;
  if (assessment.canceled_at && assessment.status !== "submitted") return "canceled" as const;
  // Prazo vencido bloqueia o acesso, mas quem já concluiu continua podendo ver.
  if (assessment.expires_at && assessment.status !== "submitted") {
    if (new Date(assessment.expires_at).getTime() < Date.now()) return "expired" as const;
  }

  const { data: parts } = await supabase
    .from("test_responses")
    .select("id, assessment_sort, submitted_at, test_versions(title, instrument_id)")
    .eq("assessment_response_id", id)
    .order("assessment_sort");

  const list = (parts ?? []).map((p) => ({
    response_id: p.id,
    title: p.test_versions?.title ?? "Teste",
    instrument_id: p.test_versions?.instrument_id ?? null,
    sort: p.assessment_sort ?? 0,
    submitted: !!p.submitted_at,
  }));
  const done = list.filter((p) => p.submitted).length;
  const allDone = list.length > 0 && done === list.length;

  if (allDone && assessment.status !== "submitted") {
    await supabase.from("assessment_responses")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", id);
  } else if (!allDone && assessment.status === "pending") {
    await supabase.from("assessment_responses")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", id)
      .is("started_at", null);
  }

  // Marca do mentor dono da bateria — quem responde não tem conta.
  const { brand } = await loadBrandAndSettings(assessment.mentor_id);

  return {
    brand,
    person_name: assessment.people?.full_name ?? null,
    parts: list,
    current: list.find((p) => !p.submitted)?.response_id ?? null,
    total: list.length,
    done,
    status: allDone ? "submitted" : assessment.status,
  };
}

export const Route = createFileRoute("/api/public/assessment/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const payload = await loadAssessment(params.id);
          if (!payload) {
            return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "content-type": "application/json" } });
          }
          if (payload === "canceled") {
            return new Response(
              JSON.stringify({ error: "canceled", message: "Este link foi cancelado pelo seu mentor. Se isso não era esperado, fale com ele." }),
              { status: 410, headers: { "content-type": "application/json" } },
            );
          }
          if (payload === "expired") {
            return new Response(
              JSON.stringify({ error: "expired", message: "Este link expirou. Peça um novo ao seu mentor." }),
              { status: 410, headers: { "content-type": "application/json" } },
            );
          }
          return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } });
        } catch (e) {
          const msg = mensagemDeErro(e);
          return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "content-type": "application/json" } });
        }
      },
    },
  },
});
