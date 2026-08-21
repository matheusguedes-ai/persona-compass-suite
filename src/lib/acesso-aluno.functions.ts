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
import { siteUrl } from "@/lib/site-url.server";

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
    const destino = `${siteUrl()}/criar-senha`;
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

/**
 * Dados de quem acabou de responder, para oferecer a conta no fim do teste.
 *
 * Público, identificado pelo id da resposta — que é o próprio link que a pessoa
 * usou para responder. Devolve só nome, telefone e o e-mail PARCIALMENTE
 * ESCONDIDO: serve para a pessoa reconhecer o próprio endereço ("é esse mesmo")
 * sem que um link vazado entregue o e-mail inteiro de alguém.
 */
export const dadosParaCadastro = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ response_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const supabase = await admin();
    const { data: r } = await supabase
      .from("test_responses")
      .select("person_id, people(full_name, phone, email, user_id)")
      .eq("id", data.response_id)
      .maybeSingle();
    const p = r?.people;
    if (!p) return { encontrado: false as const };
    const email = p.email ?? "";
    const [antes, dominio] = email.split("@");
    return {
      encontrado: true as const,
      nome: p.full_name ?? "",
      telefone: p.phone ?? "",
      ja_tem_conta: !!p.user_id,
      email_mascarado: antes && dominio
        ? `${antes.slice(0, 2)}${"•".repeat(Math.max(2, antes.length - 2))}@${dominio}`
        : "",
    };
  });

/**
 * Completa o cadastro no fim do teste e dispara o link de acesso.
 *
 * Nome e telefone são gravados na hora — é dado que a pessoa está corrigindo
 * sobre si mesma, e o mentor se beneficia disso. A CONTA, não: ela nasce do
 * link enviado ao e-mail, igual ao primeiro acesso.
 *
 * Por que não deixar escolher a senha aqui, já que a pessoa tem o link do
 * teste: porque o link do teste é descartável e a conta não é. Um link
 * encaminhado por engano daria acesso permanente a todos os resultados daquela
 * pessoa, não só ao teste que ele abria.
 */
export const concluirCadastroPeloLink = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      response_id: z.string().uuid(),
      nome: z.string().min(2).max(160).optional(),
      telefone: z.string().max(40).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const supabase = await admin();
    const { data: r } = await supabase
      .from("test_responses")
      .select("person_id, people(email, full_name, mentor_id)")
      .eq("id", data.response_id)
      .maybeSingle();
    if (!r?.people?.email) throw new Error("Não encontrei o cadastro ligado a este teste.");

    const patch: { full_name?: string; phone?: string } = {};
    if (data.nome?.trim()) patch.full_name = data.nome.trim();
    if (data.telefone?.trim()) patch.phone = data.telefone.trim();
    if (Object.keys(patch).length > 0) {
      // #212 — person_id é nullable em test_responses (teste anônimo), mas
      // `r.people` só existe quando o embed achou alguém em person_id — a
      // checagem logo acima já garante que não é o caso anônimo aqui.
      await supabase.from("people").update(patch).eq("id", r.person_id!);
    }

    const destino = `${siteUrl()}/criar-senha`;
    const email = r.people.email;
    let link: string | undefined;
    const { data: g1, error: e1 } = await supabase.auth.admin.generateLink({
      type: "magiclink", email, options: { redirectTo: destino },
    });
    if (e1) {
      const { data: g2, error: e2 } = await supabase.auth.admin.generateLink({
        type: "invite", email, options: { redirectTo: destino },
      });
      if (e2) throw new Error(e2.message);
      link = g2?.properties?.action_link;
    } else {
      link = g1?.properties?.action_link;
    }
    await mandar(link, email, { full_name: patch.full_name ?? r.people.full_name, mentor_id: r.people.mentor_id }, supabase);
    return {
      ok: true as const,
      mensagem: "Enviamos um link para o seu e-mail. Clique nele para escolher sua senha e entrar.",
    };
  });
