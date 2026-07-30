/**
 * A janela de uma aula presencial: de quando até quando o check-in aceita.
 *
 * Módulo separado, e sem nada de servidor dentro, porque as duas pontas
 * precisam da MESMA conta: o check-in (que valida no servidor) e a tabela de
 * presença (que decide, no navegador e na exportação, se a aula já aconteceu).
 * Duas cópias dessa aritmética divergiriam no dia em que alguém mudasse a
 * margem de cortesia num lado só.
 */

/** Cortesia antes do início: o professor sempre projeta o QR antes da hora. */
export const MARGEM_ANTES_MIN = 30;
/** Cortesia depois do fim: quem saiu para uma ligação e voltou no fim. */
export const MARGEM_DEPOIS_MIN = 15;
/** Aula sem fim declarado: assume um encontro de até 4 horas. */
const DURACAO_PADRAO_HORAS = 4;

export type Aula = { comeca_em: string | null; termina_em: string | null };
export type Janela = { inicio: Date; fim: Date };

/**
 * Devolve null quando a aula não tem horário — sem janela, "dentro da janela"
 * não quer dizer nada, e quem chama recusa em vez de aceitar qualquer hora.
 */
export function janelaDaAula(aula: Aula): Janela | null {
  if (!aula.comeca_em) return null;
  const comeca = new Date(aula.comeca_em);
  const termina = aula.termina_em
    ? new Date(aula.termina_em)
    : new Date(comeca.getTime() + DURACAO_PADRAO_HORAS * 3600_000);
  return {
    inicio: new Date(comeca.getTime() - MARGEM_ANTES_MIN * 60_000),
    fim: new Date(termina.getTime() + MARGEM_DEPOIS_MIN * 60_000),
  };
}

export function dentroDaJanela(j: Janela, agora = Date.now()): boolean {
  return agora >= j.inicio.getTime() && agora <= j.fim.getTime();
}

/**
 * A aula já aconteceu (a janela fechou)?
 *
 * É o que decide o denominador da frequência: "4 de 5" conta as aulas
 * REALIZADAS, não as previstas — senão todo mundo parece faltoso no meio do
 * treinamento. Aula sem horário não conta, porque não se sabe se aconteceu.
 */
export function aulaRealizada(aula: Aula, agora = Date.now()): boolean {
  const j = janelaDaAula(aula);
  return !!j && agora > j.fim.getTime();
}
