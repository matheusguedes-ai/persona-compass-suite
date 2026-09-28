/**
 * QUATRO SEÇÕES EXTRAS do relatório do DISC (#302): Matriz SWOT do
 * Comunicador, Ganhos e Perdas, Onde Isso Aparece, Comunicadores com Traços
 * Semelhantes (a quarta entrou depois, junto com o conteúdo do perfil D —
 * estava no arquivo do dono do produto, não no prompt original).
 *
 * Mesmo padrão de `intensidade.ts` (#288 2c): função pura, conteúdo vem
 * pronto de `report_content` pela sigla do perfil NATURAL — este módulo não
 * calcula sigla nenhuma, só lê. A diferença é o formato: aqui o conteúdo é
 * ESTRUTURADO (quadrantes, colunas, cartões), então mora em `content_json`
 * em vez de `body` — mas a regra de escolha da linha (versão do mentor vence
 * a global; sem linha, pendente ou malformado = sem seção) é a mesma.
 *
 * ⚠️ NOME: "SWOT do Comunicador" — de propósito, para não confundir com o
 * OUTRO "SWOT" do projeto (o painel que o mentor preenche à mão na
 * devolutiva, `docs/plano-painel-devolutiva.md`, ainda não construído). São
 * coisas diferentes com o mesmo nome curto; todo identificador aqui carrega
 * "comunicador" para não ambiguar.
 *
 * DISC e, desde 28/09/2026 (decisão do dono), TEMPERAMENTOS — só a SWOT e os
 * Ganhos e Perdas, que é o conteúdo que existe para eles (`temperamentos_swot_comunicador`,
 * `temperamentos_ganhos_perdas`). O prefixo da `section` é o instrumento; quem decide
 * se a seção aparece continua sendo o CHAMADOR (`report.server.ts`). Nos Temperamentos a
 * chave é um temperamento de três letras (SAN) e o motor escreve o combinado com "+"
 * (SAN+COL) — por isso a sigla se separa pelas CHAVES do instrumento, nunca letra a letra.
 *
 * REGRA DE HONESTIDADE (item 3 da demanda): ao contrário do texto do perfil
 * (#288), que mostra um AVISO no lugar quando está pendente, estas seções
 * não mostram nada — nem aviso, nem quadrante vazio. `null` aqui significa
 * "a seção inteira não aparece", ponto. Por isso as funções devolvem o tipo
 * pronto ou `null`, nunca um estado "pendente" à parte: quem lê não precisa
 * (nem deve) diferenciar "sem linha" de "linha incompleta" — as duas
 * produzem o mesmo relatório, sem buraco visual.
 *
 * REGRA DE HERANÇA (acréscimo pós-D/I/S/C, confirmado com o dono do produto): o DISC tem 16
 * siglas no perfil natural — as 4 simples (D/I/S/C) e 12 combinadas (DI, ID, DS…). Só as
 * simples têm conteúdo PRÓPRIO cadastrado nestas 4 seções. Para uma sigla combinada:
 * - SWOT do Comunicador, Ganhos e Perdas: as `montarXDoNatural` abaixo buscam o conteúdo de
 *   CADA letra que compõe a sigla (na ordem em que aparecem — a que lidera vem primeiro) e
 *   devolvem uma entrada por letra. Tudo ou nada: se uma das duas letras não tiver a seção
 *   completa, a função devolve `null` e a seção INTEIRA some pro perfil combinado — rotular
 *   "SWOT do D e do I" mostrando só um lado seria mais confuso que não mostrar nada.
 * - Onde Isso Aparece: mesma regra de tudo-ou-nada, mas o resultado NÃO é agrupado por letra —
 *   os cartões das duas letras entram numa lista só, cada um com a letra de origem marcada
 *   (`Aplicacao.letra`), na ordem letra-que-lidera-primeiro.
 * - Comunicadores com Traços Semelhantes: SEM regra de herança. As pessoas públicas foram
 *   escolhidas para um estilo PURO; combinar duas listas seria uma inferência que ninguém
 *   aprovou. Perfil combinado nunca mostra esta seção — `montarComunicadoresSemelhantesDoNatural`
 *   devolve `null` direto, sem nem consultar o banco.
 * A descrição do perfil (`disc_perfil_texto`, #288) NÃO usa esta regra — toda sigla, simples ou
 * combinada, sempre teve e continua tendo texto próprio; é outro mecanismo, em `intensidade.ts`.
 */

export type SwotComunicador = {
  forcas: string[];
  fragilidades: string[];
  oportunidades: string[];
  ameacas: string[];
};

/**
 * Uma entrada por letra do perfil natural — 1 entrada nos simples (D/I/S/C), 2 nas combinadas.
 * `rotulo`: o nome a mostrar no lugar da chave (Temperamentos: "Sanguíneo" em vez de "SAN"). Ausente =
 * mostra a letra, como o DISC sempre fez.
 */
export type SwotComunicadorPorLetra = { letra: string; rotulo?: string; swot: SwotComunicador };

export type GanhosPerdas = {
  mantendo: { ganha: string; perde: string };
  mudando: { ganha: string; perde: string };
  frase_que_te_segura: string;
};

export type GanhosPerdasPorLetra = { letra: string; rotulo?: string; gp: GanhosPerdas };

export type Aplicacao = {
  situacao: string;
  automatico: string;
  tecnica: string;
  /** Só presente num perfil COMBINADO: de qual das duas letras este cartão veio. */
  letra?: string;
};

export type OndeAparece = {
  situacoes: Aplicacao[];
};

export type ComunicadorSemelhante = {
  nome: string;
  descricao: string;
};

export type ComunicadoresSemelhantes = {
  pessoas: ComunicadorSemelhante[];
};

export type LinhaDeConteudo = {
  section: string;
  dimension_key: string;
  mode: string;
  status?: string | null;
  content_json: unknown;
  version_id: string | null;
};

/** A mesma escolha de `intensidade.ts`: versão do mentor > global; sem linha publicada, nada. */
function jsonDaSigla(section: string, sigla: string, versionId: string, linhas: LinhaDeConteudo[]): unknown {
  const candidatas = linhas.filter(
    (r) => r.section === section && r.dimension_key === sigla && r.mode === "natural",
  );
  const daVersao = candidatas.filter((r) => r.version_id === versionId);
  const linha = (daVersao.length > 0 ? daVersao : candidatas.filter((r) => r.version_id === null))[0];
  if (!linha || (linha.status ?? "publicado") !== "publicado") return null;
  return linha.content_json;
}

function textoValido(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

function listaDeTextosValida(v: unknown, minimo: number): v is string[] {
  return Array.isArray(v) && v.length >= minimo && v.every(textoValido);
}

export const SECAO_SWOT_COMUNICADOR = "disc_swot_comunicador";
export const SECAO_GANHOS_PERDAS = "disc_ganhos_perdas";
export const SECAO_ONDE_APARECE = "disc_onde_aparece";
export const SECAO_COMUNICADORES_SEMELHANTES = "disc_comunicadores_semelhantes";

/** Instrumentos com SWOT do Comunicador e Ganhos e Perdas. Onde Isso Aparece e Comunicadores: só DISC. */
export type InstrumentoComSecoes = "disc" | "temperamentos";

function secaoDo(instrumento: InstrumentoComSecoes, secaoDoDisc: string): string {
  return instrumento === "disc" ? secaoDoDisc : secaoDoDisc.replace(/^disc_/, `${instrumento}_`);
}

/** Item 3: os quatro quadrantes precisam estar completos juntos — 3 de 4 preenchidos
 *  ainda é "pendente" pra não sair um quadrante manco no relatório. */
function swotValido(v: unknown): v is SwotComunicador {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (["forcas", "fragilidades", "oportunidades", "ameacas"] as const).every((k) =>
    listaDeTextosValida(o[k], 1),
  );
}

export function montarSwotComunicador(
  sigla: string,
  versionId: string,
  linhas: LinhaDeConteudo[],
  instrumento: InstrumentoComSecoes = "disc",
): SwotComunicador | null {
  const json = jsonDaSigla(secaoDo(instrumento, SECAO_SWOT_COMUNICADOR), sigla, versionId, linhas);
  return swotValido(json) ? json : null;
}

function ganhosPerdasValido(v: unknown): v is GanhosPerdas {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  const coluna = (c: unknown): c is { ganha: string; perde: string } =>
    !!c && typeof c === "object" &&
    textoValido((c as Record<string, unknown>).ganha) &&
    textoValido((c as Record<string, unknown>).perde);
  return coluna(o.mantendo) && coluna(o.mudando) && textoValido(o.frase_que_te_segura);
}

export function montarGanhosPerdasDisc(
  sigla: string,
  versionId: string,
  linhas: LinhaDeConteudo[],
  instrumento: InstrumentoComSecoes = "disc",
): GanhosPerdas | null {
  const json = jsonDaSigla(secaoDo(instrumento, SECAO_GANHOS_PERDAS), sigla, versionId, linhas);
  return ganhosPerdasValido(json) ? json : null;
}

function aplicacaoValida(v: unknown): v is Aplicacao {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return textoValido(o.situacao) && textoValido(o.automatico) && textoValido(o.tecnica);
}

/** "Seis a sete cartões" (item da demanda) — exige pelo menos 6, sem teto. */
function ondeAppareceValido(v: unknown): v is OndeAparece {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.situacoes) && o.situacoes.length >= 6 && o.situacoes.every(aplicacaoValida);
}

export function montarOndeAparece(sigla: string, versionId: string, linhas: LinhaDeConteudo[]): OndeAparece | null {
  const json = jsonDaSigla(SECAO_ONDE_APARECE, sigla, versionId, linhas);
  return ondeAppareceValido(json) ? json : null;
}

function comunicadorValido(v: unknown): v is ComunicadorSemelhante {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return textoValido(o.nome) && textoValido(o.descricao);
}

/**
 * "Leitura de estilo público, não diagnóstico" — os nomes vêm do dono do produto, nunca
 * inventados aqui. Exige pelo menos 1: diferente da SWOT (que é tudo-ou-nada nos 4 quadrantes
 * porque formam uma leitura só), aqui cada pessoa é independente.
 */
function comunicadoresSemelhantesValido(v: unknown): v is ComunicadoresSemelhantes {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.pessoas) && o.pessoas.length >= 1 && o.pessoas.every(comunicadorValido);
}

export function montarComunicadoresSemelhantes(sigla: string, versionId: string, linhas: LinhaDeConteudo[]): ComunicadoresSemelhantes | null {
  const json = jsonDaSigla(SECAO_COMUNICADORES_SEMELHANTES, sigla, versionId, linhas);
  return comunicadoresSemelhantesValido(json) ? json : null;
}

// ------------------------------------------------------------------------------------------
// Regra de herança (ver o topo do arquivo): a partir daqui, as funções recebem a sigla do
// perfil NATURAL inteira (1 ou 2 letras) em vez de uma letra já resolvida — é aqui que a
// combinada vira "uma consulta por letra componente".
// ------------------------------------------------------------------------------------------

/**
 * As chaves que compõem a sigla, na ordem dela. O motor junta chaves de UMA letra sem separador (DI) e
 * chaves de mais de uma com "+" (SAN+COL) — `escolha-forcada.ts`. Uma chave inteira do instrumento (SAN,
 * ou D) é ela mesma; sem `chaves`, vale a leitura do DISC, letra a letra.
 */
export function letrasDoNatural(siglaNatural: string, chaves?: readonly string[]): string[] {
  if (chaves?.includes(siglaNatural)) return [siglaNatural];
  if (siglaNatural.includes("+")) return siglaNatural.split("+");
  return [...siglaNatural];
}

/** Para qual instrumento, com quais chaves, e o nome a mostrar de cada uma (Temperamentos). */
export type OpcoesDasSecoes = {
  instrumento?: InstrumentoComSecoes;
  chaves?: readonly string[];
  rotulos?: ReadonlyMap<string, string>;
};

export function montarSwotComunicadorDoNatural(
  siglaNatural: string,
  versionId: string,
  linhas: LinhaDeConteudo[],
  opcoes: OpcoesDasSecoes = {},
): SwotComunicadorPorLetra[] | null {
  const resultado: SwotComunicadorPorLetra[] = [];
  for (const letra of letrasDoNatural(siglaNatural, opcoes.chaves)) {
    const swot = montarSwotComunicador(letra, versionId, linhas, opcoes.instrumento);
    if (!swot) return null;
    const rotulo = opcoes.rotulos?.get(letra);
    resultado.push(rotulo ? { letra, rotulo, swot } : { letra, swot });
  }
  return resultado;
}

export function montarGanhosPerdasDoNatural(
  siglaNatural: string,
  versionId: string,
  linhas: LinhaDeConteudo[],
  opcoes: OpcoesDasSecoes = {},
): GanhosPerdasPorLetra[] | null {
  const resultado: GanhosPerdasPorLetra[] = [];
  for (const letra of letrasDoNatural(siglaNatural, opcoes.chaves)) {
    const gp = montarGanhosPerdasDisc(letra, versionId, linhas, opcoes.instrumento);
    if (!gp) return null;
    const rotulo = opcoes.rotulos?.get(letra);
    resultado.push(rotulo ? { letra, rotulo, gp } : { letra, gp });
  }
  return resultado;
}

export function montarOndeApareceDoNatural(
  siglaNatural: string,
  versionId: string,
  linhas: LinhaDeConteudo[],
): OndeAparece | null {
  const letras = letrasDoNatural(siglaNatural);
  const marcarLetra = letras.length > 1;
  const situacoes: Aplicacao[] = [];
  for (const letra of letras) {
    const oa = montarOndeAparece(letra, versionId, linhas);
    if (!oa) return null;
    for (const s of oa.situacoes) situacoes.push(marcarLetra ? { ...s, letra } : s);
  }
  return { situacoes };
}

/** Sem regra de herança — ver o aviso no topo do arquivo. */
export function montarComunicadoresSemelhantesDoNatural(
  siglaNatural: string,
  versionId: string,
  linhas: LinhaDeConteudo[],
): ComunicadoresSemelhantes | null {
  return letrasDoNatural(siglaNatural).length === 1
    ? montarComunicadoresSemelhantes(siglaNatural, versionId, linhas)
    : null;
}

/** Mesmo texto em pílula na tela e no PDF (#293: nunca duas fontes pro mesmo texto). */
export function rotuloDaSituacao(situacao: string, letra?: string): string {
  return letra ? `${situacao} · ${letra}` : situacao;
}
