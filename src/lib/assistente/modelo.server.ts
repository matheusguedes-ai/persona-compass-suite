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
import { ehCategoria, type Categoria } from "@/lib/assistente/niveis";

/**
 * #317 — o app NÃO sabe qual modelo atende cada nível: o mapa mora só na edge function, que devolve o
 * modelo usado em cada resposta (e em cada erro, quando chegou a escolher). Isto é só o que vai para o
 * registro de uso quando nem isso voltou (a edge function não respondeu).
 */
export const MODELO_NAO_INFORMADO = "não informado";

export type MensagemDoHistorico = { role: "user" | "assistant"; content: string };

/** A edge function existe mas não respondeu (sem a chave configurada, ou o provedor fora do ar). */
export class AssistenteDesligada extends Error {
  constructor(
    message: string,
    public modelo?: string,
  ) {
    super(message);
  }
}

/** Qualquer outra falha ao chamar a edge function (rede, sessão, corpo inesperado). */
export class AssistenteFalhou extends Error {
  constructor(
    message: string,
    public status?: number,
    public modelo?: string,
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
  /** #317 — o modelo que DE FATO respondeu, como a edge function devolveu. */
  modelo: string;
  /** #317 — o nível que a edge function usou: o pedido, ou o mais baixo do teto quando nenhum foi pedido. */
  categoria: Categoria | null;
};

/**
 * #317 — quanto esperar a edge function. Smart e Pro pensam mais antes de responder; a Básica fica com a
 * espera de sempre. A edge function tem até 150 s para devolver a resposta (limite da plataforma).
 */
const ESPERA_MAXIMA_MS: Record<Categoria, number> = { basica: 90_000, smart: 150_000, pro: 150_000 };

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
 * edge function troca de portão (`assistente_mentor_liberada`). Sem `escopo`, é a do aluno, como sempre.
 * #317 — `categoria` é o nível pedido. Sem ela, a edge function usa o mais baixo que a pessoa tem.
 */
export type OpcoesDoModelo = { instrucoes?: string; escopo?: "mentor"; categoria?: Categoria };

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
  const doMentor = opcoes?.escopo === "mentor";
  if (doMentor && !opcoes?.instrucoes) throw new AssistenteFalhou("assistente do mentor chamada sem as orientações dela");
  const controle = new AbortController();
  const espera = opcoes?.categoria ? ESPERA_MAXIMA_MS[opcoes.categoria] : Math.max(...Object.values(ESPERA_MAXIMA_MS));
  const tempoEsgotado = setTimeout(() => controle.abort(), espera);
  let resp: globalThis.Response;
  try {
    resp = await fetch(`${urlDoSupabase()}/functions/v1/assistente-chat`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${sessao}` },
      body: JSON.stringify({
        instrucoes: doMentor ? opcoes?.instrucoes : INSTRUCOES_DA_ASSISTENTE,
        contexto,
        historico,
        ...(doMentor ? { escopo: "mentor" } : {}),
        ...(opcoes?.categoria ? { categoria: opcoes.categoria } : {}),
      }),
      signal: controle.signal,
    });
  } catch (e) {
    throw new AssistenteFalhou(e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(tempoEsgotado);
  }

  const corpo = await resp.json().catch(() => null);
  const modeloDoCorpo = typeof corpo?.modelo === "string" ? (corpo.modelo as string) : undefined;
  if (!resp.ok) {
    const mensagem = (corpo?.error as string | undefined) ?? `a assistente respondeu ${resp.status}`;
    if (resp.status === 503 || resp.status === 502) throw new AssistenteDesligada(mensagem, modeloDoCorpo);
    throw new AssistenteFalhou(mensagem, resp.status, modeloDoCorpo);
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
    modelo: modeloDoCorpo ?? MODELO_NAO_INFORMADO,
    categoria: ehCategoria(corpo.categoria) ? corpo.categoria : null,
  };
}

/** O modelo para o registro de uso de uma chamada que falhou: o que a edge function disse, se disse. */
export function modeloDoErro(e: unknown): string {
  return (e instanceof AssistenteDesligada || e instanceof AssistenteFalhou) && e.modelo ? e.modelo : MODELO_NAO_INFORMADO;
}

/** O erro em poucas palavras, para o registro de custo — nunca vai para a tela, e nunca carrega a chave. */
export function resumoDoErro(e: unknown): string {
  if (e instanceof AssistenteDesligada) return `desligada: ${e.message}`.slice(0, 300);
  if (e instanceof AssistenteFalhou) return `falha${e.status ? ` ${e.status}` : ""}: ${e.message}`.slice(0, 300);
  return (e instanceof Error ? e.message : String(e)).slice(0, 300);
}
