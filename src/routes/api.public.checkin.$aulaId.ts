/**
 * A porta do check-in: é aqui que a câmera do celular cai.
 *
 * O QR aponta para cá com o código do minuto. Este endpoint valida o código e a
 * janela da aula, troca o código por um passe em cookie e redireciona para a
 * página de confirmar — SEM o código na URL.
 *
 * Por que redirecionar em vez de já mostrar a página: sem isso, um F5 (ou o
 * botão voltar do Safari) reexecuta a validação com um código já morto, e o
 * aluno vê "expirado" DEPOIS de ter confirmado a presença. Cinco linhas que
 * matam uma classe inteira de suporte.
 *
 * É rota pública de propósito: o cookie nasce antes do login. Quem grava a
 * presença é a server function autenticada do outro lado — aqui não se escreve
 * nada no banco.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  codigoValido, janelaDaAula, dentroDaJanela, assinarPasse, cookieDoPasse,
} from "@/lib/checkin.server";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Página de recado. HTML cru, sem router e sem bundle: quem chega aqui está num
 * celular com sinal ruim e precisa LER uma frase, não baixar o app inteiro.
 */
function recado(titulo: string, texto: string, status: number) {
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${titulo}</title></head>
<body style="margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;background:#f5f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:420px;background:#fff;border-radius:14px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<h1 style="margin:0 0 10px;font-size:19px;color:#111">${titulo}</h1>
<p style="margin:0;font-size:15px;line-height:1.6;color:#444">${texto}</p>
</div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/checkin/$aulaId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const url = new URL(request.url);
          const codigo = url.searchParams.get("c") ?? "";
          const aulaId = params.aulaId;

          const supabase = await getAdmin();
          const { data: aula, error } = await supabase
            .from("treinamento_aulas")
            .select("id, titulo, comeca_em, termina_em, cancelada")
            .eq("id", aulaId)
            .maybeSingle();
          if (error) throw new Error(error.message);
          if (!aula) {
            return recado("Aula não encontrada", "Confira com o professor se o QR é desta aula.", 404);
          }

          // Cancelada antes da janela: o QR de uma aula que não vai acontecer
          // continuaria válido dentro do horário, e quem escaneasse viraria
          // presença gravada num encontro que nunca houve.
          if (aula.cancelada) {
            return recado(
              "Este encontro foi cancelado",
              "O professor cancelou esta aula. Fique de olho na sua agenda — quando for remarcada, você recebe um aviso.",
              410,
            );
          }

          const janela = janelaDaAula(aula);
          if (!janela) {
            return recado(
              "Esta aula ainda não tem horário",
              "O professor precisa definir a data e a hora da aula para liberar o check-in.",
              409,
            );
          }
          if (!dentroDaJanela(janela)) {
            const fim = janela.fim.toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
            });
            return recado(
              "O check-in desta aula está fechado",
              `Ele aceita confirmações até ${fim}. Fale com o professor — ele pode registrar a sua presença na lista.`,
              410,
            );
          }
          if (!codigoValido(aulaId, codigo)) {
            // Sem tom de acusação: na esmagadora maioria das vezes o aluno
            // apenas demorou alguns segundos entre escanear e abrir.
            return recado(
              "Este código já expirou",
              "O código na tela da sala muda a cada minuto. Escaneie o QR de novo — deve funcionar de primeira.",
              410,
            );
          }

          const seguro =
            url.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
          return new Response(null, {
            status: 302,
            headers: {
              Location: `/checkin/${aulaId}`,
              "Set-Cookie": cookieDoPasse(aulaId, assinarPasse(aulaId), seguro),
            },
          });
        } catch (e) {
          return recado(
            "Não deu para abrir o check-in",
            `Tente escanear de novo. Se continuar, o professor pode registrar a sua presença. (${
              e instanceof Error ? e.message : "erro"
            })`,
            500,
          );
        }
      },
    },
  },
});
