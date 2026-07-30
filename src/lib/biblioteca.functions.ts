/**
 * Biblioteca — material que não pertence a aula nenhuma.
 *
 * Item G, primeira parte. Quem lê é a conta inteira: aluno, mentor e dono.
 * Quem escreve é só o dono — material solto é curadoria, não colaboração.
 * A RLS é quem garante isso; aqui só se monta o que a tela precisa.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export const TIPOS = ["link", "pdf", "planilha", "imagem", "video", "audio", "outro"] as const;

/** Rótulo do tipo na tela — o valor cru em minúscula ficava feio no seletor. */
export const ROTULO_TIPO: Record<string, string> = {
  link: "Link", pdf: "PDF", planilha: "Planilha", imagem: "Imagem",
  video: "Vídeo", audio: "Áudio", outro: "Outro",
};

/** A ordem em que os formatos aparecem agrupados dentro da pasta. */
export const ORDEM_TIPOS = ["pdf", "planilha", "imagem", "video", "audio", "link", "outro"] as const;

/**
 * A biblioteca inteira: pastas e materiais, com o cadeado já resolvido.
 *
 * `preview_person_id` faz a prévia "ver como aluno" valer o acesso DAQUELA
 * pessoa. Sem ele, quem consulta continua sendo o dono — que abre tudo — e o
 * cadeado não teria como ser conferido.
 */
export const listarBiblioteca = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ preview_person_id: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const ver = data.preview_person_id ?? null;
    const [mats, pastas, pLib, mLib] = await Promise.all([
      context.supabase
        .from("biblioteca_materiais")
        .select("id, titulo, descricao, url, kind, categoria, capa_url, pasta_id, created_at, biblioteca_material_destinos(count)")
        .order("created_at", { ascending: false }),
      context.supabase
        .from("biblioteca_pastas")
        .select("id, titulo, descricao, capa_url, ordem, created_at, biblioteca_pasta_destinos(count)")
        .order("ordem")
        .order("created_at"),
      context.supabase.rpc("bib_pastas_liberadas", { _person_id: ver }),
      context.supabase.rpc("bib_materiais_liberados", { _person_id: ver }),
    ]);
    if (mats.error) throw new Error(mats.error.message);
    if (pastas.error) throw new Error(pastas.error.message);
    if (pLib.error) throw new Error(pLib.error.message);
    if (mLib.error) throw new Error(mLib.error.message);

    const ids = (r: unknown) =>
      new Set(
        ((r ?? []) as Array<string | Record<string, string>>).map((x) =>
          typeof x === "string" ? x : Object.values(x)[0],
        ),
      );
    const pastasOk = ids(pLib.data);
    const matsOk = ids(mLib.data);
    const conta = (v: unknown) => (v as Array<{ count: number }> | null)?.[0]?.count ?? 0;

    const materiais = (mats.data ?? []).map((m) => ({
      ...m,
      liberado: matsOk.has(m.id),
      destinos_count: conta(m.biblioteca_material_destinos),
    }));
    return {
      materiais,
      pastas: (pastas.data ?? []).map((p) => ({
        ...p,
        liberada: pastasOk.has(p.id),
        destinos_count: conta(p.biblioteca_pasta_destinos),
        // Quantos materiais moram nela — para o AlertDialog de exclusão dizer
        // quantos voltam para a raiz.
        materiais_count: materiais.filter((m) => m.pasta_id === p.id).length,
      })),
      // As categorias saem do que existe, não de uma lista fixa: uma lista fixa
      // envelhece e ninguém lembra de atualizar.
      categorias: [...new Set(materiais.map((m) => m.categoria).filter(Boolean))] as string[],
    };
  });

const materialSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(1000).optional(),
  url: z.string().url().max(1000),
  kind: z.enum(TIPOS).default("link"),
  categoria: z.string().trim().max(80).optional(),
  capa_url: z.string().url().nullable().optional(),
  pasta_id: z.string().uuid().nullable().optional(),
});

/**
 * Cria OU edita o material.
 *
 * Editar precisa existir por causa das pastas: sem isso, os materiais que já
 * estão na raiz ficariam presos lá para sempre — a única saída seria apagar e
 * recadastrar, perdendo o arquivo que já subiu para o bucket.
 */
export const salvarMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => materialSchema.extend({ id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { id, ...campos } = data;
    const linha = {
      titulo: campos.titulo,
      descricao: campos.descricao?.trim() || null,
      url: campos.url,
      kind: campos.kind,
      categoria: campos.categoria?.trim() || null,
      capa_url: campos.capa_url ?? null,
      pasta_id: campos.pasta_id ?? null,
    };
    if (campos.pasta_id) await conferirPasta(context.supabase, campos.pasta_id);

    const q = id
      ? context.supabase.from("biblioteca_materiais").update(linha).eq("id", id)
      : context.supabase
          .from("biblioteca_materiais")
          .insert({ ...linha, mentor_id: context.userId });
    const { data: row, error } = await q.select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const excluirMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("biblioteca_materiais").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Pastas
// ============================================================
export const salvarPasta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      titulo: z.string().trim().min(1).max(200),
      descricao: z.string().trim().max(1000).optional().nullable(),
      capa_url: z.string().url().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { id, ...campos } = data;
    const linha = {
      titulo: campos.titulo,
      descricao: campos.descricao?.trim() || null,
      capa_url: campos.capa_url ?? null,
    };
    if (id) {
      const { data: row, error } = await context.supabase
        .from("biblioteca_pastas").update(linha).eq("id", id).select("id").single();
      if (error) throw new Error(error.message);
      return { ok: true, id: row.id };
    }
    // Entra no fim da fila, como os banners: criar já mexendo na ordem dos
    // outros seria surpresa.
    const { data: ultima } = await context.supabase
      .from("biblioteca_pastas").select("ordem")
      .order("ordem", { ascending: false }).limit(1).maybeSingle();
    const { data: row, error } = await context.supabase
      .from("biblioteca_pastas")
      .insert({ ...linha, mentor_id: context.userId, ordem: (ultima?.ordem ?? 0) + 1 })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

/**
 * Apaga a pasta. Os materiais NÃO vão junto: o `ON DELETE SET NULL` devolve
 * todos para a raiz. Apagar material por tabela vizinha seria perda calada, e
 * o arquivo ainda ficaria órfão no bucket.
 */
export const excluirPasta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("biblioteca_pastas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moverPasta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), direcao: z.enum(["cima", "baixo"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const { data: todas, error } = await supabase
      .from("biblioteca_pastas").select("id, ordem").order("ordem").order("created_at");
    if (error) throw new Error(error.message);

    const lista = todas ?? [];
    const i = lista.findIndex((p) => p.id === data.id);
    const j = data.direcao === "cima" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= lista.length) return { ok: true };

    await Promise.all([
      supabase.from("biblioteca_pastas").update({ ordem: lista[j].ordem }).eq("id", lista[i].id),
      supabase.from("biblioteca_pastas").update({ ordem: lista[i].ordem }).eq("id", lista[j].id),
    ]);
    return { ok: true };
  });

// ============================================================
// Quem tem acesso (o cadeado)
// ============================================================
export const getDestinosBiblioteca = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ alvo: z.enum(["pasta", "material"]), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const q =
      data.alvo === "pasta"
        ? context.supabase
            .from("biblioteca_pasta_destinos").select("group_id, person_id").eq("pasta_id", data.id)
        : context.supabase
            .from("biblioteca_material_destinos").select("group_id, person_id").eq("material_id", data.id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return {
      group_ids: (rows ?? []).filter((r) => r.group_id).map((r) => r.group_id as string),
      person_ids: (rows ?? []).filter((r) => r.person_id).map((r) => r.person_id as string),
    };
  });

/**
 * Troca os destinos por DIFERENÇA, nunca apagando tudo para reinserir.
 *
 * Entre o delete e o insert a pasta ficaria sem destino — ou seja, aberta a
 * todos — e quem carregasse a página nesse instante levaria o material embora.
 * É a mesma razão de `setTrackDestinos`.
 *
 * Os dois ramos são escritos por extenso de propósito: com o nome da tabela
 * numa variável, o cliente do Supabase perde o tipo e o insert deixa de ser
 * conferido em tempo de compilação.
 */
export const setDestinosBiblioteca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      alvo: z.enum(["pasta", "material"]),
      id: z.string().uuid(),
      group_ids: z.array(z.string().uuid()).max(200).default([]),
      person_ids: z.array(z.string().uuid()).max(500).default([]),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const ehPasta = data.alvo === "pasta";

    await validarDestinos(supabase, data.group_ids, data.person_ids);

    const atuais = ehPasta
      ? await supabase
          .from("biblioteca_pasta_destinos").select("id, group_id, person_id").eq("pasta_id", data.id)
      : await supabase
          .from("biblioteca_material_destinos").select("id, group_id, person_id").eq("material_id", data.id);
    if (atuais.error) throw new Error(atuais.error.message);

    const quero = new Set([
      ...data.group_ids.map((g) => `g:${g}`),
      ...data.person_ids.map((p) => `p:${p}`),
    ]);
    const tenho = new Map(
      (atuais.data ?? []).map((r) => [r.group_id ? `g:${r.group_id}` : `p:${r.person_id}`, r.id]),
    );

    const sobrando = [...tenho.entries()].filter(([k]) => !quero.has(k)).map(([, id]) => id);
    if (sobrando.length) {
      const del = ehPasta
        ? await supabase.from("biblioteca_pasta_destinos").delete().in("id", sobrando)
        : await supabase.from("biblioteca_material_destinos").delete().in("id", sobrando);
      if (del.error) throw new Error(del.error.message);
    }

    const faltando = [...quero].filter((k) => !tenho.has(k));
    if (faltando.length) {
      const grupo = (k: string) => (k.startsWith("g:") ? k.slice(2) : null);
      const pessoa = (k: string) => (k.startsWith("p:") ? k.slice(2) : null);
      const ins = ehPasta
        ? await supabase.from("biblioteca_pasta_destinos").insert(
            faltando.map((k) => ({ pasta_id: data.id, group_id: grupo(k), person_id: pessoa(k) })),
          )
        : await supabase.from("biblioteca_material_destinos").insert(
            faltando.map((k) => ({ material_id: data.id, group_id: grupo(k), person_id: pessoa(k) })),
          );
      if (ins.error) throw new Error(ins.error.message);
    }
    return { ok: true, total: quero.size };
  });

/**
 * Confere que grupos e pessoas são da conta.
 *
 * A policy dos destinos só olha a PASTA/MATERIAL — o id vem do cliente e
 * passaria mesmo sendo de outra conta, enchendo a tabela de destino que nunca
 * casa e deixando a pasta "restrita para ninguém", sem sintoma na tela.
 */
async function validarDestinos(
  supabase: SupabaseClient<Database>, groupIds: string[], personIds: string[],
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

/** A pasta escolhida é da conta? O id vem do cliente. */
async function conferirPasta(supabase: SupabaseClient<Database>, pastaId: string) {
  const { data, error } = await supabase
    .from("biblioteca_pastas").select("id").eq("id", pastaId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Essa pasta não é sua.");
}

/**
 * Banners do topo da Academy — item G, parte 2.
 *
 * Ficam no mesmo arquivo da biblioteca porque são a mesma ideia: curadoria do
 * master, consumo de todo mundo. Separar em outro módulo só criaria mais um
 * lugar para procurar.
 */
export const listarBanners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("academy_banners")
      .select("id, imagem_url, link_url, titulo, ordem, ativo")
      .eq("ativo", true)
      .order("ordem");
    if (error) throw new Error(error.message);
    return { banners: data ?? [] };
  });

export const salvarBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      imagem_url: z.string().url(),
      link_url: z.string().url().max(600).nullable().optional(),
      titulo: z.string().trim().max(120).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    // Entra no fim da fila. Reordenar é outra ação; criar já mexendo na ordem
    // dos outros seria surpresa.
    const { data: ultimo } = await context.supabase
      .from("academy_banners").select("ordem")
      .order("ordem", { ascending: false }).limit(1).maybeSingle();

    const { error } = await context.supabase.from("academy_banners").insert({
      mentor_id: context.userId,
      imagem_url: data.imagem_url,
      link_url: data.link_url ?? null,
      titulo: data.titulo?.trim() || null,
      ordem: (ultimo?.ordem ?? 0) + 1,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("academy_banners").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moverBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), direcao: z.enum(["cima", "baixo"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const { data: todos, error } = await supabase
      .from("academy_banners").select("id, ordem").order("ordem");
    if (error) throw new Error(error.message);

    const lista = todos ?? [];
    const i = lista.findIndex((b) => b.id === data.id);
    const j = data.direcao === "cima" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= lista.length) return { ok: true };

    // Troca as posições dos dois vizinhos. Reescrever a lista inteira seria
    // mais simples de ler e mais fácil de embaralhar se duas abas mexerem ao
    // mesmo tempo.
    await Promise.all([
      supabase.from("academy_banners").update({ ordem: lista[j].ordem }).eq("id", lista[i].id),
      supabase.from("academy_banners").update({ ordem: lista[i].ordem }).eq("id", lista[j].id),
    ]);
    return { ok: true };
  });
