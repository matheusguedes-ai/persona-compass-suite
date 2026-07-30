/**
 * Classroom: treinamentos PRESENCIAIS — treinamento → módulo → aula → material.
 *
 * Estrutura própria, separada da Academy, por decisão registrada em
 * docs/analise-classroom.md: o check-in não tem paralelo lá, e reaproveitar as
 * tabelas obrigaria toda consulta da Academy a filtrar o presencial.
 *
 * Quem enxerga é a RLS (`posso_ver_treinamento`, migração 20260730140000).
 * Quem EDITA é só o dono da conta — as policies de escrita exigem
 * `mentor_id = auth.uid()`, mesma regra dos eventos da agenda.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Inclui `slide` e `roteiro`, que a Academy não tem: são o material de quem dá aula presencial. */
export const TIPOS_MATERIAL_TREINAMENTO = [
  "link", "pdf", "slide", "roteiro", "planilha", "video", "audio", "outro",
] as const;

// ============================================================
// Treinamentos
// ============================================================
export const listTreinamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("treinamentos")
      .select("*, treinamento_grupos(count), treinamento_modulos(treinamento_aulas(count))")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((t) => {
      const grupos = t.treinamento_grupos as unknown as Array<{ count: number }>;
      const modulos = t.treinamento_modulos as unknown as Array<{
        treinamento_aulas: Array<{ count: number }>;
      }>;
      return {
        ...t,
        treinamento_grupos: undefined,
        treinamento_modulos: undefined,
        grupos_count: grupos?.[0]?.count ?? 0,
        aulas_count: (modulos ?? []).reduce((s, m) => s + (m.treinamento_aulas?.[0]?.count ?? 0), 0),
      };
    });
  });

/** Treinamento inteiro com a árvore montada, para a tela do master. */
export const getTreinamento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: treinamento, error } = await supabase
      .from("treinamentos").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!treinamento) throw new Error("Treinamento não encontrado.");

    const [mods, grupos] = await Promise.all([
      supabase
        .from("treinamento_modulos")
        .select("*, treinamento_aulas(*, treinamento_materiais(*))")
        .eq("treinamento_id", data.id),
      supabase.from("treinamento_grupos").select("group_id, groups(id, name)").eq("treinamento_id", data.id),
    ]);
    if (mods.error) throw new Error(mods.error.message);
    if (grupos.error) throw new Error(grupos.error.message);

    // As anotações moram em tabela própria com RLS só do dono (migração
    // 20260730150000): o aluno não recebe o roteiro do professor nem
    // consultando a API direto. Só vale buscar quando é o dono olhando.
    const dono = treinamento.mentor_id === userId;
    const anotPorAula = new Map<string, string>();
    if (dono) {
      const { data: anots, error: eAnots } = await supabase
        .from("treinamento_anotacoes").select("aula_id, texto");
      if (eAnots) throw new Error(eAnots.message);
      for (const a of anots ?? []) anotPorAula.set(a.aula_id, a.texto);
    }

    // Ordena aqui em vez de encadear `order` por tabela estrangeira: dois
    // níveis de aninhamento tornam a sintaxe frágil, e a lista é pequena.
    const porOrdem = <T extends { ordem: number; titulo: string }>(xs: T[]) =>
      [...xs].sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo));

    const modules = porOrdem(mods.data ?? []).map((m) => ({
      ...m,
      treinamento_aulas: undefined,
      aulas: porOrdem(
        ((m.treinamento_aulas as unknown as Array<Record<string, unknown>>) ?? []).map((a) => {
          const aula = a as { id: string; modulo_id: string; titulo: string; descricao: string | null; comeca_em: string | null; termina_em: string | null; local: string | null; ordem: number };
          return {
            ...aula,
            anotacoes: anotPorAula.get(aula.id) ?? null,
            treinamento_materiais: undefined,
            materiais: porOrdem(
              (a.treinamento_materiais as Array<{ id: string; titulo: string; url: string; kind: string; ordem: number }>) ?? [],
            ),
          };
        }),
      ),
    }));

    return {
      treinamento,
      modules,
      grupos: (grupos.data ?? []).map((g) => ({
        id: g.group_id,
        name: (g.groups as unknown as { name: string } | null)?.name ?? "—",
      })),
      can_edit: dono,
    };
  });

export const createTreinamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      titulo: z.string().trim().min(2).max(200),
      descricao: z.string().trim().max(2000).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // `mentor_id` é quem está logado — a RLS de escrita exige isso, então o
    // colaborador que chegar aqui por fora do menu é recusado pelo banco.
    const { data: row, error } = await context.supabase
      .from("treinamentos")
      .insert({ ...data, mentor_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateTreinamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      titulo: z.string().trim().min(2).max(200).optional(),
      descricao: z.string().trim().max(2000).optional().nullable(),
      capa_url: z.string().trim().max(600).optional().nullable(),
      publicado: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("treinamentos").update(rest).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTreinamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("treinamentos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Troca os grupos com acesso. Por DIFERENÇA, não por apagar-e-recriar: se a
 * inserção falhasse depois de um DELETE geral, o treinamento perderia todos os
 * grupos — e ninguém ligaria o sumiço ao clique de semanas atrás.
 */
export const setGruposDoTreinamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      treinamento_id: z.string().uuid(),
      group_ids: z.array(z.string().uuid()).max(200),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: atuais, error: eLer } = await supabase
      .from("treinamento_grupos").select("group_id").eq("treinamento_id", data.treinamento_id);
    if (eLer) throw new Error(eLer.message);

    const antes = new Set((atuais ?? []).map((g) => g.group_id));
    const alvo = new Set(data.group_ids);
    const tirar = [...antes].filter((g) => !alvo.has(g));
    const incluir = [...alvo].filter((g) => !antes.has(g));

    if (tirar.length > 0) {
      const { error } = await supabase
        .from("treinamento_grupos").delete()
        .eq("treinamento_id", data.treinamento_id).in("group_id", tirar);
      if (error) throw new Error(error.message);
    }
    if (incluir.length > 0) {
      const { error } = await supabase
        .from("treinamento_grupos")
        .insert(incluir.map((group_id) => ({ treinamento_id: data.treinamento_id, group_id })));
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ============================================================
// Módulos
// ============================================================
export const saveModulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      treinamento_id: z.string().uuid(),
      titulo: z.string().trim().min(1).max(200),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...rest } = data;
    if (id) {
      const { data: row, error } = await supabase
        .from("treinamento_modulos").update({ titulo: rest.titulo }).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    // `ordem` = quantos já existem: o novo entra no fim, e a lista não depende
    // do acaso de todo mundo nascer com ordem 0.
    const { count, error: eCont } = await supabase
      .from("treinamento_modulos")
      .select("id", { count: "exact", head: true })
      .eq("treinamento_id", rest.treinamento_id);
    if (eCont) throw new Error(eCont.message);
    const { data: row, error } = await supabase
      .from("treinamento_modulos").insert({ ...rest, ordem: count ?? 0 }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteModulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("treinamento_modulos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Aulas
// ============================================================
const aulaSchema = z.object({
  id: z.string().uuid().optional(),
  modulo_id: z.string().uuid(),
  titulo: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(4000).optional().nullable(),
  anotacoes: z.string().trim().max(8000).optional().nullable(),
  comeca_em: z.string().datetime({ offset: true }).optional().nullable(),
  termina_em: z.string().datetime({ offset: true }).optional().nullable(),
  local: z.string().trim().max(300).optional().nullable(),
}).refine(
  (a) => !a.comeca_em || !a.termina_em || new Date(a.termina_em) > new Date(a.comeca_em),
  { message: "O fim precisa ser depois do início." },
);

export const saveAula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => aulaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // A anotação vai para a tabela dela, não para a linha da aula — ver a
    // migração 20260730150000 e o comentário no getTreinamento.
    const { id, anotacoes, ...rest } = data;
    let row: { id: string };
    if (id) {
      const { data: r, error } = await supabase
        .from("treinamento_aulas").update(rest).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      row = r;
    } else {
      const { count, error: eCont } = await supabase
        .from("treinamento_aulas")
        .select("id", { count: "exact", head: true })
        .eq("modulo_id", rest.modulo_id);
      if (eCont) throw new Error(eCont.message);
      const { data: r, error } = await supabase
        .from("treinamento_aulas").insert({ ...rest, ordem: count ?? 0 }).select().single();
      if (error) throw new Error(error.message);
      row = r;
    }

    const texto = anotacoes?.trim() ?? "";
    if (texto) {
      const { error } = await supabase
        .from("treinamento_anotacoes")
        .upsert({ aula_id: row.id, texto, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
    } else {
      // Apagar o texto no formulário apaga a anotação — sem linha órfã.
      const { error } = await supabase
        .from("treinamento_anotacoes").delete().eq("aula_id", row.id);
      if (error) throw new Error(error.message);
    }
    return row;
  });

export const deleteAula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("treinamento_aulas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Materiais
// ============================================================
export const saveMaterialAula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      aula_id: z.string().uuid(),
      titulo: z.string().trim().min(1).max(200),
      url: z.string().trim().url().max(1000),
      kind: z.enum(TIPOS_MATERIAL_TREINAMENTO).default("link"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...rest } = data;
    if (id) {
      const { data: row, error } = await supabase
        .from("treinamento_materiais").update(rest).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { count, error: eCont } = await supabase
      .from("treinamento_materiais")
      .select("id", { count: "exact", head: true })
      .eq("aula_id", rest.aula_id);
    if (eCont) throw new Error(eCont.message);
    const { data: row, error } = await supabase
      .from("treinamento_materiais").insert({ ...rest, ordem: count ?? 0 }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteMaterialAula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("treinamento_materiais").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
