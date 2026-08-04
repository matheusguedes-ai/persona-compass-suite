/**
 * Google Calendar — o lado servidor.
 *
 * Mão única, por decisão do Matheus: o que é marcado na plataforma vai para o
 * Google. Nada volta. Isso simplifica o problema inteiro — não há conflito de
 * "editou nos dois lados, qual vale".
 *
 * O escopo é `calendar.app.created`: a plataforma cria uma agenda própria e só
 * mexe nos eventos DELA. Não lê, não edita e não apaga nada do calendário
 * pessoal de ninguém.
 */
import { siteUrl } from "@/lib/site-url.server";

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const CAL = "https://www.googleapis.com/calendar/v3";

export const ESCOPO = "https://www.googleapis.com/auth/calendar.app.created";

/**
 * As credenciais do app.
 *
 * Aceita os dois nomes porque a hospedagem prefixa com `APP_` — mesma coisa que
 * já acontece com `RESEND_API_KEY`. Devolver null em vez de lançar deixa a tela
 * dizer "não configurado" em vez de quebrar.
 */
export function credenciais(): { id: string; secret: string } | null {
  const id = process.env.GOOGLE_CLIENT_ID || process.env.APP_GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET || process.env.APP_GOOGLE_CLIENT_SECRET;
  return id && secret ? { id, secret } : null;
}

export function urlDeRetorno(): string {
  return `${siteUrl()}/api/google/callback`;
}

/**
 * Para onde mandar a pessoa autorizar.
 *
 * `access_type=offline` + `prompt=consent` são obrigatórios: sem os dois o
 * Google devolve só o token de acesso, que dura uma hora. Sem refresh token, a
 * sincronização morreria sozinha no dia seguinte — e calada.
 */
export function urlDeAutorizacao(estado: string): string | null {
  const c = credenciais();
  if (!c) return null;
  const p = new URLSearchParams({
    client_id: c.id,
    redirect_uri: urlDeRetorno(),
    response_type: "code",
    scope: ESCOPO,
    access_type: "offline",
    prompt: "consent",
    state: estado,
  });
  return `${AUTH}?${p.toString()}`;
}

type Tokens = { access_token: string; refresh_token?: string; expires_in: number };

export async function trocarCodigoPorTokens(codigo: string): Promise<Tokens> {
  const c = credenciais();
  if (!c) throw new Error("Google não configurado.");
  const r = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: codigo,
      client_id: c.id,
      client_secret: c.secret,
      redirect_uri: urlDeRetorno(),
      grant_type: "authorization_code",
    }),
  });
  if (!r.ok) throw new Error(`Google recusou a troca do código: ${await r.text()}`);
  return r.json();
}

/** Renova o token de acesso a partir do refresh. É o que faz durar. */
export async function renovarAcesso(refresh: string): Promise<string> {
  const c = credenciais();
  if (!c) throw new Error("Google não configurado.");
  const r = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refresh,
      client_id: c.id,
      client_secret: c.secret,
      grant_type: "refresh_token",
    }),
  });
  if (!r.ok) throw new Error(`Não consegui renovar o acesso ao Google: ${await r.text()}`);
  const t = (await r.json()) as Tokens;
  return t.access_token;
}

/**
 * A agenda própria da plataforma, no Google da pessoa.
 *
 * Com `calendar.app.created` não dá para escrever no calendário principal — e
 * é bom que não dê. Tudo o que a plataforma cria vive numa agenda separada, que
 * a pessoa pode esconder ou apagar sem afetar o resto.
 */
export async function criarAgenda(accessToken: string): Promise<string> {
  const r = await fetch(`${CAL}/calendars`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ summary: "Métrica Humana", timeZone: "America/Sao_Paulo" }),
  });
  if (!r.ok) throw new Error(`Não consegui criar a agenda: ${await r.text()}`);
  return ((await r.json()) as { id: string }).id;
}

/** Quem autorizou — só para a tela dizer "conectado como fulano@". */
export async function emailDaConta(accessToken: string): Promise<string | null> {
  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) return null;
    return ((await r.json()) as { email?: string }).email ?? null;
  } catch {
    return null;
  }
}

/**
 * O `state` que vai e volta do Google, assinado.
 *
 * O callback precisa saber QUEM autorizou. O caminho ingênuo seria mandar o id
 * do usuário no `state` e confiar no que voltar — mas `state` é um parâmetro de
 * URL, e qualquer pessoa poderia chamar o callback com o id de outra,
 * pendurando a própria conta do Google no calendário alheio.
 *
 * Então o id vai acompanhado de uma assinatura feita com uma chave que só o
 * servidor tem. Sem a chave não dá para forjar, e o callback recusa o que não
 * confere.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function chaveDeAssinatura(): string {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.APP_SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("Sem chave para assinar o estado.");
  return k;
}

export function assinarEstado(userId: string): string {
  const assinatura = createHmac("sha256", chaveDeAssinatura()).update(userId).digest("hex");
  return `${userId}.${assinatura}`;
}

export function verificarEstado(estado: string): string | null {
  const corte = estado.lastIndexOf(".");
  if (corte < 0) return null;
  const userId = estado.slice(0, corte);
  const veio = estado.slice(corte + 1);
  const esperado = createHmac("sha256", chaveDeAssinatura()).update(userId).digest("hex");
  // Comparação de tempo constante: comparar com `===` vaza, pelo tempo de
  // resposta, quantos caracteres iniciais bateram.
  const a = Buffer.from(veio, "hex");
  const b = Buffer.from(esperado, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

/**
 * Cria, atualiza ou apaga um evento na agenda da plataforma.
 *
 * Silenciosa: como a pontuação e as notificações, o Google nunca derruba a ação
 * que a gerou. Se o calendário estiver fora do ar, a sessão é agendada do
 * mesmo jeito — a agenda de dentro da plataforma não depende dele.
 *
 * O erro fica registrado em `google_conexoes.ultimo_erro` para a tela poder
 * avisar "a última sincronização falhou" em vez de fingir que deu certo.
 */
export async function sincronizar(
  userId: string,
  origem: "mentoria" | "evento",
  origemId: string,
  dados: { titulo: string; descricao?: string | null; quando: string; terminaEm?: string | null; duracaoMin?: number | null } | null,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: conexao } = await supabaseAdmin
      .from("google_conexoes")
      .select("refresh_token, calendar_id")
      .eq("user_id", userId)
      .maybeSingle();
    // Ninguém conectou o Google: não é erro, é o estado normal.
    if (!conexao?.calendar_id) return;

    const acesso = await renovarAcesso(conexao.refresh_token);

    const { data: jaExiste } = await supabaseAdmin
      .from("google_eventos")
      .select("google_event_id")
      .eq("user_id", userId).eq("origem", origem).eq("origem_id", origemId)
      .maybeSingle();

    const base = `${CAL}/calendars/${encodeURIComponent(conexao.calendar_id)}/events`;
    const auth = { Authorization: `Bearer ${acesso}`, "Content-Type": "application/json" };

    // `dados` nulo significa "isto deixou de existir": cancelada ou apagada.
    if (!dados) {
      if (jaExiste) {
        await fetch(`${base}/${jaExiste.google_event_id}`, { method: "DELETE", headers: auth });
        await supabaseAdmin.from("google_eventos").delete()
          .eq("user_id", userId).eq("origem", origem).eq("origem_id", origemId);
      }
      return;
    }

    const inicio = new Date(dados.quando);
    // Hora de fim informada manda; sem ela, a duração; sem nenhuma, 60 min.
    const fim = dados.terminaEm
      ? new Date(dados.terminaEm)
      : new Date(inicio.getTime() + (dados.duracaoMin ?? 60) * 60_000);
    const corpo = JSON.stringify({
      summary: dados.titulo,
      description: dados.descricao ?? undefined,
      start: { dateTime: inicio.toISOString(), timeZone: "America/Sao_Paulo" },
      end: { dateTime: fim.toISOString(), timeZone: "America/Sao_Paulo" },
    });

    if (jaExiste) {
      // ATUALIZA o que já existe. Sem o vínculo guardado, remarcar criaria um
      // segundo evento e o calendário encheria de duplicatas.
      const r = await fetch(`${base}/${jaExiste.google_event_id}`, {
        method: "PATCH", headers: auth, body: corpo,
      });
      if (!r.ok) throw new Error(await r.text());
    } else {
      const r = await fetch(base, { method: "POST", headers: auth, body: corpo });
      if (!r.ok) throw new Error(await r.text());
      const criado = (await r.json()) as { id: string };
      await supabaseAdmin.from("google_eventos").insert({
        user_id: userId, origem, origem_id: origemId, google_event_id: criado.id,
      });
    }

    await supabaseAdmin.from("google_conexoes")
      .update({ ultimo_uso_em: new Date().toISOString(), ultimo_erro: null })
      .eq("user_id", userId);
  } catch (e) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("google_conexoes")
        .update({ ultimo_erro: (e as Error).message.slice(0, 500) })
        .eq("user_id", userId);
    } catch {
      // Nem o registro do erro pode derrubar a ação.
    }
  }
}
