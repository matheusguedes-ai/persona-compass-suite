/**
 * Educação: trilhas → módulos → submódulos → aulas → materiais.
 *
 * Vídeo entra por link do YouTube e material por link externo (Drive etc.).
 * Quem vê o quê é decidido pela RLS (`can_see_track` / `can_edit_track` na
 * migração `20260728050000`): a equipe da conta vê tudo; o aluno vê o que
 * estiver publicado para ele.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PUBLICOS = [
  { valor: "alunos", titulo: "Alunos", ajuda: "Só quem responde os testes." },
  { valor: "equipe", titulo: "Minha equipe", ajuda: "Só mentores e colaboradores." },
  { valor: "ambos", titulo: "Todo mundo", ajuda: "Equipe e alunos." },
] as const;

export const TIPOS_MATERIAL = ["link", "pdf", "planilha", "video", "audio", "outro"] as const;

/**
 * Extrai o id do vídeo de qualquer formato de link do YouTube (watch, youtu.be,
 * embed, shorts). Devolve null quando não reconhece — aí a tela mostra o link
 * cru em vez de um player quebrado.
 */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const padroes = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const p of padroes) {
    const m = p.exec(url);
    if (m) return m[1];
  }
  return null;
}

// ============================================================
// Trilhas
// ============================================================
const trackSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  cover_url: z.string().trim().max(600).optional().nullable(),
  audience: z.enum(["equipe", "alunos", "ambos"]).default("alunos"),
  is_published: z.boolean().default(false),
});

export const listTracks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("learning_tracks")
      .select("*, learning_lessons(count)")
      .order("sort_order")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((t) => ({
      ...t,
      lessons_count: (t.learning_lessons as unknown as Array<{ count: number }>)?.[0]?.count ?? 0,
    }));
  });

/** Trilha inteira com a árvore montada, para a tela de edição e para o player. */
export const getTrack = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: track, error } = await supabase
      .from("learning_tracks").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!track) throw new Error("Trilha não encontrada.");

    const [mods, lessons, materials, progress, podeEditar] = await Promise.all([
      supabase.from("learning_modules").select("*").eq("track_id", data.id).order("sort_order"),
      supabase.from("learning_lessons").select("*").eq("track_id", data.id).order("sort_order"),
      supabase.from("learning_materials").select("*").eq("track_id", data.id).order("sort_order"),
      supabase.from("learning_progress").select("lesson_id").eq("track_id", data.id).eq("user_id", userId),
      supabase.rpc("can_edit_track", { _track_id: data.id }),
    ]);
    if (mods.error) throw new Error(mods.error.message);
    if (lessons.error) throw new Error(lessons.error.message);
    if (materials.error) throw new Error(materials.error.message);

    const materiaisPorAula = new Map<string, typeof materials.data>();
    for (const m of materials.data ?? []) {
      const lista = materiaisPorAula.get(m.lesson_id) ?? [];
      lista.push(m);
      materiaisPorAula.set(m.lesson_id, lista);
    }
    const aulasPorModulo = new Map<string, Array<(typeof lessons.data)[number] & { materials: typeof materials.data }>>();
    for (const l of lessons.data ?? []) {
      const lista = aulasPorModulo.get(l.module_id) ?? [];
      lista.push({ ...l, materials: materiaisPorAula.get(l.id) ?? [] });
      aulasPorModulo.set(l.module_id, lista);
    }

    const todos = mods.data ?? [];
    const raiz = todos.filter((m) => !m.parent_id);
    const modules = raiz.map((m) => ({
      ...m,
      lessons: aulasPorModulo.get(m.id) ?? [],
      submodules: todos
        .filter((s) => s.parent_id === m.id)
        .map((s) => ({ ...s, lessons: aulasPorModulo.get(s.id) ?? [] })),
    }));

    return {
      track,
      modules,
      concluidas: (progress.data ?? []).map((p) => p.lesson_id),
      can_edit: podeEditar.data === true,
    };
  });

export const createTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => trackSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: conta, error: cErr } = await supabase.rpc("acting_account");
    if (cErr) throw new Error(cErr.message);
    const { data: row, error } = await supabase
      .from("learning_tracks")
      .insert({ ...data, owner_id: (conta as string) ?? userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).merge(trackSchema.partial()).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("learning_tracks").update(rest).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("learning_tracks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Módulos e submódulos
// ============================================================
export const saveModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      track_id: z.string().uuid(),
      parent_id: z.string().uuid().optional().nullable(),
      title: z.string().trim().min(1).max(200),
      description: z.string().trim().max(1000).optional().nullable(),
      sort_order: z.number().int().min(0).max(9999).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const q = id
      ? context.supabase.from("learning_modules").update(rest).eq("id", id)
      : context.supabase.from("learning_modules").insert(rest);
    const { data: row, error } = await q.select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("learning_modules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Aulas
// ============================================================
export const saveLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      track_id: z.string().uuid(),
      module_id: z.string().uuid(),
      title: z.string().trim().min(1).max(200),
      description: z.string().trim().max(4000).optional().nullable(),
      video_url: z.string().trim().max(600).optional().nullable(),
      duration_min: z.number().int().min(0).max(1000).optional().nullable(),
      sort_order: z.number().int().min(0).max(9999).optional(),
      is_published: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const q = id
      ? context.supabase.from("learning_lessons").update(rest).eq("id", id)
      : context.supabase.from("learning_lessons").insert(rest);
    const { data: row, error } = await q.select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("learning_lessons").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Materiais
// ============================================================
export const saveMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      track_id: z.string().uuid(),
      lesson_id: z.string().uuid(),
      title: z.string().trim().min(1).max(200),
      url: z.string().trim().url().max(1000),
      kind: z.enum(TIPOS_MATERIAL).default("link"),
      sort_order: z.number().int().min(0).max(9999).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const q = id
      ? context.supabase.from("learning_materials").update(rest).eq("id", id)
      : context.supabase.from("learning_materials").insert(rest);
    const { data: row, error } = await q.select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("learning_materials").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Progresso
// ============================================================
/** Marca ou desmarca uma aula como assistida. */
export const toggleLessonDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ lesson_id: z.string().uuid(), track_id: z.string().uuid(), done: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.done) {
      const { error } = await supabase
        .from("learning_progress")
        .upsert(
          { lesson_id: data.lesson_id, track_id: data.track_id, user_id: userId },
          { onConflict: "lesson_id,user_id" },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("learning_progress")
        .delete()
        .eq("lesson_id", data.lesson_id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true, done: data.done };
  });
