/**
 * Marca pública das telas SEM SESSÃO (#261) — login hoje; convite, check-in
 * e as demais entram na #262. Resolvida pelo HOST do pedido
 * (`resolveContaPorHost`/`loadPublicLoginBrand` em brand.server.ts), nunca
 * por login: quem abre esta rota ainda não foi identificado.
 *
 * `no-store` de propósito — ao contrário de `/api/icone` e `/api/manifest`
 * (que podem viver em cache por uma hora, o navegador só busca de novo em
 * visitas espaçadas), aqui o teste que decide é justamente trocar a marca em
 * Configurações e ver refletir no login SEM REPUBLICAR NADA. Um cache
 * atrasaria exatamente o que a demanda pede para provar.
 *
 * Lista FECHADA de campos — ver o cabeçalho de loadPublicLoginBrand.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/marca")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { loadPublicLoginBrand, hostDaRequisicao } = await import("@/lib/brand.server");
          const brand = await loadPublicLoginBrand(hostDaRequisicao(request));
          return new Response(JSON.stringify({ brand }), {
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });
        } catch {
          return new Response(JSON.stringify({ brand: null }), {
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });
        }
      },
    },
  },
});
