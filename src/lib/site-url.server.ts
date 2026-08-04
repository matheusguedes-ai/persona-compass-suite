/**
 * O endereço público da plataforma — usado para montar link em e-mail (primeiro
 * acesso, convite de equipe) e o retorno do login do Google, que não têm
 * `window.location` disponível (rodam no servidor).
 *
 * Uma variável só: `SITE_URL` (ou `APP_SITE_URL`, porque a hospedagem do
 * Lovable às vezes prefixa o secret com `APP_` — mesma situação de
 * `RESEND_API_KEY`/`APP_RESEND_API_KEY`, ver email.server.ts). Antes disto
 * existiam três nomes (`SITE_URL`, `APP_URL`, `APP_APP_URL`) para a mesma
 * coisa — bastava alguém trocar um e esquecer o outro para o convite ou o
 * login do Google apontarem para o lugar errado.
 *
 * Sem a variável definida, cai no domínio próprio (não mais o do Lovable) —
 * fecha #64.
 */
export function siteUrl(): string {
  const bruto = process.env.SITE_URL || process.env.APP_SITE_URL || "https://assessment.metodointencao.com.br";
  return bruto.replace(/\/$/, "");
}
