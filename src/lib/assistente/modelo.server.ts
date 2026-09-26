/**
 * A chamada ao modelo da assistente (#289). Separada do resto do servidor para o script de avaliação
 * (`scripts/avaliar_assistente.ts`) exercitar EXATAMENTE esta função, com o mesmo modelo, o mesmo
 * texto de sistema e os mesmos parâmetros da produção — ele roda fora do servidor, então passa o
 * token de um login fictício em vez de tirá-lo da requisição.
 *
 * A CHAVE NÃO MORA MAIS AQUI. Ela vive nos secrets da Supabase Edge Function `assistente-chat`
 * (`supabase/functions/assistente-chat/`) — o Lovable só permite Secrets em conta Enterprise, que
 * este projeto não tem, e duas chaves já foram reveladas (e revogadas) por terem passado pelo chat.
 * Esta função só monta a pergunta e chama a edge function com o token da PRÓPRIA sessão do aluno;
 * quem fala com a Anthropic, e quem seguraria a chave se algo vazasse, é só a edge function.
 */
import { getRequest } from "@tanstack/react-start/server";
import { INSTRUCOES_DA_ASSISTENTE } from "@/lib/assistente/instrucoes.server";

export const MODELO_DA_ASSISTENTE = "claude-sonnet-5";

export type MensagemDoHistorico = { role: "user" | "assistant"; content: string };

/** A edge function existe mas não respondeu (sem a chave configurada, ou o provedor fora do ar). */
export class AssistenteDesligada extends Error {}

/** Qualquer outra falha ao chamar a edge function (rede, sessão, corpo inesperado). */
export class AssistenteFalhou extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export type RespostaDoModelo = {
  texto: string;
  stopReason: string | null;
  uso: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  };
  ms: number;
};

/**
 * A URL do `.env` do repo, que o Vite fixa no build — é ela que vale no servidor: na hospedagem do
 * Lovable o `SUPABASE_URL` do ambiente aponta para o banco gerenciado por ele (ver `client.server.ts`).
 * Fora do Vite (o script de avaliação, em `npx tsx`) `import.meta.env` não existe e a leitura estoura;
 * só aí vale o `SUPABASE_URL` do ambiente. O `try` guarda a MESMA expressão que o Vite substitui —
 * `import.meta.env?.…` dependeria de o build também reconhecer a forma com `?.`.
 */
function urlDoSupabase(): string {
  let daBuild: string | undefined;
  try {
    daBuild = import.meta.env.VITE_SUPABASE_URL;
  } catch {
    daBuild = undefined;
  }
  const url = daBuild || process.env.SUPABASE_URL;
  if (!url) throw new Error("assistente: SUPABASE_URL ausente");
  return url;
}

/**
 * O token da sessão atual, para a edge function saber QUEM está perguntando — a mesma extração que
 * `auth-middleware.ts` já faz (arquivo gerado, não duplicar a lógica lá; refazer aqui é mais simples
 * que expor o token bruto num contexto compartilhado por toda server function do app).
 */
function tokenDaSessao(): string {
  const auth = getRequest()?.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) throw new AssistenteFalhou("sem sessão para chamar a assistente");
  return auth.slice(7);
}

/**
 * #307 — a assistente do MENTOR usa a mesma chamada, com as orientações DELA e `escopo: "mentor"`: a
 * edge function troca de portão (`assistente_mentor_liberada`). Sem opções, é a do aluno, como sempre.
 */
export type OpcoesDoModelo = { instrucoes: string; escopo: "mentor" };

/**
 * Uma pergunta ao modelo, via a Supabase Edge Function `assistente-chat`. O prefixo em cache é:
 * orientações (iguais para todo aluno) → relatórios (iguais em toda conversa daquele aluno, até ele
 * responder outro teste) → histórico — a edge function é quem manda isso pra Anthropic, mas a
 * composição do prefixo continua sendo decidida aqui, no mesmo lugar de sempre.
 *
 * `token` é só para quem chama FORA de uma requisição do servidor, onde não há sessão de onde tirá-lo:
 * o script de avaliação, com o login de uma pessoa fictícia. O app nunca passa — usa sempre o da
 * sessão do aluno que perguntou.
 */
export async function perguntarAoModelo(
  contexto: string,
  historico: MensagemDoHistorico[],
  token?: string,
  opcoes?: OpcoesDoModelo,
): Promise<RespostaDoModelo> {
  const sessao = token ?? tokenDaSessao();
  const controle = new AbortController();
  const tempoEsgotado = setTimeout(() => controle.abort(), 90_000);
  let resp: globalThis.Response;
  try {
    resp = await fetch(`${urlDoSupabase()}/functions/v1/assistente-chat`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${sessao}` },
      body: JSON.stringify(
        opcoes
          ? { instrucoes: opcoes.instrucoes, contexto, historico, escopo: opcoes.escopo }
          : { instrucoes: INSTRUCOES_DA_ASSISTENTE, contexto, historico },
      ),
      signal: controle.signal,
    });
  } catch (e) {
    throw new AssistenteFalhou(e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(tempoEsgotado);
  }

  const corpo = await resp.json().catch(() => null);
  if (!resp.ok) {
    const mensagem = (corpo?.error as string | undefined) ?? `a assistente respondeu ${resp.status}`;
    if (resp.status === 503 || resp.status === 502) throw new AssistenteDesligada(mensagem);
    throw new AssistenteFalhou(mensagem, resp.status);
  }
  if (!corpo || typeof corpo.texto !== "string" || !corpo.usage) {
    throw new AssistenteFalhou("a assistente devolveu uma resposta em formato inesperado");
  }

  return {
    texto: corpo.texto,
    stopReason: corpo.stopReason ?? null,
    uso: {
      input_tokens: corpo.usage.input_tokens ?? 0,
      output_tokens: corpo.usage.output_tokens ?? 0,
      cache_creation_input_tokens: corpo.usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: corpo.usage.cache_read_input_tokens ?? 0,
    },
    ms: typeof corpo.ms === "number" ? corpo.ms : 0,
  };
}

/** O erro em poucas palavras, para o registro de custo — nunca vai para a tela, e nunca carrega a chave. */
export function resumoDoErro(e: unknown): string {
  if (e instanceof AssistenteDesligada) return `desligada: ${e.message}`.slice(0, 300);
  if (e instanceof AssistenteFalhou) return `falha${e.status ? ` ${e.status}` : ""}: ${e.message}`.slice(0, 300);
  return (e instanceof Error ? e.message : String(e)).slice(0, 300);
}
