import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Instruments (public read)
// ============================================================
export const listInstruments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("instruments")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ============================================================
// People
// ============================================================
const personSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().nullable(),
  profession: z.string().trim().max(120).optional().nullable(),
  role_at_company: z.string().trim().max(120).optional().nullable(),
  role: z.enum(["cliente", "aluno", "colaborador"]).default("cliente"),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const listPeople = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("people")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getPerson = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: person, error } = await context.supabase
      .from("people")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!person) throw new Error("Pessoa não encontrada");
    const { data: groups } = await context.supabase
      .from("group_members")
      .select("group_id, groups(id, name, type)")
      .eq("person_id", data.id);

    // Histórico de testes da pessoa. Só `self`: respostas de observador (360°)
    // pertencem ao relatório do avaliado e já aparecem dentro dele.
    const { data: responses, error: rErr } = await context.supabase
      .from("test_responses")
      .select(
        "id, status, submitted_at, started_at, created_at, assessment_response_id, assessment_sort, attempt, test_versions(title, instrument_id)",
      )
      .eq("person_id", data.id)
      .eq("mentor_id", context.userId)
      .eq("kind", "self")
      .order("created_at", { ascending: false });
    if (rErr) throw new Error(rErr.message);

    return { person, groups: groups ?? [], responses: responses ?? [] };
  });

export const createPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => personSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("people")
      .insert({ ...data, mentor_id: context.userId })
      .select()
      .single();
    if (error) {
      // O índice único do banco é quem garante; aqui vira frase legível.
      // Dois cadastros com o mesmo e-mail quebram o primeiro acesso do aluno,
      // que casa a pessoa ao usuário justamente pelo e-mail.
      if (error.code === "23505") {
        throw new Error("Já existe uma pessoa cadastrada com este e-mail.");
      }
      throw new Error(error.message);
    }
    return row;
  });

export const updatePerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).merge(personSchema.partial()).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("people")
      .update(rest)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      // Trocar o e-mail para um que já existe cria o mesmo problema.
      if (error.code === "23505") {
        throw new Error("Já existe outra pessoa cadastrada com este e-mail.");
      }
      throw new Error(error.message);
    }
    return row;
  });

export const deletePerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("people").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Groups
// ============================================================
/**
 * Áreas do painel do aluno que um grupo pode liberar.
 *
 * "Meu perfil" não está aqui de propósito: é onde ele troca a própria senha e
 * os próprios dados. Tirar isso deixaria a pessoa presa numa conta que não
 * consegue ajustar.
 */
export const AREAS_DO_ALUNO = [
  { valor: "resultados", titulo: "Meus resultados", ajuda: "Os testes que ele respondeu e os relatórios." },
  { valor: "comunidade", titulo: "Comunidade", ajuda: "O feed do grupo, os membros e o ranking." },
  { valor: "devolutivas", titulo: "Devolutivas", ajuda: "O histórico das conversas de resultado." },
  { valor: "agenda", titulo: "Agenda", ajuda: "Eventos e aulas marcadas para ele." },
  { valor: "academy", titulo: "Academy", ajuda: "Trilhas, aulas gravadas e biblioteca." },
  { valor: "classroom", titulo: "Classroom", ajuda: "Treinamentos presenciais e presença." },
] as const;

const AREAS = AREAS_DO_ALUNO.map((a) => a.valor) as unknown as [string, ...string[]];

/**
 * As áreas que quem está pedindo abre no painel do aluno.
 *
 * A conta e a equipe recebem tudo — a trava é do painel do aluno. Na prévia
 * "ver como aluno" valem as áreas DAQUELA pessoa: sem isso ele veria o menu
 * inteiro (ele abre tudo) e a restrição não teria como ser conferida.
 */
export const minhasAreas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ preview_person_id: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = data.preview_person_id
      ? await context.supabase.rpc("areas_da_pessoa", { p_person_id: data.preview_person_id })
      : await context.supabase.rpc("minhas_areas");
    if (error) throw new Error(error.message);
    const lista = ((rows ?? []) as unknown as Array<string | Record<string, string>>).map((r) =>
      typeof r === "string" ? r : Object.values(r)[0],
    );
    return { areas: lista };
  });

const groupSchema = z.object({
  name: z.string().trim().min(1).max(160),
  type: z.enum(["turma", "empresa", "setor"]).default("turma"),
  description: z.string().trim().max(500).optional().nullable(),
  // `null` = grupo sem restrição, tudo liberado. É como os grupos existentes
  // nasceram, e é o padrão de um grupo novo.
  areas_aluno: z.array(z.enum(AREAS)).nullable().optional(),
});

export const listGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("groups")
      .select("*, group_members(count), group_instruments(count)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((g) => ({
      ...g,
      people_count: g.group_members?.[0]?.count ?? 0,
      instruments_count: g.group_instruments?.[0]?.count ?? 0,
    }));
  });

export const getGroup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: group, error } = await context.supabase
      .from("groups")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!group) throw new Error("Grupo não encontrado");

    const [{ data: members }, { data: instruments }] = await Promise.all([
      context.supabase
        .from("group_members")
        .select("person_id, added_at, people(id, full_name, email, role)")
        .eq("group_id", data.id),
      context.supabase
        .from("group_instruments")
        .select("instrument_id, added_at, instruments(id, name, short_name, category, duration_min)")
        .eq("group_id", data.id),
    ]);

    return { group, members: members ?? [], instruments: instruments ?? [] };
  });

export const createGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    groupSchema
      .extend({
        person_ids: z.array(z.string().uuid()).default([]),
        instrument_ids: z.array(z.string()).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { person_ids, instrument_ids, ...groupData } = data;
    const { data: group, error } = await context.supabase
      .from("groups")
      .insert({
        ...groupData,
        areas_aluno: normalizarAreas(groupData.areas_aluno),
        mentor_id: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (person_ids.length > 0) {
      const { error: memErr } = await context.supabase
        .from("group_members")
        .insert(person_ids.map((person_id) => ({ group_id: group.id, person_id })));
      if (memErr) throw new Error(memErr.message);
    }
    if (instrument_ids.length > 0) {
      const { error: insErr } = await context.supabase
        .from("group_instruments")
        .insert(instrument_ids.map((instrument_id) => ({ group_id: group.id, instrument_id })));
      if (insErr) throw new Error(insErr.message);
    }
    return group;
  });

export const updateGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).merge(groupSchema.partial()).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const patch =
      "areas_aluno" in rest ? { ...rest, areas_aluno: normalizarAreas(rest.areas_aluno) } : rest;
    const { data: row, error } = await context.supabase
      .from("groups")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/**
 * Tudo marcado vira `null` — "sem restrição".
 *
 * As duas formas significam o mesmo, e guardar a lista cheia faria um grupo
 * liberado parecer restrito toda vez que uma área NOVA aparecesse na
 * plataforma: ela nasceria fora da lista e sumiria do menu sem ninguém mexer.
 */
function normalizarAreas(areas: string[] | null | undefined): string[] | null {
  if (!areas) return null;
  return areas.length >= AREAS_DO_ALUNO.length ? null : areas;
}

export const deleteGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("groups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Group members
// ============================================================
export const addGroupMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ group_id: z.string().uuid(), person_ids: z.array(z.string().uuid()).min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const rows = data.person_ids.map((person_id) => ({ group_id: data.group_id, person_id }));
    const { error } = await context.supabase
      .from("group_members")
      .upsert(rows, { onConflict: "group_id,person_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeGroupMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ group_id: z.string().uuid(), person_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("group_members")
      .delete()
      .eq("group_id", data.group_id)
      .eq("person_id", data.person_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Group instruments
// ============================================================
export const setGroupInstruments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ group_id: z.string().uuid(), instrument_ids: z.array(z.string()) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Diff current vs desired so we preserve version_id on rows that stay.
    const { data: current, error: curErr } = await context.supabase
      .from("group_instruments")
      .select("instrument_id")
      .eq("group_id", data.group_id);
    if (curErr) throw new Error(curErr.message);
    const currentIds = new Set((current ?? []).map((r) => r.instrument_id));
    const desired = new Set(data.instrument_ids);

    const toRemove = [...currentIds].filter((id) => !desired.has(id));
    const toAdd = [...desired].filter((id) => !currentIds.has(id));

    if (toRemove.length > 0) {
      const { error } = await context.supabase
        .from("group_instruments")
        .delete()
        .eq("group_id", data.group_id)
        .in("instrument_id", toRemove);
      if (error) throw new Error(error.message);
    }
    if (toAdd.length > 0) {
      const { error } = await context.supabase
        .from("group_instruments")
        .insert(toAdd.map((instrument_id) => ({ group_id: data.group_id, instrument_id })));
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ============================================================
// Mentors (owner-scoped CRUD)
// ============================================================
const mentorSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  specialty: z.string().trim().max(160).optional().nullable(),
});

export const listMentors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("mentors")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createMentor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => mentorSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("mentors")
      .insert({ ...data, owner_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateMentor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).merge(mentorSchema.partial()).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("mentors")
      .update(rest)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteMentor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("mentors").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Profile (per-user settings, single row)
// ============================================================
/** Blocos do relatório que o mentor pode desligar. */
export const REPORT_BLOCKS = ["fatores", "narrativas", "derivados", "plano_acao", "observadores"] as const;

const profileSchema = z.object({
  full_name: z.string().trim().max(160).optional().nullable(),
  company_name: z.string().trim().max(160).optional().nullable(),
  brand_color: z.string().trim().max(32).optional().nullable(),
  brand_accent_color: z.string().trim().max(32).optional().nullable(),
  logo_url: z.string().trim().max(500).optional().nullable(),
  avatar_url: z.string().trim().max(600).optional().nullable(),
  email_from: z.string().trim().max(200).optional().nullable(),
  support_email: z.string().trim().email().max(200).optional().nullable().or(z.literal("")),
  site_url: z.string().trim().max(300).optional().nullable(),
  invite_message: z.string().trim().max(2000).optional().nullable(),
  reminder_message: z.string().trim().max(2000).optional().nullable(),
  result_message: z.string().trim().max(2000).optional().nullable(),
  report_allow_pdf: z.boolean().optional(),
  report_show_brand: z.boolean().optional(),
  report_hidden_blocks: z.array(z.enum(REPORT_BLOCKS)).optional(),
});

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const email = (context.claims as { email?: string })?.email ?? null;
    return { profile: data, email, user_id: context.userId };
  });

export const upsertMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => profileSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Campo esvaziado na tela chega como "" — guardar null mantém a checagem
    // "tem valor?" simples em quem lê (um `??` resolve).
    const limpo = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === "" ? null : v]),
    );
    const { data: row, error } = await context.supabase
      .from("profiles")
      .upsert({ user_id: context.userId, ...limpo }, { onConflict: "user_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
/**
 * DNA do grupo: média das dimensões por instrumento entre os membros.
 *
 * Regras de honestidade:
 * - Só respostas `self` concluídas entram.
 * - Agrega por **key** da dimensão (D, I, S, C…), não por id: versões
 *   diferentes do mesmo teste têm ids diferentes para a mesma dimensão.
 * - Só entra dimensão que foi de fato medida (presente em `normalized`).
 * - Devolve o tamanho da amostra por instrumento para a tela poder avisar
 *   quando ainda são poucas pessoas.
 */
export const getGroupDna = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ group_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: group } = await supabase
      .from("groups").select("id, mentor_id").eq("id", data.group_id).maybeSingle();
    if (!group || group.mentor_id !== userId) throw new Error("Grupo não encontrado ou não pertence a você.");

    const { data: members, error: mErr } = await supabase
      .from("group_members").select("person_id").eq("group_id", data.group_id);
    if (mErr) throw new Error(mErr.message);
    const personIds = (members ?? []).map((m) => m.person_id);
    if (personIds.length === 0) return { members: 0, instruments: [] };

    const { data: responses, error: rErr } = await supabase
      .from("test_responses")
      .select("id, person_id, version_id, computed_scores, test_versions(instrument_id, instruments(name))")
      .in("person_id", personIds)
      .eq("mentor_id", userId)
      .eq("kind", "self")
      .not("submitted_at", "is", null);
    if (rErr) throw new Error(rErr.message);
    if (!responses || responses.length === 0) return { members: personIds.length, instruments: [] };

    const versionIds = Array.from(new Set(responses.map((r) => r.version_id)));
    const { data: dims, error: dErr } = await supabase
      .from("test_dimensions")
      .select("id, version_id, key, label, color, sort_order")
      .in("version_id", versionIds);
    if (dErr) throw new Error(dErr.message);
    const dimsByVersion = new Map<string, typeof dims>();
    for (const d of dims ?? []) {
      const list = dimsByVersion.get(d.version_id) ?? [];
      list.push(d);
      dimsByVersion.set(d.version_id, list);
    }

    type Agg = { key: string; label: string; color: string | null; sort: number; values: number[] };
    const byInstrument = new Map<string, { name: string; people: Set<string>; dims: Map<string, Agg> }>();

    for (const r of responses) {
      const instrumentId = r.test_versions?.instrument_id;
      if (!instrumentId) continue;
      const normalized = (r.computed_scores as { normalized?: Record<string, { natural?: number }> } | null)?.normalized;
      if (!normalized) continue;

      const entry = byInstrument.get(instrumentId) ?? {
        name: r.test_versions?.instruments?.name ?? instrumentId,
        people: new Set<string>(),
        dims: new Map<string, Agg>(),
      };
      entry.people.add(r.person_id);

      for (const d of dimsByVersion.get(r.version_id) ?? []) {
        const value = normalized[d.id]?.natural;
        if (typeof value !== "number") continue; // dimensão não medida nesta resposta
        const agg = entry.dims.get(d.key) ?? {
          key: d.key, label: d.label, color: d.color, sort: d.sort_order ?? 0, values: [],
        };
        agg.values.push(value);
        entry.dims.set(d.key, agg);
      }
      byInstrument.set(instrumentId, entry);
    }

    const instrumentsOut = Array.from(byInstrument.entries())
      .map(([instrument_id, e]) => ({
        instrument_id,
        name: e.name,
        sample: e.people.size,
        dimensions: Array.from(e.dims.values())
          .map((a) => {
            const avg = a.values.reduce((x, y) => x + y, 0) / a.values.length;
            return {
              key: a.key,
              label: a.label,
              color: a.color,
              sort: a.sort,
              average: Math.round(avg * 10) / 10,
              min: Math.round(Math.min(...a.values) * 10) / 10,
              max: Math.round(Math.max(...a.values) * 10) / 10,
              count: a.values.length,
            };
          })
          .sort((x, y) => x.sort - y.sort || x.key.localeCompare(y.key)),
      }))
      .sort((a, b) => b.sample - a.sample || a.name.localeCompare(b.name));

    return { members: personIds.length, instruments: instrumentsOut };
  });

// ============================================================
// Dashboard — indicadores agregados
// ============================================================
// Conta TODAS as respostas do avaliado, inclusive as que fazem parte de uma
// bateria. O `listResponses` filtra `assessment_response_id IS NULL` porque
// serve à tela de Envios (lá a bateria aparece como uma linha só) — usar aquele
// número aqui subestimava o total agora que a bateria é o fluxo principal.
export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: rows, error } = await supabase
      .from("test_responses")
      .select("id, status, created_at, submitted_at, assessment_response_id, people(id, full_name), test_versions(instrument_id, title, instruments(name))")
      .eq("mentor_id", userId)
      .eq("kind", "self")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { count: peopleCount, error: pErr } = await supabase
      .from("people")
      .select("id", { count: "exact", head: true })
      .eq("mentor_id", userId);
    if (pErr) throw new Error(pErr.message);

    const list = rows ?? [];
    const submitted = list.filter((r) => !!r.submitted_at).length;

    // Quais inventários estão realmente sendo usados.
    const instrumentMap = new Map<string, { name: string; respondidos: number; pendentes: number }>();
    for (const r of list) {
      const id = r.test_versions?.instrument_id;
      if (!id) continue;
      const entry = instrumentMap.get(id) ?? {
        name: r.test_versions?.instruments?.name ?? r.test_versions?.title ?? id,
        respondidos: 0,
        pendentes: 0,
      };
      if (r.submitted_at) entry.respondidos += 1;
      else entry.pendentes += 1;
      instrumentMap.set(id, entry);
    }
    const byInstrument = Array.from(instrumentMap.values())
      .sort((a, b) => b.respondidos - a.respondidos || a.name.localeCompare(b.name));

    // Últimos 6 meses, sempre com os 6 rótulos (mês sem resposta vale zero —
    // omitir daria a impressão de continuidade onde houve pausa).
    const now = new Date();
    const buckets: { chave: string; mes: string; respondidos: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        respondidos: 0,
      });
    }
    const bucketIndex = new Map(buckets.map((b, i) => [b.chave, i]));
    for (const r of list) {
      if (!r.submitted_at) continue;
      const d = new Date(r.submitted_at);
      const idx = bucketIndex.get(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      if (idx != null) buckets[idx].respondidos += 1;
    }

    const recent = list
      .slice()
      .sort((a, b) =>
        new Date(b.submitted_at ?? b.created_at).getTime() - new Date(a.submitted_at ?? a.created_at).getTime())
      .slice(0, 6)
      .map((r) => ({
        id: r.id,
        nome: r.people?.full_name ?? "—",
        teste: r.test_versions?.title ?? "—",
        concluido: !!r.submitted_at,
        quando: r.submitted_at ?? r.created_at,
        emBateria: !!r.assessment_response_id,
      }));

    return {
      total: list.length,
      submitted,
      pending: list.length - submitted,
      people: peopleCount ?? 0,
      byInstrument,
      byMonth: buckets,
      recent,
    };
  });

/**
 * Importa pessoas de uma planilha.
 *
 * `group_id` é opcional: vindo de dentro de um grupo, as pessoas já entram nele;
 * vindo do menu Pessoas, só entram no cadastro.
 *
 * Regra que evita a maior dor de importação: **não duplica**. Se já existe
 * alguém na conta com aquele email, reaproveita o cadastro — reimportar a mesma
 * planilha não gera 80 pessoas repetidas.
 */
export const importPeople = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      group_id: z.string().uuid().optional().nullable(),
      pessoas: z.array(z.object({
        full_name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(200),
        phone: z.string().trim().max(40).optional().nullable(),
        profession: z.string().trim().max(120).optional().nullable(),
        role_at_company: z.string().trim().max(120).optional().nullable(),
      })).min(1).max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.group_id) {
      const { data: grupo, error: gErr } = await supabase
        .from("groups").select("id").eq("id", data.group_id).maybeSingle();
      if (gErr) throw new Error(gErr.message);
      if (!grupo) throw new Error("Grupo não encontrado ou fora do seu acesso.");
    }

    const emails = Array.from(new Set(data.pessoas.map((p) => p.email.toLowerCase())));
    const { data: existentes, error: eErr } = await supabase
      .from("people").select("id, email").in("email", emails);
    if (eErr) throw new Error(eErr.message);
    const porEmail = new Map((existentes ?? []).map((p) => [p.email.toLowerCase(), p.id]));

    const novos = data.pessoas.filter((p) => !porEmail.has(p.email.toLowerCase()));
    let criados = 0;
    if (novos.length > 0) {
      const { data: inseridos, error: iErr } = await supabase
        .from("people")
        .insert(novos.map((p) => ({
          mentor_id: userId,
          full_name: p.full_name,
          email: p.email.toLowerCase(),
          phone: p.phone || null,
          profession: p.profession || null,
          role_at_company: p.role_at_company || null,
          role: "colaborador",
        })))
        .select("id, email");
      if (iErr) throw new Error(iErr.message);
      criados = inseridos?.length ?? 0;
      for (const p of inseridos ?? []) porEmail.set(p.email.toLowerCase(), p.id);
    }

    const ids = Array.from(new Set(data.pessoas.map((p) => porEmail.get(p.email.toLowerCase())!).filter(Boolean)));

    let aAdicionar: string[] = [];
    let dentro = new Set<string>();
    if (data.group_id) {
      // Quem já estava no grupo não entra de novo.
      const { data: jaNoGrupo, error: mErr } = await supabase
        .from("group_members").select("person_id").eq("group_id", data.group_id).in("person_id", ids);
      if (mErr) throw new Error(mErr.message);
      dentro = new Set((jaNoGrupo ?? []).map((m) => m.person_id));
      aAdicionar = ids.filter((id) => !dentro.has(id));

      if (aAdicionar.length > 0) {
        const grupoId = data.group_id;
        const { error: addErr } = await supabase
          .from("group_members")
          .insert(aAdicionar.map((person_id) => ({ group_id: grupoId, person_id })));
        if (addErr) throw new Error(addErr.message);
      }
    }

    return {
      criados,
      reaproveitados: ids.length - criados,
      adicionados_ao_grupo: aAdicionar.length,
      ja_estavam_no_grupo: dentro.size,
      com_grupo: !!data.group_id,
    };
  });
