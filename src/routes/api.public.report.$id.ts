import { mensagemDeErro } from "@/lib/erro-legivel";
import { createFileRoute } from "@tanstack/react-router";
import { buildReport } from "@/lib/report.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export const Route = createFileRoute("/api/public/report/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const out = await buildReport(params.id);
          if (out.status === 404) return json({ error: out.error }, 404);
          return json(out.data);
        } catch (e) {
          const msg = mensagemDeErro(e);
          return json({ error: msg }, 500);
        }
      },
    },
  },
});
