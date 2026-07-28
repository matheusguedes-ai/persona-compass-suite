/**
 * Primeiro acesso do avaliado.
 *
 * O mentor cadastra a pessoa em `people`, mas isso não cria um usuário — então
 * o avaliado não tinha como entrar na plataforma. Este arquivo abre esse
 * caminho.
 *
 * ⚠️ POR QUE NÃO É "DIGITE O E-MAIL E ESCOLHA A SENHA"
 *
 * Do jeito mais simples possível, qualquer pessoa que soubesse o e-mail de um
 * avaliado definiria a senha dele e entraria na conta — com os resultados de
 * todo mundo do outro lado. Por isso o e-mail recebe um LINK, e a senha só pode
 * ser criada depois de clicar nele. Clicar no link é a prova de que o e-mail é
 * da pessoa; não existe atalho para isso.
 *
 * ⚠️ POR QUE A RESPOSTA É SEMPRE A MESMA
 *
 * Se a tela dissesse "e-mail não encontrado", qualquer um descobriria quem são
 * os avaliados de um mentor testando endereços. A resposta não varia: "se este
 * e-mail estiver cadastrado, você vai receber um link". Quem tem cadastro
 * recebe; quem não tem, não recebe e também não fica sabendo.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const solicitarAcessoAluno = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      email: z.string().email().max(200),
      /** Para onde voltar depois de clicar no link. */
      origem: z.string().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    // Mesma frase em todos os caminhos. Ver o cabeçalho.
    const resposta = {
      ok: true as const,
      mensagem:
        "Se este e-mail estiver cadastrado, você vai receber um link para entrar. " +
        "Confira também a caixa de spam.",
    };

    const supabase = await admin();
    const { data: pessoa, error } = await supabase
      .from("people")
      .select("id, full_name, mentor_id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!pessoa) return resposta;

    // `generateLink` cria o usuário se ainda não existir e devolve o link de
    // acesso sem enviar e-mail — o envio é nosso, pelo Resend, com o domínio
    // verificado e a marca do mentor.
    const site = process.env.SITE_URL || "https://persona-compass-suite.lovable.app";
    const destino = `${site}/aluno/criar-senha`;
    const { data: gerado, error: erroLink } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: destino },
    });
    if (erroLink) {
      // Usuário ainda não existe: o tipo `magiclink` só serve para quem já tem
      // conta. Aí o convite é que cria.
      const { data: convite, error: erroConvite } = await supabase.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo: destino },
      });
      if (erroConvite) throw new Error(erroConvite.message);
      await mandar(convite?.properties?.action_link, email, pessoa, supabase);
      return resposta;
    }
    await mandar(gerado?.properties?.action_link, email, pessoa, supabase);
    return resposta;
  });

async function mandar(
  link: string | undefined,
  email: string,
  pessoa: { full_name: string | null; mentor_id: string },
  supabase: Awaited<ReturnType<typeof admin>>,
) {
  if (!link) return;
  const { enviarEmail, montarHtml } = await import("@/lib/email.server");
  const { data: perfil } = await supabase
    .from("profiles")
    .select("company_name, brand_color, site_url, support_email, email_from")
    .eq("user_id", pessoa.mentor_id)
    .maybeSingle();

  const nome = (pessoa.full_name ?? "").split(" ")[0] || "Olá";
  const marca = perfil?.company_name?.trim() || "Métrica Humana";
  const html = montarHtml({
    corpo:
      `${nome}, este é o seu acesso ao painel de ${marca}.\n\n` +
      "Clique no botão abaixo para entrar. Na primeira vez, você vai escolher uma senha — " +
      "depois disso, é só usar o seu e-mail e essa senha.\n\n" +
      "O link vale por uma hora. Se você não pediu este acesso, pode ignorar esta mensagem.",
    link,
    rotuloBotao: "Entrar no meu painel",
    marca: perfil ?? null,
  });

  await enviarEmail({
    to: email,
    subject: `Seu acesso ao painel de ${marca}`,
    html,
    from: perfil?.email_from ?? null,
    replyTo: perfil?.support_email ?? null,
  });
}
