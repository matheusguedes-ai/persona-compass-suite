/**
 * ÍNDICES DO PERFIL DISC (#304) — Positividade, Estima e Flexibilidade (página de intensidade) e
 * Energia (bloco "Índices comportamentais", mais abaixo no relatório).
 *
 * Função pura sobre o resultado do motor ipsativo (`computed_scores.ipsativo`, ou o mesmo resultado
 * derivado das respostas cruas): não lê banco, não recalcula ranking, perfil nem faixa. Só sintaxe
 * apagável do TypeScript — roda no servidor e no Node dos testes (`scripts/testar_indices.py`, que
 * confere esta função contra um oráculo em Python e refaz a calibração).
 *
 * ── Onde o resultado mora ──────────────────────────────────────────────────────────────────────────
 * GRAVADO junto do resultado do motor, em `computed_scores.ipsativo.indices` (`comIndices`, chamado
 * pelo motor no envio). O relatório LÊ de lá — pelo `obterIpsativo`, que só completa em memória, com
 * esta mesma conta, o que ainda não tiver índice gravado. As respostas anteriores foram preenchidas
 * por `scripts/gravar_indices.py`.
 *
 * ── Por que foram refeitos ────────────────────────────────────────────────────────────────────────
 * Até a #304, Positividade e Energia aplicavam pesos que somam 1 ao percentual de cada letra no
 * gráfico ADAPTADO. No motor ipsativo as quatro letras DIVIDEM 100 (média 25): a conta não passava de
 * 0,60 nem para quem marcasse a mesma letra nos 28 blocos, e ficava perto de 0,25 para todo mundo —
 * abaixo de 0,40 em 100% das respostas ao acaso. Estima e Flexibilidade estavam "em revisão" desde a
 * Etapa 2c: as contas antigas subtraíam réguas diferentes e davam 1,00 e 0,75 para qualquer resposta.
 *
 * ── As contas (DISC: 28 blocos, uma alternativa por letra em cada bloco) ──────────────────────────
 * POSITIVIDADE — o eixo de Marston (1928) sobre como o ambiente é percebido: I e S respondem a um
 *   ambiente percebido como favorável; D e C, a um ambiente percebido como desafiador. Das vezes em que
 *   a pessoa apontou um estilo como o MENOS parecido com ela (a matéria do gráfico natural), a fração
 *   que caiu em D ou C. 1 = só rejeita os estilos do desafio; 0 = só os do acolhimento. Ao acaso, 0,50.
 * ENERGIA — o outro eixo de Marston, o da resposta: D e I agem sobre o ambiente; S e C o acolhem. A
 *   fração dos MENOS que caiu em S ou C.
 *
 * ESTIMA e FLEXIBILIDADE relacionam o natural com o adaptado — e isso NÃO pode ser feito comparando os
 * dois gráficos. O natural é "blocos − MENOS", e o estilo marcado como MAIS num bloco não pode ser o
 * MENOS daquele bloco: o que a pessoa mais escolhe como MAIS sobe sozinho no natural (natural ≥ MAIS,
 * letra por letra, sempre). Medido em simulação: comparando os gráficos, quem responde ao acaso saía
 * MAIS "flexível" do que quem de fato ajusta o comportamento, e a Estima subia quando o ajuste crescia.
 * A leitura justa do natural, aqui, é a ACEITAÇÃO de cada estilo:
 *     aceitação = 1 − MENOS ÷ (blocos em que o estilo ainda estava disponível depois do MAIS)
 * — das vezes em que ele podia ser rejeitado, em quantas não foi.
 * ESTIMA — das escolhas de MAIS, o quanto caem nos estilos mais aceitos: cada MAIS vale a posição do
 *   estilo na ordem de aceitação (1 para o mais aceito, 0 para o menos; empate = meia posição). O quanto
 *   aquilo que a pessoa mostra vem do que ela menos rejeita em si. Ao acaso, 0,50.
 * FLEXIBILIDADE — dos pares de estilos, a fração em que a ordem do MAIS contradiz a ordem de aceitação
 *   (empate de um lado só = meia troca). 0 = mostra os estilos na mesma ordem em que os aceita; 1 = na
 *   ordem inversa. O quanto a pessoa está reorganizando o jeito natural para o ambiente. Ao acaso, 0,50.
 * Nas duas fica de fora a letra com sinal abaixo do mínimo (#292): o teste não consegue posicioná-la,
 * e posição é justamente o que as duas comparam. Com o que sobra, sempre há ao menos dois estilos para
 * comparar no DISC; o `null` só existe para o caso patológico de quem marcou o MESMO estilo como MAIS
 * nos 28 blocos (ele nunca esteve disponível para ser rejeitado, e não há o que comparar).
 *
 * Calibração (40 mil respostas ao acaso + pessoas simuladas com natural e adaptado conhecidos) e o
 * porquê de cada escolha: `docs/motor-ipsativo.md`, seção "Os índices (#304)".
 */
import type { LetraIpsativa, ResultadoIpsativo } from "@/lib/escolha-forcada";

export type ChaveDoIndice = "positividade" | "estima" | "flexibilidade" | "energia";

/** `value` de 0 a 1, com duas casas. `null` só no caso patológico descrito acima. */
export type IndiceDoPerfil = { key: ChaveDoIndice; label: string; value: number | null };

/** Os três que a página de intensidade mostra lado a lado, nesta ordem. */
export const INDICES_DA_INTENSIDADE: readonly ChaveDoIndice[] = ["positividade", "estima", "flexibilidade"];

const LETRAS_DO_DISC = ["D", "I", "S", "C"];
/** Marston: estilos que respondem a um ambiente percebido como desafiador (o outro lado: I e S). */
const LADO_DO_DESAFIO = ["D", "C"];
/** Marston: estilos que acolhem o ambiente em vez de agir sobre ele (o outro lado: D e I). */
const LADO_RECEPTIVO = ["S", "C"];

const chaveDe = (l: LetraIpsativa) => l.chave.trim().toUpperCase();
const duasCasas = (n: number) => Math.round(n * 100) / 100;
const sinalDe = (x: number) => (x > 0 ? 1 : x < 0 ? -1 : 0);

/** Blocos em que a letra ainda podia ser o MENOS: todos em que ela aparece, menos os em que foi o MAIS. */
function disponivel(l: LetraIpsativa): number {
  return l.maximo - l.mais;
}

/**
 * +1 quando `a` é mais aceita que `b`, −1 quando é menos, 0 no empate. Sem dividir: MENOS ÷ disponível
 * vira produto cruzado, então empate é empate de verdade (nada de 0,1 + 0,2 ≠ 0,3).
 * aceitação(a) > aceitação(b) ⟺ menos_a ÷ disp_a < menos_b ÷ disp_b ⟺ menos_b × disp_a > menos_a × disp_b
 */
function compararAceitacao(a: LetraIpsativa, b: LetraIpsativa): number {
  return sinalDe(b.menos * disponivel(a) - a.menos * disponivel(b));
}

/** Das marcações de MENOS, a fração que caiu nas letras do `lado`. */
function fracaoDosMenos(letras: LetraIpsativa[], lado: string[]): number | null {
  const total = letras.reduce((soma, l) => soma + l.menos, 0);
  if (total <= 0) return null;
  return letras.filter((l) => lado.includes(chaveDe(l))).reduce((soma, l) => soma + l.menos, 0) / total;
}

function estima(validas: LetraIpsativa[]): number | null {
  if (validas.length < 2) return null;
  const totalMais = validas.reduce((soma, l) => soma + l.mais, 0);
  if (totalMais <= 0) return null;
  let soma = 0;
  for (const l of validas) {
    let aFrente = 0;
    for (const outra of validas) {
      if (outra === l) continue;
      const c = compararAceitacao(outra, l);
      if (c > 0) aFrente += 1;
      else if (c === 0) aFrente += 0.5;
    }
    soma += l.mais * (1 - aFrente / (validas.length - 1));
  }
  return soma / totalMais;
}

function flexibilidade(validas: LetraIpsativa[]): number | null {
  if (validas.length < 2) return null;
  let trocas = 0;
  let pares = 0;
  for (let i = 0; i < validas.length; i++) {
    for (let j = i + 1; j < validas.length; j++) {
      const a = validas[i];
      const b = validas[j];
      // mesma ordem = 0; ordem trocada = 1; empate de um lado só = 0,5; empatadas nos dois = 0
      trocas += Math.abs(compararAceitacao(a, b) - sinalDe(a.mais - b.mais)) / 2;
      pares += 1;
    }
  }
  return trocas / pares;
}

/**
 * Versão da FÓRMULA dos índices, gravada junto deles. Se as contas mudarem, sobe a versão: o índice
 * gravado com a versão antiga deixa de ser usado (é recalculado em memória pela conta atual, igual ao
 * que `obterIpsativo` faz com o resultado do motor) até alguém regravar as respostas existentes.
 */
export const VERSAO_INDICES = 1;

/**
 * O que fica gravado em `computed_scores.ipsativo.indices` (#304, segunda parte) — a MESMA estrutura
 * do resultado do motor, para haver um lugar só de onde ler. Valores de 0 a 1 com duas casas; `null`
 * só no caso patológico descrito acima.
 */
export type IndicesGravados = {
  versao: number;
  positividade: number | null;
  estima: number | null;
  flexibilidade: number | null;
  energia: number | null;
};

/** O resultado do motor como ele fica gravado a partir da #304: com os índices dentro (só DISC). */
export type ResultadoComIndices = ResultadoIpsativo & { indices?: IndicesGravados };

/**
 * A CONTA dos quatro índices — o único lugar onde ela existe. `null` quando o resultado não é de
 * DISC (as quatro letras D, I, S, C): os índices só existem para ele.
 */
export function calcularIndices(ips: ResultadoIpsativo): IndicesGravados | null {
  const chaves = ips.letras.map(chaveDe);
  if (chaves.length !== LETRAS_DO_DISC.length || !LETRAS_DO_DISC.every((k) => chaves.includes(k))) return null;
  const validas = ips.letras.filter((l) => l.sinal_suficiente && disponivel(l) > 0);
  const valor = (v: number | null) => (v == null ? null : duasCasas(v));
  return {
    versao: VERSAO_INDICES,
    positividade: valor(fracaoDosMenos(ips.letras, LADO_DO_DESAFIO)),
    estima: valor(estima(validas)),
    flexibilidade: valor(flexibilidade(validas)),
    energia: valor(fracaoDosMenos(ips.letras, LADO_RECEPTIVO)),
  };
}

/** Os índices gravados que ainda valem: da versão atual da fórmula e com os quatro campos. */
function indicesValidos(g: unknown): g is IndicesGravados {
  const o = g as IndicesGravados | null | undefined;
  return (
    !!o &&
    o.versao === VERSAO_INDICES &&
    (["positividade", "estima", "flexibilidade", "energia"] as const).every(
      (k) => o[k] === null || typeof o[k] === "number",
    )
  );
}

/**
 * O resultado do motor COM os índices dentro. Quem grava (o motor, no envio) e quem entrega ao
 * relatório (`obterIpsativo`) passam por aqui — então existe uma conta só:
 *   - índices já gravados e da versão atual → devolvidos como estão (LIDOS, não recalculados);
 *   - sem índices (resposta anterior à gravação, ou resultado derivado das respostas cruas) →
 *     calculados agora, em memória, pela mesma `calcularIndices`. Nada é gravado por esta função.
 * Fora do DISC devolve o resultado intocado, sem a chave.
 */
export function comIndices(ips: ResultadoIpsativo): ResultadoComIndices {
  const atual = ips as ResultadoComIndices;
  if (indicesValidos(atual.indices)) return atual;
  const indices = calcularIndices(ips);
  return indices ? { ...ips, indices } : ips;
}

/** Os quatro índices como a tela, o PDF e a assistente mostram: nesta ordem e com o nome. */
export function listaDeIndices(g: IndicesGravados | undefined): IndiceDoPerfil[] {
  if (!g) return [];
  return [
    { key: "positividade", label: "Positividade", value: g.positividade },
    { key: "estima", label: "Estima", value: g.estima },
    { key: "flexibilidade", label: "Flexibilidade", value: g.flexibilidade },
    { key: "energia", label: "Energia", value: g.energia },
  ];
}
