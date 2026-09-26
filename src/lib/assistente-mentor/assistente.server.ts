/**
 * O lado do servidor da assistente do MENTOR (#307): lê os dados da conta (`dados.server.ts`, sempre
 * com o login do mentor) e os transforma no texto que vai para o modelo (`contexto.ts`). A chamada ao
 * modelo é a MESMA da assistente do aluno (`assistente/modelo.server.ts`), com as orientações do
 * mentor e `escopo: "mentor"` — a edge function troca de portão por esse campo.
 *
 * Só é carregado dentro dos handlers de `assistente-mentor.functions.ts` (import dinâmico) — nunca
 * chega ao navegador.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { agoraArredondado } from "@/lib/assistente/plataforma";
import { lerDadosDaConta } from "@/lib/assistente-mentor/dados.server";
import { contextoDaConta } from "@/lib/assistente-mentor/contexto";

export {
  AssistenteDesligada,
  AssistenteFalhou,
  MODELO_DA_ASSISTENTE,
  perguntarAoModelo,
  resumoDoErro,
} from "@/lib/assistente/modelo.server";
export { INSTRUCOES_DO_MENTOR } from "@/lib/assistente-mentor/instrucoes.server";

/** O bloco <dados_da_conta> inteiro, lido agora com o login de quem pergunta. */
export async function montarContextoDoMentor(supabase: SupabaseClient<Database>, conta: string): Promise<string> {
  const agora = agoraArredondado(Date.now());
  const dados = await lerDadosDaConta(supabase, conta, agora);
  return contextoDaConta(dados, agora);
}
