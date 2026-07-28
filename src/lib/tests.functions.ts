import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

// ============================================================
// Types
// ============================================================
export type QuestionType =
  | "multiple_choice"
  | "checkboxes"
  | "linear_scale"
  | "ranking"
  | "drag_order"
  | "forced_choice";

// ============================================================
// Versions
// ============================================================
export const listTestVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ instrument_id: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("test_versions")
      .select("*")
      .order("is_template", { ascending: false })
      .order("created_at", { ascending: false });
    if (data.instrument_id) q = q.eq("instrument_id", data.instrument_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getTestVersion = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: version, error: vErr }, dims, questions, bands] = await Promise.all([
      context.supabase.from("test_versions").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("test_dimensions").select("*").eq("version_id", data.id).order("sort_order"),
      context.supabase.from("test_questions").select("*").eq("version_id", data.id).order("sort_order"),
      context.supabase.from("test_result_bands").select("*").eq("version_id", data.id).order("sort_order"),
    ]);
    if (vErr) throw new Error(vErr.message);
    if (!version) throw new Error("Versão não encontrada");
    if (dims.error) throw new Error(dims.error.message);
    if (questions.error) throw new Error(questions.error.message);
    if (bands.error) throw new Error(bands.error.message);

    const questionIds = (questions.data ?? []).map((q) => q.id);
    const [options, scores] = await Promise.all([
      questionIds.length
        ? context.supabase
            .from("test_options")
            .select("*")
            .in("question_id", questionIds)
            .order("sort_order")
        : Promise.resolve({ data: [] as never[], error: null }),
      questionIds.length
        ? context.supabase
            .from("option_scores")
            .select("id, option_id, dimension_id, points, test_options!inner(question_id)")
            .in("test_options.question_id", questionIds)
        : Promise.resolve({ data: [] as never[], error: null }),
    ]);
    if (options.error) throw new Error(options.error.message);
    if (scores.error) throw new Error(scores.error.message);

    return {
      version,
      dimensions: dims.data ?? [],
      questions: questions.data ?? [],
      options: options.data ?? [],
      scores: (scores.data ?? []).map((s: { id: string; option_id: string; dimension_id: string; points: number }) => ({
        id: s.id,
        option_id: s.option_id,
        dimension_id: s.dimension_id,
        points: Number(s.points),
      })),
      bands: bands.data ?? [],
    };
  });

export const duplicateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ template_version_id: z.string().uuid(), title: z.string().min(1).max(160).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: tpl, error: tErr } = await supabase
      .from("test_versions").select("*").eq("id", data.template_version_id).maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!tpl) throw new Error("Template não encontrado");

    // Pre-fetch all source rows first; abort before inserting anything on any error.
    const [dimsRes, qsRes, bandsRes] = await Promise.all([
      supabase.from("test_dimensions").select("*").eq("version_id", tpl.id),
      supabase.from("test_questions").select("*").eq("version_id", tpl.id),
      supabase.from("test_result_bands").select("*").eq("version_id", tpl.id),
    ]);
    if (dimsRes.error) throw new Error(dimsRes.error.message);
    if (qsRes.error) throw new Error(qsRes.error.message);
    if (bandsRes.error) throw new Error(bandsRes.error.message);
    const dims = dimsRes.data ?? [];
    const qs = qsRes.data ?? [];
    const bands = bandsRes.data ?? [];

    let opts: Array<{ id: string; question_id: string; label: string; value: string | null; sort_order: number }> = [];
    let srcScores: Array<{ option_id: string; dimension_id: string; points: number }> = [];
    if (qs.length > 0) {
      const optsRes = await supabase
        .from("test_options").select("*").in("question_id", qs.map((q) => q.id));
      if (optsRes.error) throw new Error(optsRes.error.message);
      opts = optsRes.data ?? [];
      if (opts.length > 0) {
        const scoresRes = await supabase
          .from("option_scores").select("*").in("option_id", opts.map((o) => o.id));
        if (scoresRes.error) throw new Error(scoresRes.error.message);
        srcScores = scoresRes.data ?? [];
      }
    }

    const { data: newV, error: nErr } = await supabase
      .from("test_versions")
      .insert({
        instrument_id: tpl.instrument_id,
        mentor_id: userId,
        title: data.title ?? `${tpl.title} (cópia)`,
        description: tpl.description,
        is_template: false,
        is_published: false,
      })
      .select().single();
    if (nErr) throw new Error(nErr.message);

    const dimMap = new Map<string, string>();
    if (dims.length > 0) {
      const { data: newDims, error } = await supabase
        .from("test_dimensions")
        .insert(dims.map((d) => ({
          version_id: newV.id, key: d.key, label: d.label,
          description: d.description, color: d.color, sort_order: d.sort_order,
        })))
        .select();
      if (error) throw new Error(error.message);
      dims.forEach((d, i) => dimMap.set(d.id, newDims![i].id));
    }

    // O config de perguntas pontuadas por dimensão (ex.: linear_scale do Big Five)
    // guarda o id da dimensão. Sem remapear para as dimensões da nova versão, a
    // referência fica órfã e o teste pontua zero em tudo.
    type QuestionConfig = (typeof qs)[number]["config"];
    const remapQuestionConfig = (config: QuestionConfig): QuestionConfig => {
      if (!config || typeof config !== "object" || Array.isArray(config)) return config;
      const next: Record<string, unknown> = { ...config };
      if (typeof next.dimension_id === "string") {
        // Sem correspondência, zera em vez de manter um id de outra versão.
        next.dimension_id = dimMap.get(next.dimension_id) ?? null;
      }
      return next as QuestionConfig;
    };

    const qMap = new Map<string, string>();
    if (qs.length > 0) {
      const { data: newQs, error } = await supabase
        .from("test_questions")
        .insert(qs.map((q) => ({
          version_id: newV.id, type: q.type, prompt: q.prompt, helper: q.helper,
          required: q.required, sort_order: q.sort_order, config: remapQuestionConfig(q.config),
        })))
        .select();
      if (error) throw new Error(error.message);
      qs.forEach((q, i) => qMap.set(q.id, newQs![i].id));

      const optMap = new Map<string, string>();
      if (opts.length > 0) {
        const { data: newOpts, error: oErr } = await supabase
          .from("test_options")
          .insert(opts.map((o) => ({
            question_id: qMap.get(o.question_id)!,
            label: o.label, value: o.value, sort_order: o.sort_order,
          })))
          .select();
        if (oErr) throw new Error(oErr.message);
        opts.forEach((o, i) => optMap.set(o.id, newOpts![i].id));

        if (srcScores.length > 0) {
          const { error: sErr } = await supabase.from("option_scores").insert(
            srcScores.map((s) => ({
              option_id: optMap.get(s.option_id)!,
              dimension_id: dimMap.get(s.dimension_id)!,
              points: s.points,
            })),
          );
          if (sErr) throw new Error(sErr.message);
        }
      }
    }

    if (bands.length > 0) {
      const { error } = await supabase.from("test_result_bands").insert(
        bands.map((b) => ({
          version_id: newV.id,
          dimension_id: b.dimension_id ? dimMap.get(b.dimension_id) : null,
          min_score: b.min_score, max_score: b.max_score,
          title: b.title, description: b.description, sort_order: b.sort_order,
          mode: b.mode,
        })),
      );
      if (error) throw new Error(error.message);
    }

    return newV;
  });

export const updateTestVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      title: z.string().trim().min(1).max(160).optional(),
      description: z.string().trim().max(1000).optional().nullable(),
      is_published: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("test_versions").update(rest).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTestVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("test_versions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Dimensions
// ============================================================
export const upsertDimension = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    version_id: z.string().uuid(),
    key: z.string().trim().min(1).max(20),
    label: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500).optional().nullable(),
    color: z.string().trim().max(20).optional().nullable(),
    sort_order: z.number().int().default(0),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("test_dimensions").upsert(data).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteDimension = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("test_dimensions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Questions
// ============================================================
const questionTypeSchema = z.enum(["multiple_choice", "checkboxes", "linear_scale", "ranking", "drag_order", "forced_choice"]);

export const createQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    version_id: z.string().uuid(),
    type: questionTypeSchema,
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: max } = await context.supabase
      .from("test_questions").select("sort_order").eq("version_id", data.version_id)
      .order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const sort_order = (max?.sort_order ?? 0) + 1;
    const defaultConfig =
      data.type === "linear_scale" ? { min: 1, max: 5, minLabel: "Discordo", maxLabel: "Concordo" } :
      data.type === "ranking" || data.type === "drag_order" ? { top_weight: 3 } :
      data.type === "forced_choice" ? { hint: "Escolha a que MAIS e a que MENOS descreve você." } : {};
    const { data: row, error } = await context.supabase.from("test_questions").insert({
      version_id: data.version_id, type: data.type, prompt: "", required: true,
      sort_order, config: defaultConfig,
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    prompt: z.string().trim().max(500).optional(),
    helper: z.string().trim().max(500).optional().nullable(),
    required: z.boolean().optional(),
    type: questionTypeSchema.optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    sort_order: z.number().int().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, config, ...rest } = data;
    const patch = { ...rest, ...(config !== undefined ? { config: config as Json } : {}) };
    const { data: row, error } = await context.supabase
      .from("test_questions").update(patch).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("test_questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    version_id: z.string().uuid(),
    ordered_ids: z.array(z.string().uuid()),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const results = await Promise.all(
      data.ordered_ids.map((id, i) =>
        context.supabase.from("test_questions").update({ sort_order: i + 1 }).eq("id", id),
      ),
    );
    for (const r of results) {
      if (r.error) throw new Error(r.error.message);
    }
    return { ok: true };
  });

// ============================================================
// Options
// ============================================================
export const createOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ question_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: max } = await context.supabase
      .from("test_options").select("sort_order").eq("question_id", data.question_id)
      .order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const sort_order = (max?.sort_order ?? 0) + 1;
    const { data: row, error } = await context.supabase
      .from("test_options").insert({ question_id: data.question_id, label: "", sort_order }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    label: z.string().trim().max(300).optional(),
    value: z.string().trim().max(80).optional().nullable(),
    sort_order: z.number().int().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("test_options").update(rest).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("test_options").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setOptionScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    option_id: z.string().uuid(),
    dimension_id: z.string().uuid(),
    points: z.number().finite(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.points === 0) {
      await context.supabase.from("option_scores").delete()
        .eq("option_id", data.option_id).eq("dimension_id", data.dimension_id);
      return { ok: true };
    }
    const { error } = await context.supabase.from("option_scores").upsert(
      data, { onConflict: "option_id,dimension_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Result bands
// ============================================================
export const upsertBand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    version_id: z.string().uuid(),
    dimension_id: z.string().uuid().nullable().optional(),
    min_score: z.number().finite(),
    max_score: z.number().finite(),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1000).optional().nullable(),
    sort_order: z.number().int().default(0),
    mode: z.enum(["natural", "adaptado"]).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("test_result_bands").upsert(data).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteBand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("test_result_bands").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Responses (mentor-authenticated)
// ============================================================
export const startResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    version_id: z.string().uuid(),
    person_id: z.string().uuid(),
    group_id: z.string().uuid().optional().nullable(),
    expires_at: z.string().datetime().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    // Verify ownership: person must belong to this mentor, and version must be
    // either a global template or owned by this mentor.
    const [personRes, versionRes] = await Promise.all([
      context.supabase.from("people").select("id, mentor_id").eq("id", data.person_id).maybeSingle(),
      context.supabase.from("test_versions").select("id, mentor_id, is_template").eq("id", data.version_id).maybeSingle(),
    ]);
    if (personRes.error) throw new Error(personRes.error.message);
    if (versionRes.error) throw new Error(versionRes.error.message);
    if (!personRes.data || personRes.data.mentor_id !== context.userId) {
      throw new Error("Pessoa não encontrada ou não pertence a você.");
    }
    const v = versionRes.data;
    if (!v || (!v.is_template && v.mentor_id !== context.userId)) {
      throw new Error("Versão de teste não encontrada ou não pertence a você.");
    }
    const { data: row, error } = await context.supabase.from("test_responses").insert({
      version_id: data.version_id,
      person_id: data.person_id,
      group_id: data.group_id ?? null,
      mentor_id: context.userId,
      status: "pending",
      expires_at: data.expires_at ?? null,
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listResponses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    group_id: z.string().uuid().optional(),
    person_id: z.string().uuid().optional(),
    person_ids: z.array(z.string().uuid()).optional(),
  }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("test_responses")
      .select("*, people(id, full_name, email), test_versions(id, title, instrument_id)")
      .eq("kind", "self")
      .is("assessment_response_id", null)
      .order("created_at", { ascending: false });
    if (data.group_id) q = q.eq("group_id", data.group_id);
    if (data.person_id) q = q.eq("person_id", data.person_id);
    if (data.person_ids && data.person_ids.length > 0) q = q.in("person_id", data.person_ids);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    if (list.length === 0) return list;
    const { data: observers, error: obsErr } = await context.supabase
      .from("test_responses")
      .select("id, parent_response_id, submitted_at")
      .eq("kind", "observer")
      .in("parent_response_id", list.map((r) => r.id));
    if (obsErr) throw new Error(obsErr.message);
    const counts = new Map<string, { invited: number; answered: number }>();
    for (const o of observers ?? []) {
      if (!o.parent_response_id) continue;
      const c = counts.get(o.parent_response_id) ?? { invited: 0, answered: 0 };
      c.invited += 1;
      if (o.submitted_at) c.answered += 1;
      counts.set(o.parent_response_id, c);
    }
    return list.map((r) => ({
      ...r,
      observers_invited: counts.get(r.id)?.invited ?? 0,
      observers_answered: counts.get(r.id)?.answered ?? 0,
    }));
  });

// Cria um convite de observador (percepção externa 360°) vinculado a uma
// response própria (kind='self') do mentor autenticado.
export const createObserverInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ response_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: parent, error } = await context.supabase
      .from("test_responses")
      .select("id, kind, version_id, person_id, mentor_id")
      .eq("id", data.response_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!parent || parent.mentor_id !== context.userId) {
      throw new Error("Resposta não encontrada ou não pertence a você.");
    }
    if (parent.kind !== "self") throw new Error("Só é possível convidar observadores para a resposta do próprio avaliado.");
    const { count, error: qErr } = await context.supabase
      .from("test_questions")
      .select("id", { count: "exact", head: true })
      .eq("version_id", parent.version_id)
      .eq("type", "forced_choice");
    if (qErr) throw new Error(qErr.message);
    if (!count || count === 0) throw new Error("Este teste não suporta percepção externa.");
    const { data: row, error: insErr } = await context.supabase.from("test_responses").insert({
      version_id: parent.version_id,
      person_id: parent.person_id,
      mentor_id: context.userId,
      status: "pending",
      kind: "observer",
      parent_response_id: parent.id,
    }).select("id").single();
    if (insErr) throw new Error(insErr.message);
    return { id: row.id };
  });
// ============================================================
// Bateria unificada (assessment_responses)
// ============================================================
export const startAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    person_id: z.string().uuid(),
    version_ids: z.array(z.string().uuid()).min(1).max(10),
    group_id: z.string().uuid().optional().nullable(),
    expires_at: z.string().datetime().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const versionIds = Array.from(new Set(data.version_ids));

    const [personRes, versionsRes] = await Promise.all([
      supabase.from("people").select("id, mentor_id").eq("id", data.person_id).maybeSingle(),
      supabase.from("test_versions").select("id, mentor_id, is_template").in("id", versionIds),
    ]);
    if (personRes.error) throw new Error(personRes.error.message);
    if (versionsRes.error) throw new Error(versionsRes.error.message);
    if (!personRes.data || personRes.data.mentor_id !== userId) {
      throw new Error("Pessoa não encontrada ou não pertence a você.");
    }
    const byId = new Map((versionsRes.data ?? []).map((v) => [v.id, v]));
    for (const vid of versionIds) {
      const v = byId.get(vid);
      if (!v || (!v.is_template && v.mentor_id !== userId)) {
        throw new Error("Versão de teste não encontrada ou não pertence a você.");
      }
    }

    const { data: assessment, error: aErr } = await supabase.from("assessment_responses").insert({
      mentor_id: userId,
      person_id: data.person_id,
      group_id: data.group_id ?? null,
      status: "pending",
      expires_at: data.expires_at ?? null,
    }).select("id").single();
    if (aErr) throw new Error(aErr.message);

    const { error: rErr } = await supabase.from("test_responses").insert(
      data.version_ids.map((version_id, idx) => ({
        version_id,
        person_id: data.person_id,
        group_id: data.group_id ?? null,
        mentor_id: userId,
        status: "pending",
        kind: "self",
        expires_at: data.expires_at ?? null,
        assessment_response_id: assessment.id,
        assessment_sort: idx,
      })),
    );
    if (rErr) {
      await supabase.from("assessment_responses").delete().eq("id", assessment.id);
      throw new Error(rErr.message);
    }
    return { id: assessment.id };
  });

export const listAssessments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ person_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("assessment_responses")
      .select("*, people(id, full_name, email)")
      .order("created_at", { ascending: false });
    if (data.person_id) q = q.eq("person_id", data.person_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    if (list.length === 0) return [];
    const { data: parts, error: pErr } = await context.supabase
      .from("test_responses")
      .select("id, assessment_response_id, assessment_sort, submitted_at, test_versions(id, title, instrument_id)")
      .in("assessment_response_id", list.map((a) => a.id))
      .order("assessment_sort");
    if (pErr) throw new Error(pErr.message);
    return list.map((a) => {
      const mine = (parts ?? []).filter((p) => p.assessment_response_id === a.id);
      return {
        ...a,
        total: mine.length,
        done: mine.filter((p) => p.submitted_at).length,
        parts: mine.map((p) => ({
          response_id: p.id,
          title: p.test_versions?.title ?? "Teste",
          instrument_id: p.test_versions?.instrument_id ?? null,
          submitted: !!p.submitted_at,
        })),
      };
    });
  });

// ============================================================
// Link aberto (invite_links)
// Um único link que várias pessoas respondem, identificando-se na hora.
// ============================================================

export const createInviteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    version_ids: z.array(z.string().uuid()).min(1).max(10),
    title: z.string().trim().max(160).optional().nullable(),
    group_id: z.string().uuid().optional().nullable(),
    expires_at: z.string().datetime().optional().nullable(),
    max_responses: z.number().int().positive().max(10000).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const versionIds = Array.from(new Set(data.version_ids));

    // Mesma regra dos envios: template global ou versão do próprio mentor.
    const { data: versions, error: vErr } = await supabase
      .from("test_versions").select("id, mentor_id, is_template").in("id", versionIds);
    if (vErr) throw new Error(vErr.message);
    const byId = new Map((versions ?? []).map((v) => [v.id, v]));
    for (const vid of versionIds) {
      const v = byId.get(vid);
      if (!v || (!v.is_template && v.mentor_id !== userId)) {
        throw new Error("Versão de teste não encontrada ou não pertence a você.");
      }
    }
    if (data.group_id) {
      const { data: g } = await supabase
        .from("groups").select("id, mentor_id").eq("id", data.group_id).maybeSingle();
      if (!g || g.mentor_id !== userId) throw new Error("Grupo não encontrado ou não pertence a você.");
    }

    const { data: row, error } = await supabase.from("invite_links").insert({
      mentor_id: userId,
      title: data.title?.trim() || null,
      version_ids: versionIds,
      group_id: data.group_id ?? null,
      expires_at: data.expires_at ?? null,
      max_responses: data.max_responses ?? null,
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listInviteLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("invite_links")
      .select("*, groups(name)")
      .eq("mentor_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setInviteLinkActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("invite_links")
      .update({ is_active: data.is_active })
      .eq("id", data.id)
      .eq("mentor_id", context.userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
