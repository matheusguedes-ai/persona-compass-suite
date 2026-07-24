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
    .select("id, submitted_at, version_id, people(full_name), test_versions(title, description)")
    .eq("id", id)
    .maybeSingle();
  if (!response) return null;
  if (response.submitted_at) {
    return { submitted: true as const };
  }
  const versionId = response.version_id;
  const { data: questions } = await supabase
    .from("test_questions")
    .select("id, type, prompt, required, config, sort_order")
    .eq("version_id", versionId)
    .order("sort_order");
  const qIds = (questions ?? []).map((q) => q.id);
  const { data: options } = qIds.length
    ? await supabase.from("test_options").select("id, question_id, label, sort_order").in("question_id", qIds).order("sort_order")
    : { data: [] };
  return {
    submitted: false as const,
    response: {
      id: response.id,
      submitted_at: response.submitted_at,
      test_versions: response.test_versions,
      people: response.people,
    },
    questions: questions ?? [],
    options: options ?? [],
  };
}

const submitSchema = z.object({
  answers: z.array(z.object({
    question_id: z.string().uuid(),
    payload: z.record(z.string(), z.unknown()),
  })),
});

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function hasContent(qType: string, payload: Record<string, unknown> | undefined): boolean {
  if (!payload) return false;
  if (qType === "multiple_choice") return typeof payload.option_id === "string" && payload.option_id.length > 0;
  if (qType === "checkboxes") return Array.isArray(payload.option_ids) && (payload.option_ids as unknown[]).length > 0;
  if (qType === "linear_scale") {
    const v = payload.value;
    return typeof v === "number" && Number.isFinite(v);
  }
  if (qType === "ranking" || qType === "drag_order") {
    return Array.isArray(payload.ordered_option_ids) && (payload.ordered_option_ids as unknown[]).length > 0;
  }
  return Object.keys(payload).length > 0;
}

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
  const dimById = new Map((dims ?? []).map((d) => [d.id, d]));
  const qIdSet = new Set(qIds);
  const optIdSet = new Set(optIds);
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

  // Reject answers pointing at questions from a different version
  for (const a of input.answers) {
    if (!qIdSet.has(a.question_id)) throw new Error("Pergunta inválida no envio.");
  }
  const givenMap = new Map(input.answers.map((a) => [a.question_id, a.payload]));

  // Sanitized payloads to persist (dedup + type-safe)
  const sanitized = new Map<string, Record<string, unknown>>();

  for (const q of questions ?? []) {
    const payload = givenMap.get(q.id);
    if (q.required && !hasContent(q.type, payload)) {
      throw new Error(`Pergunta obrigatória sem resposta: "${q.prompt || q.id}"`);
    }
    if (!payload) continue;

    if (q.type === "multiple_choice") {
      const optId = typeof payload.option_id === "string" ? payload.option_id : undefined;
      if (!optId) continue;
      if (!optIdSet.has(optId)) throw new Error("Opção inválida no envio.");
      sanitized.set(q.id, { option_id: optId });
      (scoresByOpt.get(optId) ?? []).forEach((s) => addPoints(s.dimension_id, s.points));
    } else if (q.type === "checkboxes") {
      const raw = Array.isArray(payload.option_ids) ? (payload.option_ids as unknown[]).filter((x): x is string => typeof x === "string") : [];
      const ids = dedupe(raw);
      for (const id of ids) if (!optIdSet.has(id)) throw new Error("Opção inválida no envio.");
      sanitized.set(q.id, { option_ids: ids });
      ids.forEach((optId) => (scoresByOpt.get(optId) ?? []).forEach((s) => addPoints(s.dimension_id, s.points)));
    } else if (q.type === "linear_scale") {
      const value = Number(payload.value);
      if (!Number.isFinite(value)) {
        if (q.required) throw new Error(`Pergunta obrigatória sem resposta: "${q.prompt || q.id}"`);
        continue;
      }
      sanitized.set(q.id, { value });
      const cfg = (q.config ?? {}) as Json;
      const dimId = typeof cfg.dimension_id === "string" ? cfg.dimension_id : undefined;
      const dimKey = typeof cfg.dimension_key === "string" ? cfg.dimension_key : undefined;
      const dim = (dimId && dimById.get(dimId)) || (dimKey && dimByKey.get(dimKey)) || undefined;
      if (dim) addPoints(dim.id, value);
    } else if (q.type === "ranking" || q.type === "drag_order") {
      const raw = Array.isArray(payload.ordered_option_ids) ? (payload.ordered_option_ids as unknown[]).filter((x): x is string => typeof x === "string") : [];
      const ordered = dedupe(raw);
      for (const id of ordered) if (!optIdSet.has(id)) throw new Error("Opção inválida no envio.");
      sanitized.set(q.id, { ordered_option_ids: ordered });
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
  if (sanitized.size > 0) {
    const { error: delErr } = await supabase.from("test_answers").delete().eq("response_id", id);
    if (delErr) throw new Error(delErr.message);
    const { error: insErr } = await supabase.from("test_answers").insert(
      Array.from(sanitized.entries()).map(([question_id, payload]) => ({
        response_id: id, question_id, payload: payload as never,
      })),
    );
    if (insErr) throw new Error(insErr.message);
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
  const dominantDim = dominantDimId != null ? dimById.get(dominantDimId) : undefined;
  const band = bandId ? (bands ?? []).find((b) => b.id === bandId) : undefined;
  const byDimension = Object.entries(totals).map(([dimId, points]) => {
    const d = dimById.get(dimId);
    return { id: dimId, key: d?.key ?? "", label: d?.label ?? dimId, color: d?.color ?? null, points };
  }).sort((a, b) => b.points - a.points);
  return {
    response: updated,
    result: {
      totals,
      by_dimension: byDimension,
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