/**
 * Ícone do app (#235) — endereço ESTÁVEL, nunca expira.
 *
 * O bucket 'marca' é privado; uma URL assinada tem prazo. Se o manifest ou o
 * apple-touch-icon apontassem direto para uma URL assinada, o ícone quebraria
 * dias depois no celular de quem já instalou — sem aviso, sem ação visível
 * que explique. Aqui o CAMINHO (`/api/icone/192` etc.) nunca muda: a cada
 * pedido, assina de novo por dentro e devolve os bytes. Quem chamou nunca vê
 * a URL assinada, só a imagem.
 *
 * `$tamanho` (192, 512, apple) hoje não muda a resposta — servimos sempre o
 * mesmo arquivo quadrado que a conta subiu, do jeito que os navegadores/SO já
 * fazem ao redimensionar um ícone só para vários tamanhos declarados. Existe
 * como três entradas separadas no manifest/HTML para não recusar o pedido de
 * nenhum navegador, e para o dia de gerar tamanhos de verdade não exigir
 * mudar a URL usada em produção.
 */
import { createFileRoute } from "@tanstack/react-router";

const REDIRECT_PADRAO = { status: 302, headers: { Location: "/favicon.ico" } };

export const Route = createFileRoute("/api/icone/$tamanho")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { resolveContaUnica } = await import("@/lib/brand.server");
          const conta = await resolveContaUnica();
          if (!conta?.icon_url) return new Response(null, REDIRECT_PADRAO);

          const { assinarUrl, TTL_MARCA_SEGUNDOS } = await import("@/lib/storage-assinado.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const assinada = await assinarUrl(supabaseAdmin, conta.icon_url, TTL_MARCA_SEGUNDOS);
          if (!assinada) return new Response(null, REDIRECT_PADRAO);

          const upstream = await fetch(assinada);
          if (!upstream.ok || !upstream.body) return new Response(null, REDIRECT_PADRAO);

          return new Response(upstream.body, {
            headers: {
              "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
              "cache-control": "public, max-age=3600",
            },
          });
        } catch {
          return new Response(null, REDIRECT_PADRAO);
        }
      },
    },
  },
});
