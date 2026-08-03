/**
 * Manifest do app (#235) — nome, ícone e cor da conta, para o navegador
 * oferecer "Instalar aplicativo" e o celular usar o ícone certo.
 *
 * Sem sessão (ver `resolveContaUnica` em brand.server.ts para o porquê e o
 * que muda com o segundo cliente). Os ícones apontam para `/api/icone/*`,
 * que também nunca expira — ver o comentário daquela rota.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/manifest")({
  server: {
    handlers: {
      GET: async () => {
        const { resolveContaUnica } = await import("@/lib/brand.server");
        const conta = await resolveContaUnica();
        const nome = conta?.company_name?.trim() || "Métrica Humana";
        const cor = conta?.brand_color?.trim() || "#164e63";

        const manifest = {
          name: nome,
          short_name: nome.slice(0, 30),
          start_url: "/",
          display: "standalone",
          background_color: "#ffffff",
          theme_color: cor,
          // `RecortarImagem` sempre exporta JPEG — o type precisa bater com o
          // arquivo de verdade, não com o formato mais comum de ícone de app.
          icons: [
            { src: "/api/icone/192", sizes: "192x192", type: "image/jpeg" },
            { src: "/api/icone/512", sizes: "512x512", type: "image/jpeg" },
          ],
        };

        return new Response(JSON.stringify(manifest), {
          headers: {
            "content-type": "application/manifest+json",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
