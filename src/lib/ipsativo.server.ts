/**
 * De onde o RELATÓRIO lê o resultado ipsativo (#288, Etapa 2b-i).
 *
 * A fórmula existe num lugar só: `calcularIpsativo` (src/lib/escolha-forcada.ts). Este módulo
 * só entrega o resultado dela a quem lê, de duas origens:
 *
 *  - "gravado": respostas enviadas depois da Etapa 2a já trazem `computed_scores.ipsativo`.
 *  - "derivado": respostas enviadas ANTES da 2a (as reais de Temperamentos e VAK, por exemplo)
 *    não têm o campo. Em vez de gravar nada nelas — resposta existente não se altera —, o resultado
 *    é derivado EM MEMÓRIA das respostas cruas (`test_answers`) com a MESMA função. O relatório
 *    fica igual para elas sem que ninguém precise recalcular o que foi gravado.
 *
 * Nada aqui escreve no banco.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  calcularIpsativo,
  VERSAO_IPSATIVO,
  type BlocoRespondido,
  type ResultadoIpsativo,
} from "@/lib/escolha-forcada";

type Cliente = SupabaseClient<Database>;

export type OrigemDoIpsativo = "gravado" | "derivado";

/**
 * Resultado ipsativo de uma resposta, ou `null` se não der para obtê-lo com fidelidade (resposta
 * incompleta, opção que não existe mais…). Quem chama decide o que fazer com `null`.
 */
export async function obterIpsativo(
  supabase: Cliente,
  args: { responseId: string; versionId: string; computedScores: unknown },
): Promise<{ ipsativo: ResultadoIpsativo; origem: OrigemDoIpsativo } | null> {
  const gravado = (args.computedScores as { ipsativo?: ResultadoIpsativo } | null | undefined)
    ?.ipsativo;
  if (
    gravado &&
    gravado.versao === VERSAO_IPSATIVO &&
    Array.isArray(gravado.letras) &&
    gravado.letras.length > 0 &&
    Array.isArray(gravado.adaptado?.ranking)
  ) {
    return { ipsativo: gravado, origem: "gravado" };
  }
  const derivado = await derivarDasRespostas(supabase, args.responseId, args.versionId);
  return derivado ? { ipsativo: derivado, origem: "derivado" } : null;
}

async function derivarDasRespostas(
  supabase: Cliente,
  responseId: string,
  versionId: string,
): Promise<ResultadoIpsativo | null> {
  // Toda leitura com ordem explícita (mesma regra do motor): nada depende da ordem em que o banco devolve.
  const [dimsRes, qsRes] = await Promise.all([
    supabase
      .from("test_dimensions")
      .select("id, key, sort_order")
      .eq("version_id", versionId)
      .order("sort_order")
      .order("id"),
    supabase
      .from("test_questions")
      .select("id")
      .eq("version_id", versionId)
      .eq("type", "forced_choice")
      .order("sort_order")
      .order("id"),
  ]);
  if (dimsRes.error) throw new Error(dimsRes.error.message);
  if (qsRes.error) throw new Error(qsRes.error.message);
  const perguntas = qsRes.data ?? [];
  if (perguntas.length === 0) return null;
  const qIds = perguntas.map((q) => q.id);

  const optsRes = await supabase
    .from("test_options")
    .select("id, question_id")
    .in("question_id", qIds)
    .order("sort_order")
    .order("id");
  if (optsRes.error) throw new Error(optsRes.error.message);
  const opcoes = optsRes.data ?? [];
  const optIds = opcoes.map((o) => o.id);

  const [scoresRes, answersRes] = await Promise.all([
    optIds.length > 0
      ? supabase
          .from("option_scores")
          .select("option_id, dimension_id, points")
          .in("option_id", optIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("test_answers")
      .select("question_id, payload")
      .eq("response_id", responseId)
      .in("question_id", qIds),
  ]);
  if (scoresRes.error) throw new Error(scoresRes.error.message);
  if (answersRes.error) throw new Error(answersRes.error.message);

  const pontosPorOpcao = new Map<string, Array<{ dimension_id: string; points: number }>>();
  for (const s of scoresRes.data ?? []) {
    const lista = pontosPorOpcao.get(s.option_id) ?? [];
    lista.push({ dimension_id: s.dimension_id, points: Number(s.points) });
    pontosPorOpcao.set(s.option_id, lista);
  }
  const opcoesPorPergunta = new Map<string, string[]>();
  for (const o of opcoes) {
    const lista = opcoesPorPergunta.get(o.question_id) ?? [];
    lista.push(o.id);
    opcoesPorPergunta.set(o.question_id, lista);
  }
  const respostaPorPergunta = new Map<string, Record<string, unknown>>();
  for (const a of answersRes.data ?? []) {
    if (a.payload && typeof a.payload === "object" && !Array.isArray(a.payload)) {
      respostaPorPergunta.set(a.question_id, a.payload as Record<string, unknown>);
    }
  }

  const blocos: BlocoRespondido[] = [];
  for (const q of perguntas) {
    const p = respostaPorPergunta.get(q.id);
    const mais = typeof p?.most_option_id === "string" ? p.most_option_id : null;
    const menos = typeof p?.least_option_id === "string" ? p.least_option_id : null;
    const ids = opcoesPorPergunta.get(q.id) ?? [];
    // Bloco sem resposta, com MAIS = MENOS ou com opção que não é mais do bloco: não dá para
    // derivar com fidelidade. Melhor dizer "não sei" do que inventar um resultado.
    if (!mais || !menos || mais === menos || !ids.includes(mais) || !ids.includes(menos))
      return null;
    blocos.push({
      id: q.id,
      opcoes: ids.map((id) => ({ id, pontos: pontosPorOpcao.get(id) ?? [] })),
      mais,
      menos,
    });
  }

  return calcularIpsativo({
    dimensoes: (dimsRes.data ?? []).map((d) => ({
      id: d.id,
      key: d.key,
      sort_order: d.sort_order,
    })),
    blocos,
  });
}

// ---------------------------------------------------------------------------
// PONTE TEMPORÁRIA — sai na Etapa 2c
// ---------------------------------------------------------------------------

export type NumerosDaTelaAtual = {
  /** { [dimension_id]: { natural, adaptado } } em 0–100 — o formato que o relatório de hoje consome. */
  normalized: Record<string, { natural: number; adaptado: number }>;
  /** MAIS por letra (o "natural" bruto do formato antigo). */
  natural: Record<string, number>;
  /** MAIS − MENOS por letra (o "adaptado" bruto do formato antigo). */
  adaptado: Record<string, number>;
};

const limitar = (n: number) => Math.max(0, Math.min(100, n));

/**
 * Reproduz, A PARTIR DOS CONTADORES DO `ipsativo`, os números que a tela atual do relatório usa.
 *
 * A Etapa 2b-i só troca de ONDE o relatório busca o número; o que o aluno vê não muda. Só que a
 * tela de hoje foi desenhada com o formato antigo:
 *   "Natural"  = MAIS ÷ máximo × 100                       (no motor novo, é o conjunto ADAPTADO)
 *   "Adaptado" = (MAIS − MENOS + máximo) ÷ (2 × máximo) × 100  (não existe no motor novo)
 * As duas contas abaixo são a expressão EXATA das fórmulas antigas (mesma ordem de operações, para
 * dar o mesmo número bit a bit) com `mais`, `menos` e `maximo` lidos do `ipsativo`.
 *
 * ⚠️ Esta é a única ponte entre os dois vocabulários e ela MANTÉM o que a Etapa 2a mandou parar de
 * fazer: colocar as duas barras na mesma régua (a diferença "adaptado − natural" tem viés fixo de
 * +25). Fica assim de propósito enquanto a tela não muda; a Etapa 2c troca a apresentação e
 * esta função desaparece.
 */
export function numerosDaTelaAtual(ipsativo: ResultadoIpsativo): NumerosDaTelaAtual {
  const normalized: NumerosDaTelaAtual["normalized"] = {};
  const natural: Record<string, number> = {};
  const adaptado: Record<string, number> = {};
  for (const l of ipsativo.letras) {
    normalized[l.dimension_id] = {
      natural: limitar((l.mais / l.maximo) * 100),
      adaptado: limitar(((l.expressao + l.maximo) / (2 * l.maximo)) * 100),
    };
    natural[l.dimension_id] = l.mais;
    adaptado[l.dimension_id] = l.expressao;
  }
  return { normalized, natural, adaptado };
}
