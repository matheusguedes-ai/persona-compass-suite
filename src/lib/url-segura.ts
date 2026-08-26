/**
 * Validação de URL que a plataforma vai RENDERIZAR ou seguir.
 *
 * O campo de capa era `z.string().trim().max(600)` — 600 caracteres de texto
 * livre, e mais nada. O que entrava ali saía num `<img src>` ou num `<a href>`.
 *
 * Três coisas que texto livre deixa passar e isto barra:
 *
 * 1. `javascript:alert(1)`. Em `<img src>` não executa, mas em `<a href>` sim —
 *    e o mesmo campo alimenta os dois em telas diferentes.
 * 2. `data:text/html;base64,…`. Página inteira embutida numa string.
 * 3. Um endereço que não é endereço nenhum. "minha capa.png" vira imagem
 *    quebrada sem ninguém entender por quê, porque a tela não valida e o banco
 *    aceita.
 *
 * Só `http:` e `https:`. Não é uma lista de bloqueio (que sempre esquece um
 * esquema), é uma lista de permissão de dois itens.
 */
import { z } from "zod";

export function ehUrlSegura(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * O schema para campos de link. Vazio continua valendo — capa é opcional, e
 * `""` significa "sem capa", não "URL inválida".
 */
export const urlOpcional = z
  .string()
  .trim()
  .max(600)
  .refine((v) => v === "" || ehUrlSegura(v), {
    message: "Use um endereço começando com http:// ou https://",
  })
  .optional()
  .nullable();

/**
 * #282 — igual a `urlOpcional`, mas também aceita o identificador interno do
 * NOSSO storage (`bucket/caminho`, sem domínio — ver storage-assinado.server.ts)
 * além de um link http(s) de verdade. Só para os campos que o formulário de
 * avatar/banner grava — `avatar_url`/`banner_url` de `people` e de `profiles`
 * (o componente de upload é o mesmo para os dois). Os demais campos de link
 * (site, LinkedIn, Instagram, capa por URL colada à mão…) continuam em
 * `urlOpcional`: eles nunca recebem o identificador interno, só endereço
 * externo digitado pela própria pessoa.
 *
 * Mesma lista de buckets de `storage-assinado.server.ts`, repetida aqui (não
 * importada) de propósito: aquele arquivo é `.server.ts`, e este precisa
 * continuar seguro para validar formulário no navegador também.
 */
const CAMINHO_INTERNO_DO_STORAGE = /^(biblioteca|avatares|marca|eventos|comunidade)\/.+$/;

export const urlOuCaminhoInterno = z
  .string()
  .trim()
  .max(600)
  .refine((v) => v === "" || ehUrlSegura(v) || CAMINHO_INTERNO_DO_STORAGE.test(v), {
    message: "Use um endereço começando com http:// ou https://",
  })
  .optional()
  .nullable();
