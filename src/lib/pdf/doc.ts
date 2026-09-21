/**
 * MOTOR DE DIAGRAMAÇÃO do PDF (#293, fatia 1).
 *
 * Até aqui, "baixar PDF" era `window.print()`: o arquivo saía do navegador de quem clicava, e por
 * isso dependia da impressora virtual, das margens e do papel configurados na máquina da pessoa.
 * Dois alunos geravam arquivos diferentes do mesmo relatório. Aqui o documento é montado no
 * servidor, página a página, e a mesma entrada devolve sempre os mesmos bytes.
 *
 * O desenho é feito em DUAS FASES, e é isso que permite quebra de página honesta:
 *   1. cada bloco sabe dizer a altura que vai ocupar numa dada largura, ANTES de desenhar;
 *   2. o fluxo decide em que página ele cabe e só então manda desenhar.
 *
 * Com isso valem três regras que a impressão do navegador não sustentava:
 *   - bloco ATÔMICO (gráfico, tabela, caixa) nunca é partido ao meio;
 *   - bloco COLADO no próximo (título) não fica sozinho no pé da página;
 *   - parágrafo só parte deixando pelo menos duas linhas de cada lado.
 *
 * Coordenadas: o PDF conta o Y de baixo para cima; aqui todo mundo pensa de cima para baixo
 * (`yTopo`), e a conversão acontece num lugar só, no `desenhar` de cada primitiva.
 */
import {
  PDFDocument,
  PDFPage,
  setCharacterSpacing,
  type Color,
  type PDFFont,
  type PDFImage,
} from "./pdf-lib";
import { CINZA, CINZA_CLARO, GRAFITE, PRETO, type Tipografia } from "./marca";

/** A4 em pontos (1 pt = 1/72"). 210 × 297 mm. */
export const A4 = { largura: 595.28, altura: 841.89 };
/**
 * ⚠️ O topo e a base precisam caber o ORNAMENTO do sistema visual (#294): o cabeçalho ocupa até
 * ~60pt do alto e o rodapé ~46pt do pé. Margens menores fazem o conteúdo encostar no filete — foi
 * o que aconteceu na primeira montagem, com a ressalva colada no cabeçalho.
 */
export const MARGEM = { topo: 92, base: 78, esquerda: 51, direita: 51 };
export const LARGURA_UTIL = A4.largura - MARGEM.esquerda - MARGEM.direita;

/** Um pedaço de texto com peso próprio — é assim que o **negrito** do conteúdo sobrevive. */
export type Trecho = { texto: string; forte?: boolean };

export type Bloco = {
  altura(l: number): number;
  desenhar(p: PDFPage, x: number, yTopo: number, l: number): void;
  /** Não pode ser partido entre páginas. */
  atomico?: boolean;
  /** O bloco seguinte tem de começar na mesma página que este. */
  colaNoProximo?: boolean;
  /** Espaço acima do bloco (ignorado quando ele abre a página). */
  antes?: number;
  /** Parte o bloco no espaço disponível. `null` = não vale a pena partir aqui. */
  partir?(l: number, disponivel: number): [Bloco, Bloco] | null;
};

const CONTROLES = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]", "g");

/**
 * Tira do texto o que não pode ir para o PDF: quebras de linha soltas viram espaço (o `drawText`
 * do pdf-lib as desenharia como glifo vazio), caracteres de controle somem, e o NFC junta acentos
 * combinantes num único ponto de código — sem isso, "ção" digitado no Mac pode chegar como "c + ̧"
 * e sair sem cedilha.
 */
export function limpar(t: string): string {
  return (t ?? "")
    .normalize("NFC")
    .replace(CONTROLES, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[  ]{2,}/g, " ")
    .trim();
}

/**
 * Texto com espaçamento entre letras (os rótulos em caixa alta da marca).
 *
 * ⚠️ Usa o operador `Tc` do PDF, não um `drawText` por caractere. Desenhando letra a letra o
 * documento fica igual na tela e QUEBRA na hora de usar: quem copia o texto do leitor recebe
 * "I N T E N S I D A D E", e a busca dentro do PDF não encontra a palavra.
 */
export function textoEspacado(
  p: PDFPage,
  o: { texto: string; x: number; y: number; tamanho: number; fonte: PDFFont; cor: Color; entreletras: number },
) {
  p.pushOperators(setCharacterSpacing(o.entreletras));
  p.drawText(o.texto, { x: o.x, y: o.y, size: o.tamanho, font: o.fonte, color: o.cor });
  p.pushOperators(setCharacterSpacing(0));
}

/** A largura que `textoEspacado` ocupa. */
export function larguraEspacada(texto: string, fonte: PDFFont, tamanho: number, entreletras: number) {
  return fonte.widthOfTextAtSize(texto, tamanho) + entreletras * texto.length;
}

/** Divide `**assim**` em trechos normais e fortes, do jeito que a tela faz com `comNegrito`. */
export function trechos(texto: string): Trecho[] {
  const saida: Trecho[] = [];
  for (const parte of limpar(texto).split(/(\*\*[^*]+\*\*)/g)) {
    if (!parte) continue;
    const forte = parte.startsWith("**") && parte.endsWith("**") && parte.length > 4;
    saida.push({ texto: forte ? parte.slice(2, -2) : parte, forte });
  }
  return saida.length > 0 ? saida : [{ texto: "" }];
}

type Palavra = { texto: string; forte: boolean; largura: number };
type Linha = { palavras: Palavra[]; largura: number };

function medirPalavras(ts: Trecho[], rg: PDFFont, md: PDFFont, tamanho: number): Palavra[] {
  const saida: Palavra[] = [];
  for (const t of ts) {
    for (const p of t.texto.split(/\s+/)) {
      if (p === "") continue;
      const fonte = t.forte ? md : rg;
      saida.push({ texto: p, forte: !!t.forte, largura: fonte.widthOfTextAtSize(p, tamanho) });
    }
  }
  return saida;
}

function quebrar(palavras: Palavra[], l: number, espacoRg: number): Linha[] {
  const linhas: Linha[] = [];
  let atual: Palavra[] = [];
  let larg = 0;
  for (const p of palavras) {
    const adicional = atual.length === 0 ? p.largura : espacoRg + p.largura;
    if (atual.length > 0 && larg + adicional > l) {
      linhas.push({ palavras: atual, largura: larg });
      atual = [p];
      larg = p.largura;
    } else {
      atual.push(p);
      larg += adicional;
    }
  }
  if (atual.length > 0) linhas.push({ palavras: atual, largura: larg });
  return linhas.length > 0 ? linhas : [{ palavras: [], largura: 0 }];
}

export type EstiloTexto = {
  tamanho?: number;
  cor?: Color;
  /** Multiplicador do tamanho. 1.45 é o corpo confortável em A4. */
  entrelinha?: number;
  /** Peso do texto normal; o **negrito** sobe um degrau a partir dele. */
  peso?: "rg" | "md" | "bd" | "xbd";
  alinhamento?: "esquerda" | "centro" | "direita";
  antes?: number;
  /** Quantas linhas, no mínimo, ficam de cada lado quando o parágrafo parte. */
  minLinhas?: number;
  maiusculas?: boolean;
  /** Espaçamento entre letras, para os rótulos em caixa alta. */
  entreletras?: number;
};

/**
 * Parágrafo de texto. É o único bloco DIVISÍVEL do motor: quando não cabe inteiro, ele parte —
 * mas só se sobrarem ao menos `minLinhas` de cada lado, para não deixar linha órfã no pé nem no
 * topo da página.
 */
export function paragrafo(conteudo: string | Trecho[], tipo: Tipografia, e: EstiloTexto = {}): Bloco {
  const tamanho = e.tamanho ?? 10;
  const entrelinha = (e.entrelinha ?? 1.45) * tamanho;
  const peso = e.peso ?? "rg";
  const normal = tipo[peso];
  const forte = peso === "rg" ? tipo.md : peso === "md" ? tipo.bd : tipo.xbd;
  const cor = e.cor ?? GRAFITE;
  const entreletras = e.entreletras ?? 0;
  const minLinhas = e.minLinhas ?? 2;
  const brutos = typeof conteudo === "string" ? trechos(conteudo) : conteudo;
  const ts = e.maiusculas
    ? brutos.map((t) => ({ ...t, texto: t.texto.toLocaleUpperCase("pt-BR") }))
    : brutos;
  const espaco = normal.widthOfTextAtSize(" ", tamanho) + entreletras;

  // O cache evita remedir as mesmas palavras a cada consulta de altura — o fluxo pergunta várias
  // vezes pelo mesmo bloco antes de decidir onde ele entra.
  let cache: { l: number; linhas: Linha[] } | null = null;
  const linhasEm = (l: number) => {
    if (cache?.l !== l) {
      const ps = medirPalavras(ts, normal, forte, tamanho).map((p) =>
        entreletras ? { ...p, largura: p.largura + entreletras * p.texto.length } : p,
      );
      cache = { l, linhas: quebrar(ps, l, espaco) };
    }
    return cache.linhas;
  };

  const daLinhas = (linhas: Linha[]): Bloco => ({
    antes: e.antes,
    altura: () => linhas.length * entrelinha,
    desenhar(p, x, yTopo, l) {
      let y = yTopo - tamanho * 0.86;
      for (const linha of linhas) {
        let cx =
          e.alinhamento === "centro"
            ? x + (l - linha.largura) / 2
            : e.alinhamento === "direita"
              ? x + l - linha.largura
              : x;
        for (const palavra of linha.palavras) {
          const f = palavra.forte ? forte : normal;
          if (entreletras) {
            textoEspacado(p, {
              texto: palavra.texto, x: cx, y, tamanho, fonte: f, cor, entreletras,
            });
          } else {
            p.drawText(palavra.texto, { x: cx, y, size: tamanho, font: f, color: cor });
          }
          cx += palavra.largura + espaco;
        }
        y -= entrelinha;
      }
    },
    partir(l, disponivel) {
      const cabem = Math.floor(disponivel / entrelinha);
      if (cabem < minLinhas || linhas.length - cabem < minLinhas) return null;
      return [daLinhas(linhas.slice(0, cabem)), daLinhas(linhas.slice(cabem))];
    },
  });

  return {
    antes: e.antes,
    altura: (l) => linhasEm(l).length * entrelinha,
    desenhar: (p, x, y, l) => daLinhas(linhasEm(l)).desenhar(p, x, y, l),
    partir: (l, disponivel) => daLinhas(linhasEm(l)).partir!(l, disponivel),
  };
}

/** Título de seção: cola no que vem depois, para nunca sobrar sozinho no pé da página. */
export function titulo(texto: string, tipo: Tipografia, e: EstiloTexto = {}): Bloco {
  return {
    ...paragrafo(texto, tipo, {
      tamanho: e.tamanho ?? 15,
      peso: e.peso ?? "bd",
      cor: e.cor ?? PRETO,
      entrelinha: e.entrelinha ?? 1.25,
      alinhamento: e.alinhamento,
      maiusculas: e.maiusculas,
      entreletras: e.entreletras,
      antes: e.antes,
    }),
    colaNoProximo: true,
  };
}

/**
 * Marcador de quebra de página dentro de uma lista de blocos.
 *
 * O fluxo empilha blocos; às vezes uma SEÇÃO inteira precisa começar na folha seguinte — a
 * página de intensidade é uma peça só, e parti-la ao meio desmonta a leitura que a proposta
 * desenhou. O `fluir` reconhece este marcador e vira a página.
 */
export const QUEBRA_DE_PAGINA: unique symbol = Symbol("quebra");
/** Quando presente, a quebra só acontece se faltar este tanto de espaço na página atual. */
export const QUEBRA_SE_MENOS_QUE: unique symbol = Symbol("quebraSe");

export function quebraDePagina(): Bloco {
  return { altura: () => 0, desenhar: () => {}, [QUEBRA_DE_PAGINA]: true } as Bloco;
}

/**
 * Quebra CONDICIONAL: vira a página só se o que resta nela for menor que `minimo`.
 *
 * A quebra incondicional criava o defeito oposto ao que resolvia. Na bateria, a abertura de cada
 * parte ("PARTE 2 DE 5", título, descrição) caía numa página, e a página de intensidade — que
 * pedia folha nova — empurrava tudo para a seguinte: sobrava uma folha com três linhas no alto e
 * o resto branco. Com a condicional, a seção só pula quando realmente não cabe.
 */
export function quebraSeFaltarEspaco(minimo: number): Bloco {
  return {
    altura: () => 0,
    desenhar: () => {},
    [QUEBRA_DE_PAGINA]: true,
    [QUEBRA_SE_MENOS_QUE]: minimo,
  } as Bloco;
}

export function espaco(h: number): Bloco {
  return { altura: () => h, desenhar: () => {} };
}

/** Linha fina de separação. */
export function regua(cor: Color = CINZA_CLARO, espessura = 0.6, antes = 0): Bloco {
  return {
    antes,
    atomico: true,
    altura: () => espessura,
    desenhar: (p, x, yTopo, l) =>
      p.drawRectangle({ x, y: yTopo - espessura, width: l, height: espessura, color: cor }),
  };
}

/** Empilha blocos numa coluna, tratando o conjunto como um bloco só (atômico por padrão). */
export function pilha(blocos: Array<Bloco | null | undefined>, opcoes: { atomico?: boolean; antes?: number } = {}): Bloco {
  const usados = blocos.filter((b): b is Bloco => !!b);
  const alturaDe = (l: number) =>
    usados.reduce((s, b, i) => s + (i > 0 ? (b.antes ?? 0) : 0) + b.altura(l), 0);
  return {
    antes: opcoes.antes,
    atomico: opcoes.atomico !== false,
    altura: alturaDe,
    desenhar(p, x, yTopo, l) {
      let y = yTopo;
      usados.forEach((b, i) => {
        if (i > 0) y -= b.antes ?? 0;
        b.desenhar(p, x, y, l);
        y -= b.altura(l);
      });
    },
  };
}

/** Duas ou mais colunas lado a lado, todas com a altura da mais alta. */
export function colunas(cols: Bloco[], opcoes: { vao?: number; antes?: number } = {}): Bloco {
  const vao = opcoes.vao ?? 16;
  const larguraCol = (l: number) => (l - vao * (cols.length - 1)) / cols.length;
  return {
    antes: opcoes.antes,
    atomico: true,
    altura: (l) => Math.max(...cols.map((c) => c.altura(larguraCol(l)))),
    desenhar(p, x, yTopo, l) {
      const lc = larguraCol(l);
      cols.forEach((c, i) => c.desenhar(p, x + i * (lc + vao), yTopo, lc));
    },
  };
}

/** Caixa com fundo e/ou moldura em volta de um conteúdo. */
export function caixa(
  dentro: Bloco,
  e: {
    fundo?: Color;
    borda?: Color;
    espessura?: number;
    padding?: number;
    paddingX?: number;
    /** Tarja colorida na lateral esquerda, como um marcador. */
    tarja?: Color;
    antes?: number;
    tracejada?: boolean;
  } = {},
): Bloco {
  const pd = e.padding ?? 12;
  const px = e.paddingX ?? pd;
  const tarja = e.tarja ? 3 : 0;
  return {
    antes: e.antes,
    atomico: true,
    altura: (l) => dentro.altura(l - px * 2 - tarja) + pd * 2,
    desenhar(p, x, yTopo, l) {
      const h = this.altura(l);
      if (e.fundo || e.borda) {
        p.drawRectangle({
          x,
          y: yTopo - h,
          width: l,
          height: h,
          color: e.fundo,
          borderColor: e.borda,
          borderWidth: e.borda ? (e.espessura ?? 0.7) : undefined,
          borderDashArray: e.tracejada ? [3, 2.4] : undefined,
        });
      }
      if (e.tarja) p.drawRectangle({ x, y: yTopo - h, width: tarja, height: h, color: e.tarja });
      dentro.desenhar(p, x + px + tarja, yTopo - pd, l - px * 2 - tarja);
    },
  };
}

/** Imagem com largura fixa, mantendo a proporção. */
export function imagem(
  img: PDFImage,
  larguraPt: number,
  e: { alinhamento?: "esquerda" | "centro" | "direita"; antes?: number } = {},
): Bloco {
  const h = (img.height / img.width) * larguraPt;
  return {
    antes: e.antes,
    atomico: true,
    altura: () => h,
    desenhar(p, x, yTopo, l) {
      const cx =
        e.alinhamento === "centro"
          ? x + (l - larguraPt) / 2
          : e.alinhamento === "direita"
            ? x + l - larguraPt
            : x;
      p.drawImage(img, { x: cx, y: yTopo - h, width: larguraPt, height: h });
    },
  };
}

/** Bloco de altura conhecida desenhado à mão — para gráficos e tabelas. */
export function desenhoLivre(
  altura: number,
  pintar: (p: PDFPage, x: number, yTopo: number, l: number) => void,
  antes = 0,
): Bloco {
  return { antes, atomico: true, altura: () => altura, desenhar: pintar };
}

/**
 * O documento: carrega páginas, conduz o fluxo e, no fim, manda ornamentar todas as páginas de
 * conteúdo — o cabeçalho e a numeração só podem ser escritos no fim, porque "página 3" precisa
 * saber quantas são.
 *
 * ⚠️ O motor não conhece o sistema visual: quem sabe desenhar cabeçalho, rodapé e fundo é
 * `sistema.ts`, e ele entra aqui como FUNÇÃO. Assim o mesmo motor serve ao relatório, ao
 * certificado (#221) e ao PDF individual (#280), cada um com o seu ornamento.
 */
export class Documento {
  readonly pdf: PDFDocument;
  private paginas: PDFPage[] = [];
  /** Páginas que não levam cabeçalho nem número (a capa). */
  private semOrnamento = new Set<PDFPage>();
  private atual: PDFPage | null = null;
  private y = 0;
  /** Desenhado ASSIM QUE a página abre, para ficar atrás do conteúdo (textura, marca d'água). */
  private fundo: ((p: PDFPage) => void) | null = null;

  constructor(pdf: PDFDocument, _tipo?: unknown) {
    this.pdf = pdf;
  }

  /** Define o fundo das próximas páginas. `null` desliga. */
  usarFundo(pintor: ((p: PDFPage) => void) | null) {
    this.fundo = pintor;
  }

  get pagina(): PDFPage {
    if (!this.atual) this.novaPagina();
    return this.atual!;
  }

  /** Abre uma folha nova. `ornamentada: false` deixa a folha limpa (capa). */
  novaPagina(ornamentada = true): PDFPage {
    const p = this.pdf.addPage([A4.largura, A4.altura]);
    this.paginas.push(p);
    if (!ornamentada) this.semOrnamento.add(p);
    this.atual = p;
    this.y = A4.altura - MARGEM.topo;
    if (ornamentada && this.fundo) this.fundo(p);
    return p;
  }

  private get sobra() {
    return this.y - MARGEM.base;
  }

  private get noTopo() {
    return Math.abs(this.y - (A4.altura - MARGEM.topo)) < 0.01;
  }

  /**
   * Quanto o bloco seguinte precisa, no mínimo, para o anterior não ficar órfão. Um bloco atômico
   * exige a altura inteira (quando ela couber numa página); um parágrafo exige duas linhas.
   */
  private minimoDe(b: Bloco | undefined, l: number): number {
    if (!b) return 0;
    const h = b.altura(l);
    const cabeInteiro = h <= A4.altura - MARGEM.topo - MARGEM.base;
    if (b.atomico) return cabeInteiro ? h : 0;
    return Math.min(h, 34);
  }

  /** Coloca a lista de blocos no papel, abrindo páginas conforme precisar. */
  fluir(blocos: Array<Bloco | null | undefined>, l = LARGURA_UTIL, x = MARGEM.esquerda) {
    const fila = blocos.filter((b): b is Bloco => !!b);
    for (let i = 0; i < fila.length; i++) {
      let b = fila[i];
      const marcas = b as unknown as Record<symbol, number | boolean | undefined>;
      if (marcas[QUEBRA_DE_PAGINA]) {
        const minimo = marcas[QUEBRA_SE_MENOS_QUE];
        if (typeof minimo !== "number" || this.espacoRestante < minimo) this.quebrarPagina();
        continue;
      }
      if (!this.atual) this.novaPagina();
      const espacoAntes = this.noTopo ? 0 : (b.antes ?? 0);
      let h = b.altura(l);
      const exigido = h + espacoAntes + (b.colaNoProximo ? this.minimoDe(fila[i + 1], l) : 0);

      if (exigido > this.sobra) {
        const disponivel = this.sobra - espacoAntes;
        const partes = !b.atomico && disponivel > 0 ? b.partir?.(l, disponivel) : null;
        if (partes) {
          this.y -= espacoAntes;
          partes[0].desenhar(this.pagina, x, this.y, l);
          this.novaPagina();
          b = partes[1];
          h = b.altura(l);
        } else {
          this.novaPagina();
        }
      } else {
        this.y -= espacoAntes;
      }
      b.desenhar(this.pagina, x, this.y, l);
      this.y -= h;
    }
  }

  /**
   * Força o conteúdo seguinte a começar numa folha nova.
   *
   * ⚠️ A checagem de "já estou no topo" não basta: a CAPA é desenhada fora do fluxo, então o
   * cursor continua no topo dela e o corpo inteiro acabava impresso por cima. Uma folha sem
   * ornamento nunca recebe fluxo, e por isso sempre vira página aqui.
   */
  quebrarPagina() {
    if (!this.atual || !this.noTopo || this.semOrnamento.has(this.atual)) this.novaPagina();
  }

  /** Quanto ainda cabe na página atual — para decidir se vale abrir uma seção aqui. */
  get espacoRestante() {
    return this.sobra;
  }

  /** Ornamenta cada página de conteúdo. Roda por último: antes disso não se sabe o total. */
  finalizar(pintar: (p: PDFPage, pagina: number, total: number) => void) {
    const contam = this.paginas.filter((p) => !this.semOrnamento.has(p));
    contam.forEach((p, i) => pintar(p, i + 1, contam.length));
  }
}

/** Retângulo com cantos arredondados — o pdf-lib só desenha canto reto. */
export function retanguloArredondado(
  p: PDFPage,
  o: { x: number; y: number; largura: number; altura: number; raio: number; cor?: Color },
) {
  const r = Math.min(o.raio, o.largura / 2, o.altura / 2);
  // Duas faixas cruzadas cobrem o miolo; quatro círculos fecham os cantos.
  p.drawRectangle({ x: o.x + r, y: o.y, width: o.largura - r * 2, height: o.altura, color: o.cor });
  p.drawRectangle({ x: o.x, y: o.y + r, width: o.largura, height: o.altura - r * 2, color: o.cor });
  for (const [cx, cy] of [
    [o.x + r, o.y + r],
    [o.x + o.largura - r, o.y + r],
    [o.x + r, o.y + o.altura - r],
    [o.x + o.largura - r, o.y + o.altura - r],
  ]) {
    p.drawCircle({ x: cx, y: cy, size: r, color: o.cor });
  }
}

/** Uma barra de gráfico: trilho claro com o preenchimento proporcional em cima. */
export function pintarBarra(
  p: PDFPage,
  o: { x: number; y: number; largura: number; altura: number; valor: number; cor: Color },
) {
  const pct = Math.max(0, Math.min(100, o.valor)) / 100;
  retanguloArredondado(p, {
    x: o.x,
    y: o.y,
    largura: o.largura,
    altura: o.altura,
    raio: o.altura / 2,
    cor: CINZA_CLARO,
  });
  if (pct > 0) {
    retanguloArredondado(p, {
      x: o.x,
      y: o.y,
      largura: Math.max(o.altura, o.largura * pct),
      altura: o.altura,
      raio: o.altura / 2,
      cor: o.cor,
    });
  }
}
