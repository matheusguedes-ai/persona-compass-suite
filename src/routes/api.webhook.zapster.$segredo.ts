/**
 * A porta do webhook da Zapster (Menu Mensagens — M1a): a Zapster avisa aqui quando chega mensagem, quando uma mensagem
 * nossa é entregue/lida, quando alguém clica num botão e quando a instância cai.
 *
 * PROVA DE ORIGEM: a Zapster não assina as chamadas (o cadastro do webhook só aceita endereço, nome, eventos e
 * ligado/desligado). Por isso o endereço leva um segredo longo: /api/webhook/zapster/<segredo>. Sem ele, ou sem as
 * variáveis configuradas, a resposta é 404 vazio — igual à rota do relógio: nenhuma pista de que a porta existe.
 *
 * Só aceita eventos da NOSSA linha (conferida pelo número, em ZAPSTER_NUMERO). Responde rápido, sem trabalho pesado.
 * Nunca escreve em log o corpo, o segredo ou o token.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";

const nao = () => new Response(null, { status: 404 });

function iguais(a: string, b: string): boolean {
  // Resume os dois antes de comparar: tamanhos iguais e tempo constante, qualquer que seja o que chegou.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export const Route = createFileRoute("/api/webhook/zapster/$segredo")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        // `.trim()`: um espaço ou quebra de linha colado por engano no fim do segredo não pode derrubar a porta.
        const esperado = (process.env.ZAPSTER_WEBHOOK_SEGREDO || process.env.APP_ZAPSTER_WEBHOOK_SEGREDO || "").trim();
        const numero = (process.env.ZAPSTER_NUMERO || process.env.APP_ZAPSTER_NUMERO || "").replace(/\D/g, "");
        if (!esperado || !numero || !iguais(String(params.segredo ?? ""), esperado)) return nao();

        let evento: unknown;
        try {
          const texto = await request.text();
          if (texto.length > 512_000) return nao();
          evento = JSON.parse(texto);
        } catch {
          return new Response(JSON.stringify({ ok: false }), { status: 400, headers: { "content-type": "application/json" } });
        }
        if (!evento || typeof evento !== "object") return new Response(JSON.stringify({ ok: false }), { status: 400, headers: { "content-type": "application/json" } });

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { contaDaInstancia, processarEventoZapster } = await import("@/lib/canal/webhook-zapster.server");
          const contaId = await contaDaInstancia(supabaseAdmin);
          if (!contaId) return nao();
          const acao = await processarEventoZapster(supabaseAdmin as never, evento as never, { contaId, numero });
          // De outra linha: para quem chama, é como se a porta não existisse.
          if (acao === "outra_instancia") return nao();
          return new Response(JSON.stringify({ ok: true, acao }), { headers: { "content-type": "application/json" } });
        } catch (e) {
          // Só a mensagem do erro — nunca o corpo do evento. 500 = a Zapster (se reenviar) tenta de novo.
          console.error("[webhook-zapster] falhou:", e instanceof Error ? e.message : "erro");
          return new Response(JSON.stringify({ ok: false }), { status: 500, headers: { "content-type": "application/json" } });
        }
      },
    },
  },
});
