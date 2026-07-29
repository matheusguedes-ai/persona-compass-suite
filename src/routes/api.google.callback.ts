/**
 * A volta do Google.
 *
 * Recebe o código de autorização, troca por tokens, cria a agenda própria e
 * guarda o refresh token. Só o servidor encosta no token — a tabela não tem
 * policy de leitura, então ele nunca chega ao navegador.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  trocarCodigoPorTokens, criarAgenda, emailDaConta, verificarEstado,
} from "@/lib/google.server";

const DESTINO = "/configuracoes";

function volta(msg: string, ok: boolean) {
  return new Response(null, {
    status: 302,
    headers: { Location: `${DESTINO}?google=${ok ? "ok" : "erro"}&msg=${encodeURIComponent(msg)}` },
  });
}

export const Route = createFileRoute("/api/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const erro = url.searchParams.get("error");
        // A pessoa clicou em "cancelar" na tela do Google. Não é falha.
        if (erro) return volta("Você não autorizou o acesso.", false);

        const codigo = url.searchParams.get("code");
        const estado = url.searchParams.get("state");
        if (!codigo || !estado) return volta("Resposta incompleta do Google.", false);

        // Sem isto, qualquer um chamaria este endereço com o id de outra pessoa
        // e penduraria a própria conta do Google no calendário dela.
        const userId = verificarEstado(estado);
        if (!userId) return volta("Pedido não reconhecido.", false);

        try {
          const tokens = await trocarCodigoPorTokens(codigo);
          if (!tokens.refresh_token) {
            // Acontece quando a pessoa já autorizou antes e o Google não repete
            // o refresh. `prompt=consent` evita, mas se escapar é melhor dizer
            // do que guardar uma conexão que morre em uma hora.
            return volta("O Google não devolveu a autorização de longo prazo. Tente de novo.", false);
          }

          const [agenda, email] = await Promise.all([
            criarAgenda(tokens.access_token),
            emailDaConta(tokens.access_token),
          ]);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("google_conexoes").upsert({
            user_id: userId,
            refresh_token: tokens.refresh_token,
            calendar_id: agenda,
            email,
            ultimo_erro: null,
          });
          if (error) throw new Error(error.message);

          return volta("Google Calendar conectado.", true);
        } catch (e) {
          return volta((e as Error).message, false);
        }
      },
    },
  },
});
