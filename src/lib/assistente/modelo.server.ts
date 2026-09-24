/**
 * A chamada ao modelo da assistente (#289). Separada do resto do servidor para o script de avaliação
 * (`scripts/avaliar_assistente.ts`) exercitar EXATAMENTE esta função, com o mesmo modelo, o mesmo
 * texto de sistema e os mesmos parâmetros da produção.
 */
import Anthropic from "@anthropic-ai/sdk";
import { INSTRUCOES_DA_ASSISTENTE } from "@/lib/assistente/instrucoes.server";

/** "Equivalente a Sonnet, assertivo e de baixo consumo" — decisão do dono do produto. */
export const MODELO_DA_ASSISTENTE = "claude-sonnet-5";

/** Lovable reserva prefixos em Secrets; o `APP_` é o mesmo contorno que o e-mail usa. */
export function chaveDaAssistente(): string | null {
  return process.env.ANTHROPIC_API_KEY || process.env.APP_ANTHROPIC_API_KEY || null;
}

export class AssistenteDesligada extends Error {}

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
 * Uma pergunta ao modelo. O prefixo em cache é: orientações (iguais para todo aluno) → relatórios
 * (iguais em toda conversa daquele aluno, até ele responder outro teste) → histórico. Dois marcadores
 * fixos nos blocos de sistema + o automático no fim, que acompanha a conversa crescendo.
 *
 * Pensamento adaptativo com esforço baixo: é conversa, não raciocínio longo — o modelo pensa quando
 * a pergunta pede (assunto sensível, pergunta fora do relatório) e responde direto no resto.
 */
export async function perguntarAoModelo(contexto: string, historico: Anthropic.MessageParam[]): Promise<RespostaDoModelo> {
  const chave = chaveDaAssistente();
  if (!chave) throw new AssistenteDesligada("sem ANTHROPIC_API_KEY");
  const client = new Anthropic({ apiKey: chave, timeout: 90_000, maxRetries: 2 });
  const inicio = Date.now();
  const resp = await client.messages.create({
    model: MODELO_DA_ASSISTENTE,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    cache_control: { type: "ephemeral" },
    system: [
      { type: "text", text: INSTRUCOES_DA_ASSISTENTE, cache_control: { type: "ephemeral" } },
      { type: "text", text: contexto, cache_control: { type: "ephemeral" } },
    ],
    messages: historico,
  });
  const texto = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return {
    texto,
    stopReason: resp.stop_reason ?? null,
    uso: {
      input_tokens: resp.usage.input_tokens ?? 0,
      output_tokens: resp.usage.output_tokens ?? 0,
      cache_creation_input_tokens: resp.usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: resp.usage.cache_read_input_tokens ?? 0,
    },
    ms: Date.now() - inicio,
  };
}

/** O erro do provedor em poucas palavras, para o registro de custo — nunca vai para a tela. */
export function resumoDoErro(e: unknown): string {
  if (e instanceof AssistenteDesligada) return "desligada: sem chave";
  if (e instanceof Anthropic.APIError) return `api ${e.status ?? "?"}: ${e.message}`.slice(0, 300);
  return (e instanceof Error ? e.message : String(e)).slice(0, 300);
}
