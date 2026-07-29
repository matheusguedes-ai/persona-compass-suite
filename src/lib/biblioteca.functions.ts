/**
 * Biblioteca — material que não pertence a aula nenhuma.
 *
 * Item G, primeira parte. Quem lê é a conta inteira: aluno, mentor e dono.
 * Quem escreve é só o dono — material solto é curadoria, não colaboração.
 * A RLS é quem garante isso; aqui só se monta o que a tela precisa.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const TIPOS = ["link", "pdf", "planilha", "video", "audio", "outro"] as const;

export const listarBiblioteca = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("biblioteca_materiais")
      .select("id, titulo, descricao, url, kind, categoria, capa_url, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const materiais = data ?? [];
    return {
      materiais,
      // As categorias saem do que existe, não de uma lista fixa: uma lista fixa
      // envelhece e ninguém lembra de atualizar.
      categorias: [...new Set(materiais.map((m) => m.categoria).filter(Boolean))] as string[],
    };
  });

export const salvarMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      titulo: z.string().trim().min(1).max(200),
      descricao: z.string().trim().max(1000).optional(),
      url: z.string().url().max(1000),
      kind: z.enum(TIPOS).default("link"),
      categoria: z.string().trim().max(80).optional(),
      capa_url: z.string().url().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("biblioteca_materiais").insert({
      mentor_id: context.userId,
      titulo: data.titulo,
      descricao: data.descricao?.trim() || null,
      url: data.url,
      kind: data.kind,
      categoria: data.categoria?.trim() || null,
      capa_url: data.capa_url ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
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
