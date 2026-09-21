/**
 * Motor IPSATIVO da escolha forçada (#288, Etapa 2a) — DISC, Temperamentos, VAK.
 *
 * Função pura: recebe as escolhas MAIS/MENOS já validadas e devolve o resultado
 * completo. Não lê banco, não lê relógio, não lê a ordem em que o banco devolveu
 * nada. É o único lugar onde a fórmula existe; o motor (`api.public.response`)
 * só monta a entrada e grava a saída, e as telas leem o que está gravado.
 *
 * ── Por que "ipsativo" ────────────────────────────────────────────────────────
 * Em escolha forçada cada bloco reparte exatamente um MAIS e um MENOS entre as
 * letras. O que uma letra ganha, outra perde: as quatro pontuações de uma pessoa
 * SEMPRE somam o mesmo total (28 MAIS em 28 blocos). Logo a média entre as letras
 * é fixa (25%) e um limiar absoluto do tipo "67% é alto" não mede a pessoa — mede a
 * régua. O que faz sentido é a POSIÇÃO RELATIVA das letras da mesma pessoa. Por
 * isso o resultado é ranking + distância entre 1º e 2º, nunca porcentagem contra
 * um limiar fixo.
 *
 * ── Definições ────────────────────────────────────────────────────────────────
 *   adaptado(letra) = quantas vezes a letra foi MAIS            (0 a n_blocos)
 *   natural(letra)  = n_blocos − quantas vezes foi MENOS        (quanto menos
 *                                                                rejeitada, mais natural)
 *   expressao(letra)= MAIS − MENOS   (soma zero entre as letras; "buscada ou
 *                                     evitada no dia a dia" — métrica separada)
 *
 * Natural e adaptado são DOIS CONJUNTOS independentes. Cada um é reportado como
 * ranking e como % da soma do PRÓPRIO conjunto (cada conjunto soma 100). Os dois
 * percentuais NÃO estão na mesma régua e nunca devem ser subtraídos ou comparados
 * um contra o outro — foi esse viés ("adaptação sempre crescente") que a fórmula
 * antiga tinha. Por isso este resultado não tem nenhum campo de diferença entre os
 * dois, de propósito.
 *
 * ── Perfil e intensidade (por conjunto) ───────────────────────────────────────
 *   distância = bruto(1º) − bruto(2º)
 *   até LIMITE_COMBINADO (2) → PERFIL COMBINADO (as duas letras; sem intensidade)
 *   de 3 a LIMITE_MODERADA (5) → predominância MODERADA
 *   6 ou mais → predominância CLARA
 * Os limiares vêm da variação esperada por acaso em 28 escolhas.
 *
 * ── Determinismo ──────────────────────────────────────────────────────────────
 * Todo empate é decidido pela ORDEM DA LETRA NO INSTRUMENTO (`sort_order` da
 * dimensão, depois a chave, depois o id) — nunca pela ordem em que as linhas
 * chegaram do banco nem pela ordem em que as respostas foram somadas. Embaralhar
 * a entrada não muda a saída (há teste para isso).
 *
 * Só sintaxe apagável do TypeScript e nenhum import: o mesmo arquivo roda no
 * servidor (motor), no Node dos scripts de teste e no build.
 */

/** Distância (em pontos brutos) até a qual 1º e 2º viram PERFIL COMBINADO. */
export const LIMITE_COMBINADO = 2;
/** Acima do combinado e até aqui: predominância moderada. Acima: clara. */
export const LIMITE_MODERADA = 5;
/** Versão do formato gravado em `computed_scores.ipsativo`. */
export const VERSAO_IPSATIVO = 2;

/**
 * SINAL MÍNIMO (#292). O sinal de uma letra é quantas vezes ela foi marcada na resposta, somando MAIS
 * e MENOS: o quanto a resposta fala dela. Cada bloco só informa sobre DUAS letras (a marcada como mais
 * e a marcada como menos); as outras ficam mudas. Como `natural` = máximo − MENOS, uma letra quase
 * nunca marcada sobe no ranking natural sem nunca ter sido escolhida — lidera por ser INVISÍVEL, não
 * por ser forte. Abaixo do sinal mínimo a letra não pode ocupar o título; continua no gráfico, marcada.
 *
 * O limiar sai da PRÓPRIA estrutura do teste (ver `sinalMinimo`), não de tabela: é o primeiro valor de
 * sinal que deixa de ser raro ao acaso, com esta cauda por letra. Calibrado com 40 mil respostas ao
 * acaso por instrumento (`scripts/testar_ipsativo.py sinal`): dá 9 no DISC e no Temperamentos (de 28
 * blocos), 11 no VAK (de 24) e 6 em Valores (cada valor aparece em 15 dos 30 blocos).
 */
export const ALVO_SINAL_POR_LETRA = 0.02;

/**
 * Instrumentos cujo resultado usa este motor.
 *
 * VALORES USA O MESMO TIPO DE PERGUNTA (`forced_choice`, 30 blocos, 6 letras, 3
 * alternativas por bloco) e passaria por aqui automaticamente — ficou FORA por
 * decisão pendente do dono do produto (#288, Etapa 2a). Para incluí-lo: acrescentar
 * "valores" a esta lista, e mais nada.
 */
export const INSTRUMENTOS_IPSATIVOS: readonly string[] = ["disc", "temperamentos", "vak"];

export function usaMotorIpsativo(instrumentId: string | null | undefined): boolean {
  return !!instrumentId && INSTRUMENTOS_IPSATIVOS.includes(instrumentId);
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

export type DimensaoIpsativa = { id: string; key: string; sort_order: number | null };

export type OpcaoDoBloco = {
  id: string;
  /** Linhas de `option_scores` da alternativa (uma por letra que ela pontua). */
  pontos: Array<{ dimension_id: string; points: number }>;
};

export type BlocoRespondido = {
  id: string;
  /** TODAS as alternativas do bloco (o máximo de cada letra sai daqui). */
  opcoes: OpcaoDoBloco[];
  /** id da alternativa marcada MAIS. */
  mais: string;
  /** id da alternativa marcada MENOS. */
  menos: string;
};

export type EntradaIpsativo = {
  dimensoes: DimensaoIpsativa[];
  blocos: BlocoRespondido[];
};

// ---------------------------------------------------------------------------
// Saída (é exatamente o que fica em `computed_scores.ipsativo`)
// ---------------------------------------------------------------------------

export type FaixaIpsativa = "combinado" | "moderada" | "clara";

/** Onde a letra ficou DENTRO de um conjunto (natural ou adaptado). */
export type PosicaoNoConjunto = {
  /** Pontos brutos no conjunto. */
  bruto: number;
  /** % da soma do próprio conjunto — o conjunto inteiro soma 100. */
  percentual: number;
  /** 1..n. Empate decidido pela ordem da letra no instrumento. */
  posicao: number;
  /** true se o bruto é igual ao da letra imediatamente acima no ranking. */
  empate_com_anterior: boolean;
};

export type LetraIpsativa = {
  dimension_id: string;
  chave: string;
  /** Em quantos blocos a letra aparece (28 no DISC). É o teto de `mais` e de `natural`. */
  maximo: number;
  /** Vezes marcada MAIS. */
  mais: number;
  /** Vezes marcada MENOS. */
  menos: number;
  /** Conjunto ADAPTADO: bruto = mais. */
  adaptado: PosicaoNoConjunto;
  /** Conjunto NATURAL: bruto = maximo − menos. */
  natural: PosicaoNoConjunto;
  /** mais − menos. Soma zero entre as letras. Não entra em nenhum ranking. */
  expressao: number;
  /** Quantas vezes a letra foi MARCADA, somando MAIS e MENOS: o quanto a resposta fala dela (#292). */
  sinal: number;
  /** Abaixo disto o sinal é raro demais ao acaso para sustentar um título. Vem da estrutura do teste. */
  sinal_minimo: number;
  /** false = fica fora do título (mas continua no gráfico, marcada como "pouca informação"). */
  sinal_suficiente: boolean;
};

export type PerfilIpsativo = {
  /**
   * "combinado" quando a distância entre 1º e 2º é ≤ LIMITE_COMBINADO.
   * "sem_sinal" quando NENHUMA letra tem sinal suficiente para ocupar o título (#292).
   */
  tipo: "predominante" | "combinado" | "sem_sinal";
  /** 1 letra (predominante) ou 2 (combinado), na ordem do ranking. Vazio em "sem_sinal". */
  chaves: string[];
  /** "S" | "SC". Se alguma chave tiver mais de um caractere (SAN, COL…), junta com "+". */
  codigo: string;
  /** bruto(1º) − bruto(2º) ENTRE AS ELEGÍVEIS, em pontos brutos. `null` em "sem_sinal". */
  distancia: number | null;
  faixa: FaixaIpsativa | null;
  /**
   * Letras a até LIMITE_COMBINADO pontos da 1ª (inclui a 1ª), na ordem do ranking.
   * Com mais de duas, o "perfil combinado" de duas letras esconde um empate maior
   * — `empate_multiplo` avisa, para a tela não apresentar como se fosse só um par.
   */
  grupo_da_frente: string[];
  empate_multiplo: boolean;
  /**
   * Letras que o ranking traria para o título e que ficaram de fora por sinal baixo (#292), na ordem
   * do ranking. O ranking em si NÃO muda: elas continuam onde estão, no gráfico.
   */
  fora_por_sinal: string[];
};

export type ConjuntoIpsativo = {
  /** Soma dos brutos do conjunto (base do percentual). */
  soma_bruta: number;
  /** Chaves das letras da 1ª à última. */
  ranking: string[];
  perfil: PerfilIpsativo;
};

export type ResultadoIpsativo = {
  versao: number;
  /** Blocos que entraram na conta. */
  n_blocos: number;
  /** Limiares usados, gravados junto para auditar respostas antigas se um dia mudarem. */
  limiares: { combinado_ate: number; moderada_ate: number; sinal_alvo_por_letra: number };
  /** Uma entrada por letra, NA ORDEM DO INSTRUMENTO (não do ranking). */
  letras: LetraIpsativa[];
  adaptado: ConjuntoIpsativo;
  natural: ConjuntoIpsativo;
};

// ---------------------------------------------------------------------------
// Ordem estável das letras — a ÚNICA fonte de desempate
// ---------------------------------------------------------------------------

const SEM_ORDEM = Number.MAX_SAFE_INTEGER;

function cmpTexto(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Ordem das letras no instrumento: sort_order, depois chave, depois id. */
export function compararLetras(a: DimensaoIpsativa, b: DimensaoIpsativa): number {
  const oa = a.sort_order ?? SEM_ORDEM;
  const ob = b.sort_order ?? SEM_ORDEM;
  if (oa !== ob) return oa - ob;
  return cmpTexto(a.key, b.key) || cmpTexto(a.id, b.id);
}

/**
 * Letra com o maior valor; empate decidido pela ordem da letra no instrumento.
 * Usada pelo "dominante" do fluxo antigo, que a tela pós-envio ainda lê — assim
 * nem o legado depende mais da ordem de leitura do banco.
 */
export function escolherDominante(
  valores: Record<string, number>,
  dimensoes: DimensaoIpsativa[],
): { id: string; valor: number } | null {
  let melhor: { dim: DimensaoIpsativa; valor: number } | null = null;
  for (const dim of dimensoes) {
    const valor = valores[dim.id];
    if (typeof valor !== "number") continue;
    if (
      melhor === null ||
      valor > melhor.valor ||
      (valor === melhor.valor && compararLetras(dim, melhor.dim) < 0)
    ) {
      melhor = { dim, valor };
    }
  }
  return melhor ? { id: melhor.dim.id, valor: melhor.valor } : null;
}

// ---------------------------------------------------------------------------
// Cálculo
// ---------------------------------------------------------------------------

type Linha = { dim: DimensaoIpsativa; bruto: number };

function ordenarConjunto(linhas: Linha[]): Linha[] {
  return [...linhas].sort((a, b) => b.bruto - a.bruto || compararLetras(a.dim, b.dim));
}

/**
 * Sinal mínimo de UMA letra, a partir da estrutura do teste (#292).
 *
 * Em cada bloco em que a letra aparece, o acaso a marca com chance p = 2 × (alternativas dela no
 * bloco) ÷ (alternativas do bloco) — uma chance de ser o MAIS, uma de ser o MENOS. Somando os blocos,
 * o número de marcações ao acaso tem distribuição binomial-poisson, calculada aqui de forma exata.
 * O limiar é o primeiro valor de sinal cuja cauda acumulada passa de `ALVO_SINAL_POR_LETRA`: dali para
 * baixo, o sinal é raro demais ao acaso para sustentar o título.
 */
export function sinalMinimo(chances: number[]): number {
  let dist = [1];
  for (const p of chances) {
    const prox = new Array(dist.length + 1).fill(0) as number[];
    for (let i = 0; i < dist.length; i++) {
      prox[i] += dist[i] * (1 - p);
      prox[i + 1] += dist[i] * p;
    }
    dist = prox;
  }
  let acumulado = 0;
  for (let k = 0; k < dist.length; k++) {
    acumulado += dist[k];
    if (acumulado > ALVO_SINAL_POR_LETRA) return k;
  }
  return dist.length;
}

/**
 * Perfil de um conjunto. O RANKING não muda (`ordenado` inteiro); o que muda é quem pode ocupar o
 * título: letra com sinal abaixo do mínimo é pulada, e o título passa para a próxima com sinal
 * suficiente (#292). Sem nenhuma elegível, não há perfil a declarar.
 */
function montarPerfil(ordenado: Linha[], temSinal: (l: Linha) => boolean): PerfilIpsativo {
  const elegiveis = ordenado.filter(temSinal);
  if (elegiveis.length === 0) {
    return {
      tipo: "sem_sinal",
      chaves: [],
      codigo: "",
      distancia: null,
      faixa: null,
      grupo_da_frente: [],
      empate_multiplo: false,
      fora_por_sinal: ordenado.map((l) => l.dim.key),
    };
  }
  const primeira = elegiveis[0];
  const segunda = elegiveis[1];
  // Sem 2ª letra não existe "distância"; nunca acontece nos instrumentos daqui
  // (mínimo 3 letras), mas a função não deve quebrar por isso.
  const distancia = segunda ? primeira.bruto - segunda.bruto : primeira.bruto;
  const combinado = !!segunda && distancia <= LIMITE_COMBINADO;
  const faixa: FaixaIpsativa = combinado
    ? "combinado"
    : distancia <= LIMITE_MODERADA
      ? "moderada"
      : "clara";
  const chaves = combinado ? [primeira.dim.key, segunda.dim.key] : [primeira.dim.key];
  const grupo = elegiveis
    .filter((l) => l.bruto >= primeira.bruto - LIMITE_COMBINADO)
    .map((l) => l.dim.key);
  // Quem o ranking traria para o título até a última letra usada, e ficou de fora por sinal baixo.
  const ultima = ordenado.findIndex((l) => l.dim.key === chaves[chaves.length - 1]);
  const fora = ordenado
    .slice(0, ultima)
    .filter((l) => !temSinal(l))
    .map((l) => l.dim.key);
  return {
    tipo: combinado ? "combinado" : "predominante",
    chaves,
    codigo: chaves.every((k) => k.length === 1) ? chaves.join("") : chaves.join("+"),
    distancia,
    faixa,
    grupo_da_frente: grupo,
    empate_multiplo: grupo.length > 2,
    fora_por_sinal: fora,
  };
}

function montarConjunto(
  linhas: Linha[],
  temSinal: (l: Linha) => boolean,
): {
  conjunto: ConjuntoIpsativo;
  porLetra: Map<string, PosicaoNoConjunto>;
} {
  const ordenado = ordenarConjunto(linhas);
  const soma = ordenado.reduce((acc, l) => acc + l.bruto, 0);
  const porLetra = new Map<string, PosicaoNoConjunto>();
  ordenado.forEach((l, i) => {
    porLetra.set(l.dim.id, {
      bruto: l.bruto,
      percentual: soma > 0 ? (l.bruto / soma) * 100 : 0,
      posicao: i + 1,
      empate_com_anterior: i > 0 && ordenado[i - 1].bruto === l.bruto,
    });
  });
  return {
    conjunto: {
      soma_bruta: soma,
      ranking: ordenado.map((l) => l.dim.key),
      perfil: montarPerfil(ordenado, temSinal),
    },
    porLetra,
  };
}

/**
 * Calcula o resultado ipsativo. Devolve `null` quando não há o que calcular
 * (nenhum bloco respondido ou nenhuma letra pontuada).
 *
 * Lança erro só quando a entrada é incoerente (MAIS/MENOS que não pertencem ao
 * bloco) — o motor já validou isso antes, então um erro aqui é bug, não dado ruim.
 */
export function calcularIpsativo(entrada: EntradaIpsativo): ResultadoIpsativo | null {
  const dims = [...entrada.dimensoes].sort(compararLetras);
  const ehDaVersao = new Set(dims.map((d) => d.id));
  const maximo = new Map<string, number>();
  const mais = new Map<string, number>();
  const menos = new Map<string, number>();
  /** Quantas VEZES a letra foi marcada (não pontos): é isso que o sinal conta (#292). */
  const marcacoes = new Map<string, number>();
  /** Chance de o acaso marcar a letra em cada bloco onde ela aparece — base do sinal mínimo (#292). */
  const chances = new Map<string, number[]>();

  for (const bloco of entrada.blocos) {
    // Teto de cada letra NESTE bloco: o maior valor que uma alternativa dá a ela.
    const tetoNoBloco = new Map<string, number>();
    for (const opcao of bloco.opcoes) {
      for (const s of opcao.pontos) {
        if (!ehDaVersao.has(s.dimension_id)) continue;
        tetoNoBloco.set(s.dimension_id, Math.max(tetoNoBloco.get(s.dimension_id) ?? 0, s.points));
      }
    }
    for (const [dimId, teto] of tetoNoBloco)
      maximo.set(dimId, (maximo.get(dimId) ?? 0) + Math.max(teto, 0));

    // Quantas alternativas do bloco pontuam cada letra: o acaso marca a letra (como MAIS ou como
    // MENOS) com chance 2 × essas alternativas ÷ total de alternativas do bloco.
    const alternativasDaLetra = new Map<string, number>();
    for (const opcao of bloco.opcoes) {
      const letrasDaOpcao = new Set(
        opcao.pontos.filter((s) => ehDaVersao.has(s.dimension_id) && s.points > 0).map((s) => s.dimension_id),
      );
      for (const dimId of letrasDaOpcao)
        alternativasDaLetra.set(dimId, (alternativasDaLetra.get(dimId) ?? 0) + 1);
    }
    for (const [dimId, quantas] of alternativasDaLetra) {
      const lista = chances.get(dimId) ?? [];
      lista.push(Math.min(1, (2 * quantas) / Math.max(bloco.opcoes.length, 1)));
      chances.set(dimId, lista);
    }

    const opcaoMais = bloco.opcoes.find((o) => o.id === bloco.mais);
    const opcaoMenos = bloco.opcoes.find((o) => o.id === bloco.menos);
    if (!opcaoMais || !opcaoMenos) {
      throw new Error(`Bloco ${bloco.id}: MAIS/MENOS não pertencem às alternativas do bloco.`);
    }
    for (const s of opcaoMais.pontos) {
      if (ehDaVersao.has(s.dimension_id))
        mais.set(s.dimension_id, (mais.get(s.dimension_id) ?? 0) + s.points);
    }
    for (const s of opcaoMenos.pontos) {
      if (ehDaVersao.has(s.dimension_id))
        menos.set(s.dimension_id, (menos.get(s.dimension_id) ?? 0) + s.points);
    }
    // Uma marcação por direção, por letra tocada — mesmo que a alternativa pontue mais de uma.
    for (const opcao of [opcaoMais, opcaoMenos]) {
      const tocadas = new Set(
        opcao.pontos.filter((s) => ehDaVersao.has(s.dimension_id) && s.points > 0).map((s) => s.dimension_id),
      );
      for (const dimId of tocadas) marcacoes.set(dimId, (marcacoes.get(dimId) ?? 0) + 1);
    }
  }

  // Só entram as letras que aparecem em algum bloco (dimensão sem pergunta não é
  // resultado zero — é falta de dado, mesma regra do relatório).
  const letras = dims.filter((d) => (maximo.get(d.id) ?? 0) > 0);
  if (letras.length === 0 || entrada.blocos.length === 0) return null;

  // SINAL (#292): quantas vezes a letra foi marcada, e o mínimo que a estrutura do teste exige dela.
  const sinal = new Map<string, number>();
  const minimo = new Map<string, number>();
  for (const dim of letras) {
    sinal.set(dim.id, marcacoes.get(dim.id) ?? 0);
    minimo.set(dim.id, sinalMinimo(chances.get(dim.id) ?? []));
  }
  const temSinal = (l: Linha) => (sinal.get(l.dim.id) ?? 0) >= (minimo.get(l.dim.id) ?? 0);

  const linhasAdaptado: Linha[] = letras.map((dim) => ({ dim, bruto: mais.get(dim.id) ?? 0 }));
  const linhasNatural: Linha[] = letras.map((dim) => ({
    dim,
    bruto: (maximo.get(dim.id) ?? 0) - (menos.get(dim.id) ?? 0),
  }));
  const adaptado = montarConjunto(linhasAdaptado, temSinal);
  const natural = montarConjunto(linhasNatural, temSinal);

  return {
    versao: VERSAO_IPSATIVO,
    n_blocos: entrada.blocos.length,
    limiares: {
      combinado_ate: LIMITE_COMBINADO,
      moderada_ate: LIMITE_MODERADA,
      sinal_alvo_por_letra: ALVO_SINAL_POR_LETRA,
    },
    letras: letras.map((dim) => ({
      dimension_id: dim.id,
      chave: dim.key,
      maximo: maximo.get(dim.id) ?? 0,
      mais: mais.get(dim.id) ?? 0,
      menos: menos.get(dim.id) ?? 0,
      adaptado: adaptado.porLetra.get(dim.id)!,
      natural: natural.porLetra.get(dim.id)!,
      expressao: (mais.get(dim.id) ?? 0) - (menos.get(dim.id) ?? 0),
      sinal: sinal.get(dim.id) ?? 0,
      sinal_minimo: minimo.get(dim.id) ?? 0,
      sinal_suficiente: (sinal.get(dim.id) ?? 0) >= (minimo.get(dim.id) ?? 0),
    })),
    adaptado: adaptado.conjunto,
    natural: natural.conjunto,
  };
}
