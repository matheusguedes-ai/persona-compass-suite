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
import { ColorTypes, rgb, type Color, type PDFDocument, type PDFFont, type PDFImage } from "./pdf-lib";

/**
 * A PALETA DO SISTEMA VISUAL (#294), medida pixel a pixel na proposta aprovada.
 *
 * ⚠️ CONTRASTE É REQUISITO, NÃO ESTÉTICA — foi a queixa do dono do produto sobre a primeira
 * versão do PDF. Cada cor daqui foi medida contra o fundo onde ela é usada, pelo cálculo de
 * contraste do WCAG (4,5:1 para texto de corpo normal, 3:1 para texto grande). Cinco tons da
 * proposta não passavam e foram ESCURECIDOS o mínimo necessário, mantendo matiz e saturação —
 * a cor continua a mesma, só com força suficiente para ser lida no papel:
 *
 *   #7FA6D6 → #6A97CF   2ª linha do título          (2,52 → 3,03)
 *   #6B7F93 → #617486   cinzas de apoio, unificados (3,67–4,13 → 4,5+)
 *   #01A5FC → #017CBD   o Ciano quando vira TEXTO   (2,70 → 4,60)
 *
 * E uma correção de sentido oposto: onde o Ciano é FUNDO de texto branco (a pílula ADAPTADO, o
 * círculo da sigla adaptada), quem escurece é o FUNDO, não a letra — texto cinza sobre ciano
 * seria pior do que o problema. Daí `CIANO_FUNDO`.
 *
 * Reconferir depois de mexer: `python3 scripts/testar_pdf.py contraste`.
 */

/** Ciano Claro — a primária. Vale como MANCHA (barra, filete, preenchimento), não como texto. */
export const CIANO = rgb(0x01 / 255, 0xa5 / 255, 0xfc / 255);
/** O Ciano quando precisa ser LIDO sobre branco. */
export const CIANO_TEXTO = rgb(0x01 / 255, 0x7c / 255, 0xbd / 255);
/** O Ciano quando carrega texto branco em cima. */
export const CIANO_FUNDO = rgb(0x01 / 255, 0x7c / 255, 0xbd / 255);
/** Azul Cerúleo — a secundária. Títulos, valores e a sigla do gráfico natural. */
export const AZUL = rgb(0x02 / 255, 0x5e / 255, 0xc4 / 255);
/** O azul leve da segunda linha do título, já com contraste suficiente. */
export const AZUL_LEVE = rgb(0x6a / 255, 0x97 / 255, 0xcf / 255);
/** Azul quase preto — pílula do perfil, texto de corpo e o número acima da barra. */
export const ESCURO = rgb(0x0b / 255, 0x22 / 255, 0x39 / 255);
export const BRANCO = rgb(1, 1, 1);
export const PRETO = ESCURO;
/** Cinza de apoio: cabeçalho, rótulos, escala do gráfico e assinatura do rodapé. */
export const APOIO = rgb(0x61 / 255, 0x74 / 255, 0x86 / 255);
/** Cinza de leitura: texto da nota e letra da dimensão. */
export const GRAFITE = rgb(0x48 / 255, 0x60 / 255, 0x7a / 255);
export const CINZA = APOIO;
/** Filetes e bordas. */
export const FILETE = rgb(0xd6 / 255, 0xe1 / 255, 0xea / 255);
export const CINZA_CLARO = FILETE;
/** Fundo dos cartões. */
export const CARTAO = rgb(0xf4 / 255, 0xf8 / 255, 0xfb / 255);
export const FUNDO_SUAVE = CARTAO;
/** Trilho do termômetro — o máximo da escala. */
export const TRILHO = rgb(0xdf / 255, 0xe8 / 255, 0xf0 / 255);
/** Fundo da nota de leitura. */
export const NOTA = rgb(0xe7 / 255, 0xf3 / 255, 0xfe / 255);

/**
 * Os quatro pesos que o documento usa. Mais do que isso pesaria no asset sem ganho: o relatório é
 * texto corrido com títulos, não uma peça gráfica.
 */
export type Tipografia = {
  /** Títulos grandes de seção — o peso que a proposta aprovada usa no "INTENSIDADE DO PERFIL". */
  lt: PDFFont;
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
  /** Logo colorida com o texto em preto — para fundo claro. */
  logoCor: PDFImage;
  /**
   * A mesma logo tingida de Azul Cerúleo, para o cabeçalho das páginas (#294).
   * É a marca REAL: `scripts/gerar_logo_ceruleo.py` troca só o canal de cor do arquivo oficial
   * "Logo Intensão Preto", preservando a forma exata — nada é redesenhado.
   */
  logoCeruleo: PDFImage;
  /** Logo do mentor (white label), quando houver e quando as Configurações mandarem mostrar. */
  logoMentor: PDFImage | null;
};

const ARQUIVOS = {
  lt: "PublicaSansRound-Lt.otf",
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

/**
 * Arquivo de fonte, do bucket privado. Só o servidor alcança — ver o aviso no topo do módulo.
 *
 * ⚠️ `fetch` direto na REST do Storage, e não `supabaseAdmin.storage.download()`: dentro do
 * Worker o SDK devolvia "Gateway Timeout" para este mesmo arquivo. Um GET com a chave de serviço
 * é a mesma operação, com uma camada a menos entre o runtime e a rede.
 */
async function baixarFonte(nome: string): Promise<Uint8Array> {
  const chave = `storage:${nome}`;
  const guardado = emMemoria.get(chave);
  if (guardado) return guardado;

  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const servico = process.env.APP_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !servico) {
    throw new Error(
      `Sem credencial para ler a fonte ${nome}: falta SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY. ` +
        `A fonte do método é licenciada e mora em bucket privado — sem a chave, o PDF não sai.`,
    );
  }
  const r = await fetch(`${url.replace(/\/$/, "")}/storage/v1/object/${BUCKET_FONTES}/${PASTA_FONTES}/${nome}`, {
    headers: { apikey: servico, Authorization: `Bearer ${servico}` },
  });
  if (!r.ok) {
    throw new Error(
      `Não consegui carregar a fonte ${nome} do bucket "${BUCKET_FONTES}" (HTTP ${r.status}). ` +
        `O PDF não sai com outra fonte — a tipografia é parte da identidade do método.`,
    );
  }
  const bytes = new Uint8Array(await r.arrayBuffer());
  emMemoria.set(chave, bytes);
  return bytes;
}

/** Embute os quatro pesos no documento. Falha alto: PDF sem a fonte da marca não é entregável. */
export async function carregarTipografia(doc: PDFDocument): Promise<Tipografia> {
  // Baixar em paralelo (rede) e EMBUTIR EM ORDEM FIXA (documento) são coisas separadas de
  // propósito: cada `embedFont` registra objetos dentro do PDF, e deixar a ordem depender de qual
  // download termina primeiro faz o mesmo relatório sair com bytes diferentes a cada geração.
  // Em Node isso não aparecia; no workerd, sim — e o critério (b) da demanda é exatamente este.
  const [ltB, rgB, mdB, bdB, xbdB] = await Promise.all(
    (Object.keys(ARQUIVOS) as Array<keyof typeof ARQUIVOS>).map((k) => baixarFonte(ARQUIVOS[k])),
  );
  // ⚠️ `subset: false` é OBRIGATÓRIO aqui, não desleixo. A Publica Sans Round é uma fonte CFF com
  // ligaduras, e o subsetting do pdf-lib deixa os glifos "fi" e "fl" para trás enquanto o texto
  // continua apontando para eles: "perfil" saía "perfl", "gráficos" saía "gráfcos", "confiança"
  // saía "confança". Num relatório sobre o comportamento de uma pessoa, texto corrompido é pior
  // do que arquivo grande. Embutir a família inteira custa ~57 KB por peso no PDF — e é o que
  // torna o documento legível em qualquer leitor, que é o ponto da demanda.
  const lt = await doc.embedFont(ltB, { subset: false });
  const rg = await doc.embedFont(rgB, { subset: false });
  const md = await doc.embedFont(mdB, { subset: false });
  const bd = await doc.embedFont(bdB, { subset: false });
  const xbd = await doc.embedFont(xbdB, { subset: false });
  return { lt, rg, md, bd, xbd };
}

export async function carregarIlustracoes(
  doc: PDFDocument,
  origem: string,
  logoMentorUrl: string | null,
): Promise<Ilustracoes> {
  const [branca, cor, ceruleo] = await Promise.all([
    baixar(origem, "/marca/intencao-branco.png"),
    baixar(origem, "/marca/intencao-cor.png"),
    baixar(origem, "/marca/intencao-ceruleo.png"),
  ]);
  // Mesma regra das fontes: o que ENTRA no documento entra em ordem fixa.
  const logoBranca = await doc.embedPng(branca);
  const logoCor = await doc.embedPng(cor);
  const logoCeruleo = await doc.embedPng(ceruleo);
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
  return { logoBranca, logoCor, logoCeruleo, logoMentor };
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
