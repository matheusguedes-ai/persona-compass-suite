// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // #279 F6 — o próprio arquivo do service worker (e seu ajudante da
  // workbox) NUNCA pode ficar em cache: é o único jeito do navegador
  // perceber que existe uma versão nova depois de uma publicação. O
  // /assets/* de sempre continua com cache de 1 ano (nomes têm hash,
  // sempre mudam num build novo — sem risco); só isto aqui é a exceção.
  // `routeRules` é opção real do Nitro (repassada direto, sem validação —
  // ver node_modules/@lovable.dev/vite-tanstack-config/dist/index.js
  // ~linha 554); o .d.ts do wrapper só declara preset/output/cloudflare,
  // por isso o `as` abaixo.
  nitro: {
    routeRules: {
      "/sw.js": { headers: { "cache-control": "no-cache" } },
      "/workbox-*.js": { headers: { "cache-control": "no-cache" } },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
  vite: {
    plugins: [
      mcpPlugin(),
      // #279 F6 — só instalabilidade (app shell em cache), não offline de
      // dados. Ver o comentário grande no topo de src/routes/__root.tsx
      // sobre as decisões (registro manual, sem manifest daqui, sem cache
      // de API).
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: false,
        manifest: false,
        includeManifestIcons: false,
        // O Nitro deste projeto manda o build do cliente direto para
        // .output/public (não o dist/ padrão do Vite) — sem isto, o plugin
        // procura os arquivos no lugar errado e o build quebra dizendo que
        // não achou nada para colocar em cache.
        outDir: ".output/public",
        workbox: {
          // Só os arquivos do próprio app (JS/CSS/ícone da aba). Nada de
          // HTML — este projeto não tem HTML estático, toda rota é servida
          // pelo Nitro a cada pedido — e nenhuma chamada a /api/* entra
          // aqui: o glob só varre a pasta de build do cliente, que nunca
          // teve rota de API dentro dela.
          globPatterns: ["**/*.{js,css,ico}"],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          // Sem fallback de navegação de propósito: não existe index.html
          // estático pra cair de volta, e forçar um aqui arriscaria servir
          // uma casca velha por cima de uma rota que o Nitro devolveria
          // certa. Instalável não precisa disso — só precisa de um SW
          // registrado com fetch handler, que o generateSW já entrega.
          navigateFallback: undefined,
          // Vazio de propósito — sem isto, nada além do precache acima é
          // interceptado. /api/manifest, /api/icone/* e toda resposta do
          // Supabase passam direto pela rede, nunca em cache.
          runtimeCaching: [],
        },
        devOptions: {
          // Sem service worker no `vite dev` — só atrapalharia o hot
          // reload, e o critério de pronto desta fatia é sobre produção.
          enabled: false,
        },
      }),
    ],
  },
});
