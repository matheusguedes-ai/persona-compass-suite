/**
 * O SISTEMA VISUAL DO MÉTODO INTENÇÃO em PDF (#294).
 *
 * A #293 entregou a infraestrutura: documento montado no servidor, A4, determinístico. O dono do
 * produto olhou e disse o que faltava — diagramação e identidade — e aprovou uma proposta visual.
 * Este módulo é essa proposta virada em PEÇAS, e é de propósito que ele não saiba nada sobre
 * relatório: cabeçalho, cartão, pílula, termômetro, nota e rodapé valem igual para o certificado
 * (#221) e para o PDF individual (#280), que vêm depois. Quem montar aquelas páginas monta com
 * estas peças, não do zero.
 *
 * As cores vivem em `marca.ts`, medidas na proposta aprovada e corrigidas onde o contraste não
 * bastava — ver o aviso lá. Aqui não se escolhe cor: só se usa.
 */
import type { Color, PDFPage } from "./pdf-lib";
import {
  APOIO,
  AZUL,
  AZUL_LEVE,
  BRANCO,
  CARTAO,
  CIANO,
  CIANO_TEXTO,
  CIANO_TEXTO_CARTAO,
  ESCURO,
  FILETE,
  GRAFITE,
  NOTA,
  TRILHO,
  type Ilustracoes,
  type Tipografia,
} from "./marca";
import {
  A4,
  LARGURA_UTIL,
  MARGEM,
  desenhoLivre,
  larguraEspacada,
  limpar,
  paragrafo,
  pilha,
  retanguloArredondado,
  retanguloTopoArredondado,
  textoEspacado,
  type Bloco,
} from "./doc";

/** Milímetros em pontos — a proposta fala em mm, o PDF pensa em pt. */
export const MM = 2.8346;

// ---------------------------------------------------------------------------------------------
// Peças de desenho (usadas dentro de outras peças)
// ---------------------------------------------------------------------------------------------

/** Pílula de canto totalmente arredondado, com o texto centralizado na vertical. */
export function pintarPilula(
  p: PDFPage,
  o: {
    texto: string;
    x: number;
    yTopo: number;
    altura: number;
    fundo: Color;
    cor: Color;
    tipo: Tipografia;
    tamanho?: number;
    entreletras?: number;
    peso?: keyof Tipografia;
  },
): number {
  const tamanho = o.tamanho ?? 8;
  const entreletras = o.entreletras ?? 1.2;
  const fonte = o.tipo[o.peso ?? "bd"];
  const texto = o.texto.toLocaleUpperCase("pt-BR");
  const largura = larguraEspacada(texto, fonte, tamanho, entreletras) + o.altura;
  retanguloArredondado(p, {
    x: o.x,
    y: o.yTopo - o.altura,
    largura,
    altura: o.altura,
    raio: o.altura / 2,
    cor: o.fundo,
  });
  textoEspacado(p, {
    texto,
    x: o.x + o.altura / 2,
    y: o.yTopo - o.altura / 2 - tamanho * 0.35,
    tamanho,
    fonte,
    cor: o.cor,
    entreletras,
  });
  return largura;
}

/** A largura que `pintarPilula` vai ocupar — para posicionar antes de desenhar. */
export function larguraDaPilula(
  texto: string,
  tipo: Tipografia,
  o: { altura: number; tamanho?: number; entreletras?: number; peso?: keyof Tipografia },
): number {
  const fonte = tipo[o.peso ?? "bd"];
  return larguraEspacada(texto.toLocaleUpperCase("pt-BR"), fonte, o.tamanho ?? 8, o.entreletras ?? 1.2) + o.altura;
}

/** Círculo sólido com a sigla do perfil dentro, como na proposta. */
export function pintarCirculoSigla(
  p: PDFPage,
  o: { sigla: string; cx: number; cy: number; raio: number; fundo: Color; tipo: Tipografia },
) {
  p.drawCircle({ x: o.cx, y: o.cy, size: o.raio, color: o.fundo });
  // O corpo encolhe para siglas longas ("MEL+FLE" cabe onde "CI" sobra espaço).
  let tamanho = o.raio * 0.62;
  while (tamanho > 5 && o.tipo.bd.widthOfTextAtSize(o.sigla, tamanho) > o.raio * 1.68) tamanho -= 0.4;
  const l = o.tipo.bd.widthOfTextAtSize(o.sigla, tamanho);
  p.drawText(o.sigla, {
    x: o.cx - l / 2,
    y: o.cy - tamanho * 0.35,
    size: tamanho,
    font: o.tipo.bd,
    color: BRANCO,
  });
}

// ---------------------------------------------------------------------------------------------
// Fundo da página: textura e marca d'água
// ---------------------------------------------------------------------------------------------

/**
 * Pontos Ciano na margem direita. Vão no FUNDO da página, antes do conteúdo, e só na faixa fora
 * da coluna de texto — a proposta é explícita: nunca atrás de texto.
 */
export function texturaDePontos(p: PDFPage, o: { yTopo: number; altura: number }) {
  const passo = 9;
  const x0 = A4.largura - MARGEM.direita + 12;
  const x1 = A4.largura - 16;
  for (let x = x0; x <= x1; x += passo) {
    for (let y = o.yTopo - o.altura; y <= o.yTopo; y += passo) {
      p.drawCircle({ x, y, size: 0.9, color: CIANO, opacity: 0.18 });
    }
  }
}

/**
 * Círculos concêntricos de respiro, bem apagados.
 *
 * ⚠️ `opacity` no pdf-lib vale para o PREENCHIMENTO; a borda tem `borderOpacity` próprio. Sem
 * isso os anéis saíam sólidos no meio da página, competindo com o texto em vez de respirar.
 */
export function marcaDagua(p: PDFPage, o: { cx: number; cy: number; raio: number }) {
  p.drawCircle({ x: o.cx, y: o.cy, size: o.raio, borderColor: CIANO, borderWidth: 0.8, borderOpacity: 0.2, opacity: 0 });
  p.drawCircle({ x: o.cx, y: o.cy, size: o.raio * 0.62, borderColor: AZUL, borderWidth: 0.7, borderOpacity: 0.16, opacity: 0 });
  p.drawCircle({ x: o.cx, y: o.cy, size: o.raio * 0.22, color: CIANO, opacity: 0.12 });
}

// ---------------------------------------------------------------------------------------------
// Cabeçalho e rodapé
// ---------------------------------------------------------------------------------------------

export type Ornamento = {
  pessoa: string;
  data: string;
  assinatura: string;
  arte: Ilustracoes;
};

/** Cabeçalho: logo Cerúleo à esquerda, nome ao centro, data à direita, filete embaixo. */
export function pintarCabecalho(p: PDFPage, tipo: Tipografia, o: Ornamento) {
  const y = A4.altura - 46;
  const lg = 62;
  const logo = o.arte.logoCeruleo;
  p.drawImage(logo, {
    x: MARGEM.esquerda,
    y: y - (logo.height / logo.width) * lg * 0.5,
    width: lg,
    height: (logo.height / logo.width) * lg,
  });

  const data = o.data.replace(/\//g, " / ");
  const larguraData = larguraEspacada(data, tipo.md, 7.6, 1.1);

  // O nome fica ENTRE a logo e a data, e encolhe para caber nesse vão. Um nome longo antes
  // atravessava as duas: a data virava rabisco e a logo ficava com letras por cima.
  const nome = limpar(o.pessoa).toLocaleUpperCase("pt-BR");
  const vao = A4.largura - 2 * (MARGEM.esquerda + Math.max(lg, larguraData) + 16);
  let corpoNome = 7.6;
  let entreNome = 1.1;
  while (corpoNome > 5.4 && larguraEspacada(nome, tipo.md, corpoNome, entreNome) > vao) {
    corpoNome -= 0.2;
    entreNome = Math.max(0.4, entreNome - 0.04);
  }
  // Nem no corpo mínimo cabe: corta e marca o corte, em vez de invadir o vizinho.
  let visivel = nome;
  while (visivel.length > 6 && larguraEspacada(visivel + "…", tipo.md, corpoNome, entreNome) > vao) {
    visivel = visivel.slice(0, -1);
  }
  if (visivel !== nome) visivel += "…";
  const larguraNome = larguraEspacada(visivel, tipo.md, corpoNome, entreNome);
  textoEspacado(p, {
    texto: visivel,
    x: (A4.largura - larguraNome) / 2,
    y,
    tamanho: corpoNome,
    fonte: tipo.md,
    cor: APOIO,
    entreletras: entreNome,
  });

  textoEspacado(p, {
    texto: data,
    x: A4.largura - MARGEM.direita - larguraData,
    y,
    tamanho: 7.6,
    fonte: tipo.md,
    cor: APOIO,
    entreletras: 1.1,
  });

  p.drawRectangle({ x: MARGEM.esquerda, y: y - 14, width: LARGURA_UTIL, height: 0.7, color: FILETE });
}

/** Rodapé: filete, assinatura discreta à esquerda e o número da página em Cerúleo. */
export function pintarRodape(p: PDFPage, tipo: Tipografia, o: Ornamento & { pagina: number }) {
  const y = MARGEM.base - 26;
  p.drawRectangle({ x: MARGEM.esquerda, y: y + 16, width: LARGURA_UTIL, height: 0.7, color: FILETE });
  const assinatura = o.assinatura.toLocaleUpperCase("pt-BR");
  textoEspacado(p, {
    texto: assinatura,
    x: MARGEM.esquerda,
    y,
    tamanho: 7,
    fonte: tipo.md,
    cor: APOIO,
    entreletras: 1,
  });
  const num = String(o.pagina).padStart(2, "0");
  const l = tipo.bd.widthOfTextAtSize(num, 13);
  p.drawText(num, {
    x: A4.largura - MARGEM.direita - l,
    y: y - 2,
    size: 13,
    font: tipo.bd,
    color: AZUL,
  });
}

// ---------------------------------------------------------------------------------------------
// Blocos de conteúdo
// ---------------------------------------------------------------------------------------------

/**
 * Título de seção: duas linhas em peso Light, a primeira em Cerúleo sólido e a segunda em tom
 * mais leve — e a barra Ciano sangrando na borda esquerda da página, à altura do título.
 *
 * A barra sangra de verdade (x = 0), por isso ela é desenhada aqui e não pelo fluxo: nenhuma
 * outra peça do documento sai da margem.
 */
export function tituloDeSecao(
  linha1: string,
  linha2: string | null,
  tipo: Tipografia,
  antes = 0,
  /**
   * 31pt é o título de abertura (a página de intensidade). As demais seções usam o mesmo desenho
   * em corpo menor — mesma barra, mesmas cores, mesma família: é o sistema, não outro elemento.
   */
  corpoTitulo = 31,
): Bloco {
  const corpo = corpoTitulo;
  const entrelinha = corpo * 1.08;
  const linhas = linha2 ? 2 : 1;
  const altura = entrelinha * linhas + 6;
  return {
    antes,
    atomico: true,
    colaNoProximo: true,
    altura: () => altura,
    desenhar(p, x, yTopo) {
      p.drawRectangle({
        x: 0,
        y: yTopo - altura + 8,
        width: 8 * MM,
        height: entrelinha * linhas - 4,
        color: CIANO,
      });
      let y = yTopo - corpo * 0.82;
      p.drawText(linha1.toLocaleUpperCase("pt-BR"), {
        x,
        y,
        size: corpo,
        // Abaixo de 20pt o peso Light fica frágil no papel; o corpo do texto pede Regular.
        font: corpo >= 20 ? tipo.lt : tipo.rg,
        color: AZUL,
      });
      if (linha2) {
        y -= entrelinha;
        p.drawText(linha2.toLocaleUpperCase("pt-BR"), {
          x,
          y,
          size: corpo,
          font: corpo >= 20 ? tipo.lt : tipo.rg,
          color: AZUL_LEVE,
        });
      }
    },
  };
}

/** Rótulo de subseção: Ciano em caixa alta, com um filete curto por baixo. */
export function rotuloDeSubsecao(texto: string, tipo: Tipografia, antes = 22): Bloco {
  return {
    antes,
    atomico: true,
    colaNoProximo: true,
    altura: () => 22,
    desenhar(p, x, yTopo) {
      textoEspacado(p, {
        texto: texto.toLocaleUpperCase("pt-BR"),
        x,
        y: yTopo - 9,
        tamanho: 8.4,
        fonte: tipo.bd,
        cor: CIANO_TEXTO,
        entreletras: 1.2,
      });
      p.drawRectangle({ x, y: yTopo - 18, width: 46, height: 2, color: CIANO });
    },
  };
}

/** Cartão: fundo claro, cantos de ~4mm, sem borda — o contêiner padrão do sistema. */
export function cartao(
  dentro: Bloco,
  o: { padding?: number; paddingX?: number; antes?: number; fundo?: Color } = {},
): Bloco {
  const pd = o.padding ?? 16;
  const px = o.paddingX ?? 18;
  return {
    antes: o.antes,
    atomico: true,
    altura: (l) => dentro.altura(l - px * 2) + pd * 2,
    desenhar(p, x, yTopo, l) {
      const h = this.altura(l);
      retanguloArredondado(p, {
        x,
        y: yTopo - h,
        largura: l,
        altura: h,
        raio: 4 * MM,
        cor: o.fundo ?? CARTAO,
      });
      dentro.desenhar(p, x + px, yTopo - pd, l - px * 2);
    },
  };
}

/** Nota de leitura: caixa azul clara com filete Ciano à esquerda. */
export function notaDeLeitura(titulo: string, texto: string, tipo: Tipografia, antes = 20): Bloco {
  const dentro = pilha([
    {
      ...paragrafo(titulo, tipo, {
        tamanho: 8.6,
        peso: "bd",
        cor: AZUL,
        maiusculas: true,
        entreletras: 1.1,
        entrelinha: 1.3,
      }),
    },
    paragrafo(texto, tipo, { tamanho: 9.2, cor: GRAFITE, entrelinha: 1.55, antes: 6 }),
  ]);
  const px = 18;
  const pd = 14;
  return {
    antes,
    atomico: true,
    altura: (l) => dentro.altura(l - px - 12) + pd * 2,
    desenhar(p, x, yTopo, l) {
      const h = this.altura(l);
      retanguloArredondado(p, { x, y: yTopo - h, largura: l, altura: h, raio: 2.5 * MM, cor: NOTA });
      p.drawRectangle({ x, y: yTopo - h, width: 4, height: h, color: CIANO });
      dentro.desenhar(p, x + px, yTopo - pd, l - px - 12);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// O gráfico: termômetros
// ---------------------------------------------------------------------------------------------

export type Termometro = {
  /** A letra embaixo da coluna (D, I, S, C…). */
  chave: string;
  valor: number;
  cor: Color;
  /** Fora do título por pouca informação (#292): a coluna esmaece e ganha a marca. */
  apagada?: boolean;
  marca?: string | null;
  /** Percepção externa (360°): um traço atravessando a coluna na altura do valor. */
  externo?: number | null;
  corExterno?: Color;
};

/**
 * O gráfico da proposta: colunas verticais em trilho arredondado, com o número acima da ponta e
 * um marcador circular no topo da barra.
 *
 * A ESCALA é fixa em 0–100 e a linha tracejada fica na metade. É a régua verdadeira do motor
 * ipsativo — as letras de um conjunto dividem 100 pontos entre si —, então quatro letras
 * equilibradas ficam mesmo perto de 25. Uma escala que esticasse até o maior valor deixaria o
 * gráfico mais bonito e mentiria sobre a distância entre as letras.
 */
export function graficoDeTermometros(
  itens: Termometro[],
  tipo: Tipografia,
  o: { alturaTrilho?: number; antes?: number } = {},
): Bloco {
  // 126pt (era 150) — a peça da intensidade precisava caber na MESMA página que a abertura de
  // cada parte da bateria, e sobravam ~30pt. O trilho é o que dá para encolher sem tocar em
  // nenhum elemento do sistema: mesma escala, mesmas cores, mesmo marcador.
  const alturaTrilho = o.alturaTrilho ?? 126;
  const espacoNumero = 20;
  const espacoLetra = 22;
  const alturaMarca = itens.some((i) => i.marca) ? 13 : 0;
  const altura = espacoNumero + alturaTrilho + espacoLetra + alturaMarca;

  return desenhoLivre(
    altura,
    (p, x, yTopo, l) => {
      const base = yTopo - espacoNumero - alturaTrilho;
      const eixoX = x + 26;
      const util = l - 26;
      const larguraColuna = Math.min(26, (util / itens.length) * 0.5);
      const passo = util / itens.length;

      // Escala 0 / 50 / 100 à esquerda, e a tracejada do meio atravessando o gráfico.
      for (const marca of [0, 50, 100]) {
        const y = base + (alturaTrilho * marca) / 100;
        const rotulo = String(marca);
        const lr = tipo.rg.widthOfTextAtSize(rotulo, 7.4);
        p.drawText(rotulo, { x: eixoX - 8 - lr, y: y - 2.6, size: 7.4, font: tipo.rg, color: APOIO });
        if (marca === 50) {
          p.drawLine({
            start: { x: eixoX, y },
            end: { x: x + l, y },
            thickness: 0.6,
            color: FILETE,
            dashArray: [3, 3],
          });
        }
      }

      itens.forEach((item, i) => {
        const cx = eixoX + passo * i + passo / 2;
        const xCol = cx - larguraColuna / 2;
        const pct = Math.max(0, Math.min(100, item.valor)) / 100;
        const cor = item.cor;

        // Trilho: o máximo da escala, sempre visível atrás da barra.
        retanguloArredondado(p, {
          x: xCol,
          y: base,
          largura: larguraColuna,
          altura: alturaTrilho,
          raio: larguraColuna / 2,
          cor: TRILHO,
        });
        const h = Math.max(larguraColuna, alturaTrilho * pct);
        retanguloArredondado(p, {
          x: xCol,
          y: base,
          largura: larguraColuna,
          altura: h,
          raio: larguraColuna / 2,
          cor,
        });
        // Marcador na ponta: círculo branco com miolo colorido.
        const topo = base + h - larguraColuna / 2;
        p.drawCircle({ x: cx, y: topo, size: larguraColuna * 0.42, color: BRANCO });
        p.drawCircle({ x: cx, y: topo, size: larguraColuna * 0.2, color: cor });

        // 360°: o valor dos observadores atravessa a coluna como um traço, sem virar outra barra.
        // Vai ANTES do número: desenhado depois, ele riscava o próprio valor que explica.
        if (item.externo != null && item.corExterno) {
          const ye = base + alturaTrilho * (Math.max(0, Math.min(100, item.externo)) / 100);
          p.drawRectangle({
            x: xCol - 5,
            y: ye - 1.1,
            width: larguraColuna + 10,
            height: 2.2,
            color: item.corExterno,
          });
        }

        const num = String(Math.round(item.valor));
        const ln = tipo.bd.widthOfTextAtSize(num, 10);
        p.drawText(num, { x: cx - ln / 2, y: base + h + 8, size: 10, font: tipo.bd, color: ESCURO });

        const lc = tipo.md.widthOfTextAtSize(item.chave, 9);
        p.drawText(item.chave, {
          x: cx - lc / 2,
          y: base - 15,
          size: 9,
          font: tipo.md,
          color: GRAFITE,
        });

        if (item.marca) {
          const marca = item.marca.toLocaleUpperCase("pt-BR");
          // A etiqueta encolhe até caber DENTRO da fatia da coluna: larga demais, ela cobria a
          // letra da dimensão vizinha e parecia pertencer às duas.
          let corpoMarca = 6;
          while (corpoMarca > 3.6 && larguraEspacada(marca, tipo.md, corpoMarca, 0.6) + 10 > passo - 4) {
            corpoMarca -= 0.2;
          }
          const lm = larguraEspacada(marca, tipo.md, corpoMarca, 0.6);
          retanguloArredondado(p, {
            x: cx - lm / 2 - 5,
            y: base - 15 - alturaMarca,
            largura: lm + 10,
            altura: 10.5,
            raio: 5.25,
            cor: BRANCO,
          });
          textoEspacado(p, {
            texto: marca,
            x: cx - lm / 2,
            y: base - 12.4 - alturaMarca,
            tamanho: corpoMarca,
            fonte: tipo.md,
            cor: APOIO,
            entreletras: 0.6,
          });
        }
      });
    },
    o.antes,
  );
}

/**
 * O cartão de um conjunto (NATURAL ou ADAPTADO): pílula identificando, círculo com a sigla, a
 * linha que diz o que aquele gráfico mede, e os termômetros.
 */
export function cartaoDoGrafico(o: {
  rotulo: string;
  sigla: string | null;
  explica: string;
  itens: Termometro[];
  /** Cerúleo no natural, Ciano no adaptado. */
  cor: Color;
  tipo: Tipografia;
  antes?: number;
}): Bloco {
  const t = o.tipo;
  const alturaCabeca = 34;
  return cartao(
    pilha([
      desenhoLivre(alturaCabeca, (p, x, yTopo, l) => {
        pintarPilula(p, {
          texto: o.rotulo,
          x,
          yTopo: yTopo - 2,
          altura: 22,
          fundo: o.cor,
          cor: BRANCO,
          tipo: t,
          tamanho: 8,
          entreletras: 1.4,
        });
        const raio = 17;
        pintarCirculoSigla(p, {
          sigla: o.sigla ?? "—",
          cx: x + l - raio,
          cy: yTopo - 13,
          raio,
          fundo: o.cor,
          tipo: t,
        });
      }),
      paragrafo(o.explica, t, { tamanho: 8.4, cor: APOIO, entrelinha: 1.5, antes: 4 }),
      graficoDeTermometros(o.itens, t, { antes: 14 }),
    ]),
    { antes: o.antes, padding: 16, paddingX: 16 },
  );
}

/** Faixa de índices: rótulo em caixa alta e valor grande, separados por filete vertical. */
export function faixaDeIndices(
  indices: Array<{ label: string; valor: string }>,
  tipo: Tipografia,
  antes = 0,
): Bloco {
  return desenhoLivre(
    46,
    (p, x, yTopo, l) => {
      const passo = l / indices.length;
      indices.forEach((ind, i) => {
        const cx = x + passo * i;
        if (i > 0) {
          p.drawRectangle({ x: cx, y: yTopo - 40, width: 0.7, height: 36, color: FILETE });
        }
        const dentro = cx + (i === 0 ? 0 : 18);
        textoEspacado(p, {
          texto: ind.label.toLocaleUpperCase("pt-BR"),
          x: dentro,
          y: yTopo - 10,
          tamanho: 7.2,
          fonte: tipo.md,
          cor: APOIO,
          entreletras: 1.1,
        });
        p.drawText(ind.valor, { x: dentro, y: yTopo - 36, size: 21, font: tipo.bd, color: AZUL });
      });
    },
    antes,
  );
}

/** A pílula escura do perfil: "PERFIL" em branco e a sigla em Ciano. */
export function seloDoPerfil(sigla: string, tipo: Tipografia, antes = 0): Bloco {
  const altura = 34;
  return desenhoLivre(
    altura,
    (p, x, yTopo) => {
      const rotulo = "PERFIL";
      const lRot = larguraEspacada(rotulo, tipo.bd, 9, 1.4);
      const lSig = larguraEspacada(sigla, tipo.bd, 12, 1.8);
      const largura = lRot + lSig + 54;
      retanguloArredondado(p, {
        x,
        y: yTopo - altura,
        largura,
        altura,
        raio: altura / 2,
        cor: ESCURO,
      });
      textoEspacado(p, {
        texto: rotulo,
        x: x + 20,
        y: yTopo - altura / 2 - 3.2,
        tamanho: 9,
        fonte: tipo.bd,
        cor: BRANCO,
        entreletras: 1.4,
      });
      textoEspacado(p, {
        texto: sigla,
        x: x + 20 + lRot + 18,
        y: yTopo - altura / 2 - 4.2,
        tamanho: 12,
        fonte: tipo.bd,
        cor: CIANO,
        entreletras: 1.8,
      });
    },
    antes,
  );
}

// ---------------------------------------------------------------------------------------------
// Peças da Matriz SWOT do Comunicador (#302) — cor sempre por parâmetro: este módulo não sabe
// que Forças é verde ou que Ameaças é âmbar, quem sabe é `relatorio.ts`.
// ---------------------------------------------------------------------------------------------

/** Item de lista com marcador circular colorido — um item da SWOT, sempre uma frase curta. */
function itemComMarcador(texto: string, cor: Color, tipo: Tipografia, antes = 0): Bloco {
  const RAIO_PONTO = 3.2;
  const RECUO = 20;
  const tamanho = 10.5;
  const corpo = paragrafo(texto, tipo, { tamanho, cor: GRAFITE, entrelinha: 1.4 });
  return {
    antes,
    altura: (l) => corpo.altura(l - RECUO),
    desenhar(p, x, yTopo, l) {
      p.drawCircle({ x: x + RAIO_PONTO, y: yTopo - tamanho * 0.55, size: RAIO_PONTO, color: cor });
      corpo.desenhar(p, x + RECUO, yTopo, l - RECUO);
    },
  };
}

/**
 * Quadrante da Matriz SWOT: cabeçalho de duas cores — o rótulo à esquerda e o subtítulo em
 * linguagem simples à direita, os dois em branco — e o corpo com os itens, cada um com um
 * marcador da MESMA cor do cabeçalho. Uma peça só, com cantos arredondados nos quatro lados (o
 * corpo desenha o retângulo inteiro; o cabeçalho cobre por cima só até a costura).
 */
export function cartaoQuadrante(o: {
  rotulo: string;
  subtitulo: string;
  itens: string[];
  cor: Color;
  tipo: Tipografia;
  antes?: number;
}): Bloco {
  const t = o.tipo;
  const ALTURA_CABECA = 15 * MM;
  const PAD_X = 18;
  const PAD_Y = 16;
  const RAIO = 4 * MM;
  const corpo = pilha(o.itens.map((item, i) => itemComMarcador(limpar(item), o.cor, t, i === 0 ? 0 : 15)));
  const alturaCorpo = (l: number) => corpo.altura(l - PAD_X * 2) + PAD_Y * 2;
  return {
    antes: o.antes,
    atomico: true,
    altura: (l) => ALTURA_CABECA + alturaCorpo(l),
    desenhar(p, x, yTopo, l) {
      const hCorpo = alturaCorpo(l);
      const hTotal = ALTURA_CABECA + hCorpo;
      retanguloArredondado(p, { x, y: yTopo - hTotal, largura: l, altura: hTotal, raio: RAIO, cor: CARTAO });
      retanguloTopoArredondado(p, { x, y: yTopo - ALTURA_CABECA, largura: l, altura: ALTURA_CABECA, raio: RAIO, cor: o.cor });

      const subtitulo = o.subtitulo.toLocaleUpperCase("pt-BR");
      const lSub = larguraEspacada(subtitulo, t.md, 8, 0.8);
      textoEspacado(p, {
        texto: subtitulo,
        x: x + l - PAD_X - lSub,
        y: yTopo - ALTURA_CABECA / 2 - 3,
        tamanho: 8,
        fonte: t.md,
        cor: BRANCO,
        entreletras: 0.8,
      });

      // O rótulo encolhe até caber no vão antes do subtítulo — "OPORTUNIDADES" é largo
      // demais em cartões estreitos (duas colunas) para o corpo de 10pt fixo, e colidia
      // com o subtítulo à direita (mesma técnica de `pintarCabecalho`).
      const rotulo = o.rotulo.toLocaleUpperCase("pt-BR");
      const vao = l - PAD_X * 2 - lSub - 10;
      let corpoRotulo = 10;
      let entreRotulo = 0.6;
      while (corpoRotulo > 7 && larguraEspacada(rotulo, t.bd, corpoRotulo, entreRotulo) > vao) {
        corpoRotulo -= 0.3;
        entreRotulo = Math.max(0.2, entreRotulo - 0.03);
      }
      textoEspacado(p, {
        texto: rotulo,
        x: x + PAD_X,
        y: yTopo - ALTURA_CABECA / 2 - corpoRotulo * 0.35,
        tamanho: corpoRotulo,
        fonte: t.bd,
        cor: BRANCO,
        entreletras: entreRotulo,
      });

      corpo.desenhar(p, x + PAD_X, yTopo - ALTURA_CABECA - PAD_Y, l - PAD_X * 2);
    },
  };
}

/**
 * Coluna confrontada de Ganhos e Perdas: pílula identificando a coluna, "VOCÊ GANHA" e "VOCÊ
 * PERDE" na cor da coluna, cada um com o texto embaixo.
 */
export function colunaGanhosPerdas(o: {
  rotulo: string;
  cor: Color;
  corTexto: Color;
  ganha: string;
  perde: string;
  tipo: Tipografia;
  antes?: number;
}): Bloco {
  const t = o.tipo;
  const ALTURA_CABECA = 30;
  return cartao(
    pilha([
      desenhoLivre(ALTURA_CABECA, (p, x, yTopo) => {
        pintarPilula(p, {
          texto: o.rotulo,
          x,
          yTopo: yTopo - 2,
          altura: 22,
          fundo: o.cor,
          cor: BRANCO,
          tipo: t,
          tamanho: 8,
          entreletras: 0.8,
        });
      }),
      paragrafo("VOCÊ GANHA", t, {
        tamanho: 9, peso: "bd", cor: o.corTexto, maiusculas: true, entreletras: 0.8, antes: 12,
      }),
      paragrafo(o.ganha, t, { tamanho: 9.6, cor: GRAFITE, entrelinha: 1.5, antes: 6 }),
      paragrafo("VOCÊ PERDE", t, {
        tamanho: 9, peso: "bd", cor: o.corTexto, maiusculas: true, entreletras: 0.8, antes: 16,
      }),
      paragrafo(o.perde, t, { tamanho: 9.6, cor: GRAFITE, entrelinha: 1.5, antes: 6 }),
    ]),
    { antes: o.antes, padding: 18, paddingX: 18 },
  );
}

/**
 * Bloco escuro de destaque: o mesmo desenho da nota de leitura (filete colado na borda,
 * título + corpo), em ESCURO com texto claro — para "a frase que te segura" (#302), o único
 * ponto do relatório que fala em segunda pessoa direta.
 */
export function blocoDeDestaque(titulo: string, texto: string, tipo: Tipografia, antes = 20): Bloco {
  const dentro = pilha([
    paragrafo(titulo, tipo, {
      tamanho: 8.6, peso: "bd", cor: CIANO, maiusculas: true, entreletras: 1.1, entrelinha: 1.3,
    }),
    paragrafo(texto, tipo, { tamanho: 10.5, cor: BRANCO, entrelinha: 1.55, antes: 8 }),
  ]);
  const px = 20;
  const pd = 16;
  return {
    antes,
    atomico: true,
    altura: (l) => dentro.altura(l - px - 14) + pd * 2,
    desenhar(p, x, yTopo, l) {
      const h = this.altura(l);
      retanguloArredondado(p, { x, y: yTopo - h, largura: l, altura: h, raio: 2.5 * MM, cor: ESCURO });
      p.drawRectangle({ x, y: yTopo - h, width: 4, height: h, color: CIANO });
      dentro.desenhar(p, x + px, yTopo - pd, l - px - 14);
    },
  };
}

/**
 * Cartão de aplicação prática ("Onde Isso Aparece"): pílula com o nome da situação, o texto do
 * automático, e o bloco TÉCNICA com marcador e a recomendação em destaque.
 */
export function cartaoAplicacao(o: {
  situacao: string;
  automatico: string;
  tecnica: string;
  cor: Color;
  tipo: Tipografia;
  antes?: number;
}): Bloco {
  const t = o.tipo;
  const ALTURA_CABECA = 30;
  return cartao(
    pilha([
      desenhoLivre(ALTURA_CABECA, (p, x, yTopo) => {
        pintarPilula(p, {
          texto: o.situacao,
          x,
          yTopo: yTopo - 2,
          altura: 22,
          fundo: o.cor,
          cor: BRANCO,
          tipo: t,
          tamanho: 8,
          entreletras: 0.8,
        });
      }),
      paragrafo(o.automatico, t, { tamanho: 9.6, cor: GRAFITE, entrelinha: 1.5, antes: 12 }),
      desenhoLivre(
        16,
        (p, x, yTopo) => {
          p.drawCircle({ x: x + 3, y: yTopo - 9, size: 3, color: CIANO });
          textoEspacado(p, {
            texto: "TÉCNICA", x: x + 14, y: yTopo - 12, tamanho: 8, fonte: t.bd, cor: CIANO_TEXTO_CARTAO, entreletras: 1,
          });
        },
        14,
      ),
      paragrafo(o.tecnica, t, { tamanho: 9.6, peso: "md", cor: ESCURO, entrelinha: 1.5, antes: 4 }),
    ]),
    { antes: o.antes, padding: 18, paddingX: 18 },
  );
}
