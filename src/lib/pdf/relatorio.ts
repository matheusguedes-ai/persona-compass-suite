/**
 * O RELATÓRIO COMPORTAMENTAL EM PDF (#293, fatia 1).
 *
 * Monta o documento a partir do MESMO payload que a tela recebe (`buildReport`) e dos MESMOS
 * textos fixos (`components/report/textos.ts`). Nada aqui recalcula nota, faixa ou sigla, e nada
 * aqui escreve frase que a tela não tenha: o PDF é a tela diagramada, não uma segunda versão do
 * relatório. Foi por isso que os textos saíram do JSX antes desta fatia começar.
 *
 * A ordem das seções é a de `ReportBody`, e o que o mentor escondeu nas Configurações
 * (`settings.hidden_blocks`) continua escondido aqui.
 */
import { PDFDocument, rgb, type Color, type PDFPage } from "./pdf-lib";
import type { Derived, Factor, JungPares, Report } from "@/components/report/sections";
import type { GraficoDoConjunto, Intensidade } from "@/lib/intensidade";
import type { SwotComunicador, GanhosPerdas, OndeAparece, ComunicadoresSemelhantes } from "@/lib/disc-secoes-extra";
import { JUNG_BULLETS, indexPhrase } from "@/lib/derivations";
import {
  CONFIABILIDADE,
  COMUNICACAO,
  CORPO,
  DERIVADOS,
  FACTOR_THEMES,
  FAIXA_DO_GRAFICO,
  INDICE_EM_REVISAO,
  INTENSIDADE,
  INTRO,
  JUNG,
  OBSERVADORES,
  PLANO_ACAO,
  PLANO_ACAO_GENERICO,
  RODAPE_LEGAL,
  SECTION_TITLES,
  BATERIA,
  SWOT_COMUNICADOR,
  GANHOS_PERDAS,
  ONDE_APARECE,
  COMUNICADORES_SEMELHANTES,
  avisoDeSinal,
} from "@/components/report/textos";
import {
  APOIO,
  AZUL,
  AZUL_LEVE,
  AMBAR_FUNDO,
  BRANCO,
  CARTAO,
  CIANO,
  CIANO_FUNDO,
  CIANO_TEXTO,
  ESCURO,
  FILETE,
  NOTA,
  CINZA,
  CINZA_CLARO,
  FUNDO_SUAVE,
  GRAFITE,
  PRETO,
  VERDE_FUNDO,
  VERDE_TEXTO,
  VERMELHO,
  carregarIlustracoes,
  carregarTipografia,
  corDaMarca,
  esmaecer,
  type Ilustracoes,
  type Tipografia,
} from "./marca";
import {
  MM,
  cartao,
  cartaoAplicacao,
  cartaoDoGrafico,
  cartaoQuadrante,
  colunaGanhosPerdas,
  blocoDeDestaque,
  faixaDeIndices,
  graficoDeTermometros,
  marcaDagua,
  notaDeLeitura,
  pintarCabecalho,
  pintarPilula,
  pintarRodape,
  rotuloDeSubsecao,
  seloDoPerfil,
  texturaDePontos,
  tituloDeSecao as tituloGrande,
  type Ornamento,
  type Termometro,
} from "./sistema";
import {
  A4,
  Documento,
  LARGURA_UTIL,
  MARGEM,
  caixa,
  colunas,
  desenhoLivre,
  espaco,
  imagem,
  quebraSeFaltarEspaco,
  larguraEspacada,
  limpar,
  paragrafo,
  pilha,
  pintarBarra,
  regua,
  retanguloArredondado,
  textoEspacado,
  titulo,
  type Bloco,
} from "./doc";

/** Roxo da percepção externa — o mesmo `#8b5cf6` que a tela usa nos observadores. */
const EXTERNO = rgb(0x8b / 255, 0x5c / 255, 0xf6 / 255);

export type Contexto = {
  tipo: Tipografia;
  arte: Ilustracoes;
  /** A cor que o mentor escolheu, ou o Ciano da marca. */
  marca: Color;
  /** Respostas já gravadas do plano de ação, por `q1`, `q2`… */
  plano: Record<string, string>;
  /** O que assina o rodapé de cada página. */
  assinatura: string;
};

const cor = (valor: string | null | undefined, padrao: Color) =>
  valor ? corDaMarca(valor) : padrao;

/**
 * A cor de uma dimensão no gráfico.
 *
 * O DISC tem cor cadastrada por dimensão; Temperamentos e VAK, não — e sem isso todas as colunas
 * saíam do mesmo azul, o que apaga a leitura que a proposta pede. Quando falta a cor, as colunas
 * recebem tons distribuídos entre o Cerúleo e o Ciano: continuam sendo a paleta da marca, e cada
 * uma fica distinguível da vizinha. Cadastrar as cores nas Configurações passa a valer na hora.
 */
function corDaDimensao(valor: string | null | undefined, i: number, total: number): Color {
  if (valor) return corDaMarca(valor);
  const f = total <= 1 ? 0 : i / (total - 1);
  return rgb(
    0.02 + (0.004 - 0.02) * f,
    0.37 + (0.65 - 0.37) * f,
    0.77 + (0.99 - 0.77) * f,
  );
}

const dataBR = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";

// ---------------------------------------------------------------------------------------------
// Peças reutilizadas
// ---------------------------------------------------------------------------------------------

/** Rótulo pequeno em caixa alta, o "olho" de cada seção. */
function rotulo(texto: string, t: Tipografia, c: Color, antes = 0): Bloco {
  return paragrafo(texto, t, {
    tamanho: 7.6,
    peso: "bd",
    cor: c,
    maiusculas: true,
    entreletras: 1.5,
    entrelinha: 1.3,
    antes,
  });
}

/** Selo de procedência ("Derivado do seu DISC") — a regra de honestidade do relatório. */
function selo(texto: string, t: Tipografia, antes = 6): Bloco {
  const tamanho = 7.4;
  const caixaAlta = texto.toLocaleUpperCase("pt-BR");
  const largura = larguraEspacada(caixaAlta, t.md, tamanho, 1.1) + 16;
  return desenhoLivre(
    16,
    (p, x, yTopo) => {
      retanguloArredondado(p, { x, y: yTopo - 15, largura, altura: 15, raio: 7.5, cor: FUNDO_SUAVE });
      textoEspacado(p, { texto: caixaAlta, x: x + 8, y: yTopo - 10.6, tamanho, fonte: t.md, cor: CINZA, entreletras: 1.1 });
    },
    antes,
  );
}

/** Etiqueta de canto arredondado com a sigla do perfil. */
function pastilha(texto: string, t: Tipografia, c: Color): Bloco {
  const tamanho = 11;
  const largura = larguraEspacada(texto, t.bd, tamanho, 2) + 18;
  return desenhoLivre(20, (p, x, yTopo, l) => {
    const cx0 = x + l - largura;
    retanguloArredondado(p, { x: cx0, y: yTopo - 19, largura, altura: 19, raio: 5, cor: c });
    textoEspacado(p, { texto, x: cx0 + 9, y: yTopo - 13.5, tamanho, fonte: t.bd, cor: BRANCO, entreletras: 2 });
  });
}

/**
 * Uma barra do gráfico: nome à esquerda, trilho no meio, número à direita. É bloco ATÔMICO — é
 * esta marca que impede a barra de ser cortada entre duas páginas.
 */
function barra(
  o: {
    nome: string;
    chave?: string;
    valor: number;
    cor: Color;
    t: Tipografia;
    destaque?: boolean;
    /** "Você"/"Externo"/"Natural"/"Adaptado" à esquerda do trilho. */
    serie?: string;
    marca?: string;
    antes?: number;
  },
): Bloco {
  const { t } = o;
  const temNome = o.nome !== "";
  const alturaNome = temNome ? 14 : 0;
  const alturaMarca = o.marca ? 12 : 0;
  return desenhoLivre(
    alturaNome + alturaMarca + 13,
    (p, x, yTopo, l) => {
      let y = yTopo;
      if (temNome) {
        const f = o.destaque ? t.bd : t.md;
        p.drawText(limpar(o.nome), { x, y: y - 9, size: 9.4, font: f, color: o.destaque ? PRETO : GRAFITE });
        if (o.chave) {
          p.drawText(`(${o.chave})`, {
            x: x + f.widthOfTextAtSize(limpar(o.nome), 9.4) + 4,
            y: y - 9,
            size: 7.8,
            font: t.rg,
            color: CINZA,
          });
        }
        y -= alturaNome;
      }
      if (o.marca) {
        const tam = 6.8;
        const caixaAlta = o.marca.toLocaleUpperCase("pt-BR");
        const larg = larguraEspacada(caixaAlta, t.md, tam, 1.1) + 12;
        retanguloArredondado(p, { x, y: y - 10, largura: larg, altura: 10.5, raio: 5.25, cor: FUNDO_SUAVE });
        textoEspacado(p, { texto: caixaAlta, x: x + 6, y: y - 7.2, tamanho: tam, fonte: t.md, cor: CINZA, entreletras: 1.1 });
        y -= alturaMarca;
      }
      // Trilho + preenchimento, com espaço fixo reservado para o número à direita.
      const larguraSerie = o.serie ? 40 : 0;
      if (o.serie) {
        p.drawText(o.serie.toLocaleUpperCase("pt-BR"), { x, y: y - 8.5, size: 6.6, font: t.md, color: CINZA });
      }
      const xTrilho = x + larguraSerie;
      const larguraTrilho = l - larguraSerie - 26;
      pintarBarra(p, { x: xTrilho, y: y - 11, largura: larguraTrilho, altura: 7, valor: o.valor, cor: o.cor });
      const num = String(Math.round(o.valor));
      const numL = t.md.widthOfTextAtSize(num, 8.6);
      p.drawText(num, { x: x + l - numL, y: y - 11, size: 8.6, font: t.md, color: GRAFITE });
    },
    o.antes,
  );
}

/** Um dos dois gráficos da página de intensidade, com a própria sigla (#288 Etapa 2c). */
function graficoDoConjunto(
  g: GraficoDoConjunto,
  o: { titulo: string; explica: string; externo?: Record<string, number> | null; ctx: Contexto },
): Bloco {
  const { tipo: t } = o.ctx;
  const comExterno = !!o.externo && g.letras.some((l) => o.externo![l.key] != null);
  const barras: Bloco[] = [];
  for (const l of g.letras) {
    const c = cor(l.color, o.ctx.marca);
    barras.push(
      barra({
        nome: l.label,
        chave: l.key,
        valor: l.percentual,
        cor: l.na_sigla ? c : esmaecer(c),
        t,
        destaque: l.na_sigla,
        serie: comExterno ? "Você" : undefined,
        marca: l.pouca_informacao ? INTENSIDADE.poucaInformacao : undefined,
        antes: barras.length === 0 ? 0 : 8,
      }),
    );
    if (comExterno && o.externo?.[l.key] != null) {
      barras.push(barra({ nome: "", valor: o.externo[l.key], cor: EXTERNO, t, serie: "Externo", antes: 2 }));
    }
  }
  return cartao(
    pilha([
      desenhoLivre(20, (p, x, yTopo, l) => {
        const tam = 7.6;
        textoEspacado(p, {
          texto: o.titulo.toLocaleUpperCase("pt-BR"), x, y: yTopo - 9,
          tamanho: tam, fonte: t.bd, cor: CINZA, entreletras: 1.6,
        });
        const sigla = g.sigla ?? "—";
        const larg = larguraEspacada(sigla, t.bd, 10.5, 2) + 14;
        retanguloArredondado(p, { x: x + l - larg, y: yTopo - 17, largura: larg, altura: 17, raio: 4.5, cor: FUNDO_SUAVE });
        textoEspacado(p, {
          texto: sigla, x: x + l - larg + 7, y: yTopo - 12.5,
          tamanho: 10.5, fonte: t.bd, cor: PRETO, entreletras: 2,
        });
      }),
      paragrafo(g.sigla && g.faixa ? FAIXA_DO_GRAFICO[g.faixa] : "sem predominância clara", t, {
        tamanho: 7.8,
        cor: CINZA,
        alinhamento: "direita",
      }),
      paragrafo(o.explica, t, { tamanho: 8, cor: CINZA, entrelinha: 1.5, antes: 6 }),
      pilha(barras, { antes: 12 }),
    ]),
    { padding: 14 },
  );
}

/** Caixinha com um número grande (os três índices da página de intensidade). */
function cartaoIndice(i: { label: string; value: number | null }, t: Tipografia): Bloco {
  return cartao(
    pilha([
      paragrafo(i.label, t, { tamanho: 7, peso: "md", cor: CINZA, maiusculas: true, entreletras: 1, entrelinha: 1.3 }),
      i.value == null
        ? paragrafo("Em revisão", t, { tamanho: 9.5, cor: CINZA, antes: 6 })
        : paragrafo(i.value.toFixed(2), t, { tamanho: 19, peso: "xbd", cor: PRETO, entrelinha: 1.15, antes: 4 }),
    ]),
    { padding: 12 },
  );
}

/**
 * Título das seções do corpo — a MESMA peça do título de abertura, em corpo menor.
 *
 * Reusar em vez de inventar é regra da #294: a barra Ciano sangrando e o Cerúleo são o que
 * identifica uma seção neste documento, e um segundo estilo de título diluiria isso.
 */
function tituloDeSecao(texto: string, ctx: Contexto, antes = 24): Bloco {
  return tituloGrande(texto, null, ctx.tipo, antes, 17);
}

/**
 * Parágrafos de conteúdo, um bloco cada — assim cada um parte entre páginas por conta própria.
 *
 * A quebra é a mesma da tela (`\n\n` separa parágrafo; `\n` sozinho vira espaço), e o corte vem
 * ANTES da limpeza de propósito: `limpar` apaga caracteres de controle, então um marcador
 * invisível usado como separador sumiria e os parágrafos sairiam colados ("pensou.Colérico:").
 */
function corpoTexto(texto: string, t: Tipografia, antes = 8): Bloco[] {
  return (texto ?? "")
    .split(/\n{2,}/)
    .map((par) => limpar(par))
    .filter(Boolean)
    .map((par, i) => paragrafo(par, t, { tamanho: 9.6, entrelinha: 1.55, antes: i === 0 ? antes : 7 }));
}

// ---------------------------------------------------------------------------------------------
// Capa
// ---------------------------------------------------------------------------------------------

/**
 * A CAPA como peça gráfica (#294, item 4).
 *
 * Segue as capas que o dono do produto usa nos materiais do método (pasta `capas/` do Desktop
 * dele): azul profundo ocupando a folha inteira, a marca grande como ELEMENTO — não como
 * carimbo —, o filete Ciano curto marcando o início do bloco de texto, e o nome em dois pesos,
 * leve e forte, como o "Método **Intenção**" das capas. Os dados (instrumento, data, emissor)
 * ficam pequenos e hierarquizados no pé, porque numa capa eles são legenda, não manchete.
 *
 * O degradê do fundo é feito em faixas horizontais: o pdf-lib não tem gradiente, e 120 retângulos
 * de 7pt resolvem sem imagem externa nem perda de nitidez.
 */
export function desenharCapa(
  doc: Documento,
  o: {
    pessoa: string;
    instrumento: string;
    data: string;
    /** Lista longa (os inventários de uma bateria): vai abaixo, na largura inteira. */
    detalhe?: string;
    subtitulo?: string;
    ctx: Contexto;
    marcaMentor: { nome: string | null };
  },
) {
  const p: PDFPage = doc.novaPagina(false);
  const { tipo: t, arte } = o.ctx;

  // Fundo: Cerúleo no alto à esquerda descendo para quase preto — o mesmo clima das capas do método.
  const faixas = 130;
  for (let i = 0; i < faixas; i++) {
    const f = i / (faixas - 1);
    const r = 0.012 + (0.02 - 0.012) * (1 - f);
    const g = 0.14 + (0.30 - 0.14) * (1 - f);
    const b = 0.30 + (0.62 - 0.30) * (1 - f);
    p.drawRectangle({
      x: 0,
      y: A4.altura - (A4.altura / faixas) * (i + 1),
      width: A4.largura,
      height: A4.altura / faixas + 1,
      color: rgb(r, g, b),
    });
  }
  // Um halo Ciano no canto superior esquerdo dá profundidade ao degradê.
  for (let i = 10; i >= 1; i--) {
    p.drawCircle({ x: 40, y: A4.altura - 60, size: i * 34, color: CIANO, opacity: 0.018 });
  }

  // A marca, grande, como elemento gráfico.
  const logoL = 250;
  p.drawImage(arte.logoBranca, {
    x: MARGEM.esquerda,
    y: A4.altura - 150,
    width: logoL,
    height: (arte.logoBranca.height / arte.logoBranca.width) * logoL,
  });

  // Bloco de texto, ancorado no terço inferior.
  let y = 330;
  p.drawRectangle({ x: MARGEM.esquerda, y, width: 62, height: 3, color: CIANO });

  y -= 34;
  textoEspacado(p, {
    texto: "RELATÓRIO COMPORTAMENTAL",
    x: MARGEM.esquerda,
    y,
    tamanho: 9,
    fonte: t.bd,
    cor: CIANO,
    entreletras: 2.8,
  });

  // O NOME COMPLETO, inteiro: o corpo encolhe até caber na faixa reservada, nunca o contrário.
  const nome = limpar(o.pessoa) || "Avaliado";
  const ALTURA_DO_NOME = 132;
  const quebrar = (corpo: number) => {
    const linhas: string[] = [];
    let atual = "";
    for (const palavra of nome.split(" ")) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (atual && t.lt.widthOfTextAtSize(tentativa, corpo) > LARGURA_UTIL) {
        linhas.push(atual);
        atual = palavra;
      } else atual = tentativa;
    }
    if (atual) linhas.push(atual);
    return linhas;
  };
  let corpoNome = 34;
  let linhas = quebrar(corpoNome);
  while (corpoNome > 11 && linhas.length * corpoNome * 1.18 > ALTURA_DO_NOME) {
    corpoNome -= 0.5;
    linhas = quebrar(corpoNome);
  }
  // Primeiro nome em Light, sobrenome em ExtraBold — a hierarquia das capas do método.
  y -= 16;
  linhas.forEach((linha, i) => {
    y -= corpoNome * 1.18;
    if (i === 0) {
      const espaco = linha.indexOf(" ");
      const leve = espaco > 0 ? linha.slice(0, espaco + 1) : linha;
      const forte = espaco > 0 ? linha.slice(espaco + 1) : "";
      p.drawText(leve, { x: MARGEM.esquerda, y, size: corpoNome, font: t.lt, color: BRANCO });
      if (forte) {
        p.drawText(forte, {
          x: MARGEM.esquerda + t.lt.widthOfTextAtSize(leve, corpoNome),
          y,
          size: corpoNome,
          font: t.xbd,
          color: BRANCO,
        });
      }
    } else {
      p.drawText(linha, { x: MARGEM.esquerda, y, size: corpoNome, font: t.xbd, color: BRANCO });
    }
  });

  // Legenda do pé: instrumento, data e quem emitiu — pequenos, em coluna, com filete acima.
  const yPe = 150;
  p.drawRectangle({ x: MARGEM.esquerda, y: yPe + 46, width: LARGURA_UTIL, height: 0.7, color: BRANCO, opacity: 0.18 });
  /**
   * Um campo da legenda: rótulo em Ciano e valor em branco, QUEBRANDO DENTRO da própria coluna.
   *
   * ⚠️ Antes o valor era uma linha só que encolhia até 7pt e, não cabendo, seguia em frente e
   * atravessava a coluna vizinha: a lista de inventários de uma bateria passava por cima da data
   * e as duas ficavam ilegíveis. Agora o texto quebra em linhas dentro da largura recebida, e a
   * função devolve quantas linhas usou — quem chama posiciona o que vem abaixo a partir disso.
   */
  const campo = (rotuloTexto: string, valor: string, x: number, largura: number, corpo = 11) => {
    textoEspacado(p, {
      texto: rotuloTexto,
      x,
      y: yPe + 26,
      tamanho: 6.8,
      fonte: t.bd,
      cor: CIANO,
      entreletras: 1.6,
    });
    const palavras = limpar(valor).split(" ");
    const linhas: string[] = [];
    let atual = "";
    for (const palavra of palavras) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (atual && t.md.widthOfTextAtSize(tentativa, corpo) > largura) {
        linhas.push(atual);
        atual = palavra;
      } else atual = tentativa;
    }
    if (atual) linhas.push(atual);
    linhas.forEach((linha, i) => {
      p.drawText(linha, { x, y: yPe + 6 - i * corpo * 1.3, size: corpo, font: t.md, color: BRANCO });
    });
    return linhas.length;
  };

  const instrumento = limpar(o.instrumento) || "—";
  campo("DATA DE REALIZAÇÃO", o.data, MARGEM.esquerda + LARGURA_UTIL * 0.6, LARGURA_UTIL * 0.4);
  const linhasInstrumento = campo("INSTRUMENTO", instrumento, MARGEM.esquerda, LARGURA_UTIL * 0.6 - 18);

  // A lista de inventários de uma bateria é longa e fica ABAIXO dos dois campos, na largura
  // inteira — não espremida na coluna da esquerda, onde não cabe com mais de dois títulos.
  let yAbaixo = yPe + 6 - linhasInstrumento * 11 * 1.3 - 8;
  if (o.detalhe) {
    const palavras = limpar(o.detalhe).split(" ");
    const linhas: string[] = [];
    let atual = "";
    for (const palavra of palavras) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (atual && t.rg.widthOfTextAtSize(tentativa, 8.4) > LARGURA_UTIL) {
        linhas.push(atual);
        atual = palavra;
      } else atual = tentativa;
    }
    if (atual) linhas.push(atual);
    for (const linha of linhas) {
      p.drawText(linha, { x: MARGEM.esquerda, y: yAbaixo, size: 8.4, font: t.rg, color: rgb(0.72, 0.8, 0.9) });
      yAbaixo -= 8.4 * 1.4;
    }
    yAbaixo -= 4;
  }
  if (o.subtitulo) {
    p.drawText(limpar(o.subtitulo), {
      x: MARGEM.esquerda,
      y: yAbaixo,
      size: 8.4,
      font: t.rg,
      color: rgb(0.72, 0.8, 0.9),
    });
  }

  const emissor = o.marcaMentor.nome?.trim();
  if (emissor) {
    textoEspacado(p, {
      texto: `EMITIDO POR ${limpar(emissor)}`,
      x: MARGEM.esquerda,
      y: 62,
      tamanho: 7,
      fonte: t.md,
      cor: rgb(0.62, 0.72, 0.85),
      entreletras: 1.2,
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Corpo — a mesma ordem de ReportBody
// ---------------------------------------------------------------------------------------------

/**
 * A PÁGINA DE INTENSIDADE, no sistema visual aprovado (#294).
 *
 * É a página de referência do sistema: título de duas linhas com a barra Ciano sangrando, o selo
 * escuro do perfil e os índices num cartão, os dois conjuntos em cartões próprios com termômetros,
 * a nota de leitura e o texto do perfil. Todas as peças vêm de `sistema.ts` — nada aqui desenha
 * retângulo na mão.
 *
 * O conteúdo é o mesmo de antes: mesmos números, mesmas frases, mesmas regras de honestidade.
 */
function blocosDaIntensidade(r: Report, ints: Intensidade, mostrarIndices: boolean, ctx: Contexto): Bloco[] {
  const t = ctx.tipo;
  const { perfil, natural, adaptado, texto } = ints;
  const indices = mostrarIndices
    ? (["positividade", "estima", "flexibilidade"]
        .map((k) => r.derived?.indices.find((i) => i.key === k))
        .filter(Boolean) as Derived["indices"])
    : [];
  const ext = r.external ?? null;

  /** Uma coluna por letra, na ordem do instrumento. */
  const termometros = (g: GraficoDoConjunto, comExterno: boolean): Termometro[] =>
    g.letras.map((l, i) => {
      const c = corDaDimensao(l.color, i, g.letras.length);
      return {
        chave: l.key,
        valor: l.percentual,
        cor: l.na_sigla ? c : esmaecer(c, 0.62),
        marca: l.pouca_informacao ? INTENSIDADE.poucaInformacao : null,
        externo: comExterno ? (ext?.scores[l.key] ?? null) : null,
        corExterno: EXTERNO,
      };
    });

  // A página de intensidade é uma peça só — título, selo, gráficos e nota juntos, como na
  // proposta aprovada. Ela pede folha nova, mas só quando o que resta na atual não a comporta:
  // quebrar sempre deixava a abertura de cada parte da bateria sozinha numa página em branco.
  const out: Bloco[] = [tituloGrande("Intensidade", "do perfil", t, 0)];

  // Cartão do topo: o selo do perfil e os três índices.
  const topo: Bloco[] = [];
  if (perfil.sigla) {
    topo.push(seloDoPerfil(perfil.sigla, t));
    if (perfil.labels.length > 0) {
      topo.push(paragrafo(perfil.labels.join("  ·  "), t, { tamanho: 9, cor: APOIO, antes: 10 }));
    }
  } else {
    topo.push(
      paragrafo(INTENSIDADE.semPredominancia, t, { tamanho: 15, peso: "bd", cor: ESCURO, entrelinha: 1.2 }),
    );
    topo.push(
      paragrafo(natural.tipo === "sem_sinal" ? INTENSIDADE.semSinal : INTENSIDADE.empateMultiplo, t, {
        tamanho: 9.2,
        cor: GRAFITE,
        entrelinha: 1.55,
        antes: 8,
      }),
    );
  }
  if (indices.length > 0) {
    topo.push(
      faixaDeIndices(
        indices.map((i) => ({ label: i.label, valor: i.value == null ? "—" : i.value.toFixed(2) })),
        t,
        16,
      ),
    );
    topo.push(
      paragrafo(
        INTENSIDADE.indicesRodape + (indices.some((i) => i.value == null) ? INTENSIDADE.indicesEmRevisao : ""),
        t,
        { tamanho: 7.6, cor: APOIO, entrelinha: 1.45, antes: 8 },
      ),
    );
  }
  out.push(cartao(pilha(topo), { antes: 16 }));

  // Os dois conjuntos, cada um no seu cartão, lado a lado.
  out.push(
    colunas(
      [
        cartaoDoGrafico({
          rotulo: INTENSIDADE.naturalTitulo,
          sigla: natural.sigla,
          explica: INTENSIDADE.naturalExplica,
          itens: termometros(natural, false),
          cor: AZUL,
          tipo: t,
        }),
        cartaoDoGrafico({
          rotulo: INTENSIDADE.adaptadoTitulo,
          sigla: adaptado.sigla,
          explica: INTENSIDADE.adaptadoExplica,
          itens: termometros(adaptado, true),
          // O Ciano puro não sustenta texto branco em cima: a pílula e o círculo usam o tom fechado.
          cor: CIANO_FUNDO,
          tipo: t,
        }),
      ],
      { vao: 14, antes: 12 },
    ),
  );

  const notaFinalDaIntensidade = notaDeLeitura(INTENSIDADE.reguasTitulo, INTENSIDADE.reguasSeparadas, t, 12);
  out.push(notaFinalDaIntensidade);

  if (ints.sinal_baixo.length > 0) {
    out.push(
      notaDeLeitura(
        INTENSIDADE.poucaInformacaoTitulo,
        avisoDeSinal(ints.sinal_baixo, ints.marcacoes_no_teste),
        t,
        12,
      ),
    );
  }
  if (ext) {
    out.push(
      paragrafo(
        `Percepção externa (o traço roxo no gráfico adaptado) baseada em ${ext.count} observador(es)` +
          (ext.respondents.length > 0 ? `: ${ext.respondents.join(", ")}` : "") + ".",
        t,
        { tamanho: 7.8, cor: APOIO, antes: 10 },
      ),
    );
  }

  if (texto && perfil.sigla) {
    out.push(rotuloDeSubsecao("O que este perfil diz", t, 26));
    if (texto.estado === "publicado") {
      if (texto.titulo) {
        out.push(paragrafo(texto.titulo, t, { tamanho: 11, peso: "bd", cor: ESCURO, antes: 12 }));
      }
      out.push(...corpoTexto(texto.corpo, t, texto.titulo ? 6 : 12));
    } else {
      out.push(
        cartao(paragrafo(INTENSIDADE.textoPendente, t, { tamanho: 9.4, cor: GRAFITE, entrelinha: 1.55 }), {
          antes: 12,
          padding: 14,
        }),
      );
    }
  }
  if (r.is_disc === false) {
    out.push(paragrafo(INTENSIDADE.leiturasDoAdaptado, t, { tamanho: 8, cor: APOIO, entrelinha: 1.5, antes: 18 }));
  }

  // A página de intensidade é uma peça só — título, selo, gráficos e nota juntos, como na proposta
  // aprovada. Ela pede folha nova, mas só quando o que resta na atual NÃO A COMPORTA: pedir folha
  // sempre deixava a abertura de cada parte da bateria sozinha, com três linhas no alto e o resto
  // branco. O mínimo é a altura real do bloco visual (até a nota de leitura), medida aqui — um
  // número fixo erraria para mais ou para menos conforme o instrumento.
  const ateANota = out.slice(0, out.findIndex((b) => b === notaFinalDaIntensidade) + 1 || undefined);
  const alturaDaPeca = ateANota.reduce((soma, b) => soma + (b.antes ?? 0) + b.altura(LARGURA_UTIL), 0);
  return [quebraSeFaltarEspaco(alturaDaPeca), ...out];
}

/**
 * Cada seção extra do DISC (#302) é uma peça só — igual à intensidade: título grande, o conteúdo,
 * e uma quebra que só pede folha nova quando o que resta na página atual não a comporta.
 */
function pecaComQuebra(blocos: Bloco[]): Bloco[] {
  const altura = blocos.reduce((soma, b) => soma + (b.antes ?? 0) + b.altura(LARGURA_UTIL), 0);
  return [quebraSeFaltarEspaco(altura), ...blocos];
}

/** Matriz SWOT do Comunicador (#302) — quatro quadrantes coloridos e a nota de como ler. */
function blocosDoSwotComunicador(swot: SwotComunicador, ctx: Contexto): Bloco[] {
  const t = ctx.tipo;
  const S = SWOT_COMUNICADOR;
  return pecaComQuebra([
    tituloGrande(S.titulo1, S.titulo2, t, 0),
    colunas(
      [
        cartaoQuadrante({ rotulo: S.forcasRotulo, subtitulo: S.forcasSubtitulo, itens: swot.forcas, cor: VERDE_FUNDO, tipo: t }),
        cartaoQuadrante({ rotulo: S.fragilidadesRotulo, subtitulo: S.fragilidadesSubtitulo, itens: swot.fragilidades, cor: VERMELHO, tipo: t }),
      ],
      { vao: 14, antes: 18 },
    ),
    colunas(
      [
        cartaoQuadrante({ rotulo: S.oportunidadesRotulo, subtitulo: S.oportunidadesSubtitulo, itens: swot.oportunidades, cor: AZUL, tipo: t }),
        cartaoQuadrante({ rotulo: S.ameacasRotulo, subtitulo: S.ameacasSubtitulo, itens: swot.ameacas, cor: AMBAR_FUNDO, tipo: t }),
      ],
      { vao: 14, antes: 14 },
    ),
    notaDeLeitura(S.comoLerTitulo, S.comoLerTexto, t, 16),
  ]);
}

/** Ganhos e Perdas (#302) — duas colunas confrontadas e o bloco escuro da frase que segura. */
function blocosDeGanhosPerdas(gp: GanhosPerdas, ctx: Contexto): Bloco[] {
  const t = ctx.tipo;
  const G = GANHOS_PERDAS;
  return pecaComQuebra([
    tituloGrande(G.titulo1, G.titulo2, t, 0),
    paragrafo(G.abertura, t, { tamanho: 9.6, cor: GRAFITE, entrelinha: 1.55, antes: 10 }),
    colunas(
      [
        colunaGanhosPerdas({
          rotulo: G.mantendoRotulo, cor: VERDE_FUNDO, corTexto: VERDE_TEXTO,
          ganha: gp.mantendo.ganha, perde: gp.mantendo.perde, tipo: t,
        }),
        colunaGanhosPerdas({
          rotulo: G.mudandoRotulo, cor: AZUL, corTexto: AZUL,
          ganha: gp.mudando.ganha, perde: gp.mudando.perde, tipo: t,
        }),
      ],
      { vao: 14, antes: 16 },
    ),
    blocoDeDestaque(G.fraseQueTeSeguraTitulo, gp.frase_que_te_segura, t, 16),
  ]);
}

/** Onde Isso Aparece (#302) — cartões de aplicação prática, dois por linha. */
function blocosDeOndeAparece(oa: OndeAparece, ctx: Contexto): Bloco[] {
  const t = ctx.tipo;
  const O = ONDE_APARECE;
  const out: Bloco[] = [
    tituloGrande(O.titulo1, O.titulo2, t, 0),
    paragrafo(O.abertura, t, { tamanho: 9.6, cor: GRAFITE, entrelinha: 1.55, antes: 10 }),
  ];
  for (let i = 0; i < oa.situacoes.length; i += 2) {
    const par = oa.situacoes.slice(i, i + 2).map((s) =>
      cartaoAplicacao({ situacao: s.situacao, automatico: s.automatico, tecnica: s.tecnica, cor: AZUL, tipo: t }),
    );
    out.push(colunas(par.length === 2 ? par : [par[0], espaco(0)], { vao: 14, antes: i === 0 ? 16 : 14 }));
  }
  return pecaComQuebra(out);
}

/**
 * Comunicadores com Traços Semelhantes (#302, item (a) — entrou junto com o conteúdo do perfil
 * D). A ressalva SEMPRE aparece: sem ela o relatório estaria descrevendo o perfil de gente real
 * que nunca respondeu ao inventário.
 */
function blocosDeComunicadoresSemelhantes(cs: ComunicadoresSemelhantes, ctx: Contexto): Bloco[] {
  const t = ctx.tipo;
  const C = COMUNICADORES_SEMELHANTES;
  const lista = cs.pessoas.map((p, i) =>
    paragrafo([{ texto: `${p.nome} — `, forte: true }, { texto: p.descricao }], t, {
      tamanho: 9.6, entrelinha: 1.5, antes: i === 0 ? 14 : 10,
    }),
  );
  return pecaComQuebra([
    tituloGrande(C.titulo1, C.titulo2, t, 0),
    paragrafo(C.abertura, t, { tamanho: 9.6, cor: GRAFITE, entrelinha: 1.55, antes: 10 }),
    ...lista,
    notaDeLeitura(C.ressalvaTitulo, C.ressalva, t, 18),
  ]);
}

function blocosDosEixos(jung: { tipo: string; pares: JungPares }, doTeste: boolean, ctx: Contexto): Bloco[] {
  const t = ctx.tipo;
  const indeciso = (p: JungPares[number]) => Math.max(p.leftPct, p.rightPct) < 55;
  const noMuro = jung.pares.filter(indeciso).length;
  const siglaVale = noMuro < 2;
  const out: Bloco[] = [
    tituloDeSecao(JUNG.titulo, ctx),
    siglaVale ? pastilha(jung.tipo, t, ctx.marca) : paragrafo(JUNG.semSigla, t, { tamanho: 8.4, cor: CINZA, alinhamento: "direita" }),
    selo(doTeste ? JUNG.seloTeste : JUNG.seloDisc, t, 4),
    paragrafo(doTeste ? JUNG.introTeste : JUNG.introDisc, t, { tamanho: 9.6, entrelinha: 1.55, antes: 10 }),
  ];
  if (!doTeste) out.push(paragrafo(JUNG.ressalvaDisc, t, { tamanho: 9.6, entrelinha: 1.55, antes: 7 }));
  if (!siglaVale) out.push(paragrafo(JUNG.noMuro(noMuro), t, { tamanho: 9.6, entrelinha: 1.55, antes: 7 }));

  for (const par of jung.pares) {
    const partes: Bloco[] = [
      desenhoLivre(30, (p, x, yTopo, l) => {
        const esq = `${par.left} ${Math.round(par.leftPct)}%`;
        const dir = `${Math.round(par.rightPct)}% ${par.right}`;
        p.drawText(esq, {
          x,
          y: yTopo - 9,
          size: 9.4,
          font: par.preferred === par.left ? t.bd : t.rg,
          color: par.preferred === par.left ? PRETO : CINZA,
        });
        const fDir = par.preferred === par.right ? t.bd : t.rg;
        p.drawText(dir, {
          x: x + l - fDir.widthOfTextAtSize(dir, 9.4),
          y: yTopo - 9,
          size: 9.4,
          font: fDir,
          color: par.preferred === par.right ? PRETO : CINZA,
        });
        // Barra dividida: os dois polos somam 100 e dividem o mesmo trilho.
        const y = yTopo - 26;
        const wEsq = (l * Math.max(0, Math.min(100, par.leftPct))) / 100;
        retanguloArredondado(p, { x, y, largura: l, altura: 8, raio: 4, cor: CINZA_CLARO });
        if (wEsq > 1) retanguloArredondado(p, { x, y, largura: Math.max(8, wEsq), altura: 8, raio: 4, cor: ctx.marca });
      }, 14),
    ];
    if (indeciso(par)) {
      partes.push(paragrafo(JUNG.eixoEmpatado, t, { tamanho: 9.4, entrelinha: 1.55, antes: 8 }));
    } else {
      for (const b of JUNG_BULLETS[par.preferred] ?? []) {
        partes.push(paragrafo(`•  ${b}`, t, { tamanho: 9.4, entrelinha: 1.5, antes: 5 }));
      }
    }
    out.push(pilha(partes, { atomico: false, antes: 6 }));
  }
  return out;
}

function blocosDerivados(d: Derived, mbtiReal: { tipo: string; pares: JungPares } | null, graficoAdaptado: boolean, ctx: Contexto): Bloco[] {
  const t = ctx.tipo;
  const jung = mbtiReal ?? d.jung;
  const seloTexto = graficoAdaptado ? DERIVADOS.seloAdaptado : DERIVADOS.selo;
  const umaSerie = d.competencias.every((c) => c.adaptado == null);
  const out: Bloco[] = [...blocosDosEixos(jung, !!mbtiReal, ctx)];

  // Estilo de liderança
  out.push(tituloDeSecao(DERIVADOS.liderancaTitulo, ctx));
  out.push(
    paragrafo([{ texto: "Dominante: " }, { texto: `${d.dominant.label} (${Math.round(d.dominant.pct)}%)`, forte: true }], t, {
      tamanho: 9.4,
      cor: CINZA,
      antes: 2,
    }),
  );
  out.push(selo(seloTexto, t, 6));
  out.push(
    pilha(
      d.leadership.map((sEstilo, i) =>
        barra({
          nome: sEstilo.label,
          valor: sEstilo.pct,
          cor: sEstilo.key === d.dominant.key ? ctx.marca : esmaecer(ctx.marca),
          t,
          destaque: sEstilo.key === d.dominant.key,
          antes: i === 0 ? 0 : 8,
        }),
      ),
      { antes: 14 },
    ),
  );
  const fortes = d.leadership_content.strengths;
  const atencao = d.leadership_content.attention;
  if (fortes || atencao) {
    const cartaoDeLideranca = (c: { title: string | null; body: string } | null, padraoTitulo: string) =>
      c
        ? cartao(
            pilha([
              paragrafo(c.title ?? padraoTitulo, t, { tamanho: 9.4, peso: "md", cor: PRETO }),
              ...corpoTexto(c.body, t, 5),
            ]),
            { padding: 13 },
          )
        : espaco(0);
    out.push(
      colunas(
        [cartaoDeLideranca(fortes, DERIVADOS.pontosFortes), cartaoDeLideranca(atencao, DERIVADOS.pontosAtencao)],
        { vao: 14, antes: 16 },
      ),
    );
  }

  // Mapa de competências
  out.push(tituloDeSecao(DERIVADOS.competenciasTitulo, ctx));
  out.push(selo(seloTexto, t, 4));
  out.push(
    paragrafo(umaSerie ? DERIVADOS.competenciasUmaSerie : DERIVADOS.competenciasDuasSeries, t, {
      tamanho: 9.4,
      cor: CINZA,
      entrelinha: 1.5,
      antes: 8,
    }),
  );
  for (const c of d.competencias) {
    const numeros = umaSerie
      ? `${Math.round(c.natural)} · ${c.band}`
      : `natural ${Math.round(c.natural)} · adaptado ${Math.round(c.adaptado ?? 0)} · ${c.band}`;
    out.push(
      pilha(
        [
          desenhoLivre(14, (p, x, yTopo, l) => {
            p.drawText(limpar(c.name), { x, y: yTopo - 9, size: 9.4, font: t.md, color: PRETO });
            const nl = t.rg.widthOfTextAtSize(numeros, 7.8);
            p.drawText(numeros, { x: x + l - nl, y: yTopo - 9, size: 7.8, font: t.rg, color: CINZA });
          }),
          barra({ nome: "", valor: c.natural, cor: ctx.marca, t, serie: umaSerie ? "Adaptado" : "Natural", antes: 1 }),
          ...(umaSerie ? [] : [barra({ nome: "", valor: c.adaptado ?? 0, cor: esmaecer(ctx.marca), t, serie: "Adaptado", antes: 2 })]),
          paragrafo(c.definition, t, { tamanho: 8, cor: CINZA, entrelinha: 1.5, antes: 4 }),
        ],
        { antes: 12 },
      ),
    );
  }

  // Índices comportamentais
  out.push(tituloDeSecao(DERIVADOS.indicesTitulo, ctx));
  out.push(selo(seloTexto, t, 4));
  out.push(paragrafo(DERIVADOS.indicesIntro, t, { tamanho: 9.4, cor: CINZA, antes: 8 }));
  const cartoes = d.indices.map((i) =>
    cartao(
      pilha([
        desenhoLivre(20, (p, x, yTopo, l) => {
          p.drawText(limpar(i.label), { x, y: yTopo - 10, size: 9.4, font: t.bd, color: PRETO });
          if (i.value != null) {
            const v = i.value.toFixed(2);
            const vl = t.xbd.widthOfTextAtSize(v, 17);
            p.drawText(v, { x: x + l - vl, y: yTopo - 14, size: 17, font: t.xbd, color: PRETO });
          }
        }),
        i.value == null
          ? paragrafo(INDICE_EM_REVISAO, t, { tamanho: 9, entrelinha: 1.5, antes: 4 })
          : pilha(
              [
                barra({ nome: "", valor: i.value * 100, cor: ctx.marca, t }),
                paragrafo(indexPhrase(i.key, i.value), t, { tamanho: 9, entrelinha: 1.5, antes: 4 }),
              ],
              { antes: 2 },
            ),
      ]),
      { padding: 13 },
    ),
  );
  for (let i = 0; i < cartoes.length; i += 2) {
    out.push(colunas(cartoes.slice(i, i + 2).concat(cartoes.length - i === 1 ? [espaco(0)] : []), { vao: 14, antes: 12 }));
  }
  return out;
}

/** O corpo completo de UM teste, na ordem de `ReportBody`. */
export function blocosDoRelatorio(
  r: Report,
  ctx: Contexto,
  o: { mbtiReal?: { tipo: string; pares: JungPares } | null; comIntro?: boolean } = {},
): Bloco[] {
  const t = ctx.tipo;
  const isDisc = r.is_disc !== false;
  const oculto = r.settings?.hidden_blocks ?? [];
  const mostrar = (b: string) => !oculto.includes(b);
  const ranked = [...r.factors].sort((a, b) => b.natural_norm - a.natural_norm);
  const out: Bloco[] = [];

  if (o.comIntro !== false) {
    const paragrafos = r.is_mbti
      ? INTRO.mbti
      : isDisc
        ? [...INTRO.disc, r.intensidade ? INTRO.discIpsativo : INTRO.discClassico]
        : INTRO.dimensional;
    out.push(tituloDeSecao(INTRO.titulo, ctx, 0));
    paragrafos.forEach((par, i) => out.push(paragrafo(par, t, { tamanho: 9.6, entrelinha: 1.55, antes: i === 0 ? 10 : 7 })));
  }

  // --- fatores -------------------------------------------------------------------------------
  if (mostrar("fatores")) {
    if (r.intensidade) {
      out.push(...blocosDaIntensidade(r, r.intensidade, mostrar("derivados") && isDisc && !!r.derived, ctx));
    } else if (isDisc) {
      out.push(tituloDeSecao(CORPO.naturalAdaptado, ctx));
      out.push(
        r.perfil_indefinido
          ? paragrafo(CORPO.semPredominancia, t, { tamanho: 9.4, cor: CINZA, antes: 2 })
          : paragrafo(
              [
                { texto: "Perfil composto: " },
                { texto: r.profile ?? "—", forte: true },
                { texto: r.profile_labels.length > 0 ? ` · ${r.profile_labels.join(" + ")}` : "" },
              ],
              t,
              { tamanho: 9.4, cor: CINZA, antes: 2 },
            ),
      );
      for (const f of r.factors) {
        const c = cor(f.color, ctx.marca);
        const ext = r.external?.scores[f.key];
        out.push(
          pilha(
            [
              desenhoLivre(14, (p, x, yTopo, l) => {
                p.drawText(limpar(f.label), { x, y: yTopo - 9, size: 9.4, font: t.md, color: PRETO });
                p.drawText(`(${f.key})`, {
                  x: x + t.md.widthOfTextAtSize(limpar(f.label), 9.4) + 4,
                  y: yTopo - 9,
                  size: 7.8,
                  font: t.rg,
                  color: CINZA,
                });
                const nums =
                  `natural ${Math.round(f.natural_norm)} · adaptado ${Math.round(f.adaptado_norm ?? 0)}` +
                  (ext != null ? ` · externo ${Math.round(ext)}` : "");
                const nl = t.rg.widthOfTextAtSize(nums, 7.8);
                p.drawText(nums, { x: x + l - nl, y: yTopo - 9, size: 7.8, font: t.rg, color: CINZA });
              }),
              barra({ nome: "", valor: f.natural_norm, cor: c, t, serie: "Natural", antes: 1 }),
              barra({ nome: "", valor: f.adaptado_norm ?? 0, cor: esmaecer(c), t, serie: "Adaptado", antes: 2 }),
              ...(ext != null ? [barra({ nome: "", valor: ext, cor: EXTERNO, t, serie: "Externo", antes: 2 })] : []),
            ],
            { antes: 12 },
          ),
        );
      }
      if (r.external) {
        out.push(
          paragrafo(
            `Percepção externa baseada em ${r.external.count} observador(es)` +
              (r.external.respondents.length > 0 ? `: ${r.external.respondents.join(", ")}` : "") + ".",
            t,
            { tamanho: 7.8, cor: CINZA, antes: 10 },
          ),
        );
      }
    } else if (r.is_mbti && r.mbti) {
      out.push(...blocosDosEixos(r.mbti, true, ctx));
    } else {
      out.push(tituloDeSecao(CORPO.intensidadePorDimensao, ctx));
      out.push(paragrafo(CORPO.intensidadeIntro, t, { tamanho: 9.4, cor: CINZA, antes: 4 }));
      for (const f of ranked) {
        const ext = r.external?.scores[f.key];
        if (f.has_data === false) {
          out.push(
            pilha(
              [
                paragrafo(`${f.label} (${f.key})`, t, { tamanho: 9.4, peso: "md", cor: PRETO }),
                paragrafo(CORPO.naoMedida, t, { tamanho: 8, cor: CINZA, antes: 3 }),
              ],
              { antes: 10 },
            ),
          );
          continue;
        }
        out.push(
          pilha(
            [
              barra({ nome: f.label, chave: f.key, valor: f.natural_norm, cor: cor(f.color, ctx.marca), t, destaque: true, serie: ext != null ? "Resultado" : undefined }),
              ...(ext != null ? [barra({ nome: "", valor: ext, cor: EXTERNO, t, serie: "Externo", antes: 2 })] : []),
            ],
            { antes: 10 },
          ),
        );
      }
    }
  }

  // --- seções extras do DISC (#302): SWOT do Comunicador, Ganhos e Perdas, Onde Isso
  // Aparece, Comunicadores com Traços Semelhantes — só aparecem quando a sigla tem o
  // conteúdo cadastrado (chave ausente no payload), e só no DISC (item 5 da demanda). ---
  if (r.swot_comunicador) out.push(...blocosDoSwotComunicador(r.swot_comunicador, ctx));
  if (r.ganhos_perdas) out.push(...blocosDeGanhosPerdas(r.ganhos_perdas, ctx));
  if (r.onde_aparece) out.push(...blocosDeOndeAparece(r.onde_aparece, ctx));
  if (r.comunicadores_semelhantes) out.push(...blocosDeComunicadoresSemelhantes(r.comunicadores_semelhantes, ctx));

  // --- leitura de cada dimensão (não-DISC) ---------------------------------------------------
  if (mostrar("fatores") && !isDisc && ranked.some((f) => f.band_natural)) {
    out.push(tituloDeSecao(CORPO.leituraDimensoes, ctx));
    for (const f of ranked.filter((x) => x.has_data !== false)) {
      out.push(
        cartao(
          pilha([
            desenhoLivre(14, (p, x, yTopo, l) => {
              p.drawCircle({ x: x + 3, y: yTopo - 6, size: 3, color: corDaDimensao(f.color, ranked.indexOf(f), ranked.length) });
              p.drawText(limpar(f.label), { x: x + 11, y: yTopo - 9, size: 9.4, font: t.bd, color: PRETO });
              const nums = `${Math.round(f.natural_norm)} · ${f.band_natural?.title ?? CORPO.semFaixa}`;
              const nl = t.rg.widthOfTextAtSize(nums, 7.8);
              p.drawText(nums, { x: x + l - nl, y: yTopo - 9, size: 7.8, font: t.rg, color: CINZA });
            }),
            ...(f.band_natural?.description ? corpoTexto(f.band_natural.description, t, 6) : []),
          ]),
          { padding: 13, antes: 10 },
        ),
      );
    }
  }

  // --- observadores --------------------------------------------------------------------------
  if (mostrar("observadores") && r.external) {
    const ext = r.external;
    out.push(tituloDeSecao(OBSERVADORES.titulo, ctx));
    out.push(
      paragrafo(
        `Média das respostas de ${ext.count} observador(es) comparada à sua autoimagem.`,
        t,
        { tamanho: 9.4, cor: CINZA, antes: 6 },
      ),
    );
    const comIntensidade = !!r.intensidade;
    const cabecalhos = comIntensidade
      ? ["Fator", "Você (adaptado)", "Externo", "Diferença"]
      : ["Fator", "Natural", "Adaptado", "Externo", "Diferença"];
    const linhas = r.factors.map((f) => {
      const e = ext.scores[f.key];
      const dif = e == null ? null : Math.round(e - f.natural_norm);
      return comIntensidade
        ? [`${f.label} (${f.key})`, String(Math.round(f.natural_norm)), e == null ? "—" : String(Math.round(e)), dif == null ? "—" : `${dif > 0 ? "+" : ""}${dif}`]
        : [
            `${f.label} (${f.key})`,
            String(Math.round(f.natural_norm)),
            String(Math.round(f.adaptado_norm ?? 0)),
            e == null ? "—" : String(Math.round(e)),
            dif == null ? "—" : `${dif > 0 ? "+" : ""}${dif}`,
          ];
    });
    out.push(tabela(cabecalhos, linhas, t, 14));
    OBSERVADORES.paragrafos(comIntensidade).forEach((par, i) =>
      out.push(paragrafo(par, t, { tamanho: 9.4, entrelinha: 1.55, antes: i === 0 ? 12 : 7 })),
    );
  }

  // --- narrativas ----------------------------------------------------------------------------
  if (mostrar("narrativas")) {
    for (const s of r.sections) {
      out.push(tituloDeSecao(s.title ?? SECTION_TITLES[s.section] ?? s.section, ctx));
      out.push(...corpoTexto(s.body, t, 10));
    }
  }

  // --- temas por fator (DISC) ----------------------------------------------------------------
  if (mostrar("narrativas") && isDisc) {
    const porChave = new Map(r.factors.map((f) => [f.key, f]));
    for (const tema of FACTOR_THEMES) {
      const f = porChave.get(tema.key);
      if (!f) continue;
      out.push(tituloDeSecao(tema.title, ctx));
      if (r.intensidade) out.push(paragrafo(CORPO.leituraDoAdaptado, t, { tamanho: 8, cor: CINZA, antes: 4 }));
      const c = cor(f.color, ctx.marca);
      out.push(
        r.intensidade
          ? barra({ nome: "", valor: f.natural_norm, cor: c, t, serie: "Adaptado", antes: 10 })
          : pilha(
              [
                barra({ nome: "", valor: f.natural_norm, cor: c, t, serie: "Natural" }),
                barra({ nome: "", valor: f.adaptado_norm ?? 0, cor: esmaecer(c), t, serie: "Adaptado", antes: 2 }),
              ],
              { antes: 10 },
            ),
      );
      if (f.band_natural) {
        out.push(paragrafo(f.band_natural.title, t, { tamanho: 9.6, peso: "md", cor: PRETO, antes: 12 }));
        if (f.band_natural.description) out.push(...corpoTexto(f.band_natural.description, t, 5));
      }
      if (f.adaptacao) {
        out.push(
          cartao(
            pilha([
              rotulo(
                `${f.adaptacao.title ?? (f.gap_mode === "gap_up" ? CORPO.elevou : CORPO.conteve)} (${(f.gap ?? 0) > 0 ? "+" : ""}${f.gap ?? 0} pontos)`,
                t,
                CINZA,
              ),
              ...corpoTexto(f.adaptacao.body, t, 6),
            ]),
            { padding: 13, antes: 12 },
          ),
        );
      }
    }
  }

  // --- régua de descritores (DISC) -----------------------------------------------------------
  if (mostrar("narrativas") && isDisc && r.factors.some((f) => f.descritores.length > 0)) {
    out.push(tituloDeSecao(CORPO.reguaTitulo, ctx));
    out.push(
      paragrafo(r.intensidade ? CORPO.reguaAdaptado : CORPO.reguaNatural, t, {
        tamanho: 9.4,
        cor: CINZA,
        entrelinha: 1.5,
        antes: 4,
      }),
    );
    const colunasFator = r.factors.map((f) =>
      pilha(
        [
          desenhoLivre(14, (p, x, yTopo) => {
            p.drawCircle({ x: x + 3, y: yTopo - 6, size: 3, color: corDaDimensao(f.color, ranked.indexOf(f), ranked.length) });
            p.drawText(limpar(f.label), { x: x + 11, y: yTopo - 9, size: 9.2, font: t.md, color: PRETO });
          }),
          ...f.descritores.map((d) => {
            const faixa = d.band_min != null && d.band_max != null ? `${Math.round(d.band_min)}–${Math.round(d.band_max)}` : "";
            const corpoBloco = paragrafo(
              faixa ? [{ texto: d.body }, { texto: `  ${faixa}` }] : d.body,
              t,
              { tamanho: 8.4, entrelinha: 1.45, peso: d.active ? "md" : "rg", cor: d.active ? PRETO : CINZA },
            );
            return d.active
              ? cartao(corpoBloco, { padding: 6, paddingX: 8, antes: 3 })
              : cartao(corpoBloco, { padding: 5, paddingX: 7, antes: 3 });
          }),
        ],
        { antes: 12 },
      ),
    );
    for (let i = 0; i < colunasFator.length; i += 2) {
      out.push(colunas(colunasFator.slice(i, i + 2).concat(colunasFator.length - i === 1 ? [espaco(0)] : []), { vao: 16, antes: 8 }));
    }
  }

  // --- derivados do DISC ---------------------------------------------------------------------
  if (mostrar("derivados") && isDisc && r.derived) {
    out.push(...blocosDerivados(r.derived, o.mbtiReal ?? null, !!r.intensidade, ctx));
  }

  // --- sugestões de comunicação --------------------------------------------------------------
  if (isDisc) {
    out.push(tituloDeSecao(CORPO.comunicacaoTitulo, ctx));
    out.push(paragrafo(CORPO.comunicacaoIntro, t, { tamanho: 9.4, cor: CINZA, antes: 4 }));
    for (const c of COMUNICACAO) {
      out.push(
        cartao(
          pilha([
            paragrafo(c.label, t, { tamanho: 9.4, peso: "md", cor: PRETO }),
            paragrafo(c.body, t, { tamanho: 9.2, entrelinha: 1.55, antes: 4 }),
          ]),
          { padding: 13, antes: 10 },
        ),
      );
    }
  }

  return out;
}

/** Tabela simples de texto, com cabeçalho e linhas zebradas por régua. */
function tabela(cabecalhos: string[], linhas: string[][], t: Tipografia, antes = 0): Bloco {
  const alturaLinha = 20;
  const h = 22 + linhas.length * alturaLinha;
  return desenhoLivre(
    h,
    (p, x, yTopo, l) => {
      const largura = l / cabecalhos.length;
      p.drawRectangle({ x, y: yTopo - 22, width: l, height: 22, color: FUNDO_SUAVE });
      cabecalhos.forEach((c, i) => {
        p.drawText(limpar(c), { x: x + i * largura + 8, y: yTopo - 14.5, size: 7.4, font: t.bd, color: CINZA });
      });
      linhas.forEach((linha, li) => {
        const y = yTopo - 22 - (li + 1) * alturaLinha;
        p.drawRectangle({ x, y: y + alturaLinha, width: l, height: 0.5, color: CINZA_CLARO });
        linha.forEach((celula, ci) => {
          p.drawText(limpar(celula), {
            x: x + ci * largura + 8,
            y: y + 6.5,
            size: 8.4,
            font: ci === 0 ? t.md : t.rg,
            color: ci === 0 ? PRETO : GRAFITE,
          });
        });
      });
      p.drawRectangle({ x, y: yTopo - h, width: l, height: 0.5, color: CINZA_CLARO });
    },
    antes,
  );
}

/** Ressalva de confiabilidade (`computed_scores.qualidade`), quando o nível não é "alta". */
function blocoDeConfiabilidade(r: Report, ctx: Contexto): Bloco | null {
  const q = r.qualidade;
  if (!q || q.nivel === "alta") return null;
  const grave = q.nivel === "baixa";
  const t = ctx.tipo;
  // A ressalva usa a MESMA caixa de nota do resto do documento: um quarto estilo de aviso só
  // diluiria o significado dos outros.
  return notaDeLeitura(
    grave ? CONFIABILIDADE.tituloGrave : CONFIABILIDADE.tituloLeve,
    CONFIABILIDADE.corpo(q.motivos),
    t,
    0,
  );
}

/** Plano de ação: as perguntas da tela, com o que a pessoa já respondeu (ou espaço para escrever). */
function blocosDoPlano(perguntas: string[], respostas: Record<string, string>, ctx: Contexto): Bloco[] {
  const t = ctx.tipo;
  const out: Bloco[] = [
    tituloDeSecao(CORPO.planoTitulo, ctx),
    paragrafo(CORPO.planoIntro, t, { tamanho: 9.4, cor: CINZA, antes: 4 }),
  ];
  perguntas.forEach((pergunta, i) => {
    const resposta = (respostas[`q${i + 1}`] ?? "").trim();
    out.push(
      pilha(
        [
          paragrafo(`${i + 1}. ${pergunta}`, t, { tamanho: 9.4, peso: "md", cor: PRETO, entrelinha: 1.5 }),
          resposta
            ? cartao(paragrafo(resposta, t, { tamanho: 9.2, entrelinha: 1.55 }), {
                fundo: FUNDO_SUAVE,
                padding: 10,
                antes: 6,
              })
            : caixa(espaco(26), { borda: FILETE, tracejada: true, padding: 4, antes: 6 }),
        ],
        { atomico: false, antes: 12 },
      ),
    );
  });
  return out;
}

/** Rodapé jurídico e dados de contato do mentor, no fim do documento. */
function blocosDoFim(r: Report, ctx: Contexto): Bloco[] {
  const t = ctx.tipo;
  const nome = r.brand?.company_name?.trim();
  const site = r.brand?.site_url?.trim();
  const email = r.brand?.support_email?.trim();
  const contato = [nome, site?.replace(/^https?:\/\//, ""), email].filter(Boolean).join("  ·  ");
  return [
    regua(CINZA_CLARO, 0.6, 26),
    paragrafo(RODAPE_LEGAL, t, { tamanho: 8, cor: CINZA, entrelinha: 1.55, antes: 12 }),
    contato ? paragrafo(contato, t, { tamanho: 8, peso: "md", cor: GRAFITE, antes: 8 }) : null,
  ].filter(Boolean) as Bloco[];
}

// ---------------------------------------------------------------------------------------------
// Documentos completos
// ---------------------------------------------------------------------------------------------

/**
 * Mesma entrada, mesmo arquivo. O pdf-lib carimbaria a hora da geração nos metadados, o que faria
 * dois downloads do mesmo relatório saírem diferentes; aqui a data do documento é a da RESPOSTA,
 * que não muda, e nada mais no caminho é aleatório.
 */
async function novoDocumento(origem: string, r: { brand?: Report["brand"]; submitted_at: string }, tituloDoc: string, pessoa: string) {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  const { default: fontkit } = await import("@pdf-lib/fontkit/dist/fontkit.es.js");
  pdf.registerFontkit(fontkit);
  // Em série, não em paralelo: os dois registram objetos no MESMO documento, e a ordem deles
  // precisa ser sempre a mesma para o arquivo sair idêntico a cada geração.
  const tipo = await carregarTipografia(pdf);
  const arte = await carregarIlustracoes(pdf, origem, r.brand?.logo_url ?? null);
  const quando = new Date(r.submitted_at);
  pdf.setTitle(tituloDoc);
  pdf.setAuthor(r.brand?.company_name?.trim() || "Método Intenção");
  pdf.setSubject(`Relatório comportamental de ${limpar(pessoa)}`);
  pdf.setProducer("Método Intenção");
  pdf.setCreator("Método Intenção");
  pdf.setCreationDate(quando);
  pdf.setModificationDate(quando);
  const ctx: Contexto = {
    tipo,
    arte,
    marca: corDaMarca(r.brand?.brand_color),
    plano: {},
    assinatura: `Relatório comportamental · ${r.brand?.company_name?.trim() || "Método Intenção"}`,
  };
  return { pdf, ctx };
}

export async function pdfDoRelatorio(o: {
  report: Report;
  origem: string;
  plano: Record<string, string>;
  mostrarPlano: boolean;
}): Promise<Uint8Array> {
  const r = o.report;
  const pessoa = r.person_name ?? "Avaliado";
  const { pdf, ctx } = await novoDocumento(o.origem, r, `Relatório comportamental — ${limpar(pessoa)}`, pessoa);
  ctx.plano = o.plano;
  const doc = new Documento(pdf, ctx.tipo);

  desenharCapa(doc, {
    pessoa,
    instrumento: r.test_title ?? "Inventário comportamental",
    data: dataBR(r.submitted_at),
    subtitulo: r.duration ? `Tempo de resposta: ${r.duration}` : undefined,
    ctx,
    marcaMentor: { nome: r.brand?.company_name ?? null },
  });

  // Textura e marca d'água ficam ATRÁS do conteúdo: o fundo é pintado quando a página abre.
  doc.usarFundo((p) => {
    texturaDePontos(p, { yTopo: A4.altura - 170, altura: 400 });
    marcaDagua(p, { cx: A4.largura - 62, cy: 128, raio: 46 });
  });
  doc.quebrarPagina();
  const confiabilidade = blocoDeConfiabilidade(r, ctx);
  doc.fluir([
    ...(confiabilidade ? [confiabilidade, espaco(10)] : []),
    ...blocosDoRelatorio(r, ctx),
    ...(o.mostrarPlano ? blocosDoPlano(r.is_disc !== false ? PLANO_ACAO : PLANO_ACAO_GENERICO, o.plano, ctx) : []),
    ...blocosDoFim(r, ctx),
  ]);

  ornamentar(doc, ctx, { pessoa, data: dataBR(r.submitted_at) });
  return pdf.save();
}

/**
 * Cabeçalho e rodapé em toda página de conteúdo, no padrão do sistema visual (#294).
 * A assinatura do rodapé leva o nome do mentor quando houver — no SaaS cada um assina o seu.
 */
function ornamentar(doc: Documento, ctx: Contexto, o: { pessoa: string; data: string }) {
  const orn: Ornamento = {
    pessoa: o.pessoa,
    data: o.data,
    assinatura: ctx.assinatura,
    arte: ctx.arte,
  };
  doc.finalizar((p, pagina) => {
    pintarCabecalho(p, ctx.tipo, orn);
    pintarRodape(p, ctx.tipo, { ...orn, pagina });
  });
}

export type BateriaParte = Report & { assessment_sort: number };

export async function pdfDaBateria(o: {
  bateria: {
    assessment_id: string;
    brand: Report["brand"];
    settings: Report["settings"];
    person_name: string | null;
    submitted_at: string;
    duration: string | null;
    total_parts: number;
    done_parts: number;
    pending_titles: string[];
    mbti_real: { tipo: string; pares: JungPares } | null;
    parts: BateriaParte[];
  };
  origem: string;
  /** O plano é UM por bateria, gravado na etapa principal — igual à tela. */
  plano: Record<string, string>;
  mostrarPlano: boolean;
}): Promise<Uint8Array> {
  const b = o.bateria;
  const pessoa = b.person_name ?? "Avaliado";
  const { pdf, ctx } = await novoDocumento(
    o.origem,
    { brand: b.brand, submitted_at: b.submitted_at },
    `Relatório da bateria — ${limpar(pessoa)}`,
    pessoa,
  );
  const doc = new Documento(pdf, ctx.tipo);
  const t = ctx.tipo;

  const titulos = b.parts.map((p) => p.test_title).filter(Boolean) as string[];
  desenharCapa(doc, {
    pessoa,
    // Com um inventário só, o nome dele é o instrumento; com vários, o campo resume e a lista
    // completa desce para a linha de baixo, onde cabe qualquer quantidade.
    instrumento:
      titulos.length === 1
        ? titulos[0]
        : `Bateria de ${b.done_parts} ${b.done_parts === 1 ? "inventário" : "inventários"}`,
    detalhe: titulos.length > 1 ? titulos.join("  ·  ") : undefined,
    data: dataBR(b.submitted_at),
    subtitulo:
      `${b.done_parts} de ${b.total_parts} ${b.total_parts === 1 ? "inventário respondido" : "inventários respondidos"}` +
      (b.duration ? `  ·  Tempo total: ${b.duration}` : ""),
    ctx,
    marcaMentor: { nome: b.brand?.company_name ?? null },
  });

  doc.usarFundo((p) => {
    texturaDePontos(p, { yTopo: A4.altura - 170, altura: 400 });
    marcaDagua(p, { cx: A4.largura - 62, cy: 128, raio: 46 });
  });
  doc.quebrarPagina();

  // Basta uma etapa preenchida no automático para valer a ressalva — a mesma escolha da tela.
  const peso = { baixa: 0, media: 1, alta: 2 } as const;
  const pior = b.parts
    .map((p) => p.qualidade)
    .filter((q): q is NonNullable<Report["qualidade"]> => !!q)
    .sort((a, c) => peso[a.nivel] - peso[c.nivel])[0];
  const confiabilidade = blocoDeConfiabilidade({ qualidade: pior } as Report, ctx);

  doc.fluir([
    ...(confiabilidade ? [confiabilidade, espaco(10)] : []),
    ...(b.pending_titles.length > 0
      ? [
          cartao(
            paragrafo(
              [
                { texto: BATERIA.pendentesPrefixo },
                { texto: b.pending_titles.join(", "), forte: true },
                { texto: BATERIA.pendentesSufixo },
              ],
              t,
              { tamanho: 9, entrelinha: 1.5 },
            ),
            { padding: 13 },
          ),
          espaco(8),
        ]
      : []),
    tituloDeSecao(BATERIA.sumarioTitulo, ctx, 0),
    paragrafo(BATERIA.sumarioIntro, t, { tamanho: 9.4, cor: CINZA, antes: 6 }),
    ...b.parts.map((parte, i) => {
      const detalhe =
        (parte.is_disc && parte.profile
          ? `perfil ${parte.profile}`
          : parte.factors[0]
            ? `${parte.factors.length} dimensões`
            : "") + (parte.duration ? ` · ${parte.duration}` : "");
      return cartao(
        desenhoLivre(12, (p, x, yTopo, l) => {
          p.drawText(`${i + 1}. ${limpar(parte.test_title ?? "Inventário")}`, {
            x,
            y: yTopo - 9,
            size: 9.4,
            font: t.md,
            color: PRETO,
          });
          if (detalhe) {
            const dl = t.rg.widthOfTextAtSize(detalhe, 7.8);
            p.drawText(detalhe, { x: x + l - dl, y: yTopo - 9, size: 7.8, font: t.rg, color: CINZA });
          }
        }),
        { padding: 11, antes: i === 0 ? 12 : 6 },
      );
    }),
  ]);

  b.parts.forEach((parte, idx) => {
    doc.quebrarPagina();
    doc.fluir([
      rotulo(BATERIA.parte(idx + 1, b.parts.length), t, CINZA, 0),
      paragrafo(parte.test_title ?? "Inventário", t, {
        tamanho: 20,
        peso: "xbd",
        cor: PRETO,
        entrelinha: 1.2,
        antes: 6,
      }),
      ...(parte.test_description
        ? [paragrafo(parte.test_description, t, { tamanho: 9.4, entrelinha: 1.55, antes: 6 })]
        : []),
      regua(ctx.marca, 2.4, 12),
      // A introdução metodológica só na primeira parte, como na tela.
      ...blocosDoRelatorio(parte, ctx, {
        mbtiReal: parte.is_disc ? b.mbti_real : null,
        comIntro: idx === 0,
      }),
    ]);
  });

  if (o.mostrarPlano) {
    // O plano de ação é da etapa principal (DISC quando houver) e aparece UMA vez, no fim.
    const principal = b.parts.find((p) => p.is_disc) ?? b.parts[0];
    doc.fluir(
      blocosDoPlano(principal?.is_disc !== false ? PLANO_ACAO : PLANO_ACAO_GENERICO, o.plano, ctx),
    );
  }

  doc.fluir(blocosDoFim({ brand: b.brand } as Report, ctx));
  ornamentar(doc, ctx, { pessoa, data: dataBR(b.submitted_at) });
  return pdf.save();
}
