/**
 * Comunidade do grupo.
 *
 * Um feed por grupo, não da plataforma. Quem lê e quem escreve são as pessoas
 * daquele grupo — avaliados, mentores afiliados atribuídos a ele e o dono da
 * conta. É o que torna a comunidade utilizável numa empresa cliente: o grupo do
 * RH da Empresa A não se mistura com o da Empresa B.
 *
 * Quem enxerga o quê é decidido pela RLS (`posso_ver_grupo`, na migração
 * `20260729180000_comunidade.sql`). Aqui só monta o que a tela precisa.
 *
 * Por decisão do Matheus, resultado de teste NÃO entra: texto, imagem, PDF e
 * link. Publicar perfil comportamental entre colegas tem risco próprio e ficou
 * para depois.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Grupos em que a pessoa logada participa — como avaliada ou pela equipe. */
export const meusGrupos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;
    // A RLS de `groups` já resolve o lado da equipe. Para o avaliado, o caminho
    // é pelos grupos em que ele está como pessoa.
    const { data: comoEquipe } = await supabase.from("groups").select("id, name").order("name");
    const { data: ids } = await supabase.rpc("meus_grupos_como_avaliado");
    const doAvaliado = (ids ?? []) as unknown as string[];
    const extras = doAvaliado.length
      ? (await supabase.from("groups").select("id, name").in("id", doAvaliado)).data ?? []
      : [];
    const juntos = new Map<string, { id: string; name: string }>();
    for (const g of [...(comoEquipe ?? []), ...extras]) juntos.set(g.id, g);
    return { grupos: [...juntos.values()].sort((a, b) => a.name.localeCompare(b.name)) };
  });

export const listarFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ group_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const { data: posts, error } = await supabase
      .from("community_posts")
      .select("id, author_id, author_name, body, file_url, file_kind, link_url, created_at")
      .eq("group_id", data.group_id)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);

    const ids = (posts ?? []).map((p) => p.id);
    const [{ data: comentarios }, { data: reacoes }] = await Promise.all([
      ids.length
        ? supabase.from("community_comments")
            .select("id, post_id, author_id, author_name, body, created_at")
            .in("post_id", ids).order("created_at")
        : Promise.resolve({ data: [] as never[] }),
      ids.length
        ? supabase.from("community_reactions").select("post_id, user_id").in("post_id", ids)
        : Promise.resolve({ data: [] as never[] }),
    ]);

    const eu = context.userId;
    return {
      eu,
      posts: (posts ?? []).map((p) => ({
        ...p,
        meu: p.author_id === eu,
        comentarios: (comentarios ?? []).filter((c) => c.post_id === p.id)
          .map((c) => ({ ...c, meu: c.author_id === eu })),
        curtidas: (reacoes ?? []).filter((r) => r.post_id === p.id).length,
        curti: (reacoes ?? []).some((r) => r.post_id === p.id && r.user_id === eu),
      })),
    };
  });

/**
 * Nome que aparece no post, congelado na publicação — ver a migração.
 *
 * Procura primeiro no perfil (dono e equipe) e depois no cadastro de avaliado.
 * A mesma pessoa pode ser as duas coisas; o perfil ganha por ser o que ela
 * mesma editou.
 */
async function meuNome(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data: perfil } = await supabase.from("profiles").select("full_name").eq("user_id", userId).maybeSingle();
  if (perfil?.full_name?.trim()) return perfil.full_name.trim();
  const { data: pessoa } = await supabase.from("people").select("full_name").eq("user_id", userId).limit(1).maybeSingle();
  return pessoa?.full_name?.trim() || "Participante";
}

export const publicarPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      group_id: z.string().uuid(),
      body: z.string().min(1).max(4000),
      file_url: z.string().url().nullable().optional(),
      file_kind: z.enum(["imagem", "pdf"]).nullable().optional(),
      link_url: z.string().url().max(600).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const { error } = await supabase.from("community_posts").insert({
      group_id: data.group_id,
      author_id: context.userId,
      author_name: await meuNome(supabase, context.userId),
      body: data.body.trim(),
      file_url: data.file_url ?? null,
      file_kind: data.file_kind ?? null,
      link_url: data.link_url ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const comentar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ post_id: z.string().uuid(), body: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const { error } = await supabase.from("community_comments").insert({
      post_id: data.post_id,
      author_id: context.userId,
      author_name: await meuNome(supabase, context.userId),
      body: data.body.trim(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const alternarCurtida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ post_id: z.string().uuid(), curtir: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    if (data.curtir) {
      const { error } = await supabase.from("community_reactions")
        .insert({ post_id: data.post_id, user_id: context.userId });
      // Curtir duas vezes não é erro para quem clicou; a chave primária barra.
      if (error && error.code !== "23505") throw new Error(error.message);
    } else {
      const { error } = await supabase.from("community_reactions")
        .delete().eq("post_id", data.post_id).eq("user_id", context.userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const apagarPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    // A RLS deixa apagar o próprio post ou, para o dono da conta, qualquer um
    // do grupo dele — é a moderação.
    const { error } = await context.supabase.from("community_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const apagarComentario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("community_comments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
