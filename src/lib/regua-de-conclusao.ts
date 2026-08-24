/**
 * #221 Fatia 1 — a régua: um jeito só de perguntar "esta pessoa concluiu?".
 *
 * Classroom e Academy são dois mundos que a plataforma escolheu manter
 * separados (decisão de arquitetura, ver #256): chaves diferentes
 * (person_id × user_id), tabelas diferentes, jeitos diferentes de decidir o
 * que é "um item cumprido". Esta régua não funde os dois — cada lado resolve,
 * do seu jeito, a lista de itens e quem cumpriu cada um (Classroom em
 * `classroom.functions.ts`, Academy em `learning.functions.ts`). O que mora
 * aqui é só a conta FINAL, pura, sem tocar banco — para as duas pontas nunca
 * responderem "concluiu" de um jeito e "não concluiu" de outro para o mesmo
 * número.
 */

export type Conclusao = {
  /** Quantos itens (aula/aula de trilha) esta pessoa cumpriu. */
  feitos: number;
  /** Quantos itens existem no total (sem os cancelados/despublicados). */
  total: number;
  /** Percentual atingido, arredondado. Null quando não há item nenhum ainda. */
  percentual: number | null;
  /** O percentual mínimo configurado no treinamento/trilha. */
  percentual_exigido: number;
  concluido: boolean;
};

/**
 * A conta final. `total === 0` nunca conclui — treinamento/trilha vazio não
 * tem o que cumprir, e "concluído" ali seria uma afirmação vazia, não uma
 * conquista.
 */
export function calcularConclusao(
  feitos: number,
  total: number,
  percentualExigido: number,
): Conclusao {
  const percentual = total === 0 ? null : Math.round((feitos / total) * 100);
  return {
    feitos,
    total,
    percentual,
    percentual_exigido: percentualExigido,
    concluido: total > 0 && percentual !== null && percentual >= percentualExigido,
  };
}
