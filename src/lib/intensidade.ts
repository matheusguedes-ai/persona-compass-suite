/**
 * PÁGINA DE INTENSIDADE do relatório (#288, Etapa 2c) — DISC, Temperamentos e VAK.
 *
 * Função pura: recebe o resultado do motor ipsativo (`computed_scores.ipsativo`, ou o mesmo resultado
 * derivado das respostas cruas) e devolve o que a página mostra. Não recalcula nada — ranking,
 * percentuais e siglas vêm prontos do motor (docs/motor-ipsativo.md). Só sintaxe apagável do
 * TypeScript: roda no servidor e no Node dos testes.
 *
 * O desenho segue a referência que o dono do produto usa (cartão #288.3):
 *   - título "PERFIL <sigla>" com a sigla do gráfico NATURAL — uma letra quando há predominância, duas
 *     (na ordem do ranking) quando é perfil combinado; empate múltiplo não vira sigla;
 *   - DOIS gráficos separados, NATURAL e ADAPTADO, cada um com a própria sigla. Nada aqui compara um
 *     com o outro: cada gráfico traz o percentual da soma do PRÓPRIO conjunto (cada um soma 100), e os
 *     dois não estão na mesma régua (Etapa 2a);
 *   - o texto do perfil, cadastrável em `report_content` (`<instrumento>_perfil_texto`, chave = sigla).
 *     Sigla sem texto aprovado sai como PENDENTE e a tela mostra um aviso no lugar — nunca um texto
 *     inventado sobre a personalidade de alguém.
 */
import type { ResultadoIpsativo } from "@/lib/escolha-forcada";

export type LetraNaTela = {
  key: string;
  label: string;
  color: string | null;
  /** % da soma do PRÓPRIO conjunto — as letras de um gráfico somam 100. */
  percentual: number;
  /** 1..n dentro do conjunto (empate decidido pela ordem da letra no instrumento). */
  posicao: number;
  /** A letra faz parte da sigla deste gráfico. */
  na_sigla: boolean;
  /** Quantas vezes a letra foi marcada na resposta, somando MAIS e MENOS (#292). */
  sinal: number;
  /** Abaixo disto o teste não consegue posicionar a letra com segurança. */
  sinal_minimo: number;
  /** true = pouca informação: a letra continua no gráfico, mas não ocupa o título (#292). */
  pouca_informacao: boolean;
};

export type GraficoDoConjunto = {
  /**
   * `null` quando não há sigla a declarar: empate múltiplo (três ou mais letras a até 2 pontos da 1ª)
   * ou nenhuma letra com sinal suficiente (#292).
   */
  sigla: string | null;
  tipo: "predominante" | "combinado" | "sem_sinal";
  faixa: "combinado" | "moderada" | "clara" | null;
  empate_multiplo: boolean;
  /** Na ORDEM DO INSTRUMENTO (o eixo do gráfico é fixo: D, I, S, C…). */
  letras: LetraNaTela[];
};

export type TextoDoPerfil =
  { estado: "publicado"; titulo: string | null; corpo: string } | { estado: "pendente" };

export type LetraComPoucaInformacao = {
  key: string;
  label: string;
  sinal: number;
  sinal_minimo: number;
  /** A letra estava na frente do ranking e a regra a segurou fora do título. */
  fora_do_titulo: boolean;
};

export type Intensidade = {
  /** O perfil que o relatório declara: o do gráfico NATURAL, como na referência. */
  perfil: { sigla: string | null; labels: string[] };
  natural: GraficoDoConjunto;
  adaptado: GraficoDoConjunto;
  /** `null` quando não há perfil a descrever (sem sigla no natural). */
  texto: TextoDoPerfil | null;
  /** Letras que a resposta quase não tocou, para a tela explicar em português (#292). */
  sinal_baixo: LetraComPoucaInformacao[];
  /** Marcações que o teste inteiro pede: um MAIS e um MENOS por bloco. */
  marcacoes_no_teste: number;
};

export type LinhaDeTexto = {
  section: string;
  dimension_key: string;
  mode: string;
  status?: string | null;
  title: string | null;
  body: string;
  version_id: string | null;
};

export type DimensaoNaTela = { id: string; key: string; label: string; color: string | null };

/** Seção de `report_content` com o texto do perfil do instrumento. */
export function secaoDoTextoDoPerfil(instrumentId: string): string {
  return `${instrumentId}_perfil_texto`;
}

function grafico(
  ipsativo: ResultadoIpsativo,
  conjunto: "natural" | "adaptado",
  dimPorId: Map<string, DimensaoNaTela>,
): GraficoDoConjunto {
  const perfil = ipsativo[conjunto].perfil;
  const sigla = perfil.empate_multiplo || perfil.tipo === "sem_sinal" ? null : perfil.codigo;
  return {
    sigla,
    tipo: perfil.tipo,
    faixa: perfil.faixa,
    empate_multiplo: perfil.empate_multiplo,
    letras: ipsativo.letras.map((l) => {
      const dim = dimPorId.get(l.dimension_id);
      return {
        key: l.chave,
        label: dim?.label ?? l.chave,
        color: dim?.color ?? null,
        percentual: l[conjunto].percentual,
        posicao: l[conjunto].posicao,
        na_sigla: sigla !== null && perfil.chaves.includes(l.chave),
        sinal: l.sinal,
        sinal_minimo: l.sinal_minimo,
        pouca_informacao: !l.sinal_suficiente,
      };
    }),
  };
}

/**
 * Texto do perfil para a sigla: o da versão (quando o dono dela escreveu um) vence o da plataforma.
 * Sem linha, com linha pendente ou com corpo vazio → pendente.
 */
function textoDaSigla(
  sigla: string,
  args: { instrumentId: string; versionId: string; linhas: LinhaDeTexto[] },
): TextoDoPerfil {
  const secao = secaoDoTextoDoPerfil(args.instrumentId);
  const candidatas = args.linhas.filter(
    (r) => r.section === secao && r.dimension_key === sigla && r.mode === "natural",
  );
  const daVersao = candidatas.filter((r) => r.version_id === args.versionId);
  const linha = (
    daVersao.length > 0 ? daVersao : candidatas.filter((r) => r.version_id === null)
  )[0];
  if (!linha || (linha.status ?? "publicado") !== "publicado" || linha.body.trim() === "") {
    return { estado: "pendente" };
  }
  return { estado: "publicado", titulo: linha.title, corpo: linha.body };
}

export function montarIntensidade(args: {
  ipsativo: ResultadoIpsativo;
  dimensoes: DimensaoNaTela[];
  instrumentId: string;
  versionId: string;
  linhas: LinhaDeTexto[];
}): Intensidade {
  const dimPorId = new Map(args.dimensoes.map((d) => [d.id, d]));
  const labelDaChave = new Map(args.dimensoes.map((d) => [d.key, d.label]));
  const natural = grafico(args.ipsativo, "natural", dimPorId);
  const adaptado = grafico(args.ipsativo, "adaptado", dimPorId);
  // Letras que a resposta quase não tocou (#292), na ordem do instrumento.
  const seguradas = new Set([
    ...args.ipsativo.natural.perfil.fora_por_sinal,
    ...args.ipsativo.adaptado.perfil.fora_por_sinal,
  ]);
  const sinal_baixo = args.ipsativo.letras
    .filter((l) => !l.sinal_suficiente)
    .map((l) => ({
      key: l.chave,
      label: labelDaChave.get(l.chave) ?? l.chave,
      sinal: l.sinal,
      sinal_minimo: l.sinal_minimo,
      fora_do_titulo: seguradas.has(l.chave),
    }));
  return {
    perfil: {
      sigla: natural.sigla,
      labels:
        natural.sigla === null
          ? []
          : args.ipsativo.natural.perfil.chaves.map((k) => labelDaChave.get(k) ?? k),
    },
    natural,
    adaptado,
    texto: natural.sigla === null ? null : textoDaSigla(natural.sigla, args),
    sinal_baixo,
    marcacoes_no_teste: args.ipsativo.n_blocos * 2,
  };
}
