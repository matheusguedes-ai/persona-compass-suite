/**
 * Tipos das builds ESM do pdf-lib e do fontkit.
 *
 * Os dois pacotes declaram tipos só para a build CommonJS, que é a que NÃO podemos usar no
 * Cloudflare Worker (ver o comentário em `pdf-lib.ts`). As APIs são as mesmas — aqui só se diz
 * isso ao TypeScript, para não perder a checagem por causa da escolha de build.
 */
declare module "pdf-lib/dist/pdf-lib.esm.js" {
  export * from "pdf-lib";
}

declare module "@pdf-lib/fontkit/dist/fontkit.es.js" {
  const fontkit: typeof import("@pdf-lib/fontkit").default;
  export default fontkit;
}
