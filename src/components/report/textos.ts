/**
 * TEXTOS FIXOS DO RELATÓRIO — fonte única para a tela e para o PDF (#293).
 *
 * Antes desta fatia, estas frases moravam dentro do JSX de `sections.tsx`. O PDF passou a ser
 * montado no servidor, sem React, e copiá-las para lá criaria duas versões do mesmo parágrafo —
 * que divergem no primeiro ajuste de texto. Então elas saíram do componente e vieram para cá:
 * a tela e o PDF leem daqui, e "o conteúdo do PDF é o da tela" deixa de ser promessa e vira
 * consequência.
 *
 * Nada aqui foi reescrito nesta fatia: são as mesmas frases, movidas. O `**assim**` marca o que
 * no JSX era `<strong>` — é a mesma convenção que o conteúdo vindo do banco já usava.
 *
 * ⚠️ Este módulo é PURO (sem React, sem import de componente): o servidor do PDF o carrega direto.
 */

export const SECTION_TITLES: Record<string, string> = {
  sintese: "Síntese do perfil",
  potencialidades: "Potencialidades",
  relacoes: "Relações interpessoais",
  decisao: "Tomada de decisão",
  motivador: "Motivadores",
  medos: "Medos e tensões",
  adequacao: "Adequação profissional",
  pontos_desenvolver: "Pontos a desenvolver",
  perfil: "O que mais pesa em você",
  trabalho: "Como isso aparece no trabalho",
  pressao: "Como você fica sob pressão",
  sombra: "O que menos aparece em você",
  desenvolvimento: "Por onde começar",
  equilibrio: "Nenhuma dimensão se destacou",
  eixo: "O que cada preferência sua quer dizer",
  atencao: "Pontos cegos de cada preferência",
};

export const FACTOR_THEMES: Array<{ key: string; title: string }> = [
  { key: "D", title: "Como você lida com problemas e desafios" },
  { key: "I", title: "Como você lida com pessoas e influência" },
  { key: "S", title: "Como você lida com ritmo e consistência" },
  { key: "C", title: "Como você lida com regras e procedimentos" },
];

export const COMUNICACAO: Array<{ key: string; label: string; body: string }> = [
  { key: "D", label: "Com perfis de foco em resultado (D)", body: "Vá direto ao ponto. Comece pela conclusão, apresente opções objetivas e deixe a decisão nas mãos da pessoa. Evite rodeios, contexto excessivo e conversas paralelas antes do assunto principal." },
  { key: "I", label: "Com perfis de foco em pessoas (I)", body: "Abra espaço para o diálogo e reconheça as ideias trazidas. Use exemplos, histórias e um tom entusiasmado, mas registre por escrito os combinados para que nada se perca no calor da conversa." },
  { key: "S", label: "Com perfis de foco em estabilidade (S)", body: "Fale com calma, explique o porquê das mudanças e dê tempo para a assimilação. Garanta previsibilidade: combine prazos realistas e confirme que a pessoa se sente segura antes de avançar." },
  { key: "C", label: "Com perfis de foco em precisão (C)", body: "Traga dados, critérios e fontes. Antecipe as perguntas sobre qualidade e risco, evite generalizações e permita tempo de análise antes de pedir um posicionamento." },
];

export const PLANO_ACAO: string[] = [
  "Quais comportamentos deste relatório você reconhece com mais clareza no seu dia a dia?",
  "Em quais situações o seu perfil adaptado se distancia mais do natural? O que costuma provocar esse esforço?",
  "Qual característica do seu perfil tem gerado os melhores resultados e como ampliá-la de forma consciente?",
  "Qual ponto a desenvolver traria maior impacto se você trabalhasse nele nos próximos 90 dias?",
  "Que apoio (pessoas, rotinas, ferramentas) você precisa para sustentar essa mudança?",
  "Como você vai medir o seu progresso e em que data pretende revisitar este plano?",
];

export const PLANO_ACAO_GENERICO: string[] = [
  "Quais dimensões deste relatório descrevem bem o que você observa em si mesmo?",
  "Alguma intensidade apresentada aqui te surpreendeu? O que pode explicar isso?",
  "Qual dimensão mais alta você quer usar de forma mais consciente nos próximos meses?",
  "Qual dimensão mais baixa merece atenção e por quê?",
  "Que apoio (pessoas, rotinas, ferramentas) você precisa para avançar?",
  "Como você vai acompanhar o progresso e quando pretende revisitar este plano?",
];

export const FAIXA_DO_GRAFICO: Record<"combinado" | "moderada" | "clara", string> = {
  clara: "predominância clara",
  moderada: "predominância moderada",
  combinado: "perfil combinado",
};

/** Texto dos índices sem valor (motor ipsativo): Estima e Flexibilidade estão em revisão. */
export const INDICE_EM_REVISAO =
  "Em revisão — este índice volta a aparecer quando o novo cálculo estiver pronto.";

/** "Como ler este relatório", nas três formas que o relatório assume. */
export const INTRO = {
  titulo: "Como ler este relatório",
  mbti: [
    "Este inventário mede quatro preferências independentes, na tradição de Carl Jung (1921): para onde você dirige a atenção (E/I), como capta informação (S/N), como decide (T/F) e como se organiza diante do que está em aberto (J/P).",
    "Os polos de cada eixo são complementares, não opostos excludentes. O percentual indica **ênfase** — todo mundo usa os dois lados, e a preferência diz qual deles vem primeiro e com menos esforço.",
    "As quatro letras juntas formam um apelido para o conjunto. Quando um eixo fica perto de 50% a 50%, aquela letra é praticamente sorteio, e este relatório diz isso em vez de fingir que decidiu. O que vale a leitura são os eixos, um a um.",
  ],
  disc: [
    "Este relatório organiza a leitura do seu comportamento em quatro fatores observáveis, derivados da tradição iniciada por William Moulton Marston na década de 1920: a forma como você reage a problemas e desafios (D), como se relaciona e influencia pessoas (I), o ritmo e a constância com que conduz suas atividades (S) e o grau de apego a regras, critérios e procedimentos (C).",
    "Não existem fatores melhores ou piores. Cada combinação descreve tendências de comportamento — não mede inteligência, caráter, competência técnica ou potencial de crescimento. O que o instrumento oferece é um vocabulário comum para conversar sobre estilos de agir e sobre os ajustes que cada contexto exige.",
  ],
  /** #288 Etapa 2c: os dois conjuntos não se comparam, e a frase antiga nascia dessa comparação. */
  discIpsativo:
    "Você verá dois conjuntos de resultados. O perfil **natural** descreve o comportamento mais espontâneo, aquele que aparece quando não há pressão externa. O perfil **adaptado** descreve o que você tem apresentado no ambiente atual. Cada um tem a sua própria sigla e se lê por si: os dois são medidos de formas diferentes e não se comparam um com o outro.",
  discClassico:
    "Você verá dois conjuntos de resultados. O perfil **natural** descreve o comportamento mais espontâneo, aquele que aparece quando não há pressão externa. O perfil **adaptado** descreve o que você tem apresentado no ambiente atual. Diferenças relevantes entre os dois indicam esforço consciente de ajuste — algo saudável em doses moderadas e desgastante quando prolongado.",
  dimensional: [
    "Este relatório apresenta a intensidade de cada dimensão avaliada, em uma escala comparável de 0 a 100. Quanto maior o valor, maior o peso daquela dimensão nas suas respostas.",
    "Não há dimensões certas ou erradas: o conjunto descreve ênfases e prioridades no momento em que você respondeu. Leia primeiro as dimensões mais altas, depois observe as mais baixas — elas costumam explicar escolhas e desconfortos com a mesma clareza.",
  ],
};

/** Página de intensidade (#288 Etapa 2c). */
export const INTENSIDADE = {
  rotulo: "Intensidade do perfil",
  semPredominancia: "Sem predominância clara",
  semSinal:
    "Nenhuma das dimensões apareceu vezes suficientes nas suas escolhas para o teste posicioná-la com segurança, então este relatório não declara um perfil. Os gráficos abaixo mostram como as suas escolhas se distribuíram.",
  empateMultiplo:
    "As letras do seu gráfico natural ficaram muito próximas entre si — três ou mais praticamente empatadas —, então nenhuma se destaca o bastante para virar o seu perfil. Os gráficos abaixo mostram essa distribuição.",
  indicesRodape: "Índices de 0 a 1, derivados do seu DISC (gráfico adaptado).",
  indicesEmRevisao: " Os marcados como em revisão voltam quando o novo cálculo estiver pronto.",
  naturalTitulo: "Natural",
  naturalExplica:
    "Seu jeito espontâneo: quanto menos vezes você apontou um estilo como o que menos combina com você, mais alto ele fica.",
  adaptadoTitulo: "Adaptado",
  adaptadoExplica:
    "O que você tem mostrado no ambiente atual: quanto mais vezes você apontou um estilo como o que mais combina com você, mais alto ele fica.",
  reguasSeparadas:
    "Os dois gráficos são medidos de formas diferentes e não se comparam entre si: em cada um, as letras dividem 100 pontos, e o que vale é a ordem delas.",
  poucaInformacao: "pouca informação",
  textoPendente:
    "A descrição detalhada deste perfil está sendo preparada e aparece aqui assim que estiver pronta. A sigla e os gráficos acima já refletem as suas respostas.",
  leiturasDoAdaptado:
    "As leituras de cada dimensão, nas próximas seções, partem do gráfico adaptado — o que você mais escolheu.",
};

/**
 * A explicação, para o aluno, de uma dimensão que ele quase não marcou (#292). Sem jargão e sem
 * culpar quem respondeu: o teste é que ficou sem informação sobre aquela dimensão.
 */
export function avisoDeSinal(
  letras: Array<{ label: string; sinal: number; fora_do_titulo: boolean }>,
  marcacoes: number,
): string {
  const partes = letras.map((l) => `${l.label} (${l.sinal} ${l.sinal === 1 ? "vez" : "vezes"})`);
  const lista =
    partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
  const uma = letras.length === 1;
  const fechamento = letras.some((l) => l.fora_do_titulo)
    ? `${uma ? "ela continua" : "elas continuam"} nos gráficos, mas ${uma ? "fica" : "ficam"} fora do título do perfil.`
    : `${uma ? "ela continua" : "elas continuam"} nos gráficos, e a posição ${uma ? "dela" : "delas"} merece ser lida com cuidado.`;
  return (
    `${lista} apareceu${uma ? "" : "ram"} poucas vezes nas suas escolhas, entre as ${marcacoes} marcações ` +
    `que o teste pede. Com tão pouca informação, este teste não consegue posicionar ` +
    `${uma ? "essa dimensão" : "essas dimensões"} com segurança — ${fechamento}`
  );
}

/** "Como o meio percebe você" — o 360°. */
export const OBSERVADORES = {
  titulo: "Como o meio percebe você",
  paragrafos: (comIntensidade: boolean) => [
    "A percepção externa não é uma correção da sua autoimagem: são duas leituras legítimas do mesmo comportamento, feitas de pontos de observação diferentes. Você tem acesso à sua intenção; quem convive com você tem acesso ao efeito prático das suas ações.",
    `Diferenças de até cerca de 10 pontos costumam ser ruído de leitura. Acima disso, vale investigar: quando o externo está bem acima ${comIntensidade ? "do seu gráfico adaptado" : "do natural"} em um fator, é provável que você venha entregando esse comportamento com mais intensidade do que reconhece — às vezes por exigência do contexto. Quando está bem abaixo, um traço que você considera evidente talvez não esteja chegando com clareza às pessoas.`,
    "Use essas lacunas como pauta de conversa, não como veredito. Um número pequeno de observadores tende a refletir a relação específica de cada um com você; quanto mais variados os contextos representados, mais estável fica a leitura.",
  ],
};

/** Ressalva de confiabilidade (`computed_scores.qualidade`). */
export const CONFIABILIDADE = {
  tituloGrave: "Leia este relatório com cautela",
  tituloLeve: "Uma ressalva sobre a leitura",
  corpo: (motivos: string[]) =>
    `O jeito como o inventário foi preenchido sugere ${motivos.join(" e ")}. Isso não invalida o ` +
    `resultado, mas reduz a confiança nele: o retrato pode estar mais borrado do que o normal. ` +
    `Se algo aqui não fizer sentido, o melhor caminho é responder de novo com calma.`,
};

/** Tipos psicológicos — respondidos de verdade ou estimados a partir do DISC. */
export const JUNG = {
  titulo: "Tipos psicológicos",
  semSigla: "sem sigla definida",
  seloTeste: "Com base nas suas respostas do inventário MBTI",
  seloDisc: "Estimativa derivada do seu DISC",
  introTeste:
    "Leitura das preferências mentais a partir do inventário que você respondeu. Os polos são complementares: o percentual indica ênfase, não ausência do lado oposto.",
  introDisc:
    "Você não respondeu um inventário de tipos psicológicos nesta avaliação. Os percentuais abaixo são uma estimativa calculada a partir do seu perfil DISC — útil como hipótese de leitura, não como resultado de teste.",
  ressalvaDisc:
    "**E uma ressalva que vale dizer inteira:** o DISC mede quatro fatores, e os eixos abaixo saem todos deles. Isso amarra os eixos entre si — na prática, a estimativa distingue bem menos tipos do que um inventário respondido distinguiria. Leia os percentuais, não a sigla.",
  noMuro: (quantos: number) =>
    `${quantos} dos quatro eixos ficaram praticamente empatados, então a sigla de quatro letras seria sorteio. Os eixos que se definiram continuam valendo — estão abaixo.`,
  eixoEmpatado:
    "Praticamente empatado. Você transita pelos dois lados conforme a situação — a letra correspondente do seu tipo, aqui, não diz grande coisa.",
};

/** Seções derivadas do DISC (liderança, competências, índices). */
export const DERIVADOS = {
  seloAdaptado: "Derivado do seu DISC (gráfico adaptado)",
  selo: "Derivado do seu DISC",
  liderancaTitulo: "Estilo de liderança",
  pontosFortes: "Pontos fortes",
  pontosAtencao: "Pontos de atenção",
  competenciasTitulo: "Mapa de competências",
  competenciasUmaSerie:
    "Dezesseis competências calculadas a partir da combinação dos seus fatores no gráfico adaptado.",
  competenciasDuasSeries:
    "Dezesseis competências calculadas a partir da combinação dos seus fatores. A linha sólida representa o perfil natural; a tracejada, o adaptado.",
  indicesTitulo: "Índices comportamentais",
  indicesIntro: "Valores de 0 a 1 que resumem tendências gerais do seu momento atual.",
};

/** Demais títulos e frases avulsas do corpo. */
export const CORPO = {
  naturalAdaptado: "Natural × Adaptado",
  semPredominancia: "Sem predominância clara — os quatro fatores ficaram quase no mesmo nível",
  intensidadePorDimensao: "Intensidade por dimensão",
  intensidadeIntro: "Dimensões ordenadas da maior para a menor intensidade.",
  naoMedida: "Não medida — nenhuma pergunta deste inventário pontua esta dimensão.",
  leituraDimensoes: "Leitura de cada dimensão",
  semFaixa: "sem faixa definida",
  leituraDoAdaptado: "Leitura do seu gráfico adaptado — o que você tem mostrado no ambiente atual.",
  reguaTitulo: "Régua de descritores",
  reguaAdaptado: "A faixa destacada corresponde à intensidade de cada fator no seu gráfico adaptado.",
  reguaNatural: "A faixa destacada corresponde à sua intensidade natural em cada fator.",
  comunicacaoTitulo: "Sugestões de comunicação",
  comunicacaoIntro:
    "Ajustes simples que aumentam a chance de ser compreendido por cada estilo.",
  elevou: "Você tem elevado este fator",
  conteve: "Você tem contido este fator",
  planoTitulo: "Plano de ação",
  planoIntro: "Responda com calma, salve suas anotações e revisite-as com seu mentor.",
};

/** Aviso legal do rodapé. */
export const RODAPE_LEGAL =
  "Este relatório é uma ferramenta de autoconhecimento e desenvolvimento. Ele descreve tendências de comportamento autorrelatadas em um momento específico e não deve ser usado isoladamente para decisões de seleção, promoção ou desligamento. Recomenda-se a leitura acompanhada por um mentor ou profissional qualificado.";

/** Relatório unificado de uma bateria (`/relatorio-bateria/$assessmentId`). */
export const BATERIA = {
  rotulo: "Relatório completo",
  pendentesPrefixo: "Este relatório cobre apenas os inventários já concluídos. Ainda pendente(s): ",
  pendentesSufixo:
    ". As seções correspondentes aparecerão automaticamente quando forem respondidas.",
  sumarioTitulo: "O que foi avaliado",
  sumarioIntro:
    "Cada inventário abaixo foi respondido por você e gera uma seção própria neste relatório.",
  parte: (i: number, total: number) => `Parte ${i} de ${total}`,
  concluidoEm: "Concluído em",
  tempoTotal: "Tempo total",
  inventarios: "Inventários",
};
