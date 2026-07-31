/**
 * Envio de email a partir da plataforma.
 *
 * O destinatário, o nome e o link são resolvidos **no servidor**, a partir do
 * id do envio. A tela não escolhe para quem vai — assim não dá para usar a
 * plataforma para disparar mensagem a endereço arbitrário.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirDono } from "@/lib/team.functions";

const TEXTO_PADRAO: Record<"convite" | "lembrete" | "resultado", string> = {
  convite:
    "Olá {nome}! Separei um inventário para entendermos melhor o seu perfil. " +
    "Leva poucos minutos e o resultado a gente conversa depois.",
  lembrete:
    "Oi {nome}, tudo bem? Passando para lembrar do inventário que te enviei. O link continua valendo.",
  resultado:
    "{nome}, seu relatório ficou pronto! Dá uma olhada com calma e anote o que fizer sentido para conversarmos.",
};

const ASSUNTO: Record<"convite" | "lembrete" | "resultado", string> = {
  convite: "Um inventário para você responder",
  lembrete: "Lembrete: seu inventário ainda está aberto",
  resultado: "Seu relatório está pronto",
};

const ROTULO_BOTAO: Record<"convite" | "lembrete" | "resultado", string> = {
  convite: "Começar agora",
  lembrete: "Continuar de onde parei",
  resultado: "Ver meu relatório",
};

/** Diz à tela se dá para enviar e de qual remetente. Configuração da conta: só dono. */
export const getEmailStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirDono(context.supabase);
    const { emailAtivo, remetente } = await import("@/lib/email.server");
    const { data: perfil } = await context.supabase
      .from("profiles").select("email_from").eq("user_id", context.userId).maybeSingle();
    const r = remetente(perfil?.email_from);
    return { ativo: emailAtivo(), remetente: r.valor, remetente_de_teste: r.eh_teste };
  });

/** Últimos envios, para a tela responder "eu mandei para essa pessoa?". Configuração da conta: só dono. */
export const listEmailLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await exigirDono(context.supabase);
    const { data: rows, error } = await context.supabase
      .from("email_logs")
      .select("id, kind, to_email, subject, status, error, created_at, person_id")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/**
 * Envia convite, lembrete ou "relatório pronto" para o avaliado de um envio.
 *
 * Grava o resultado em `email_logs` com service role: o registro precisa ser
 * escrito pelo servidor depois da resposta do provedor, senão daria para
 * registrar envio que nunca aconteceu.
 */
export const sendMentorEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      kind: z.enum(["convite", "lembrete", "resultado"]),
      response_id: z.string().uuid().optional().nullable(),
      assessment_id: z.string().uuid().optional().nullable(),
      origin: z.string().url().max(300),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { emailAtivo, enviarEmail, montarHtml, aplicarModelo } = await import("@/lib/email.server");
    if (!emailAtivo()) {
      throw new Error("O envio de email ainda não está ligado. Cadastre a chave do Resend nas configurações do projeto.");
    }
    if (!data.response_id && !data.assessment_id) throw new Error("Informe o envio.");

    // A RLS já garante que só sai daqui envio da conta de quem está pedindo.
    let personId: string | null = null;
    let caminho = "";
    if (data.assessment_id) {
      const { data: a, error } = await supabase
        .from("assessment_responses")
        .select("id, person_id, submitted_at")
        .eq("id", data.assessment_id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!a) throw new Error("Envio não encontrado.");
      personId = a.person_id;
      caminho = data.kind === "resultado" ? `/relatorio-bateria/${a.id}` : `/bateria/${a.id}`;
    } else {
      const { data: r, error } = await supabase
        .from("test_responses")
        .select("id, person_id, submitted_at")
        .eq("id", data.response_id!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!r) throw new Error("Envio não encontrado.");
      personId = r.person_id;
      caminho = data.kind === "resultado" ? `/relatorio/${r.id}` : `/responder/${r.id}`;
    }

    const { data: pessoa, error: pErr } = await supabase
      .from("people").select("id, full_name, email").eq("id", personId!).maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!pessoa?.email) throw new Error("Este avaliado não tem email cadastrado.");

    const { data: perfil } = await supabase
      .from("profiles")
      .select("company_name, logo_url, brand_color, site_url, support_email, email_from, invite_message, reminder_message, result_message")
      .eq("user_id", userId)
      .maybeSingle();

    const modeloDoMentor =
      data.kind === "convite" ? perfil?.invite_message
      : data.kind === "lembrete" ? perfil?.reminder_message
      : perfil?.result_message;

    const link = `${data.origin.replace(/\/$/, "")}${caminho}`;
    const corpo = aplicarModelo((modeloDoMentor ?? "").trim() || TEXTO_PADRAO[data.kind], {
      nome: pessoa.full_name,
      link,
    });
    const assunto = ASSUNTO[data.kind];

    const resultado = await enviarEmail({
      to: pessoa.email,
      subject: assunto,
      html: montarHtml({ corpo, link, rotuloBotao: ROTULO_BOTAO[data.kind], marca: perfil ?? null }),
      replyTo: perfil?.support_email ?? null,
      from: perfil?.email_from ?? null,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("email_logs").insert({
      mentor_id: userId,
      kind: data.kind,
      to_email: pessoa.email,
      subject: assunto,
      response_id: data.response_id ?? null,
      assessment_id: data.assessment_id ?? null,
      person_id: pessoa.id,
      status: resultado.ok ? "enviado" : "falhou",
      provider_id: resultado.ok ? resultado.provider_id : null,
      error: resultado.ok ? null : resultado.erro,
    });

    if (!resultado.ok) throw new Error(resultado.erro);
    return { ok: true, para: pessoa.email };
  });

/** Envio de teste para o próprio dono, para conferir que a ligação funciona. Configuração da conta: só dono. */
export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ origin: z.string().url().max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirDono(context.supabase);
    const { userId, claims } = context;
    const para = (claims as { email?: string })?.email;
    if (!para) throw new Error("Não consegui identificar o seu email.");

    const { emailAtivo, enviarEmail, montarHtml } = await import("@/lib/email.server");
    if (!emailAtivo()) throw new Error("O envio de email ainda não está ligado.");

    const { data: perfil } = await context.supabase
      .from("profiles").select("company_name, logo_url, brand_color, site_url, support_email, email_from")
      .eq("user_id", userId).maybeSingle();

    const assunto = "Teste de envio — Métrica Humana";
    const resultado = await enviarEmail({
      to: para,
      subject: assunto,
      html: montarHtml({
        corpo:
          "Se você está lendo isto, o envio de email da sua plataforma está funcionando.\n\n" +
          "É assim que o convite, o lembrete e o aviso de relatório pronto vão chegar para os seus avaliados — " +
          "com a sua marca e o texto que você escreveu em Configurações → Mensagens.",
        link: data.origin,
        rotuloBotao: "Abrir a plataforma",
        marca: perfil ?? null,
      }),
      from: perfil?.email_from ?? null,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("email_logs").insert({
      mentor_id: userId, kind: "teste", to_email: para, subject: assunto,
      status: resultado.ok ? "enviado" : "falhou",
      provider_id: resultado.ok ? resultado.provider_id : null,
      error: resultado.ok ? null : resultado.erro,
    });

    if (!resultado.ok) throw new Error(resultado.erro);
    return { ok: true, para };
  });
