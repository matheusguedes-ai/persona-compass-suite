/**
 * O lado do servidor da assistente (#289, Nível 1; #305, Nível 2): o que ela lê — os relatórios, o
 * resto da plataforma (`plataforma.server.ts`) e as observações do mentor. A chamada ao modelo mora
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
import { plataformaDoAluno } from "@/lib/assistente/plataforma.server";
import { agoraArredondado, contextoDaPlataforma, contextoDasObservacoes } from "@/lib/assistente/plataforma";

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
): Promise<{ nome: string | null; pessoas: string[]; relatorios: RelatorioDoAluno[] }> {
  const { data: pessoas, error: pErr } = await supabase
    .from("people")
    .select("id, full_name, created_at")
    .eq("user_id", userId)
    .order("created_at")
    .order("id");
  if (pErr) throw new Error(`assistente: não li os cadastros do aluno (${pErr.message})`);
  const ids = (pessoas ?? []).map((p) => p.id);
  if (ids.length === 0) return { nome: null, pessoas: [], relatorios: [] };
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
  if (!respostas?.length) return { nome, pessoas: ids, relatorios: [] };

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
  return { nome, pessoas: ids, relatorios };
}

/**
 * As observações que o mentor registrou sobre ESTE aluno (#305). É a única leitura com service role
 * fora dos relatórios, e é de propósito: o aluno não tem caminho nenhum para ler estas linhas pela
 * API (a trava (a) da demanda), então não há login dele que as alcance. O recorte é feito aqui, e só
 * aqui: os cadastros do próprio login (`pessoas`, lidos acima com o login dele) e, de cada um, só as
 * observações da MESMA conta do cadastro — nada de outra conta entra.
 *
 * O texto nunca vai para a tela nem para o histórico: só para o modelo, dentro do bloco reservado.
 */
export async function observacoesDoMentor(
  admin: SupabaseClient<Database>,
  pessoas: string[],
): Promise<Array<{ texto: string; criadaEm: string }>> {
  if (!pessoas.length) return [];
  const { data: cad, error: pErr } = await admin.from("people").select("id, mentor_id").in("id", pessoas);
  if (pErr) throw new Error(`assistente: não li as contas dos cadastros (${pErr.message})`);
  const contaDe = new Map((cad ?? []).map((p) => [p.id, p.mentor_id]));
  const { data, error } = await admin
    .from("assistente_observacoes")
    .select("person_id, conta_id, texto, criada_em")
    .in("person_id", pessoas)
    .order("criada_em")
    .order("id");
  if (error) throw new Error(`assistente: não li as observações (${error.message})`);
  return (data ?? [])
    .filter((o) => contaDe.get(o.person_id) === o.conta_id)
    .map((o) => ({ texto: o.texto, criadaEm: o.criada_em }));
}

/**
 * O contexto inteiro, na ordem do que menos muda para o que mais muda (é prefixo em cache):
 * relatórios → plataforma → observações do mentor.
 */
export async function montarContexto(opts: {
  supabase: SupabaseClient<Database>;
  admin: SupabaseClient<Database>;
  userId: string;
  conta: string;
  nome: string | null;
  pessoas: string[];
  relatorios: RelatorioDoAluno[];
}): Promise<string> {
  const agora = agoraArredondado(Date.now());
  const [plataforma, observacoes] = await Promise.all([
    plataformaDoAluno(opts.supabase, opts.userId, opts.pessoas, opts.conta, agora),
    observacoesDoMentor(opts.admin, opts.pessoas).catch((e) => {
      // Sem as observações ela continua funcionando — só sem o pano de fundo.
      console.error("[assistente] observações do mentor:", e instanceof Error ? e.message : String(e));
      return [];
    }),
  ]);
  return [
    contextoDoAluno(opts.nome, opts.relatorios),
    contextoDaPlataforma(plataforma, agora),
    contextoDasObservacoes(observacoes),
  ]
    .filter(Boolean)
    .join("\n\n");
}
