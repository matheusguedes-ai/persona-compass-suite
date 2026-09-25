// Ponte para os testes (#304): roda as funções REAIS dos índices (src/lib/indices.ts) no Node.
//
// O Node 22.6+ lê TypeScript apagando os tipos; o módulo só tem sintaxe apagável e um import de TIPO,
// que some junto — é o MESMO arquivo que o motor e o relatório usam, não uma cópia.
//
// Entrada (stdin, JSON): [ resultadoIpsativo, ... ]   (o formato de `computed_scores.ipsativo`, com ou sem `indices`)
// Saída (stdout, JSON):  [ { calculado: calcularIndices(r), anexado: comIndices(r).indices ?? null }, ... ]
//   `calculado` = a conta; `anexado` = o que o motor grava e o relatório lê (índice já gravado e da versão
//   atual é devolvido como está — não recalculado).
import { calcularIndices, comIndices } from "../src/lib/indices.ts";

let entrada = "";
process.stdin.on("data", (c) => (entrada += c));
process.stdin.on("end", () => {
  const resultados = JSON.parse(entrada);
  process.stdout.write(
    JSON.stringify(resultados.map((r) => ({ calculado: calcularIndices(r), anexado: comIndices(r).indices ?? null }))),
  );
});
