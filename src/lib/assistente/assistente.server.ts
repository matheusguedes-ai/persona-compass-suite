/**
 * O lado do servidor da assistente (#289, Nível 1): quais relatórios ela lê. A chamada ao modelo mora
 * em `modelo.server.ts` e é reexportada daqui.
 *
 * Só é carregado dentro dos handlers de `assistente.functions.ts` (import dinâmico) — nunca chega ao
 * navegador. A chave da API não mora nem aqui nem em `modelo.server.ts`: vive nos secrets da Supabase
 * Edge Function `assistente-chat` (ver o comentário no topo de `modelo.server.ts`).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Report } from "@/components/report/sections";
import { buildReport } from "@/lib/report.server";
import { contextoDoAluno, type RelatorioDoAluno } from "@/lib/assistente/contexto";

export {
  AssistenteDesligada,
  AssistenteFalhou,
  MODELO_DA_ASSISTENTE,
  perguntarAoModelo,
  resumoDoErro,
  type MensagemDoHistorico,
} from "@/lib/assistente/modelo.server";

/**
 * Os relatórios que o ALUNO vê, e só esses. A lista sai de uma consulta feita com o LOGIN dele (a RLS
 * de `test_responses` aplica a mesma regra da tela de resultados, inclusive a área "resultados" do
 * grupo), filtrada pelos cadastros dele — sem esse filtro, alguém que também é mentor (tem acesso de
 * leitura às respostas dos próprios alunos) receberia relatório alheio. Fica o mais recente de cada
 * teste. Nenhum id vem do navegador.
 */
export async function relatoriosDoAluno(
  supabase: SupabaseClient<Database>,
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<{ nome: string | null; relatorios: RelatorioDoAluno[] }> {
  const { data: pessoas, error: pErr } = await supabase
    .from("people")
    .select("id, full_name, created_at")
    .eq("user_id", userId)
    .order("created_at")
    .order("id");
  if (pErr) throw new Error(`assistente: não li os cadastros do aluno (${pErr.message})`);
  const ids = (pessoas ?? []).map((p) => p.id);
  if (ids.length === 0) return { nome: null, relatorios: [] };
  const nome = pessoas![0].full_name ?? null;

  const { data: respostas, error: rErr } = await supabase
    .from("test_responses")
    .select("id, submitted_at, version_id")
    .in("person_id", ids)
    .eq("kind", "self")
    .not("submitted_at", "is", null)
    .is("canceled_at", null)
    .order("submitted_at", { ascending: false })
    .order("id");
  if (rErr) throw new Error(`assistente: não li as respostas do aluno (${rErr.message})`);
  if (!respostas?.length) return { nome, relatorios: [] };

  // O instrumento de cada versão — as respostas já foram filtradas acima, com o login do aluno.
  const versoes = [...new Set(respostas.map((r) => r.version_id))];
  const { data: vs, error: vErr } = await admin.from("test_versions").select("id, instrument_id").in("id", versoes);
  if (vErr) throw new Error(`assistente: não li as versões dos testes (${vErr.message})`);
  const instrumento = new Map((vs ?? []).map((v) => [v.id, v.instrument_id ?? v.id]));

  const vistos = new Set<string>();
  const relatorios: RelatorioDoAluno[] = [];
  for (const r of respostas) {
    const chave = instrumento.get(r.version_id) ?? r.version_id;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    // Em série: a ordem fica estável (é o prefixo em cache) e não disputa conexões.
    const rep = await buildReport(r.id);
    if (rep.status === 200) {
      relatorios.push({ report: rep.data as unknown as Report, submittedAt: r.submitted_at as string });
    }
  }
  return { nome, relatorios };
}

export function montarContexto(nome: string | null, relatorios: RelatorioDoAluno[]): string {
  return contextoDoAluno(nome, relatorios);
}
