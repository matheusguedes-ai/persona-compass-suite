/**
 * Adaptador da ZAPSTER (WhatsApp, API não oficial) — o ÚNICO arquivo que conhece a Zapster (#291 F1a).
 *
 * Conferido na documentação oficial (developer.zapsterapi.com) em 30/09/2026:
 *   - URL base:      https://api.zapsterapi.com/v1
 *   - Autenticação:  header `Authorization: Bearer <token>`
 *   - Instância:     header `X-Instance-ID` (ou `instance_id` no corpo)
 *   - Enviar texto:  POST /wa/messages  { recipient: "5518999999999", text }  →  200 { message_id }
 *   - Conexão:       GET  /wa/instances/{id}  →  { status: "connected" | "disconnected" | "offline" }
 *   - Limite:        3 requisições por segundo por token (429 com Retry-After)
 *   - ⚠️ "enviado" = a Zapster/WhatsApp ACEITOU a mensagem, não que chegou ao celular.
 *
 * O token e o id da instância vivem SÓ em variáveis de ambiente do servidor. Nada daqui vai ao
 * navegador, ao banco ou a log — as mensagens de erro passam por `limpar()` antes de sair.
 */
import type { AdaptadorDeCanal, EstadoDaConexao, ResultadoEnvioCanal } from "./tipos";

const BASE = "https://api.zapsterapi.com/v1";
const TEMPO_LIMITE_MS = 15_000;

function token(): string | null {
  // Mesma dupla de nomes de email.server.ts: a hospedagem do Lovable às vezes prefixa com APP_.
  return process.env.ZAPSTER_API_TOKEN || process.env.APP_ZAPSTER_API_TOKEN || null;
}
function instancia(): string | null {
  return process.env.ZAPSTER_INSTANCE_ID || process.env.APP_ZAPSTER_INSTANCE_ID || null;
}

/** Tira do texto qualquer pedaço que seja o token ou o id da instância, e limita o tamanho. */
function limpar(texto: string): string {
  let t = texto;
  for (const segredo of [token(), instancia()]) {
    if (segredo && segredo.length >= 4) t = t.split(segredo).join("[oculto]");
  }
  return t.replace(/\s+/g, " ").trim().slice(0, 200);
}

async function chamar(caminho: string, init: RequestInit): Promise<Response> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  try {
    return await fetch(`${BASE}${caminho}`, { ...init, signal: controle.signal });
  } finally {
    clearTimeout(timer);
  }
}

function cabecalhos(): Record<string, string> {
  return {
    Authorization: `Bearer ${token() ?? ""}`,
    "X-Instance-ID": instancia() ?? "",
    "Content-Type": "application/json",
    Accept: "application/json",
    // A Cloudflare na frente de alguns serviços recusa cliente sem User-Agent (erro 1010).
    "User-Agent": "MetodoIntencao-Plataforma/1.0",
  };
}

/** Lê a mensagem de erro dos dois formatos que a documentação mostra: {code,message} e {errors:[{code,messages}]}. */
async function motivoDaResposta(r: Response): Promise<string> {
  let detalhe = "";
  try {
    const j = (await r.json()) as {
      code?: string; message?: string;
      errors?: { code?: string; message?: string; messages?: string }[];
    };
    const e = j.errors?.[0];
    detalhe = [j.code ?? e?.code, j.message ?? e?.message ?? e?.messages].filter(Boolean).join(": ");
  } catch {
    /* corpo sem JSON: fica só o código HTTP */
  }
  if (r.status === 401 || r.status === 403) return "Zapster recusou as credenciais (token inválido ou sem permissão)";
  if (r.status === 404) return "Zapster não encontrou a instância";
  if (r.status === 429) return "Limite de envios da Zapster atingido (tente de novo em instantes)";
  return limpar(`Zapster respondeu ${r.status}${detalhe ? ` — ${detalhe}` : ""}`);
}

export const adaptadorZapster: AdaptadorDeCanal = {
  fornecedor: "zapster",

  configurado() {
    return !!token() && !!instancia();
  },

  async enviarTexto(destino, texto): Promise<ResultadoEnvioCanal> {
    if (!this.configurado()) return { ok: false, motivo: "WhatsApp ainda não está configurado (faltam as variáveis da Zapster)" };
    try {
      const r = await chamar("/wa/messages", {
        method: "POST",
        headers: cabecalhos(),
        body: JSON.stringify({ recipient: destino, text: texto }),
      });
      if (!r.ok) return { ok: false, motivo: await motivoDaResposta(r) };
      const corpo = (await r.json().catch(() => ({}))) as { message_id?: string };
      return { ok: true, idNoFornecedor: corpo.message_id ?? null };
    } catch (e) {
      const abortou = e instanceof Error && e.name === "AbortError";
      return { ok: false, motivo: abortou ? "A Zapster não respondeu a tempo" : "Falha de conexão com a Zapster" };
    }
  },

  async estadoDaConexao(): Promise<EstadoDaConexao> {
    if (!this.configurado()) return { estado: "nao_configurada" };
    try {
      const r = await chamar(`/wa/instances/${encodeURIComponent(instancia() ?? "")}`, { method: "GET", headers: cabecalhos() });
      if (!r.ok) return { estado: "indisponivel", motivo: await motivoDaResposta(r) };
      const j = (await r.json().catch(() => ({}))) as { status?: string };
      if (j.status === "connected") return { estado: "conectada" };
      if (j.status === "disconnected") return { estado: "desconectada" };
      if (j.status === "offline") return { estado: "desligada" };
      return { estado: "indisponivel", motivo: "A Zapster devolveu um estado que não conheço" };
    } catch (e) {
      const abortou = e instanceof Error && e.name === "AbortError";
      return { estado: "indisponivel", motivo: abortou ? "A Zapster não respondeu a tempo" : "Falha de conexão com a Zapster" };
    }
  },
};

// ------------------------------------------------------------------------------------------ webhook (Menu Mensagens M1a)
// A documentação da Zapster só descreve LISTAR (GET /webhooks) e ATUALIZAR (PATCH /webhooks/{id}: enabled, name, url,
// events). A chamada de CRIAR não está documentada; por isso `cadastrarWebhook` tenta alguns formatos, para no primeiro
// que a Zapster aceitar e devolve o que ela respondeu — sempre SEM o segredo nem o endereço (que carrega o segredo).

type Obj = Record<string, unknown>;

/** Resposta de erro da Zapster resumida e sem nada sensível (o endereço do webhook leva o segredo). */
async function resumoSeguro(r: Response, proibidos: string[]): Promise<string> {
  let t = "";
  try { t = JSON.stringify(await r.json()); } catch { /* sem corpo */ }
  for (const x of [...proibidos, token(), instancia()]) if (x && x.length >= 4) t = t.split(x).join("[oculto]");
  return `${r.status}${t ? ` ${t.slice(0, 240)}` : ""}`;
}

export type WebhookNaZapster = { id: string | null; enabled: boolean | null; doNossoEndereco: boolean; campos: string[]; instancias: string };

/** Lista os webhooks da conta e diz, SEM mostrar o endereço, qual é o nosso. */
export async function verificarWebhookZapster(nossoEndereco: string): Promise<
  { ok: true; total: number; nossos: WebhookNaZapster[] } | { ok: false; motivo: string }
> {
  if (!adaptadorZapster.configurado()) return { ok: false, motivo: "Zapster não configurada (faltam as variáveis)" };
  try {
    const r = await chamar("/webhooks", { method: "GET", headers: cabecalhos() });
    if (!r.ok) return { ok: false, motivo: await resumoSeguro(r, [nossoEndereco]) };
    const j = (await r.json().catch(() => ({}))) as { webhooks?: Obj[] };
    const lista = Array.isArray(j.webhooks) ? j.webhooks : Array.isArray(j) ? (j as unknown as Obj[]) : [];
    const nossos = lista
      .filter((w) => typeof w.url === "string" && (w.url === nossoEndereco || (w.url as string).includes("/api/webhook/zapster/")))
      .map((w): WebhookNaZapster => {
        const ligadoAInstancia = Object.entries(w).find(([k]) => /instanc/i.test(k));
        const v = ligadoAInstancia?.[1];
        return {
          id: typeof w.id === "string" ? w.id : null,
          enabled: typeof w.enabled === "boolean" ? w.enabled : null,
          doNossoEndereco: w.url === nossoEndereco,
          campos: Object.keys(w),
          instancias: v === undefined ? "a resposta não traz o vínculo com instâncias" : Array.isArray(v) ? `${v.length} instância(s)` : String(v === null ? "nenhuma" : "informada"),
        };
      });
    return { ok: true, total: lista.length, nossos };
  } catch {
    return { ok: false, motivo: "Falha de conexão com a Zapster" };
  }
}

export type TentativaDeCadastro = { formato: string; resultado: string };

/** Tenta cadastrar o webhook. Para no primeiro formato aceito (2xx). Nunca devolve o endereço nem o segredo. */
export async function cadastrarWebhookZapster(args: { url: string; nome: string; eventos: string[] }): Promise<
  { criado: boolean; tentativas: TentativaDeCadastro[] }
> {
  const inst = instancia() ?? "";
  const base = { name: args.nome, url: args.url, events: args.eventos, enabled: true };
  const formatos: { nome: string; caminho: string; corpo: Obj }[] = [
    { nome: "POST /webhooks (com instance_id)", caminho: "/webhooks", corpo: { ...base, instance_id: inst } },
    { nome: "POST /webhooks (com instances)", caminho: "/webhooks", corpo: { ...base, instances: [inst] } },
    { nome: "POST /webhooks (com instance_ids)", caminho: "/webhooks", corpo: { ...base, instance_ids: [inst] } },
    { nome: "POST /wa/instances/{id}/webhooks", caminho: `/wa/instances/${encodeURIComponent(inst)}/webhooks`, corpo: base },
    { nome: "POST /webhooks (sem vínculo)", caminho: "/webhooks", corpo: base },
  ];
  const tentativas: TentativaDeCadastro[] = [];
  for (const f of formatos) {
    try {
      const r = await chamar(f.caminho, { method: "POST", headers: cabecalhos(), body: JSON.stringify(f.corpo) });
      tentativas.push({ formato: f.nome, resultado: r.ok ? `aceito (${r.status})` : await resumoSeguro(r, [args.url]) });
      if (r.ok) return { criado: true, tentativas };
    } catch {
      tentativas.push({ formato: f.nome, resultado: "falha de conexão" });
    }
  }
  return { criado: false, tentativas };
}
