/**
 * O PDF do relatório unificado de uma BATERIA, gerado no servidor (#293, fatia 1).
 * Mesma infraestrutura do relatório individual: capa, cabeçalho repetido, numeração e a fonte da
 * marca embutida. Uma seção por teste efetivamente respondido, na ordem da bateria.
 */
import { createFileRoute } from "@tanstack/react-router";
import { mensagemDeErro } from "@/lib/erro-legivel";
import { servirPdfDaBateria } from "@/lib/pdf/servir.server";

export const Route = createFileRoute("/api/pdf/bateria/$assessmentId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          return await servirPdfDaBateria(params.assessmentId);
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
