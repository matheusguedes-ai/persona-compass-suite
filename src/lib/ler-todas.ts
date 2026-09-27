/**
 * LER TODAS AS LINHAS de uma consulta (#310).
 *
 * A API do banco devolve no máximo um lote por consulta (o "max rows" do Supabase) e corta o resto
 * SEM AVISAR: a resposta vem com cara de completa. Para as assistentes, isso vira a pior falha
 * possível — uma resposta de "quantos" ou "quais são" dita com segurança sobre uma fatia.
 *
 * Aqui a leitura vai em páginas, pedindo a CONTAGEM EXATA junto. Cada página começa onde a anterior
 * terminou pelo número de linhas que REALMENTE vieram (não pelo tamanho que se pediu): se o teto do
 * servidor for menor que o lote, a conta continua certa. Para quando juntou o total, ou quando bate o
 * teto de segurança — e então devolve `completo: false` com o total verdadeiro, para quem chama
 * dizer no texto "recebi X de N".
 *
 * A consulta precisa de ordem ESTÁVEL (`.order("id")` no fim): sem ela, duas páginas podem repetir ou
 * pular linhas.
 */
export type LeituraCompleta<T> = {
  linhas: T[];
  /** Quantas linhas existem de verdade (a contagem do banco). */
  total: number;
  /** false = havia mais do que foi lido (bateu o teto de segurança). */
  completo: boolean;
};

type Pagina<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null; count: number | null }>;

export async function lerTodas<T>(
  pagina: (de: number, ate: number) => Pagina<T>,
  opcoes: { lote?: number; teto?: number } = {},
): Promise<LeituraCompleta<T>> {
  const lote = opcoes.lote ?? 1000;
  const teto = opcoes.teto ?? 20000;
  const linhas: T[] = [];
  let total: number | null = null;
  while (linhas.length < teto) {
    const { data, error, count } = await pagina(linhas.length, linhas.length + lote - 1);
    if (error) throw new Error(error.message);
    if (total == null && typeof count === "number") total = count;
    const veio = data ?? [];
    linhas.push(...veio);
    if (veio.length === 0) break;
    if (total != null && linhas.length >= total) break;
    // Sem contagem (não deveria acontecer: toda chamada pede count), página menor que o lote = fim.
    if (total == null && veio.length < lote) break;
  }
  const lidas = linhas.slice(0, teto);
  const t = Math.max(total ?? lidas.length, lidas.length);
  return { linhas: lidas, total: t, completo: lidas.length >= t };
}
