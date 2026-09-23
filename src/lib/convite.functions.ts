/**
 * #300 — o link aberto para quem JÁ tem cadastro.
 *
 * O link foi desenhado para quem não tem cadastro. Na aula de 22/09 a turma
 * inteira tinha, e quem digitava o próprio e-mail recebia um erro sem saída.
 * Aqui mora o caminho de volta: entrar na conta (senha, Google ou link por
 * e-mail) e cair NO TESTE do link, não no painel genérico — perder o destino
 * é o que faz alguém desistir no meio.
 *
 * O destino sobrevive ao login por `?continuar=1` no próprio endereço do
 * convite: o login com senha e o com Google voltam para ele (o `next` da
 * tela de entrada), e o link por e-mail também. Chegando com `continuar=1` e
 * com cadastro reconhecido, a tela segue direto; sem ele (a pessoa só abriu
 * o link já logada), a tela pergunta antes — num computador compartilhado,
 * seguir sozinho responderia o teste na conta de outra pessoa.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { siteUrl } from "@/lib/site-url.server";
import { normalizarEmail } from "@/lib/duplicidade";
import {
  colocarNoGrupoDoLink, criarRespostasDoConvite, MENSAGENS_BLOQUEIO, motivoBloqueio,
  respostaAbertaDoConvite, type LinkAberto,
} from "@/lib/convite.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function carregarLink(supabase: Awaited<ReturnType<typeof admin>>, linkId: string) {
  const { data, error } = await supabase
    .from("invite_links")
    .select("id, mentor_id, version_ids, group_id, expires_at, is_active, max_responses, response_count")
    .eq("id", linkId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as LinkAberto | null;
}

/**
 * O cadastro de quem está logado, na conta dona deste link.
 *
 * Roda o casamento por e-mail antes (`claim_student_profile`): quem acabou de
 * entrar pelo link do e-mail ou pelo Google pode ainda não estar ligado ao
 * cadastro que o mentor fez — é o mesmo cuidado da #299.
 */
async function minhaPessoaNaConta(rls: SupabaseClient<Database>, userId: string, mentorId: string) {
  const { error: claimErr } = await rls.rpc("claim_student_profile");
  if (claimErr) throw new Error(claimErr.message);
  const { data, error } = await rls
    .from("people")
    .select("id, full_name")
    .eq("user_id", userId)
    .eq("mentor_id", mentorId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? [])[0] ?? null;
}

/**
 * Manda um link de acesso ao e-mail de quem já tem cadastro, voltando direto
 * para o teste do convite. Serve para quem não lembra a senha E para quem
 * nunca criou uma (ainda sem login — era o caso de parte da turma): o link
 * entra sem senha nos dois casos.
 *
 * Público. A resposta é sempre a mesma, com cadastro ou sem.
 */
export const enviarAcessoPeloConvite = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ link_id: z.string().uuid(), email: z.string().trim().email().max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    const resposta = {
      ok: true as const,
      mensagem:
        "Se este e-mail tiver cadastro, enviamos um link para ele. Clique no link para entrar — " +
        "você volta direto para este teste. Confira também a caixa de spam.",
    };

    const supabase = await admin();
    const link = await carregarLink(supabase, data.link_id);
    // Link desativado ou vencido: não há teste para onde voltar.
    if (!link || !link.is_active || (link.expires_at && new Date(link.expires_at).getTime() < Date.now())) {
      return resposta;
    }

    const email = normalizarEmail(data.email);
    const { data: daConta, error } = await supabase
      .from("people").select("id, full_name, email").eq("mentor_id", link.mentor_id);
    if (error) throw new Error(error.message);
    const pessoa = (daConta ?? []).find((p) => normalizarEmail(p.email) === email);
    if (!pessoa) return resposta;

    const destino = `${siteUrl()}/convite/${link.id}?continuar=1`;
    // `magiclink` só serve para quem já tem usuário; sem usuário ainda, o
    // `invite` é que cria. Mesma sequência do primeiro acesso.
    let acesso: string | undefined;
    const { data: g1, error: e1 } = await supabase.auth.admin.generateLink({
      type: "magiclink", email, options: { redirectTo: destino },
    });
    if (e1) {
      const { data: g2, error: e2 } = await supabase.auth.admin.generateLink({
        type: "invite", email, options: { redirectTo: destino },
      });
      if (e2) throw new Error(e2.message);
      acesso = g2?.properties?.action_link;
    } else {
      acesso = g1?.properties?.action_link;
    }
    if (!acesso) return resposta;

    const { data: perfil } = await supabase
      .from("profiles")
      .select("company_name, brand_color, site_url, support_email, email_from")
      .eq("user_id", link.mentor_id)
      .maybeSingle();
    const nome = (pessoa.full_name ?? "").split(" ")[0] || "Olá";
    const marca = perfil?.company_name?.trim() || "Métrica Humana";
    const { enviarEmail, montarHtml } = await import("@/lib/email.server");
    const envio = await enviarEmail({
      to: email,
      subject: `Seu acesso para responder — ${marca}`,
      html: montarHtml({
        corpo:
          `${nome}, este é o seu acesso para responder o convite de ${marca}.\n\n` +
          "Clique no botão abaixo para entrar. Você volta direto para o teste — não precisa de senha.\n\n" +
          "O link vale por uma hora. Se você não pediu este acesso, pode ignorar esta mensagem.",
        link: acesso,
        rotuloBotao: "Entrar e responder",
        marca: perfil ?? null,
      }),
      from: perfil?.email_from ?? null,
      replyTo: perfil?.support_email ?? null,
    });
    if (!envio.ok) console.error("[convite] e-mail de acesso não saiu:", envio.erro);
    return resposta;
  });

/** Quem está logado tem cadastro na conta deste link? Só o próprio nome volta — nada de terceiros. */
export const meuCadastroNoConvite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ link_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = await admin();
    const link = await carregarLink(supabase, data.link_id);
    if (!link) return { tem_cadastro: false as const };
    const pessoa = await minhaPessoaNaConta(context.supabase, context.userId, link.mentor_id);
    if (!pessoa) return { tem_cadastro: false as const };
    const aberta = await respostaAbertaDoConvite(supabase, link, pessoa.id);
    return {
      tem_cadastro: true as const,
      primeiro_nome: (pessoa.full_name ?? "").split(" ")[0] || "",
      tem_aberta: !!aberta,
    };
  });

/**
 * Leva quem já tem cadastro para o teste do link: retoma o que ela já tinha
 * aberto por aqui, ou cria as respostas no cadastro DELA (nunca num novo).
 * Retomar não gasta vaga e funciona mesmo com o link lotado; criar gasta.
 */
export const continuarConviteComConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ link_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = await admin();
    const link = await carregarLink(supabase, data.link_id);
    if (!link) throw new Error(MENSAGENS_BLOQUEIO.not_found);
    const pessoa = await minhaPessoaNaConta(context.supabase, context.userId, link.mentor_id);
    if (!pessoa) throw new Error("Não encontramos seu cadastro neste convite. Preencha seus dados para começar.");

    const aberta = await respostaAbertaDoConvite(supabase, link, pessoa.id);
    if (aberta) return aberta;

    const bloqueio = motivoBloqueio(link);
    if (bloqueio) throw new Error(MENSAGENS_BLOQUEIO[bloqueio]);
    const { data: claimed, error: claimErr } = await supabase.rpc("claim_invite_link", { link_id: link.id });
    if (claimErr) throw new Error(claimErr.message);
    if (!claimed || claimed.length === 0) throw new Error(MENSAGENS_BLOQUEIO.full);
    try {
      await colocarNoGrupoDoLink(supabase, link, pessoa.id);
      return await criarRespostasDoConvite(supabase, link, pessoa.id);
    } catch (e) {
      const { error } = await supabase.rpc("release_invite_link", { link_id: link.id });
      if (error) console.error("[convite] não consegui devolver a vaga:", error.message);
      throw e;
    }
  });
