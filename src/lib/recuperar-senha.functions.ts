/**
 * Recuperação de senha — #299.
 *
 * Mesmo mecanismo do primeiro acesso (`acesso-aluno.functions.ts`): o link é
 * gerado pelo admin do Supabase (`generateLink`, que NÃO envia e-mail sozinho)
 * e o envio é nosso, pelo Resend, com a marca de quem for o caso — a do mentor
 * quando é um avaliado recuperando a senha, a da própria conta quando é o
 * dono ou um colaborador. `resetPasswordForEmail` (client-side) faria o
 * Supabase mandar o e-mail dele, genérico e sem marca — por isso não é usado
 * aqui, do mesmo jeito que o primeiro acesso já evita isso.
 *
 * ⚠️ RESPOSTA SEMPRE IGUAL, pelo mesmo motivo do primeiro acesso: dizer
 * "e-mail não encontrado" deixaria qualquer um descobrir quem tem conta na
 * plataforma testando endereços.
 *
 * Diferença chave para o primeiro acesso: aqui NÃO existe fallback de
 * "convite" quando o e-mail não tem conta — recuperar senha só faz sentido
 * para quem já existe. Sem conta, a resposta é a mesma frase neutra e nada
 * é criado.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { siteUrl } from "@/lib/site-url.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const solicitarRecuperacaoSenha = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().email().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    // Mesma frase em todos os caminhos. Ver o cabeçalho.
    const resposta = {
      ok: true as const,
      mensagem:
        "Se este e-mail tiver uma conta, você vai receber um link para escolher uma nova senha. " +
        "Confira também a caixa de spam.",
    };

    const supabase = await admin();
    const destino = `${siteUrl()}/criar-senha`;
    const { data: gerado, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: destino },
    });
    // Conta não existe (ou qualquer outro problema): mesma resposta, nada a enviar.
    if (error || !gerado?.properties?.action_link) return resposta;

    const uid = gerado.user.id;
    const { marca, nome } = await buscarMarcaENome(supabase, uid);

    const { enviarEmail, montarHtml } = await import("@/lib/email.server");
    const rotulo = marca?.company_name?.trim() || "Métrica Humana";
    const html = montarHtml({
      corpo:
        `${nome}, recebemos um pedido para redefinir a senha da sua conta em ${rotulo}.\n\n` +
        "Clique no botão abaixo para escolher uma nova senha. O link vale por uma hora e só pode " +
        "ser usado uma vez.\n\n" +
        "Se você não pediu isso, pode ignorar esta mensagem — sua senha continua a mesma.",
      link: gerado.properties.action_link,
      rotuloBotao: "Escolher nova senha",
      marca,
    });
    await enviarEmail({
      to: email,
      subject: `Redefinir sua senha em ${rotulo}`,
      html,
      from: marca?.email_from ?? null,
      replyTo: marca?.support_email ?? null,
    });
    return resposta;
  });

/**
 * De quem é a marca a usar no e-mail, e o primeiro nome para saudação.
 *
 * Dono/colaborador tem `profiles` própria. Avaliado não tem `profiles` — usa
 * a do mentor dele, achado por `people.mentor_id`. Sem nenhum dos dois (não
 * deveria acontecer, já que `uid` veio de uma conta que o `generateLink`
 * confirmou existir), cai no padrão.
 */
async function buscarMarcaENome(
  supabase: Awaited<ReturnType<typeof admin>>,
  uid: string,
): Promise<{
  marca: { company_name: string | null; brand_color: string | null; site_url: string | null; support_email: string | null; email_from: string | null } | null;
  nome: string;
}> {
  const { data: perfilProprio } = await supabase
    .from("profiles")
    .select("full_name, company_name, brand_color, site_url, support_email, email_from")
    .eq("user_id", uid)
    .maybeSingle();
  if (perfilProprio) {
    return { marca: perfilProprio, nome: (perfilProprio.full_name ?? "").split(" ")[0] || "Olá" };
  }

  const { data: pessoa } = await supabase
    .from("people").select("full_name, mentor_id").eq("user_id", uid).limit(1).maybeSingle();
  if (pessoa) {
    const { data: perfilDoMentor } = await supabase
      .from("profiles")
      .select("company_name, brand_color, site_url, support_email, email_from")
      .eq("user_id", pessoa.mentor_id)
      .maybeSingle();
    return { marca: perfilDoMentor, nome: (pessoa.full_name ?? "").split(" ")[0] || "Olá" };
  }

  return { marca: null, nome: "Olá" };
}
