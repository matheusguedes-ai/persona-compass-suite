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
