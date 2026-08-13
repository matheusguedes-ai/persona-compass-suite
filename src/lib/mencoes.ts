/**
 * Menções com @ em posts e comentários da comunidade.
 *
 * A menção vive dentro do próprio texto, como marcação inline —
 * `@[Nome Completo](person_id)` — em vez de uma tabela separada. O texto já
 * tem dono (post ou comentário, que já têm o deles); criar uma tabela só para
 * guardar "quem foi marcado onde" duplicaria um dado que o próprio texto já
 * carrega, com o risco de os dois desencontrarem se um dia o texto for
 * editado. `person_id` (não o id de login) porque é o que a lista de membros
 * e o cartão de perfil já usam — sem precisar traduzir id no meio do caminho.
 */

const MARCACAO = /@\[([^\]]+)\]\(([0-9a-fA-F-]{36})\)/g;

/** Todas as menções encontradas no texto, na ordem em que aparecem. */
export function extrairMencoes(texto: string): Array<{ nome: string; personId: string }> {
  const regex = /@\[([^\]]+)\]\(([0-9a-fA-F-]{36})\)/g;
  const encontradas: Array<{ nome: string; personId: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(texto))) encontradas.push({ nome: m[1], personId: m[2] });
  return encontradas;
}

/**
 * O texto para quem NÃO vai ver a menção clicável — pré-visualização de
 * notificação, por exemplo. Sem isto, "fulano publicou" mostraria a marcação
 * crua (`@[Nome](uuid-enorme)`) para o grupo inteiro.
 */
export function textoSemMarcacao(texto: string): string {
  return texto.replace(MARCACAO, "@$1");
}

/** A marcação para inserir no texto ao escolher alguém na listinha. */
export function marcarPessoa(nome: string, personId: string): string {
  return `@[${nome}](${personId})`;
}

/**
 * Há uma menção "em andamento" bem antes do cursor? Anda para trás a partir
 * do cursor até achar espaço/quebra de linha (fim da palavra) ou `@` (início
 * da menção). Se achar `@` primeiro, a pessoa está no meio de digitar um
 * nome — devolve o que já foi digitado, para filtrar a lista.
 */
export function detectarMencao(texto: string, cursor: number): { inicio: number; termo: string } | null {
  let i = cursor;
  while (i > 0 && texto[i - 1] !== "@" && !/\s/.test(texto[i - 1])) i--;
  if (i === 0 || texto[i - 1] !== "@") return null;
  return { inicio: i - 1, termo: texto.slice(i, cursor) };
}
