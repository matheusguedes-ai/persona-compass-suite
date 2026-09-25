// Ponte para os testes (#304): roda a função REAL dos índices (src/lib/indices.ts) no Node.
//
// O Node 22.6+ lê TypeScript apagando os tipos; o módulo só tem sintaxe apagável e um import de TIPO,
// que some junto — é o MESMO arquivo que o relatório usa, não uma cópia.
//
// Entrada (stdin, JSON): [ resultadoIpsativo, ... ]   (o formato de `computed_scores.ipsativo`)
// Saída (stdout, JSON):  [ calcularIndices(resultado), ... ]
import { calcularIndices } from "../src/lib/indices.ts";

let entrada = "";
process.stdin.on("data", (c) => (entrada += c));
process.stdin.on("end", () => {
  const resultados = JSON.parse(entrada);
  process.stdout.write(JSON.stringify(resultados.map((r) => calcularIndices(r))));
});
