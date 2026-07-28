/**
 * Envio de email pelo Resend.
 *
 * Chamado pela API HTTP direto (sem SDK): é uma requisição só, e evita mais uma
 * dependência no bundle do servidor.
 *
 * A chave vive em `RESEND_API_KEY`. Enquanto ela não existir, `emailAtivo()`
 * devolve false e a interface explica a pendência em vez de dar erro — o resto
 * da plataforma não depende disso para funcionar.
 */

const RESEND_URL = "https://api.resend.com/emails";

/** Remetente padrão do Resend: só entrega para o dono da conta, serve para testar. */
const REMETENTE_TESTE = "Métrica Humana <onboarding@resend.dev>";

function chave(): string | null {
  // O Lovable reserva o prefixo SUPABASE_, mas não o RESEND_. Mesmo assim
  // aceitamos APP_ como alternativa, seguindo o que já foi feito com o Supabase.
  return process.env.RESEND_API_KEY || process.env.APP_RESEND_API_KEY || null;
}

export function emailAtivo(): boolean {
  return !!chave();
}

/** De quem sai o email. Sem domínio verificado, cai no remetente de teste. */
export function remetente(): { valor: string; eh_teste: boolean } {
  const proprio = process.env.EMAIL_FROM || process.env.APP_EMAIL_FROM;
  if (proprio) return { valor: proprio, eh_teste: false };
  return { valor: REMETENTE_TESTE, eh_teste: true };
}

export type ResultadoEnvio =
  | { ok: true; provider_id: string | null }
  | { ok: false; erro: string };

export async function enviarEmail(params: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string | null;
}): Promise<ResultadoEnvio> {
  const key = chave();
  if (!key) return { ok: false, erro: "Envio de email ainda não está ligado (falta a chave do Resend)." };

  try {
    const r = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: remetente().valor,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
    });
    const corpo = (await r.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!r.ok) {
      // As mensagens do Resend são em inglês e técnicas; traduzimos as comuns.
      return { ok: false, erro: traduzErro(r.status, corpo.message ?? corpo.name ?? "") };
    }
    return { ok: true, provider_id: corpo.id ?? null };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Falha de conexão com o serviço de email." };
  }
}

function traduzErro(status: number, msg: string): string {
  const m = msg.toLowerCase();
  if (status === 401 || status === 403) {
    return "A chave do Resend foi recusada. Confira se ela foi copiada inteira e ainda está ativa.";
  }
  if (m.includes("domain is not verified") || m.includes("not verified")) {
    return "O domínio do remetente ainda não foi verificado no Resend. Enquanto isso, só dá para enviar para o email dono da conta.";
  }
  if (m.includes("you can only send testing emails to your own email")) {
    return "Conta do Resend ainda em modo de teste: ela só entrega para o email dono da conta. Verifique um domínio no Resend para enviar aos avaliados.";
  }
  if (status === 429) return "Muitos envios em pouco tempo. Espere um instante e tente de novo.";
  return msg || `O serviço de email respondeu com erro ${status}.`;
}

// ============================================================
// Montagem da mensagem
// ============================================================
function escapar(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Aplica o texto que o mentor escreveu nas Configurações.
 * `{nome}` e `{link}` são os mesmos marcadores da tela de envio.
 */
export function aplicarModelo(modelo: string, dados: { nome: string; link: string }) {
  return modelo.replaceAll("{nome}", dados.nome).replaceAll("{link}", dados.link);
}

export type MarcaEmail = {
  company_name?: string | null;
  logo_url?: string | null;
  brand_color?: string | null;
  site_url?: string | null;
  support_email?: string | null;
};

/**
 * HTML do email. Tabela e estilo em linha de propósito: cliente de email não
 * entende folha de estilo externa nem grid moderno.
 */
export function montarHtml(params: {
  corpo: string;
  link: string;
  rotuloBotao: string;
  marca?: MarcaEmail | null;
}) {
  const { marca } = params;
  const cor = marca?.brand_color?.trim() || "#164e63";
  const nome = marca?.company_name?.trim() || "Métrica Humana";
  const paragrafos = params.corpo
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333">${escapar(p).replaceAll("\n", "<br>")}</p>`)
    .join("");

  const rodape = [
    marca?.site_url?.trim() ? `<a href="${escapar(marca.site_url)}" style="color:#777">${escapar(marca.site_url.replace(/^https?:\/\//, ""))}</a>` : "",
    marca?.support_email?.trim() ? `<a href="mailto:${escapar(marca.support_email)}" style="color:#777">${escapar(marca.support_email)}</a>` : "",
  ].filter(Boolean).join(" · ");

  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
  <tr><td style="padding:28px 28px 8px">
    ${marca?.logo_url ? `<img src="${escapar(marca.logo_url)}" alt="${escapar(nome)}" style="height:34px;max-width:180px;object-fit:contain">` : `<div style="font-size:14px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:${escapar(cor)}">${escapar(nome)}</div>`}
  </td></tr>
  <tr><td style="padding:12px 28px 4px">${paragrafos}</td></tr>
  <tr><td style="padding:8px 28px 28px">
    <a href="${escapar(params.link)}" style="display:inline-block;background:${escapar(cor)};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:600">${escapar(params.rotuloBotao)}</a>
    <p style="margin:16px 0 0;font-size:12px;color:#888;line-height:1.5">
      Se o botão não funcionar, copie e cole este endereço no navegador:<br>
      <span style="color:#555;word-break:break-all">${escapar(params.link)}</span>
    </p>
  </td></tr>
  ${rodape ? `<tr><td style="padding:16px 28px;border-top:1px solid #eee;font-size:12px;color:#777">${rodape}</td></tr>` : ""}
</table>
</body></html>`;
}
