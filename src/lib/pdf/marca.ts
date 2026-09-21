/**
 * IDENTIDADE DO MÉTODO INTENÇÃO no PDF (#293, fatia 1).
 *
 * A fonte oficial é a **Publica Sans Round** (FaceType), licenciada pelo dono do produto. Ela vai
 * EMBUTIDA no arquivo, não referenciada: o PDF carrega os glifos que usou, então abre igual em
 * qualquer leitor, em qualquer máquina, com ou sem a fonte instalada.
 *
 * ⚠️ ONDE CADA COISA MORA, e por quê:
 *
 *   - as FONTES ficam no bucket PRIVADO `fontes` do Supabase e só são lidas com a chave de
 *     serviço, que vive no servidor. A Publica Sans Round é licenciada, não livre: publicá-la em
 *     `public/` deixaria qualquer pessoa baixar a fonte pelo endereço do site, e versioná-la neste
 *     repositório — que é PÚBLICO — seria redistribuí-la. Nenhuma das duas coisas a licença
 *     permite. Embutir os glifos no PDF é uso normal de documento; servir o arquivo da fonte, não.
 *   - as LOGOS ficam em `public/marca/`, como asset estático. São ativos do próprio método, já
 *     aparecem no site, e assim não pesam no bundle do Worker (que tem teto de tamanho).
 *
 * ⚠️ NUNCA substituir por fonte parecida. O relatório é o artefato mais visível do método, e a
 * tipografia é metade da identidade. Faltando o arquivo, o certo é falhar e avisar — ver
 * `carregarTipografia`.
 */
import { ColorTypes, rgb, type Color, type PDFDocument, type PDFFont, type PDFImage } from "pdf-lib";

/** Ciano Claro — a cor primária da marca. */
export const CIANO = rgb(0x01 / 255, 0xa5 / 255, 0xfc / 255);
/** Azul Cerúleo — a secundária. */
export const AZUL = rgb(0x02 / 255, 0x5e / 255, 0xc4 / 255);
export const BRANCO = rgb(1, 1, 1);
export const PRETO = rgb(0.07, 0.07, 0.09);
/** Cinzas: são o preto em menos força, não cores novas da paleta. */
export const GRAFITE = rgb(0.29, 0.29, 0.32);
export const CINZA = rgb(0.45, 0.45, 0.49);
export const CINZA_CLARO = rgb(0.84, 0.85, 0.87);
export const FUNDO_SUAVE = rgb(0.965, 0.97, 0.98);

/**
 * Os quatro pesos que o documento usa. Mais do que isso pesaria no asset sem ganho: o relatório é
 * texto corrido com títulos, não uma peça gráfica.
 */
export type Tipografia = {
  /** Corpo do texto. */
  rg: PDFFont;
  /** Rótulos, legendas e destaques dentro do parágrafo. */
  md: PDFFont;
  /** Títulos de seção. */
  bd: PDFFont;
  /** Capa e números grandes. */
  xbd: PDFFont;
};

export type Ilustracoes = {
  /** Logo com a palavra "Intenção" em branco — para fundo colorido (a capa). */
  logoBranca: PDFImage;
  /** Logo colorida com o texto em preto — para fundo claro (o cabeçalho). */
  logoCor: PDFImage;
  /** Logo do mentor (white label), quando houver e quando as Configurações mandarem mostrar. */
  logoMentor: PDFImage | null;
};

const ARQUIVOS = {
  rg: "PublicaSansRound-Rg.otf",
  md: "PublicaSansRound-Md.otf",
  bd: "PublicaSansRound-Bd.otf",
  xbd: "PublicaSansRound-XBd.otf",
} as const;

/** Pasta das fontes dentro do bucket privado. */
const BUCKET_FONTES = "fontes";
const PASTA_FONTES = "publica-sans-round";

/**
 * Cache por isolate: o Worker reaproveita o processo entre requisições, então a fonte é baixada uma
 * vez e os PDFs seguintes já a encontram em memória.
 */
const emMemoria = new Map<string, Uint8Array>();

/** Asset estático do próprio site (as logos). */
async function baixar(origem: string, caminho: string): Promise<Uint8Array> {
  const chave = `${origem}${caminho}`;
  const guardado = emMemoria.get(chave);
  if (guardado) return guardado;
  const r = await fetch(chave);
  if (!r.ok) {
    throw new Error(
      `Não consegui carregar ${caminho} (${r.status}). O PDF do relatório não sai sem a logo da ` +
        `marca — conferir se public/marca/ foi publicado junto com o código.`,
    );
  }
  const bytes = new Uint8Array(await r.arrayBuffer());
  emMemoria.set(chave, bytes);
  return bytes;
}

/** Arquivo de fonte, do bucket privado. Só o servidor alcança — ver o aviso no topo do módulo. */
async function baixarFonte(nome: string): Promise<Uint8Array> {
  const chave = `storage:${nome}`;
  const guardado = emMemoria.get(chave);
  if (guardado) return guardado;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_FONTES)
    .download(`${PASTA_FONTES}/${nome}`);
  if (error || !data) {
    throw new Error(
      `Não consegui carregar a fonte ${nome} do bucket "${BUCKET_FONTES}"` +
        `${error ? `: ${error.message}` : ""}. O PDF não sai com outra fonte — a tipografia é ` +
        `parte da identidade do método.`,
    );
  }
  const bytes = new Uint8Array(await data.arrayBuffer());
  emMemoria.set(chave, bytes);
  return bytes;
}

/** Embute os quatro pesos no documento. Falha alto: PDF sem a fonte da marca não é entregável. */
export async function carregarTipografia(doc: PDFDocument): Promise<Tipografia> {
  const [rgB, mdB, bdB, xbdB] = await Promise.all(
    (Object.keys(ARQUIVOS) as Array<keyof typeof ARQUIVOS>).map((k) => baixarFonte(ARQUIVOS[k])),
  );
  // ⚠️ `subset: false` é OBRIGATÓRIO aqui, não desleixo. A Publica Sans Round é uma fonte CFF com
  // ligaduras, e o subsetting do pdf-lib deixa os glifos "fi" e "fl" para trás enquanto o texto
  // continua apontando para eles: "perfil" saía "perfl", "gráficos" saía "gráfcos", "confiança"
  // saía "confança". Num relatório sobre o comportamento de uma pessoa, texto corrompido é pior
  // do que arquivo grande. Embutir a família inteira custa ~57 KB por peso no PDF — e é o que
  // torna o documento legível em qualquer leitor, que é o ponto da demanda.
  const [rg, md, bd, xbd] = await Promise.all([
    doc.embedFont(rgB, { subset: false }),
    doc.embedFont(mdB, { subset: false }),
    doc.embedFont(bdB, { subset: false }),
    doc.embedFont(xbdB, { subset: false }),
  ]);
  return { rg, md, bd, xbd };
}

export async function carregarIlustracoes(
  doc: PDFDocument,
  origem: string,
  logoMentorUrl: string | null,
): Promise<Ilustracoes> {
  const [branca, cor] = await Promise.all([
    baixar(origem, "/marca/intencao-branco.png"),
    baixar(origem, "/marca/intencao-cor.png"),
  ]);
  let logoMentor: PDFImage | null = null;
  if (logoMentorUrl) {
    // A logo do mentor é arquivo de terceiro (upload dele): pode estar fora do ar, ter formato que
    // o pdf-lib não abre ou ser grande demais. Nada disso pode derrubar o relatório inteiro.
    try {
      const r = await fetch(logoMentorUrl);
      if (r.ok) {
        const bytes = new Uint8Array(await r.arrayBuffer());
        const tipo = (r.headers.get("content-type") ?? "").toLowerCase();
        logoMentor = tipo.includes("jpeg") || tipo.includes("jpg")
          ? await doc.embedJpg(bytes)
          : await doc.embedPng(bytes);
      }
    } catch {
      logoMentor = null;
    }
  }
  return {
    logoBranca: await doc.embedPng(branca),
    logoCor: await doc.embedPng(cor),
    logoMentor,
  };
}

/**
 * A mesma cor, mais fraca — o equivalente ao `opacity: 0.45` que a tela usa nas barras que não
 * entram na sigla. Pintar essas barras de cinza puro as fazia sumir dentro do trilho, que também
 * é cinza: o Colérico da referência, que lidera o gráfico natural, ficava invisível no papel.
 */
export function esmaecer(c: Color, forca = 0.45): Color {
  // Todas as cores deste documento nascem de `rgb()`; qualquer outra volta como está.
  if (c.type !== ColorTypes.RGB) return c;
  const claro = (v: number) => v + (1 - v) * (1 - forca);
  return rgb(claro(c.red), claro(c.green), claro(c.blue));
}

/**
 * A cor que o mentor escolheu nas Configurações, quando for um `#rrggbb` legível. Fora isso, o
 * Ciano da marca. A marca do mentor manda no relatório dele (#232, white label) — o que esta fatia
 * garante é que o documento tem uma identidade, não que ela seja sempre a mesma.
 */
export function corDaMarca(valor: string | null | undefined) {
  const m = /^#?([0-9a-f]{6})$/i.exec((valor ?? "").trim());
  if (!m) return CIANO;
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
