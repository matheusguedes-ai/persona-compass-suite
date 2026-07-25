import { createFileRoute } from "@tanstack/react-router";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadAssessment(id: string) {
  const supabase = await getAdmin();
  const { data: assessment } = await supabase
    .from("assessment_responses")
    .select("id, status, people(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!assessment) return null;

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

  return {
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
          return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "erro";
          return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "content-type": "application/json" } });
        }
      },
    },
  },
});
