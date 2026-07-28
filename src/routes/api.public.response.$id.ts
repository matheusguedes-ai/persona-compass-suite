import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { loadBrandAndSettings } from "@/lib/brand.server";

type Json = { [k: string]: unknown };

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadResponsePayload(id: string) {
  const supabase = await getAdmin();
  const { data: response } = await supabase
    .from("test_responses")
    .select("id, submitted_at, expires_at, canceled_at, version_id, kind, mentor_id, people(full_name), test_versions(title, description)")
    .eq("id", id)
    .maybeSingle();
  if (!response) return null;
  // Marca do mentor dono do link: quem responde não tem conta, então a
  // identidade visual precisa vir junto com os dados.
  const { brand } = await loadBrandAndSettings(response.mentor_id);
  if (response.submitted_at) {
    return { submitted: true as const, kind: response.kind ?? "self", brand };
  }
  // Cancelado só barra quem ainda ia responder: quem já enviou continua vendo
  // o resultado (o retorno acima).
  if (response.canceled_at) return "canceled" as const;
  // Quem já enviou não é barrado (retorno acima); só bloqueia quem ainda responderia.
  if (response.expires_at && new Date(response.expires_at).getTime() < Date.now()) {
    return "expired" as const;
  }
  await supabase
    .from("test_responses")
    .update({ started_at: new Date().toISOString(), status: "in_progress" })
    .eq("id", id)
    .is("started_at", null);
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
    brand,
    kind: (response.kind ?? "self") as "self" | "observer",
    subject_name: response.people?.full_name ?? null,
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
  rater_name: z.string().trim().min(1).max(120).optional(),
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
  if (qType === "forced_choice") {
    const m = payload.most_option_id;
    const l = payload.least_option_id;
    return typeof m === "string" && typeof l === "string" && m.length > 0 && l.length > 0 && m !== l;
  }
  return Object.keys(payload).length > 0;
}

async function computeAndStore(id: string, input: z.infer<typeof submitSchema>) {
  const supabase = await getAdmin();
  const { data: response } = await supabase.from("test_responses").select("*").eq("id", id).maybeSingle();
  if (!response) throw new Error("Resposta não encontrada");
  if (response.submitted_at) throw new Error("Esta resposta já foi enviada");
  // Vale também no envio: sem isso, uma aba aberta antes do prazo ainda gravaria.
  if (response.expires_at && new Date(response.expires_at).getTime() < Date.now()) {
    throw new Error("Este link expirou. Peça um novo ao seu mentor.");
  }

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
  const natural: Record<string, number> = {};
  const adaptado: Record<string, number> = {};
  const addPoints = (dimensionId: string, points: number) => {
    totals[dimensionId] = (totals[dimensionId] ?? 0) + points;
  };
  const addNatural = (dimensionId: string, points: number) => {
    natural[dimensionId] = (natural[dimensionId] ?? 0) + points;
  };
  const addAdaptado = (dimensionId: string, points: number) => {
    adaptado[dimensionId] = (adaptado[dimensionId] ?? 0) + points;
  };
  // Contribuição dos tipos de pergunta que não são escolha forçada
  // (entra tanto no perfil natural quanto no adaptado).
  const other: Record<string, number> = {};
  const addOther = (dimensionId: string, points: number) => {
    other[dimensionId] = (other[dimensionId] ?? 0) + points;
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
      (scoresByOpt.get(optId) ?? []).forEach((s) => { addPoints(s.dimension_id, s.points); addOther(s.dimension_id, s.points); });
    } else if (q.type === "checkboxes") {
      const raw = Array.isArray(payload.option_ids) ? (payload.option_ids as unknown[]).filter((x): x is string => typeof x === "string") : [];
      const ids = dedupe(raw);
      for (const id of ids) if (!optIdSet.has(id)) throw new Error("Opção inválida no envio.");
      sanitized.set(q.id, { option_ids: ids });
      ids.forEach((optId) => (scoresByOpt.get(optId) ?? []).forEach((s) => { addPoints(s.dimension_id, s.points); addOther(s.dimension_id, s.points); }));
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
      if (dim) { addPoints(dim.id, value); addOther(dim.id, value); }
    } else if (q.type === "ranking" || q.type === "drag_order") {
      const raw = Array.isArray(payload.ordered_option_ids) ? (payload.ordered_option_ids as unknown[]).filter((x): x is string => typeof x === "string") : [];
      const ordered = dedupe(raw);
      for (const id of ordered) if (!optIdSet.has(id)) throw new Error("Opção inválida no envio.");
      sanitized.set(q.id, { ordered_option_ids: ordered });
      const cfg = (q.config ?? {}) as Json;
      const topWeight = Number(cfg.top_weight ?? ordered.length);
      ordered.forEach((optId, idx) => {
        const weight = Math.max(0, topWeight - idx);
        (scoresByOpt.get(optId) ?? []).forEach((s) => { addPoints(s.dimension_id, s.points * weight); addOther(s.dimension_id, s.points * weight); });
      });
    } else if (q.type === "forced_choice") {
      const most = typeof payload.most_option_id === "string" ? payload.most_option_id : undefined;
      const least = typeof payload.least_option_id === "string" ? payload.least_option_id : undefined;
      if (!most || !least) throw new Error("Escolha forçada exige MAIS e MENOS.");
      if (most === least) throw new Error("MAIS e MENOS não podem ser a mesma opção.");
      // Validate that both options belong to this question (and to the version).
      const qOptIds = new Set((options ?? []).filter((o) => o.question_id === q.id).map((o) => o.id));
      if (!qOptIds.has(most) || !qOptIds.has(least)) throw new Error("Opção inválida no envio.");
      sanitized.set(q.id, { most_option_id: most, least_option_id: least });
      const mostScores = scoresByOpt.get(most) ?? [];
      const leastScores = scoresByOpt.get(least) ?? [];
      mostScores.forEach((s) => {
        addPoints(s.dimension_id, s.points);
        addNatural(s.dimension_id, s.points);
        addAdaptado(s.dimension_id, s.points);
      });
      leastScores.forEach((s) => {
        addAdaptado(s.dimension_id, -s.points);
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

  // ------------------------------------------------------------------
  // Normalização 0–100 por dimensão: derivamos os mínimos e máximos
  // teóricos de TODOS os tipos de pergunta da versão.
  // ------------------------------------------------------------------
  const forcedQs = (questions ?? []).filter((q) => q.type === "forced_choice");
  const normalized: Record<string, { natural: number; adaptado: number }> = {};
  const bestNat: Record<string, number> = {};
  const worstNat: Record<string, number> = {};
  const bestAdap: Record<string, number> = {};
  const worstAdap: Record<string, number> = {};
  const bump = (rec: Record<string, number>, dimId: string, v: number) => { rec[dimId] = (rec[dimId] ?? 0) + v; };
  const bumpBoth = (dimId: string, min: number, max: number) => {
    bump(bestNat, dimId, max); bump(worstNat, dimId, min);
    bump(bestAdap, dimId, max); bump(worstAdap, dimId, min);
  };
  const pointsFor = (optId: string, dimId: string) =>
    (scoresByOpt.get(optId) ?? []).filter((s) => s.dimension_id === dimId).reduce((acc, s) => acc + s.points, 0);
  const dimsOfQuestion = (qOpts: Array<{ id: string }>) => {
    const set = new Set<string>();
    qOpts.forEach((o) => (scoresByOpt.get(o.id) ?? []).forEach((s) => set.add(s.dimension_id)));
    return Array.from(set);
  };

  for (const q of questions ?? []) {
    const qOpts = (options ?? []).filter((o) => o.question_id === q.id);
    if (q.type === "forced_choice") {
      const perDim = new Map<string, number[]>();
      qOpts.forEach((o) => {
        (scoresByOpt.get(o.id) ?? []).forEach((s) => {
          const list = perDim.get(s.dimension_id) ?? [];
          list.push(s.points);
          perDim.set(s.dimension_id, list);
        });
      });
      perDim.forEach((pts, dimId) => {
        const max = Math.max(...pts, 0);
        bump(bestNat, dimId, max);
        bump(worstNat, dimId, 0);
        bump(bestAdap, dimId, max);
        bump(worstAdap, dimId, -max);
      });
    } else if (q.type === "multiple_choice") {
      for (const dimId of dimsOfQuestion(qOpts)) {
        const pts = qOpts.map((o) => pointsFor(o.id, dimId));
        bumpBoth(dimId, Math.min(...pts, 0), Math.max(...pts, 0));
      }
    } else if (q.type === "checkboxes") {
      for (const dimId of dimsOfQuestion(qOpts)) {
        const pts = qOpts.map((o) => pointsFor(o.id, dimId));
        bumpBoth(
          dimId,
          pts.filter((p) => p < 0).reduce((a, b) => a + b, 0),
          pts.filter((p) => p > 0).reduce((a, b) => a + b, 0),
        );
      }
    } else if (q.type === "linear_scale") {
      const cfg = (q.config ?? {}) as Json;
      const dimId = typeof cfg.dimension_id === "string"
        ? cfg.dimension_id
        : (typeof cfg.dimension_key === "string" ? dimByKey.get(cfg.dimension_key)?.id : undefined);
      if (dimId) {
        const mn = Number(cfg.min ?? 1);
        const mx = Number(cfg.max ?? 5);
        if (Number.isFinite(mn) && Number.isFinite(mx) && mx > mn) bumpBoth(dimId, mn, mx);
      }
    } else if (q.type === "ranking" || q.type === "drag_order") {
      const cfg = (q.config ?? {}) as Json;
      const topWeight = Number(cfg.top_weight ?? qOpts.length);
      const weights = qOpts.map((_, idx) => Math.max(0, topWeight - idx));
      for (const dimId of dimsOfQuestion(qOpts)) {
        const pts = qOpts.map((o) => pointsFor(o.id, dimId));
        const desc = [...pts].sort((a, b) => b - a);
        const asc = [...pts].sort((a, b) => a - b);
        const max = weights.reduce((acc, w, i) => acc + w * (desc[i] ?? 0), 0);
        const min = weights.reduce((acc, w, i) => acc + w * (asc[i] ?? 0), 0);
        bumpBoth(dimId, Math.min(min, max), Math.max(min, max));
      }
    }
  }

  // Bruto natural/adaptado somando as contribuições dos demais tipos.
  const rawNatural: Record<string, number> = {};
  const rawAdaptado: Record<string, number> = {};
  new Set([...Object.keys(natural), ...Object.keys(adaptado), ...Object.keys(other)]).forEach((dimId) => {
    rawNatural[dimId] = (natural[dimId] ?? 0) + (other[dimId] ?? 0);
    rawAdaptado[dimId] = (adaptado[dimId] ?? 0) + (other[dimId] ?? 0);
  });

  const normDimIds = new Set<string>([...Object.keys(bestNat), ...Object.keys(bestAdap)]);
  normDimIds.forEach((dimId) => {
    const nRange = (bestNat[dimId] ?? 0) - (worstNat[dimId] ?? 0);
    const aRange = (bestAdap[dimId] ?? 0) - (worstAdap[dimId] ?? 0);
    const nRaw = rawNatural[dimId] ?? 0;
    const aRaw = rawAdaptado[dimId] ?? 0;
    const nPct = nRange > 0 ? Math.max(0, Math.min(100, ((nRaw - (worstNat[dimId] ?? 0)) / nRange) * 100)) : 0;
    const aPct = aRange > 0 ? Math.max(0, Math.min(100, ((aRaw - (worstAdap[dimId] ?? 0)) / aRange) * 100)) : 0;
    normalized[dimId] = { natural: nPct, adaptado: forcedQs.length > 0 ? aPct : nPct };
  });
  const hasNormalized = normDimIds.size > 0;

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

  const computed: Record<string, unknown> = { total: totals };
  if (hasNormalized) {
    computed.natural = rawNatural;
    computed.adaptado = rawAdaptado;
    computed.normalized = normalized;
  }
  const { data: updated, error } = await supabase.from("test_responses").update({
    status: "submitted",
    computed_scores: computed as never,
    dominant_dimension_id: dominantDimId,
    result_band_id: bandId,
    submitted_at: new Date().toISOString(),
    ...(input.rater_name ? { rater_name: input.rater_name } : {}),
  }).eq("id", id).select().single();
  if (error) throw new Error(error.message);

  // Se a resposta faz parte de uma bateria, fecha a bateria quando for a última etapa.
  const assessmentId = (response as { assessment_response_id?: string | null }).assessment_response_id ?? null;
  if (assessmentId) {
    const { data: siblings } = await supabase
      .from("test_responses")
      .select("id, submitted_at")
      .eq("assessment_response_id", assessmentId);
    const pending = (siblings ?? []).filter((s) => !s.submitted_at && s.id !== id);
    await supabase.from("assessment_responses").update(
      pending.length === 0
        ? { status: "submitted", submitted_at: new Date().toISOString() }
        : { status: "in_progress" },
    ).eq("id", assessmentId);
  }

  // Build friendly result summary
  const dominantDim = dominantDimId != null ? dimById.get(dominantDimId) : undefined;
  const band = bandId ? (bands ?? []).find((b) => b.id === bandId) : undefined;
  const byDimension = Object.entries(totals).map(([dimId, points]) => {
    const d = dimById.get(dimId);
    return { id: dimId, key: d?.key ?? "", label: d?.label ?? dimId, color: d?.color ?? null, points };
  }).sort((a, b) => b.points - a.points);

  // Per-dimension bands, keyed by normalized (0-100). Fallback to raw if no normalized.
  const perDimBands: Array<{ dimension_id: string; label: string; color: string | null; mode: "natural" | "adaptado"; points: number; normalized: number | null; band: { title: string; description: string | null } | null }> = [];
  const dimsForBands = (dims ?? []).slice().sort((a, b) => (rawNatural[b.id] ?? totals[b.id] ?? 0) - (rawNatural[a.id] ?? totals[a.id] ?? 0));
  for (const mode of ["natural", "adaptado"] as const) {
    for (const d of dimsForBands) {
      const raw = mode === "natural" ? (rawNatural[d.id] ?? totals[d.id] ?? 0) : (rawAdaptado[d.id] ?? 0);
      const norm = normalized[d.id]?.[mode] ?? null;
      const scoreForBand = norm ?? raw;
      const match = (bands ?? []).find((b) =>
        b.dimension_id === d.id
        && ((b as { mode?: string }).mode ?? "natural") === mode
        && scoreForBand >= Number(b.min_score)
        && scoreForBand <= Number(b.max_score),
      );
      if (!match && mode === "adaptado" && forcedQs.length === 0) continue;
      perDimBands.push({
        dimension_id: d.id, label: d.label, color: d.color ?? null,
        mode, points: raw, normalized: norm,
        band: match ? { title: match.title, description: match.description } : null,
      });
    }
  }

  return {
    response: updated,
    assessment_response_id: assessmentId,
    kind: (updated as { kind?: string }).kind ?? "self",
    result: {
      totals,
      natural: hasNormalized ? rawNatural : undefined,
      adaptado: hasNormalized ? rawAdaptado : undefined,
      normalized: hasNormalized ? normalized : undefined,
      per_dimension_bands: perDimBands.filter((p) => p.band != null),
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
          if (!payload) {
            return new Response(
              JSON.stringify({
                error: "not_found",
                message: "Este link não está mais disponível. Ele pode ter sido cancelado ou substituído — peça um novo ao seu mentor.",
              }),
              { status: 404, headers: { "content-type": "application/json" } },
            );
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
          const msg = e instanceof Error ? e.message : "erro";
          return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "content-type": "application/json" } });
        }
      },
      POST: async ({ request, params }) => {
        try {
          const body = await request.json();
          const input = submitSchema.parse(body);
          const result = await computeAndStore(params.id, input);
          if (result.kind === "observer") {
            return new Response(JSON.stringify({ observer: true }), { headers: { "content-type": "application/json" } });
          }
          return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "erro";
          return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { "content-type": "application/json" } });
        }
      },
    },
  },
});