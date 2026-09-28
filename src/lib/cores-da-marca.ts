/**
 * As cores da marca do mentor nos DOIS temas (#285B).
 *
 * Até a #285B a marca entrava igual no claro e no escuro, e as duas cores foram escolhidas olhando
 * a tela clara. No escuro isso quebrava: a conta do dono tem `#000000` como cor secundária — preta
 * sobre o fundo quase preto, 1,0:1 pelo cálculo do WCAG — e todo link, título e borda pintados com
 * ela sumiam. A queixa que abriu a demanda ("no modo escuro botões e links somem") era isso.
 *
 * A regra agora:
 * - **claro**: EXATAMENTE como antes (a cor crua e o mesmo critério de texto por cima) — o critério
 *   da demanda é que o claro continue igual ao de hoje. O que o claro ainda reprova está anotado
 *   em `textoSobreNoClaro` e é decisão do dono, não deste arquivo.
 * - **escuro**: a mesma matiz, clareada o MÍNIMO para se ler sobre a superfície escura mais clara
 *   (o mesmo princípio que o PDF da #294 usou para escurecer os tons do claro), e o texto por cima
 *   é o que tiver mais contraste entre quase-preto e branco.
 *
 * Arquivo sem React e sem servidor de propósito: o teste de contraste
 * (`python3 scripts/testar_pdf.py contraste`) chama ESTAS funções, não uma cópia delas.
 */

export const CONTRASTE_MINIMO = 4.5;

/**
 * A superfície escura mais clara onde texto com a cor da marca aparece: o `--muted` do bloco `.dark`
 * de `src/styles.css`. Passar nela é passar também no `--card` e no `--background`, que são mais
 * escuros. O teste de contraste confere que este valor continua igual ao do CSS.
 */
export const SUPERFICIE_ESCURA_OKLCH: readonly [number, number, number] = [0.279, 0.041, 260.031];

const QUASE_PRETO = "#111111";
const BRANCO = "#ffffff";

type Rgb = [number, number, number];

export function hexParaRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb;
}

function rgbParaHex(rgb: Rgb): string {
  return "#" + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0")).join("");
}

const paraLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const paraGama = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** Luminância relativa do WCAG 2.x. */
export function luminancia(hex: string): number {
  const rgb = hexParaRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste do WCAG 2.x entre duas cores (1 a 21). */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function rgbParaOklch([r, g, b]: Rgb): [number, number, number] {
  const [lr, lg, lb] = [paraLinear(r), paraLinear(g), paraLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), (Math.atan2(B, A) * 180) / Math.PI];
}

/** OKLCH → sRGB linear, sem cortar (pode sair do gamut). */
function oklchParaLinear(L: number, C: number, h: number): Rgb {
  const A = C * Math.cos((h * Math.PI) / 180);
  const B = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** OKLCH → hex; se a cor não existir na tela, perde saturação (nunca claridade nem matiz). */
export function oklchParaHex(L: number, C: number, h: number): string {
  const cabe = (c: number) => oklchParaLinear(L, c, h).every((v) => v >= -1e-6 && v <= 1 + 1e-6);
  let croma = C;
  if (!cabe(croma)) {
    let baixo = 0;
    let alto = C;
    for (let i = 0; i < 40; i++) {
      const meio = (baixo + alto) / 2;
      if (cabe(meio)) baixo = meio;
      else alto = meio;
    }
    croma = baixo;
  }
  return rgbParaHex(oklchParaLinear(L, croma, h).map(paraGama) as Rgb);
}

export function superficieEscura(): string {
  return oklchParaHex(...SUPERFICIE_ESCURA_OKLCH);
}

/**
 * A cor da marca para o tema escuro. Se já se lê sobre a superfície escura, fica como está (o ciano
 * da conta do dono fica). Se não, sobe a claridade mantendo a matiz: no mínimo o necessário para
 * passar, e no mínimo o "espelho" da claridade original — o preto vira branco, o azul-marinho vira
 * um azul claro, em vez de um cinza médio que se leria como texto apagado.
 * `null` quando a cor não é um hex (não dá para medir; aí o tema escuro usa a cor dele).
 */
export function paraOTemaEscuro(hex: string): string | null {
  const rgb = hexParaRgb(hex);
  if (!rgb) return null;
  const fundo = superficieEscura();
  const original = rgbParaHex(rgb);
  if (contraste(original, fundo) >= CONTRASTE_MINIMO) return original;

  const [L, C, h] = rgbParaOklch(rgb);
  let baixo = L;
  let alto = 1;
  for (let i = 0; i < 40; i++) {
    const meio = (baixo + alto) / 2;
    if (contraste(oklchParaHex(meio, C, h), fundo) >= CONTRASTE_MINIMO) alto = meio;
    else baixo = meio;
  }
  let claridade = Math.max(alto, 1 - L);
  let cor = oklchParaHex(claridade, C, h);
  // O arredondamento para 8 bits pode deixar a cor um fio abaixo do mínimo.
  while (contraste(cor, fundo) < CONTRASTE_MINIMO && claridade < 1) {
    claridade = Math.min(1, claridade + 0.005);
    cor = oklchParaHex(claridade, C, h);
  }
  return cor;
}

/** Texto por cima de uma cor: quase-preto ou branco, o que tiver MAIS contraste pelo WCAG. */
export function textoSobre(hex: string): string {
  return contraste(QUASE_PRETO, hex) >= contraste(BRANCO, hex) ? QUASE_PRETO : BRANCO;
}

/**
 * O critério que o tema CLARO usa desde a marca aplicada, mantido de propósito (#285B, critério "o
 * claro continua igual ao de hoje"). ⚠️ O limiar 0,45 é alto demais: com ele o ciano `#00b0f0` da
 * conta do dono recebe texto branco, 2,5:1 — reprova. O limiar do WCAG que separa branco de preto é
 * ≈ 0,18 (`textoSobre` acima). Trocar muda a cara dos botões no claro: é decisão do dono.
 */
export function textoSobreNoClaro(hex: string): string {
  if (!hexParaRgb(hex)) return BRANCO;
  return luminancia(hex) > 0.45 ? QUASE_PRETO : BRANCO;
}

/** Só aceita o que é cor — o valor vai para dentro de uma folha de estilo. */
const COR_SEGURA = /^[#a-z0-9(),.%\s/-]{1,64}$/i;

export type TokensDaMarca = Record<string, string>;

/** Os tokens do tema que a marca sobrescreve, para cada tema. Campo vazio mantém o tema padrão. */
export function tokensDaMarca(
  corPrincipal: string | null | undefined,
  corSecundaria: string | null | undefined,
): { claro: TokensDaMarca; escuro: TokensDaMarca } {
  const claro: TokensDaMarca = {};
  const escuro: TokensDaMarca = {};

  const principal = corPrincipal?.trim();
  if (principal && COR_SEGURA.test(principal)) {
    const fg = textoSobreNoClaro(principal);
    claro["--primary"] = principal;
    claro["--primary-foreground"] = fg;
    claro["--sidebar-primary"] = principal;
    claro["--sidebar-primary-foreground"] = fg;
    const noEscuro = paraOTemaEscuro(principal);
    if (noEscuro) {
      const fgEscuro = textoSobre(noEscuro);
      escuro["--primary"] = noEscuro;
      escuro["--primary-foreground"] = fgEscuro;
      escuro["--sidebar-primary"] = noEscuro;
      escuro["--sidebar-primary-foreground"] = fgEscuro;
    }
  }

  const secundaria = corSecundaria?.trim();
  if (secundaria && COR_SEGURA.test(secundaria)) {
    claro["--accent"] = secundaria;
    claro["--accent-foreground"] = textoSobreNoClaro(secundaria);
    const noEscuro = paraOTemaEscuro(secundaria);
    if (noEscuro) {
      escuro["--accent"] = noEscuro;
      escuro["--accent-foreground"] = textoSobre(noEscuro);
    }
  }

  return { claro, escuro };
}

/** A folha de estilo da marca: uma regra para o claro e outra para o escuro. Vazia = tema padrão. */
export function cssDaMarca(corPrincipal: string | null | undefined, corSecundaria: string | null | undefined): string {
  const { claro, escuro } = tokensDaMarca(corPrincipal, corSecundaria);
  const bloco = (seletor: string, t: TokensDaMarca) => {
    const corpo = Object.entries(t).map(([k, v]) => `${k}:${v}`).join(";");
    return corpo ? `${seletor}{${corpo}}` : "";
  };
  // `:root:not(.dark)` e `:root.dark` pesam mais que o `:root` e o `.dark` de styles.css, em
  // qualquer ordem de carregamento — e a troca de tema passa a valer sem rodar nada de novo.
  // Papel é sempre claro: impressa com o tema escuro ligado (o certificado tem botão "Imprimir"),
  // a página usa a marca do claro — senão a secundária da conta do dono, branca no escuro, sumiria
  // no papel. O PRINT_CSS do relatório conta com isso.
  const escuroNaTela = bloco(":root.dark", escuro);
  const claroNoPapel = bloco(":root.dark", claro);
  return [
    bloco(":root:not(.dark)", claro),
    escuroNaTela && `@media screen{${escuroNaTela}}`,
    claroNoPapel && `@media print{${claroNoPapel}}`,
  ].filter(Boolean).join("\n");
}
