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
  | "drag_order";

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

    // Dimensions
    const { data: dims } = await supabase.from("test_dimensions").select("*").eq("version_id", tpl.id);
    const dimMap = new Map<string, string>();
    if (dims && dims.length > 0) {
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

    // Questions
    const { data: qs } = await supabase.from("test_questions").select("*").eq("version_id", tpl.id);
    const qMap = new Map<string, string>();
    if (qs && qs.length > 0) {
      const { data: newQs, error } = await supabase
        .from("test_questions")
        .insert(qs.map((q) => ({
          version_id: newV.id, type: q.type, prompt: q.prompt, helper: q.helper,
          required: q.required, sort_order: q.sort_order, config: q.config,
        })))
        .select();
      if (error) throw new Error(error.message);
      qs.forEach((q, i) => qMap.set(q.id, newQs![i].id));

      // Options
      const { data: opts } = await supabase
        .from("test_options").select("*").in("question_id", qs.map((q) => q.id));
      const optMap = new Map<string, string>();
      if (opts && opts.length > 0) {
        const { data: newOpts, error: oErr } = await supabase
          .from("test_options")
          .insert(opts.map((o) => ({
            question_id: qMap.get(o.question_id)!,
            label: o.label, value: o.value, sort_order: o.sort_order,
          })))
          .select();
        if (oErr) throw new Error(oErr.message);
        opts.forEach((o, i) => optMap.set(o.id, newOpts![i].id));

        // Scores
        const { data: scores } = await supabase
          .from("option_scores").select("*").in("option_id", opts.map((o) => o.id));
        if (scores && scores.length > 0) {
          const { error: sErr } = await supabase.from("option_scores").insert(
            scores.map((s) => ({
              option_id: optMap.get(s.option_id)!,
              dimension_id: dimMap.get(s.dimension_id)!,
              points: s.points,
            })),
          );
          if (sErr) throw new Error(sErr.message);
        }
      }
    }

    // Bands
    const { data: bands } = await supabase.from("test_result_bands").select("*").eq("version_id", tpl.id);
    if (bands && bands.length > 0) {
      const { error } = await supabase.from("test_result_bands").insert(
        bands.map((b) => ({
          version_id: newV.id,
          dimension_id: b.dimension_id ? dimMap.get(b.dimension_id) : null,
          min_score: b.min_score, max_score: b.max_score,
          title: b.title, description: b.description, sort_order: b.sort_order,
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
const questionTypeSchema = z.enum(["multiple_choice", "checkboxes", "linear_scale", "ranking", "drag_order"]);

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
      data.type === "ranking" || data.type === "drag_order" ? { top_weight: 3 } : {};
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
    await Promise.all(
      data.ordered_ids.map((id, i) =>
        context.supabase.from("test_questions").update({ sort_order: i + 1 }).eq("id", id),
      ),
    );
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
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("test_responses").insert({
      version_id: data.version_id,
      person_id: data.person_id,
      group_id: data.group_id ?? null,
      mentor_id: context.userId,
      status: "pending",
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listResponses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    group_id: z.string().uuid().optional(),
    person_id: z.string().uuid().optional(),
  }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("test_responses")
      .select("*, people(id, full_name, email), test_versions(id, title, instrument_id)")
      .order("created_at", { ascending: false });
    if (data.group_id) q = q.eq("group_id", data.group_id);
    if (data.person_id) q = q.eq("person_id", data.person_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });