/**
 * Rota que o pg_cron do banco chama a cada 15 minutos (ver o cabeçalho da
 * migração 20260805070000_lembrete_por_email.sql) para disparar os lembretes
 * por e-mail de sessões de mentoria próximas (#266).
 *
 * Protegida por segredo compartilhado no header `x-cron-secret` — comparado
 * contra `CRON_SECRET` (ou `APP_CRON_SECRET`, mesma dupla de nome de
 * site-url.server.ts, porque a hospedagem do Lovable às vezes prefixa o
 * secret com `APP_`). Sem bater — incluindo o caso do segredo não estar
 * configurado — devolve 404, nunca 401: um 401 confirma que a rota existe
 * para quem está tentando adivinhar o segredo.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cron/lembretes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const segredo = process.env.CRON_SECRET || process.env.APP_CRON_SECRET;
        const recebido = request.headers.get("x-cron-secret");
        if (!segredo || recebido !== segredo) {
          return new Response(null, { status: 404 });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { enviarLembretesDevidos } = await import("@/lib/agendamento.functions");
          const resultado = await enviarLembretesDevidos(supabaseAdmin);
          return new Response(JSON.stringify({ ok: true, ...resultado }), {
            headers: { "content-type": "application/json" },
          });
        } catch (e) {
          console.error("[cron/lembretes] falhou:", e);
          return new Response(JSON.stringify({ ok: false, erro: e instanceof Error ? e.message : "erro" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
