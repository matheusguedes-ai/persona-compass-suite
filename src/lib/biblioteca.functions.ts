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
      .select("id, titulo, descricao, url, kind, categoria, created_at")
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
