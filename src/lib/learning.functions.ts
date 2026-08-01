/**
 * Educação: trilhas → módulos → submódulos → aulas → materiais.
 *
 * Vídeo entra por link do YouTube e material por link externo (Drive etc.).
 * Quem vê o quê é decidido pela RLS (`can_see_track` / `can_edit_track` na
 * migração `20260728050000`): a equipe da conta vê tudo; o aluno vê o que
 * estiver publicado para ele.
 *
 * Em cima disso vem o CADEADO (migração `20260730200000`): o professor escolhe
 * pessoas e grupos por trilha. Quem não foi escolhido continua vendo o card,
 * trancado, e a RLS não entrega módulo, aula nem material — a tranca vale no
 * banco, senão o cadeado seria enfeite e bastaria abrir o console para ler o
 * link do vídeo. Trilha sem destino nenhum continua aberta a todos.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { urlOpcional } from "@/lib/url-segura";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { exigirPermissao, exigirPermissaoOuVisitante } from "@/lib/permissao.server";

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
  cover_url: urlOpcional,
  audience: z.enum(["equipe", "alunos", "ambos"]).default("alunos"),
  is_published: z.boolean().default(false),
});

export const listTracks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ preview_person_id: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    // Compartilhada com o aluno (a própria tela dele) e o mentor (vê tudo,
    // igual ao dono — ver `can_see_track`). Só falta barrar o colaborador
    // sem 'educacao', que hoje entra pela mesma porta que a equipe.
    await exigirPermissaoOuVisitante(context.supabase, context.userId, "educacao");
    const [lista, liberadas] = await Promise.all([
      context.supabase
        .from("learning_tracks")
        // `learning_track_destinos(count)` só volta preenchido para quem edita —
        // a policy de leitura dos destinos é `can_edit_track`. Para o aluno vem
        // zero, e é o que queremos: ele não fica sabendo quem mais tem acesso.
        .select("*, learning_lessons(count), learning_track_destinos(count)")
        .order("sort_order")
        .order("created_at", { ascending: false }),
      context.supabase.rpc("trilhas_liberadas", { _person_id: data.preview_person_id ?? null }),
    ]);
    if (lista.error) throw new Error(lista.error.message);
    if (liberadas.error) throw new Error(liberadas.error.message);

    const abertas = new Set(
      ((liberadas.data ?? []) as unknown as Array<string | { trilhas_liberadas: string }>).map(
        (r) => (typeof r === "string" ? r : r.trilhas_liberadas),
      ),
    );

    // Capa vem do bucket privado 'biblioteca' — precisa de link assinado para
    // abrir, igual capa de material/pasta. É a vitrine do catálogo, então
    // assina sempre, mesmo trancada (quem está trancado ainda vê o card). Link
    // externo (capa antiga, colada) passa direto — assinarUrls só assina o que
    // bate com o padrão do nosso storage.
    const linhas = lista.data ?? [];
    const { assinarUrls, TTL_ARQUIVO_SEGUNDOS } = await import("@/lib/storage-assinado.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const capasAssinadas = await assinarUrls(supabaseAdmin, linhas.map((t) => t.cover_url), TTL_ARQUIVO_SEGUNDOS);

    return linhas.map((t, i) => ({
      ...t,
      cover_url: capasAssinadas[i],
      lessons_count: (t.learning_lessons as unknown as Array<{ count: number }>)?.[0]?.count ?? 0,
      // Quantos destinos a trilha tem: só o professor recebe > 0, e é o que
      // marca o card como "restrita" no catálogo dele.
      destinos_count:
        (t.learning_track_destinos as unknown as Array<{ count: number }>)?.[0]?.count ?? 0,
      liberada: abertas.has(t.id),
    }));
  });

/** Trilha inteira com a árvore montada, para a tela de edição e para o player. */
export const getTrack = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      preview_person_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Mesmo motivo de `listTracks`: tela compartilhada com aluno e mentor.
    await exigirPermissaoOuVisitante(supabase, userId, "educacao");
    const { data: track, error } = await supabase
      .from("learning_tracks").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!track) throw new Error("Trilha não encontrada.");

    // Mesmo motivo de `listTracks`: a capa pode morar no bucket privado
    // 'biblioteca' e precisa de link assinado para abrir — tanto na capa
    // trancada em grayscale quanto no formulário de edição.
    const { assinarUrl, TTL_ARQUIVO_SEGUNDOS } = await import("@/lib/storage-assinado.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    track.cover_url = await assinarUrl(supabaseAdmin, track.cover_url, TTL_ARQUIVO_SEGUNDOS);

    const [mods, lessons, materials, progress, podeEditar, aberta] = await Promise.all([
      supabase.from("learning_modules").select("*").eq("track_id", data.id).order("sort_order"),
      supabase.from("learning_lessons").select("*").eq("track_id", data.id).order("sort_order"),
      supabase.from("learning_materials").select("*").eq("track_id", data.id).order("sort_order"),
      supabase.from("learning_progress").select("lesson_id").eq("track_id", data.id).eq("user_id", userId),
      supabase.rpc("can_edit_track", { _track_id: data.id }),
      // Na prévia "ver como aluno" a pergunta é pelo acesso DAQUELA pessoa, e
      // quem confere se posso perguntar é `trilhas_liberadas`.
      data.preview_person_id
        ? supabase.rpc("trilhas_liberadas", { _person_id: data.preview_person_id })
        : supabase.rpc("track_liberada", { _track_id: data.id }),
    ]);
    if (mods.error) throw new Error(mods.error.message);
    if (lessons.error) throw new Error(lessons.error.message);
    if (materials.error) throw new Error(materials.error.message);

    const liberada = data.preview_person_id
      ? ((aberta.data ?? []) as unknown as Array<string | { trilhas_liberadas: string }>).some(
          (r) => (typeof r === "string" ? r : r.trilhas_liberadas) === data.id,
        )
      : aberta.data === true;

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
      // Trancada não devolve nada de dentro. A RLS já não entregaria, mas
      // zerar aqui também deixa a intenção explícita para quem ler o código.
      modules: liberada ? modules : [],
      concluidas: liberada ? (progress.data ?? []).map((p) => p.lesson_id) : [],
      can_edit: podeEditar.data === true,
      liberada,
    };
  });

// ============================================================
// Quem abre a trilha (o cadeado)
// ============================================================
/** Destinos de uma trilha, para o professor marcar as caixinhas. */
export const getTrackDestinos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ track_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Só o professor marca as caixinhas — aluno e mentor nunca chamam isto.
    await exigirPermissao(context.supabase, context.userId, "educacao");
    const { data: rows, error } = await context.supabase
      .from("learning_track_destinos")
      .select("group_id, person_id")
      .eq("track_id", data.track_id);
    if (error) throw new Error(error.message);
    return {
      group_ids: (rows ?? []).filter((r) => r.group_id).map((r) => r.group_id as string),
      person_ids: (rows ?? []).filter((r) => r.person_id).map((r) => r.person_id as string),
    };
  });

/**
 * Troca os destinos de uma trilha.
 *
 * Por diferença, e não apagando tudo para reinserir: apagar e recriar deixaria
 * a trilha aberta a todos por um instante (sem destino = aberta), e um aluno
 * que carregasse a página nesse intervalo levaria as aulas embora.
 *
 * Lista vazia é uma escolha legítima — significa "aberta para todos os alunos".
 */
export const setTrackDestinos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      track_id: z.string().uuid(),
      group_ids: z.array(z.string().uuid()).max(200).default([]),
      person_ids: z.array(z.string().uuid()).max(500).default([]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await exigirPermissao(supabase, context.userId, "educacao");

    const podeEditar = await supabase.rpc("can_edit_track", { _track_id: data.track_id });
    if (podeEditar.error) throw new Error(podeEditar.error.message);
    if (podeEditar.data !== true) throw new Error("Você não pode editar esta trilha.");

    await validarDestinos(supabase, data.group_ids, data.person_ids);

    const { data: atuais, error: eA } = await supabase
      .from("learning_track_destinos")
      .select("id, group_id, person_id")
      .eq("track_id", data.track_id);
    if (eA) throw new Error(eA.message);

    const quero = new Set([
      ...data.group_ids.map((g) => `g:${g}`),
      ...data.person_ids.map((p) => `p:${p}`),
    ]);
    const tenho = new Map(
      (atuais ?? []).map((r) => [r.group_id ? `g:${r.group_id}` : `p:${r.person_id}`, r.id]),
    );

    const sobrando = [...tenho.entries()].filter(([k]) => !quero.has(k)).map(([, id]) => id);
    if (sobrando.length) {
      const { error } = await supabase.from("learning_track_destinos").delete().in("id", sobrando);
      if (error) throw new Error(error.message);
    }

    const faltando = [...quero].filter((k) => !tenho.has(k));
    if (faltando.length) {
      const { error } = await supabase.from("learning_track_destinos").insert(
        faltando.map((k) => ({
          track_id: data.track_id,
          group_id: k.startsWith("g:") ? k.slice(2) : null,
          person_id: k.startsWith("p:") ? k.slice(2) : null,
        })),
      );
      if (error) throw new Error(error.message);
    }

    return { ok: true, total: quero.size };
  });

/**
 * Confere que grupos e pessoas são da conta antes de gravar.
 *
 * A policy dos destinos só olha a TRILHA — o `group_id` vem do cliente e
 * passaria mesmo sendo de outra conta. Não vazaria conteúdo (a tranca também
 * exige `can_see_track`), mas encheria a tabela de destino que nunca casa e
 * deixaria a trilha "restrita para ninguém", sem sintoma na tela.
 */
async function validarDestinos(
  supabase: SupabaseClient<Database>,
  groupIds: string[],
  personIds: string[],
) {
  if (groupIds.length) {
    const { data, error } = await supabase.from("groups").select("id").in("id", groupIds);
    if (error) throw new Error(error.message);
    if ((data ?? []).length !== new Set(groupIds).size) {
      throw new Error("Um dos grupos escolhidos não é seu.");
    }
  }
  if (personIds.length) {
    const { data, error } = await supabase.from("people").select("id").in("id", personIds);
    if (error) throw new Error(error.message);
    if ((data ?? []).length !== new Set(personIds).size) {
      throw new Error("Uma das pessoas escolhidas não é sua.");
    }
  }
}

export const createTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    trackSchema
      .extend({
        group_ids: z.array(z.string().uuid()).max(200).default([]),
        person_ids: z.array(z.string().uuid()).max(500).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await exigirPermissao(supabase, userId, "educacao");
    const { group_ids, person_ids, ...campos } = data;
    const { data: conta, error: cErr } = await supabase.rpc("acting_account");
    if (cErr) throw new Error(cErr.message);

    // Antes de criar: destino inválido depois da inserção deixaria uma trilha
    // órfã, aberta a todos, que ele não pediu.
    await validarDestinos(supabase, group_ids, person_ids);

    const { data: row, error } = await supabase
      .from("learning_tracks")
      .insert({ ...campos, owner_id: (conta as string) ?? userId })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (group_ids.length || person_ids.length) {
      const { error: eD } = await supabase.from("learning_track_destinos").insert([
        ...group_ids.map((g) => ({ track_id: row.id, group_id: g, person_id: null })),
        ...person_ids.map((p) => ({ track_id: row.id, group_id: null, person_id: p })),
      ]);
      if (eD) {
        // Sem os destinos a trilha nasceria ABERTA a todos — o oposto do que
        // ele escolheu. Desfaz em vez de entregar o contrário do pedido.
        await supabase.from("learning_tracks").delete().eq("id", row.id);
        throw new Error("Não consegui guardar quem tem acesso. A trilha não foi criada.");
      }
    }
    return row;
  });

export const updateTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).merge(trackSchema.partial()).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "educacao");
    const { id, ...rest } = data;
    // Editar sem trocar a capa reenvia o valor ASSINADO que `getTrack` mostrou
    // (é o que ficou no campo do formulário) — preserva o identificador já
    // gravado em vez de persistir um link que expira em minutos. Mesmo cuidado
    // de `salvarPasta` em biblioteca.functions.ts.
    if (rest.cover_url) {
      const { ehUrlAssinadaNossa } = await import("@/lib/storage-assinado.server");
      if (ehUrlAssinadaNossa(rest.cover_url)) {
        const { data: atual } = await context.supabase
          .from("learning_tracks").select("cover_url").eq("id", id).maybeSingle();
        rest.cover_url = atual?.cover_url ?? null;
      }
    }
    const { data: row, error } = await context.supabase
      .from("learning_tracks").update(rest).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "educacao");
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
    await exigirPermissao(context.supabase, context.userId, "educacao");
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
    await exigirPermissao(context.supabase, context.userId, "educacao");
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
      video_url: urlOpcional,
      duration_min: z.number().int().min(0).max(1000).optional().nullable(),
      sort_order: z.number().int().min(0).max(9999).optional(),
      is_published: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "educacao");
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
    await exigirPermissao(context.supabase, context.userId, "educacao");
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
    await exigirPermissao(context.supabase, context.userId, "educacao");
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
    await exigirPermissao(context.supabase, context.userId, "educacao");
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
