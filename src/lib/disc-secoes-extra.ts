/**
 * TRÊS SEÇÕES EXTRAS do relatório do DISC (#302): Matriz SWOT do Comunicador,
 * Ganhos e Perdas, Onde Isso Aparece.
 *
 * Mesmo padrão de `intensidade.ts` (#288 2c): função pura, conteúdo vem
 * pronto de `report_content` pela sigla do perfil NATURAL — este módulo não
 * calcula sigla nenhuma, só lê. A diferença é o formato: aqui o conteúdo é
 * ESTRUTURADO (quadrantes, colunas, cartões), então mora em `content_json`
 * em vez de `body` — mas a regra de escolha da linha (versão do mentor vence
 * a global; sem linha, pendente ou malformado = sem seção) é a mesma.
 *
 * SÓ PARA O DISC nesta demanda (item 5) — a estrutura é genérica (poderia
 * servir Temperamentos/VAK no futuro com outro prefixo de `section`), mas
 * quem decide se a seção aparece é o CHAMADOR (`report.server.ts`), gateado
 * por `isDisc`. Este módulo não sabe nem precisa saber disso.
 *
 * REGRA DE HONESTIDADE (item 3 da demanda): ao contrário do texto do perfil
 * (#288), que mostra um AVISO no lugar quando está pendente, estas três
 * seções não mostram nada — nem aviso, nem quadrante vazio. `null` aqui
 * significa "a seção inteira não aparece", ponto. Por isso as funções
 * devolvem o tipo pronto ou `null`, nunca um estado "pendente" à parte: quem
 * lê não precisa (nem deve) diferenciar "sem linha" de "linha incompleta" —
 * as duas produzem o mesmo relatório, sem buraco visual.
 */

export type Swot = {
  forcas: string[];
  fragilidades: string[];
  oportunidades: string[];
  ameacas: string[];
};

export type GanhosPerdas = {
  mantendo: { ganha: string; perde: string };
  mudando: { ganha: string; perde: string };
  frase_que_te_segura: string;
};

export type Aplicacao = {
  situacao: string;
  automatico: string;
  tecnica: string;
};

export type OndeAparece = {
  situacoes: Aplicacao[];
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

export const SECAO_SWOT = "disc_swot";
export const SECAO_GANHOS_PERDAS = "disc_ganhos_perdas";
export const SECAO_ONDE_APARECE = "disc_onde_aparece";

/** Item 3: os quatro quadrantes precisam estar completos juntos — 3 de 4 preenchidos
 *  ainda é "pendente" pra não sair um quadrante manco no relatório. */
function swotValido(v: unknown): v is Swot {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (["forcas", "fragilidades", "oportunidades", "ameacas"] as const).every((k) =>
    listaDeTextosValida(o[k], 1),
  );
}

export function montarSwotDisc(sigla: string, versionId: string, linhas: LinhaDeConteudo[]): Swot | null {
  const json = jsonDaSigla(SECAO_SWOT, sigla, versionId, linhas);
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

export function montarGanhosPerdasDisc(sigla: string, versionId: string, linhas: LinhaDeConteudo[]): GanhosPerdas | null {
  const json = jsonDaSigla(SECAO_GANHOS_PERDAS, sigla, versionId, linhas);
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
