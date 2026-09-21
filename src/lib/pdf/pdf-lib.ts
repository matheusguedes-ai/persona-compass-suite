/**
 * A porta de entrada do pdf-lib — e a razão de ela existir.
 *
 * ⚠️ NÃO importar "pdf-lib" direto em lugar nenhum deste projeto.
 *
 * O pacote publica três builds. A padrão (`cjs/`) é CommonJS e depende do `tslib` como pacote
 * separado; ao empacotar o servidor para o Cloudflare Worker, o Rollup converte esse CJS para ESM
 * e o `tslib` chega sem `default`. O módulo então quebra **na primeira linha que executa**:
 *
 *     TypeError: Cannot destructure property '__extends' of '__toESM(...).default' as it is undefined
 *
 * Como o erro acontece ao AVALIAR o módulo, e o módulo entra no bundle por causa da rota do PDF,
 * o Worker inteiro morre — e com ele o site todo, não só o PDF. Foi exatamente o que aconteceu ao
 * publicar a primeira versão desta fatia: produção respondeu 500 em tudo.
 *
 * `dist/pdf-lib.esm.js` é a build ESM autocontida: já traz o tslib embutido e não depende de
 * interoperabilidade nenhuma. É a única que sobrevive ao workerd.
 *
 * Como conferir antes de publicar: `python3 scripts/testar_pdf.py worker`, que sobe o build no
 * runtime real do Cloudflare. O `vite dev` roda em Node e NÃO reproduz este erro.
 */
export {
  ColorTypes,
  PDFDocument,
  PDFPage,
  rgb,
  setCharacterSpacing,
  type Color,
  type PDFFont,
  type PDFImage,
} from "pdf-lib/dist/pdf-lib.esm.js";
