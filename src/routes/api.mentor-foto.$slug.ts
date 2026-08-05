/**
 * Foto do professor em /agendar/$slug (#248) — endereço ESTÁVEL, mesmo padrão
 * de `/api/icone/$tamanho` (ver o cabeçalho daquele arquivo): o avatar mora
 * no bucket privado 'avatares', uma URL assinada tem prazo, e a página
 * pública não pode depender de um link que expira. Aqui o CAMINHO
 * (`/api/mentor-foto/teste-mentoria` etc.) nunca muda: a cada pedido, assina
 * de novo por dentro e devolve os bytes.
 *
 * Parametrizado pelo SLUG do link, não por um id de conta — é o único dado
 * que a página pública já tem, e resolve ao mentor de dentro, sem expor
 * mentor_id ao cliente.
 *
 * Sem link ativo, ou professor sem foto, ou falha ao assinar: 404. A tela
 * (`AgendarPage`) esconde a imagem sozinha via `onError`, do jeito mais
 * simples — não precisa de uma segunda consulta só para saber se existe foto
 * antes de montar a URL.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/mentor-foto/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: link } = await supabaseAdmin
            .from("mentoria_links")
            .select("mentor_id")
            .eq("slug", params.slug)
            .eq("ativo", true)
            .maybeSingle();
          if (!link) return new Response(null, { status: 404 });

          const { data: perfil } = await supabaseAdmin
            .from("profiles")
            .select("avatar_url")
            .eq("user_id", link.mentor_id)
            .maybeSingle();
          if (!perfil?.avatar_url) return new Response(null, { status: 404 });

          const { assinarUrl, TTL_AVATAR_SEGUNDOS } = await import("@/lib/storage-assinado.server");
          const assinada = await assinarUrl(supabaseAdmin, perfil.avatar_url, TTL_AVATAR_SEGUNDOS);
          if (!assinada) return new Response(null, { status: 404 });

          const upstream = await fetch(assinada);
          if (!upstream.ok || !upstream.body) return new Response(null, { status: 404 });

          return new Response(upstream.body, {
            headers: {
              "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
              "cache-control": "public, max-age=3600",
            },
          });
        } catch {
          return new Response(null, { status: 404 });
        }
      },
    },
  },
});
