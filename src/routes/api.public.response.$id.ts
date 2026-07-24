import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

type Json = { [k: string]: unknown };

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadResponsePayload(id: string) {
  const supabase = await getAdmin();
  const { data: response } = await supabase
    .from("test_responses")
    .select("*, people(id, full_name, email), test_versions(id, title, description, instrument_id)")
    .eq("id", id)
    .maybeSingle();
  if (!response) return null;
  const versionId = response.version_id;
  const [{ data: questions }, { data: dims }] = await Promise.all([
    supabase.from("test_questions").select("*").eq("version_id", versionId).order("sort_order"),
    supabase.from("test_dimensions").select("id, key, label, color, sort_order").eq("version_id", versionId).order("sort_order"),
  ]);
  const qIds = (questions ?? []).map((q) => q.id);
  const { data: options } = qIds.length
    ? await supabase.from("test_options").select("id, question_id, label, sort_order").in("question_id", qIds).order("sort_order")
    : { data: [] };
  return { response, questions: questions ?? [], options: options ?? [], dimensions: dims ?? [] };
}

const submitSchema = z.object({
  answers: z.array(z.object({
    question_id: z.string().uuid(),
    payload: z.record(z.string(), z.unknown()),
  })),
});

async function computeAndStore(id: string, input: z.infer<typeof submitSchema>) {
  const supabase = await getAdmin();
  const { data: response } = await supabase.from("test_responses").select("*").eq("id", id).maybeSingle();
  if (!response) throw new Error("Resposta não encontrada");
  if (response.submitted_at) throw new Error("Esta resposta já foi enviada");

  const versionId = response.version_id;
  const [{ data: questions }, { data: dims }, { data: bands }] = await Promise.all([
    supabase.from("test_questions").select("*").eq("version_id", versionId),
    supabase.from("test_dimensions").select("*").eq("version_id", versionId),
    supabase.from("test_result_bands").select("*").eq("version_id", versionId).order("sort_order"),
  ]);
  const qIds = (questions ?? []).map((q) => q.id);
  const { data: options } = qIds.length
    ? await supabase.from("test_options").select("*").in("question_id", qIds)
    : { data: [] };
  const optIds = (options ?? []).map((o) => o.id);
  const { data: scores } = optIds.length
    ? await supabase.from("option_scores").select("*").in("option_id", optIds)
    : { data: [] };

  const dimByKey = new Map((dims ?? []).map((d) => [d.key, d]));
  const scoresByOpt = new Map<string, Array<{ dimension_id: string; points: number }>>();
  (scores ?? []).forEach((s) => {
    const list = scoresByOpt.get(s.option_id) ?? [];
    list.push({ dimension_id: s.dimension_id, points: Number(s.points) });
    scoresByOpt.set(s.option_id, list);
  });

  const totals: Record<string, number> = {};
  const addPoints = (dimensionId: string, points: number) => {
    totals[dimensionId] = (totals[dimensionId] ?? 0) + points;
  };

  // Validate required + compute
  const qMap = new Map((questions ?? []).map((q) => [q.id, q]));
  const givenMap = new Map(input.answers.map((a) => [a.question_id, a.payload]));

  for (const q of questions ?? []) {
    const payload = givenMap.get(q.id);
    if (q.required && (!payload || Object.keys(payload).length === 0)) {
      throw new Error(`Pergunta obrigatória sem resposta: "${q.prompt || q.id}"`);
    }
    if (!payload) continue;

    if (q.type === "multiple_choice") {
      const optId = payload.option_id as string | undefined;
      if (optId) (scoresByOpt.get(optId) ?? []).forEach((s) => addPoints(s.dimension_id, s.points));
    } else if (q.type === "checkboxes") {
      const ids = (payload.option_ids as string[] | undefined) ?? [];
      ids.forEach((optId) => (scoresByOpt.get(optId) ?? []).forEach((s) => addPoints(s.dimension_id, s.points)));
    } else if (q.type === "linear_scale") {
      const value = Number(payload.value ?? 0);
      const cfg = (q.config ?? {}) as Json;
      const dimKey = cfg.dimension_key as string | undefined;
      const dim = dimKey ? dimByKey.get(dimKey) : undefined;
      if (dim) addPoints(dim.id, value);
    } else if (q.type === "ranking" || q.type === "drag_order") {
      const ordered = (payload.ordered_option_ids as string[] | undefined) ?? [];
      const cfg = (q.config ?? {}) as Json;
      const topWeight = Number(cfg.top_weight ?? ordered.length);
      ordered.forEach((optId, idx) => {
        const weight = Math.max(0, topWeight - idx);
        (scoresByOpt.get(optId) ?? []).forEach((s) => addPoints(s.dimension_id, s.points * weight));
      });
    }
  }

  // Resolve dominant + result band
  let dominantDimId: string | null = null;
  let dominantScore = -Infinity;
  Object.entries(totals).forEach(([dimId, pts]) => {
    if (pts > dominantScore) { dominantScore = pts; dominantDimId = dimId; }
  });

  let bandId: string | null = null;
  if (dominantDimId != null) {
    const targetDim: string = dominantDimId;
    const scoped = (bands ?? []).filter((b) => !b.dimension_id || b.dimension_id === targetDim);
    const match = scoped.find((b) => dominantScore >= Number(b.min_score) && dominantScore <= Number(b.max_score));
    if (match) bandId = match.id;
  }

  // Persist answers (upsert) + response
  if (input.answers.length > 0) {
    await supabase.from("test_answers").delete().eq("response_id", id);
    await supabase.from("test_answers").insert(
      input.answers.map((a) => ({ response_id: id, question_id: a.question_id, payload: a.payload as never })),
    );
  }

  const { data: updated, error } = await supabase.from("test_responses").update({
    status: "submitted",
    computed_scores: totals as never,
    dominant_dimension_id: dominantDimId,
    result_band_id: bandId,
    submitted_at: new Date().toISOString(),
  }).eq("id", id).select().single();
  if (error) throw new Error(error.message);

  // Build friendly result summary
  const dimById = new Map((dims ?? []).map((d) => [d.id, d]));
  const dominantDim = dominantDimId != null ? dimById.get(dominantDimId) : undefined;
  const band = bandId ? (bands ?? []).find((b) => b.id === bandId) : undefined;
  return {
    response: updated,
    result: {
      totals,
      dominant: dominantDim ? { key: dominantDim.key, label: dominantDim.label, color: dominantDim.color } : null,
      band: band ? { title: band.title, description: band.description } : null,
    },
  };
}

export const Route = createFileRoute("/api/public/response/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const payload = await loadResponsePayload(params.id);
          if (!payload) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "content-type": "application/json" } });
          return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "erro";
          return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "content-type": "application/json" } });
        }
      },
      POST: async ({ request, params }) => {
        try {
          const body = await request.json();
          const input = submitSchema.parse(body);
          const result = await computeAndStore(params.id, input);
          return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "erro";
          return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { "content-type": "application/json" } });
        }
      },
    },
  },
});