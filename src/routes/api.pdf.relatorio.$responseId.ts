/**
 * O PDF do relatório de UM teste, gerado no servidor (#293, fatia 1).
 *
 * Antes, "Baixar PDF" chamava `window.print()`: o arquivo era a tela mandada para a impressora
 * virtual de quem clicava, e saía diferente conforme o navegador, o sistema e as margens da
 * máquina. Aqui o documento é montado e diagramado aqui dentro — mesma entrada, mesmos bytes.
 *
 * O controle de acesso é o mesmo da tela, e roda em `servir.server.ts`.
 */
import { createFileRoute } from "@tanstack/react-router";
import { mensagemDeErro } from "@/lib/erro-legivel";
import { servirPdfDoRelatorio } from "@/lib/pdf/servir.server";

export const Route = createFileRoute("/api/pdf/relatorio/$responseId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          return await servirPdfDoRelatorio(params.responseId);
        } catch (e) {
          return new Response(JSON.stringify({ error: mensagemDeErro(e) }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
