// Ponte para os testes: roda o cálculo REAL (src/lib/escolha-forcada.ts) no Node.
//
// O Node 22.6+ lê TypeScript "apagando" os tipos, e o módulo foi escrito só com sintaxe
// apagável e sem imports justamente para isso — é o MESMO arquivo que o motor usa, não uma cópia.
//
// Entrada (stdin, JSON):
//   { estruturas: { nome: { dimensoes: [...], blocos: [{ id, opcoes: [{ id, pontos: [...] }] }] } },
//     casos: [{ estrutura, mais: [id...], menos: [id...] }],
//     embaralhar: 3 }                      // quantas versões embaralhadas conferir por caso
// Saída (stdout, JSON): [{ resultado, deterministico }]
import { calcularIpsativo, escolherDominante } from "../src/lib/escolha-forcada.ts";

let entrada = "";
process.stdin.on("data", (c) => (entrada += c));
process.stdin.on("end", () => {
  const { estruturas, casos, embaralhar = 0 } = JSON.parse(entrada);

  // PRNG com semente (mulberry32): o embaralhamento tem de ser reproduzível.
  const prng = (semente) => () => {
    semente |= 0;
    semente = (semente + 0x6d2b79f5) | 0;
    let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const embaralha = (lista, rnd) => {
    const a = [...lista];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const montar = (est, caso, rnd) => {
    let blocos = est.blocos.map((b, i) => ({
      id: b.id,
      opcoes: rnd ? embaralha(b.opcoes, rnd) : b.opcoes,
      mais: caso.mais[i],
      menos: caso.menos[i],
    }));
    if (rnd) blocos = embaralha(blocos, rnd);
    return { dimensoes: rnd ? embaralha(est.dimensoes, rnd) : est.dimensoes, blocos };
  };

  const saida = casos.map((caso, n) => {
    const est = estruturas[caso.estrutura];
    const resultado = calcularIpsativo(montar(est, caso, null));
    const base = JSON.stringify(resultado);
    let deterministico = true;
    for (let k = 0; k < embaralhar; k++) {
      // Entrada com dimensões, blocos e alternativas em OUTRA ordem: a saída não pode mudar.
      const outra = JSON.stringify(calcularIpsativo(montar(est, caso, prng(n * 1000 + k + 1))));
      if (outra !== base) deterministico = false;
    }
    return { resultado, deterministico };
  });
  process.stdout.write(JSON.stringify(saida));
});

// (escolherDominante é exercitado nos testes do motor completo; importado aqui para garantir que existe)
void escolherDominante;
