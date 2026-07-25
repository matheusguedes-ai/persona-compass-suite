/**
 * Derivações do relatório comportamental — calculadas a partir dos scores
 * normalizados (0–100) por fator D/I/S/C. Textos e definições originais.
 */

export type FactorKey = "D" | "I" | "S" | "C";
export type FactorMap = Record<string, number>;

export type DerivedConfig = {
  jung?: {
    extroversao?: Partial<Record<FactorKey, number>>;
    intuicao?: Partial<Record<FactorKey, number>>;
    pensamento?: Partial<Record<FactorKey, number>>;
  };
  indices?: {
    positividade?: Partial<Record<FactorKey, number>>;
    energia?: Partial<Record<FactorKey, number>>;
  };
  competencias?: Record<string, Partial<Record<FactorKey, number>>>;
};

export const DEFAULT_JUNG = {
  extroversao: { I: 0.55, D: 0.45 } as Partial<Record<FactorKey, number>>,
  intuicao: { D: 0.5, I: 0.5 } as Partial<Record<FactorKey, number>>,
  pensamento: { D: 0.5, C: 0.5 } as Partial<Record<FactorKey, number>>,
};

export const DEFAULT_INDICES = {
  positividade: { I: 0.6, S: 0.25, D: 0.15 } as Partial<Record<FactorKey, number>>,
  energia: { D: 0.6, I: 0.4 } as Partial<Record<FactorKey, number>>,
};

export const COMPETENCIAS: Array<{
  name: string;
  weights: Partial<Record<FactorKey, number>>;
  definition: string;
}> = [
  { name: "Ousadia", weights: { D: 0.85, I: 0.15 }, definition: "Disposição para assumir riscos calculados e agir mesmo sem todas as garantias." },
  { name: "Comando", weights: { D: 0.9, C: 0.1 }, definition: "Facilidade para assumir a direção de uma situação e responder por decisões difíceis." },
  { name: "Objetividade", weights: { D: 0.7, C: 0.3 }, definition: "Capacidade de ir ao ponto central de um assunto sem se perder em rodeios." },
  { name: "Assertividade", weights: { D: 0.6, C: 0.4 }, definition: "Habilidade de expressar posições e limites com clareza, sem agressividade nem omissão." },
  { name: "Persuasão", weights: { I: 0.75, D: 0.25 }, definition: "Poder de convencer pessoas por meio de argumentos, entusiasmo e presença." },
  { name: "Extroversão", weights: { I: 0.9, D: 0.1 }, definition: "Facilidade para iniciar contatos e se expressar abertamente em grupo." },
  { name: "Entusiasmo", weights: { I: 0.8, D: 0.2 }, definition: "Energia contagiante que mobiliza os outros em torno de uma ideia ou meta." },
  { name: "Sociabilidade", weights: { I: 0.75, S: 0.25 }, definition: "Naturalidade para construir e manter relações cordiais ao longo do tempo." },
  { name: "Empatia", weights: { I: 0.5, S: 0.5 }, definition: "Sensibilidade para perceber o estado emocional do outro e responder a ele." },
  { name: "Paciência", weights: { S: 0.85, C: 0.15 }, definition: "Tolerância para aguardar o tempo dos processos e das pessoas sem se irritar." },
  { name: "Persistência", weights: { S: 0.6, C: 0.4 }, definition: "Constância para sustentar o esforço até a conclusão, mesmo em tarefas longas." },
  { name: "Planejamento", weights: { C: 0.6, S: 0.4 }, definition: "Tendência a antecipar etapas e prazos antes de colocar a mão na massa." },
  { name: "Organização", weights: { C: 0.85, S: 0.15 }, definition: "Cuidado em manter informações, rotinas e materiais em ordem previsível." },
  { name: "Detalhismo", weights: { C: 0.9, S: 0.1 }, definition: "Atenção fina a informações que costumam passar despercebidas." },
  { name: "Prudência", weights: { C: 0.7, S: 0.3 }, definition: "Cautela em avaliar riscos e consequências antes de se comprometer." },
  { name: "Concentração", weights: { C: 0.5, S: 0.5 }, definition: "Capacidade de sustentar o foco em uma atividade sem se dispersar." },
];

export const COMPETENCIA_BANDS = [
  { min: 0, max: 19.999, label: "Crítico" },
  { min: 20, max: 39.999, label: "Baixo" },
  { min: 40, max: 59.999, label: "Satisfatório" },
  { min: 60, max: 79.999, label: "Desenvolvido" },
  { min: 80, max: 100, label: "Excelente" },
];

export function bandOf(value: number): string {
  return COMPETENCIA_BANDS.find((b) => value >= b.min && value <= b.max)?.label ?? "Crítico";
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}

function w(factors: FactorMap, weights: Partial<Record<FactorKey, number>>): number {
  let sum = 0;
  for (const [k, v] of Object.entries(weights)) sum += (factors[k] ?? 0) * (v ?? 0);
  return clamp(sum);
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

export const LEADERSHIP_STYLES = [
  { key: "executivo", factor: "D" as FactorKey, label: "Executivo" },
  { key: "motivador", factor: "I" as FactorKey, label: "Motivador" },
  { key: "metodico", factor: "S" as FactorKey, label: "Metódico" },
  { key: "sistematico", factor: "C" as FactorKey, label: "Sistemático" },
];

export function computeDerived(
  natural: FactorMap,
  adaptado: FactorMap,
  config?: DerivedConfig | null,
) {
  const jungCfg = { ...DEFAULT_JUNG, ...(config?.jung ?? {}) };
  const idxCfg = { ...DEFAULT_INDICES, ...(config?.indices ?? {}) };

  const extroversao = r1(w(natural, jungCfg.extroversao));
  const intuicao = r1(w(natural, jungCfg.intuicao));
  const pensamento = r1(w(natural, jungCfg.pensamento));
  const jung = {
    tipo:
      (extroversao >= 50 ? "E" : "I") +
      (intuicao >= 50 ? "N" : "S") +
      (pensamento >= 50 ? "T" : "F"),
    pares: [
      { left: "Extroversão", right: "Introversão", leftPct: extroversao, rightPct: r1(100 - extroversao), preferred: extroversao >= 50 ? "Extroversão" : "Introversão" },
      { left: "Intuição", right: "Sensação", leftPct: intuicao, rightPct: r1(100 - intuicao), preferred: intuicao >= 50 ? "Intuição" : "Sensação" },
      { left: "Pensamento", right: "Sentimento", leftPct: pensamento, rightPct: r1(100 - pensamento), preferred: pensamento >= 50 ? "Pensamento" : "Sentimento" },
    ],
  };

  const totalDISC = LEADERSHIP_STYLES.reduce((acc, s) => acc + (natural[s.factor] ?? 0), 0);
  const leadership = LEADERSHIP_STYLES.map((s) => ({
    key: s.key,
    label: s.label,
    pct: totalDISC > 0 ? r1(((natural[s.factor] ?? 0) / totalDISC) * 100) : 25,
  }));
  const dominant = [...leadership].sort((a, b) => b.pct - a.pct)[0];

  const keys: FactorKey[] = ["D", "I", "S", "C"];
  const diffs = keys.map((k) => Math.abs((adaptado[k] ?? 0) - (natural[k] ?? 0)));
  const flexibilidade = r2(1 - diffs.reduce((a, b) => a + b, 0) / diffs.length / 100);
  const positividade = r2(w(natural, idxCfg.positividade) / 100);
  const energia = r2(w(natural, idxCfg.energia) / 100);
  const highs = keys.filter((k) => (natural[k] ?? 0) >= 50);
  const estima =
    highs.length === 0
      ? 1
      : r2(
          1 -
            highs
              .map((k) => Math.max(0, (natural[k] ?? 0) - (adaptado[k] ?? 0)))
              .reduce((a, b) => a + b, 0) /
              highs.length /
              100,
        );
  const indices = [
    { key: "positividade", label: "Positividade", value: clamp01(positividade) },
    { key: "estima", label: "Estima", value: clamp01(estima) },
    { key: "flexibilidade", label: "Flexibilidade", value: clamp01(flexibilidade) },
    { key: "energia", label: "Energia", value: clamp01(energia) },
  ];

  const competencias = COMPETENCIAS.map((c) => {
    const weights = config?.competencias?.[c.name] ?? c.weights;
    const nat = r1(w(natural, weights));
    const adp = r1(w(adaptado, weights));
    return { name: c.name, natural: nat, adaptado: adp, band: bandOf(nat), definition: c.definition };
  });

  return { jung, leadership, dominant, indices, competencias };
}

export type Derived = ReturnType<typeof computeDerived>;

/** Bullets originais por polo preferido dos tipos psicológicos. */
export const JUNG_BULLETS: Record<string, string[]> = {
  "Extroversão": [
    "Você organiza as ideias falando: pensar em voz alta com outra pessoa acelera suas conclusões.",
    "Ambientes com movimento e troca costumam recarregar sua energia em vez de consumi-la.",
    "Tende a se aproximar rápido de pessoas novas e a ocupar espaço nas conversas de grupo.",
  ],
  "Introversão": [
    "Você processa internamente antes de se posicionar e valoriza tempo para pensar sozinho.",
    "Prefere conversas em profundidade com poucas pessoas a rodadas amplas e superficiais.",
    "Ambientes muito estimulados exigem depois um intervalo de silêncio para recuperar energia.",
  ],
  "Intuição": [
    "Você enxerga primeiro o quadro geral e as possibilidades futuras de uma situação.",
    "Conecta assuntos aparentemente distantes e gosta de reformular problemas antes de resolvê-los.",
    "Pode se impacientar com detalhes operacionais quando a direção já parece clara.",
  ],
  "Sensação": [
    "Você confia no que é concreto: fatos, evidências e experiências já vividas.",
    "Prefere instruções práticas e resultados verificáveis a hipóteses abstratas.",
    "Percebe com precisão o que está acontecendo agora, inclusive o que os outros não notam.",
  ],
  "Pensamento": [
    "Você decide por critérios e consequências lógicas, mesmo quando a escolha é impopular.",
    "Tende a separar o problema da pessoa e a buscar coerência entre discurso e dados.",
    "Pode soar mais frio do que pretende quando está concentrado na melhor solução.",
  ],
  "Sentimento": [
    "Você pondera o impacto humano das decisões antes de fechar uma posição.",
    "Busca harmonia e costuma perceber cedo quando alguém do grupo ficou desconfortável.",
    "Valoriza coerência com os próprios valores tanto quanto a eficiência do resultado.",
  ],
};

/** Frase interpretativa por faixa de índice. */
export function indexPhrase(key: string, value: number): string {
  const level = value < 0.4 ? "low" : value <= 0.7 ? "mid" : "high";
  const table: Record<string, Record<string, string>> = {
    positividade: {
      low: "Você tende a olhar primeiro para os riscos; registrar pequenas conquistas ajuda a equilibrar essa leitura.",
      mid: "Você alterna entre otimismo e cautela conforme o contexto, o que dá realismo às suas avaliações.",
      high: "Você mantém uma leitura favorável dos cenários e das pessoas, o que ajuda a sustentar o ânimo do grupo.",
    },
    estima: {
      low: "Você tem contido características que lhe são naturais; vale investigar o que torna esse ajuste necessário.",
      mid: "Você faz ajustes moderados no que é mais forte em você, sem abrir mão do essencial.",
      high: "Você se permite expressar seus pontos fortes no ambiente atual, com pouca necessidade de disfarce.",
    },
    flexibilidade: {
      low: "O esforço de adaptação está alto: seu comportamento atual difere bastante do espontâneo.",
      mid: "Você adapta parte do seu estilo ao contexto, mantendo boa parte da forma natural de agir.",
      high: "Seu comportamento atual está próximo do natural, o que sugere baixo desgaste de adaptação.",
    },
    energia: {
      low: "Você prefere ritmos constantes e previsíveis a mobilizações intensas e rápidas.",
      mid: "Você acelera quando o contexto pede e retoma o ritmo estável depois, sem grandes oscilações.",
      high: "Você opera em ritmo intenso e costuma iniciar movimento antes que o grupo perceba a necessidade.",
    },
  };
  return table[key]?.[level] ?? "";
}