// Testes da PÁGINA DE INTENSIDADE (#288, Etapa 2c).
//
//   node scripts/testar_intensidade.mjs
//
// Roda a função REAL da página (src/lib/intensidade.ts) sobre resultados do motor REAL
// (src/lib/escolha-forcada.ts) — o Node 22.6+ lê o TypeScript apagando os tipos, então são os mesmos
// arquivos do app, não cópias. Os textos do perfil vêm do banco (só GET, nada é escrito).
//
// Confere: a sigla do título é a do gráfico NATURAL (1 letra, ou 2 na ordem do ranking); empate
// múltiplo não vira sigla; cada gráfico traz a própria sigla e os percentuais do próprio conjunto (que
// somam 100); texto publicado aparece, pendente/ausente/vazio vira aviso; o texto da versão vence o da
// plataforma; Temperamentos (chaves de 3 letras, sigla com "+") e VAK (3 letras) seguem a mesma lógica.
// E o SINAL MÍNIMO (#292): letra quase não marcada sai do título, continua no gráfico marcada, e a
// tela recebe o que explicar.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calcularIpsativo } from "../src/lib/escolha-forcada.ts";
import { montarIntensidade, secaoDoTextoDoPerfil } from "../src/lib/intensidade.ts";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(RAIZ, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const URL_BANCO = env.SUPABASE_URL.replace(/\/$/, "");
const CHAVE = env.SUPABASE_SERVICE_ROLE_KEY;
async function get(q) {
  const r = await fetch(`${URL_BANCO}/rest/v1/${q}`, { headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` } });
  if (!r.ok) throw new Error(`GET ${q.split("?")[0]} falhou: ${r.status}`);
  return r.json();
}

const INSTRUMENTOS = {
  disc: { letras: { D: "Dominância", I: "Influência", S: "Estabilidade", C: "Conformidade" }, blocos: 28 },
  temperamentos: { letras: { SAN: "Sanguíneo", COL: "Colérico", MEL: "Melancólico", FLE: "Fleumático" }, blocos: 28 },
  vak: { letras: { V: "Visual", A: "Auditivo", K: "Cinestésico" }, blocos: 24 },
};

/** Estrutura como a dos testes reais: cada bloco tem uma alternativa por letra, valendo 1 ponto. */
function estrutura(inst) {
  const { letras, blocos } = INSTRUMENTOS[inst];
  const dims = Object.entries(letras).map(([key, label], i) => ({ id: `dim-${key}`, key, label, color: null, sort_order: i + 1 }));
  return {
    dims,
    blocos: Array.from({ length: blocos }, (_, b) => ({
      id: `bloco-${b}`,
      opcoes: dims.map((d) => ({ id: `op-${b}-${d.key}`, pontos: [{ dimension_id: d.id, points: 1 }] })),
    })),
  };
}

/** Transforma "quantos MAIS e MENOS por letra" em um par por bloco, sempre com MAIS ≠ MENOS. */
function pares(mais, menos, n) {
  const A = Object.entries(mais).flatMap(([k, c]) => Array(c).fill(k));
  const B = Object.entries(menos).flatMap(([k, c]) => Array(c).fill(k));
  if (A.length !== n || B.length !== n) throw new Error(`contagens somam ${A.length}/${B.length}, esperado ${n}`);
  for (let volta = 0; volta < 50; volta++) {
    let conflitos = 0;
    for (let i = 0; i < n; i++) {
      if (A[i] !== B[i]) continue;
      conflitos++;
      const j = A.findIndex((a, jj) => a !== B[i] && B[jj] !== A[i]);
      if (j >= 0) [B[i], B[j]] = [B[j], B[i]];
    }
    if (conflitos === 0) return A.map((a, i) => [a, B[i]]);
  }
  throw new Error("não achei pares válidos (MAIS e MENOS da mesma letra no mesmo bloco)");
}

function resultado(inst, mais, menos) {
  const est = estrutura(inst);
  const ps = pares(mais, menos, est.blocos.length);
  return {
    est,
    ips: calcularIpsativo({
      dimensoes: est.dims,
      blocos: est.blocos.map((b, i) => ({
        ...b,
        mais: b.opcoes.find((o) => o.id.endsWith(`-${ps[i][0]}`)).id,
        menos: b.opcoes.find((o) => o.id.endsWith(`-${ps[i][1]}`)).id,
      })),
    }),
  };
}

let falhas = 0;
const confere = (cond, msg) => {
  if (!cond) {
    falhas++;
    console.log("   ✗", msg);
  }
};

// --- os textos do perfil que estão no banco (linhas da plataforma, version_id nulo) --------------------
const linhasDoBanco = await get(
  "report_content?version_id=is.null&section=in.(disc_perfil_texto,temperamentos_perfil_texto,vak_perfil_texto)" +
    "&select=section,dimension_key,mode,status,title,body,version_id",
);
const porSecao = {};
for (const r of linhasDoBanco) (porSecao[r.section] ??= []).push(r);
console.log("Textos do perfil no banco:");
for (const [s, rs] of Object.entries(porSecao)) {
  const pub = rs.filter((r) => r.status === "publicado").map((r) => r.dimension_key).sort();
  console.log(`  ${s.padEnd(28)} ${rs.length} siglas · publicadas: ${pub.join(", ") || "nenhuma"}`);
}
confere(porSecao.disc_perfil_texto?.length === 16, "DISC deveria ter 16 siglas registradas");
confere(porSecao.temperamentos_perfil_texto?.length === 16, "Temperamentos deveria ter 16 siglas registradas");
confere(porSecao.vak_perfil_texto?.length === 9, "VAK deveria ter 9 siglas registradas");
const corpoDoBanco = (inst, sigla) =>
  linhasDoBanco.find((r) => r.section === secaoDoTextoDoPerfil(inst) && r.dimension_key === sigla)?.body;

// --- casos -------------------------------------------------------------------------------------------
// `texto` segue o BANCO: desde a #302 (24/09) as 16 siglas do DISC têm descrição publicada, então todo
// caso de DISC com sigla espera "publicado". O caminho do aviso de pendente (linha pendente, corpo vazio,
// sigla sem linha) continua coberto no bloco "precedência dos textos", com linhas montadas aqui.
const CASOS = [
  { nome: "natural CI legítimo (C com sinal 12) e adaptado IC", inst: "disc",
    mais: { C: 9, I: 9, D: 6, S: 4 }, menos: { C: 3, I: 4, S: 11, D: 10 },
    espera: { titulo: "CI", labels: ["Conformidade", "Influência"], natural: "CI", adaptado: "IC", texto: "publicado",
              sinal_baixo: [] } },
  { nome: "#292: C lidera o natural com sinal 7 e é segurado fora do título", inst: "disc",
    mais: { D: 12, I: 10, C: 4, S: 2 }, menos: { C: 3, I: 4, S: 9, D: 12 },
    espera: { titulo: "I", labels: ["Influência"], natural: "I", adaptado: "DI", texto: "publicado",
              sinal_baixo: [{ key: "C", sinal: 7, fora_do_titulo: true }] } },
  { nome: "#292: letra nunca marcada (sinal 0) liderava o natural e agora não ocupa o título", inst: "disc",
    mais: { S: 12, C: 10, D: 6, I: 0 }, menos: { D: 12, S: 10, C: 6, I: 0 },
    espera: { titulo: "C", labels: ["Conformidade"], natural: "C", adaptado: "SC", texto: "publicado",
              sinal_baixo: [{ key: "I", sinal: 0, fora_do_titulo: true }] } },
  { nome: "#292: letra com sinal baixo que não estava no título — marca, mas o título não muda", inst: "disc",
    mais: { S: 12, C: 10, D: 5, I: 1 }, menos: { S: 3, C: 8, D: 10, I: 7 },
    espera: { titulo: "S", labels: ["Estabilidade"], natural: "S", adaptado: "SC", texto: "publicado",
              sinal_baixo: [{ key: "I", sinal: 8, fora_do_titulo: false }] } },
  { nome: "natural S, uma letra", inst: "disc",
    mais: { S: 16, C: 6, I: 4, D: 2 }, menos: { D: 14, I: 9, C: 4, S: 1 },
    espera: { titulo: "S", labels: ["Estabilidade"], natural: "S", adaptado: "S", texto: "publicado" } },
  { nome: "natural CS, compatíveis", inst: "disc",
    mais: { C: 10, S: 9, I: 5, D: 4 }, menos: { D: 11, I: 10, S: 4, C: 3 },
    espera: { titulo: "CS", labels: ["Conformidade", "Estabilidade"], natural: "CS", adaptado: "CS", texto: "publicado" } },
  { nome: "natural DI (texto publicado na #302)", inst: "disc",
    mais: { D: 10, I: 9, S: 5, C: 4 }, menos: { C: 12, S: 11, I: 3, D: 2 },
    espera: { titulo: "DI", labels: ["Dominância", "Influência"], natural: "DI", adaptado: "DI", texto: "publicado" } },
  { nome: "natural IC, em tensão (texto publicado na #302)", inst: "disc",
    mais: { I: 10, C: 8, D: 6, S: 4 }, menos: { S: 11, D: 10, C: 4, I: 3 },
    espera: { titulo: "IC", labels: ["Influência", "Conformidade"], natural: "IC", adaptado: "IC", texto: "publicado" } },
  { nome: "empate múltiplo (7-7-7-7)", inst: "disc",
    mais: { D: 7, I: 7, S: 7, C: 7 }, menos: { D: 7, I: 7, S: 7, C: 7 },
    espera: { titulo: null, labels: [], natural: null, adaptado: null, texto: null, sinal_baixo: [] } },
  { nome: "Temperamentos, a resposta real da Gabriela: Colérico tem sinal 8 e sai do título (#292)", inst: "temperamentos",
    mais: { SAN: 9, COL: 3, MEL: 10, FLE: 6 }, menos: { SAN: 9, COL: 5, MEL: 6, FLE: 8 },
    espera: { titulo: "MEL+FLE", labels: ["Melancólico", "Fleumático"], natural: "MEL+FLE", adaptado: "MEL+SAN",
              texto: "pendente", sinal_baixo: [{ key: "COL", sinal: 8, fora_do_titulo: true }] } },
  { nome: "VAK: a resposta real (natural AV, adaptado VA)", inst: "vak",
    mais: { V: 10, A: 8, K: 6 }, menos: { V: 6, A: 5, K: 13 },
    espera: { titulo: "AV", labels: ["Auditivo", "Visual"], natural: "AV", adaptado: "VA", texto: "pendente",
              sinal_baixo: [] } },
];

for (const c of CASOS) {
  const { est, ips } = resultado(c.inst, c.mais, c.menos);
  const out = montarIntensidade({
    ipsativo: ips, dimensoes: est.dims, instrumentId: c.inst, versionId: "versao-teste", linhas: linhasDoBanco,
  });
  const antes = falhas;
  confere(out.perfil.sigla === c.espera.titulo, `título: ${out.perfil.sigla} ≠ ${c.espera.titulo}`);
  confere(JSON.stringify(out.perfil.labels) === JSON.stringify(c.espera.labels), `nomes: ${out.perfil.labels} ≠ ${c.espera.labels}`);
  confere(out.natural.sigla === c.espera.natural, `sigla do natural: ${out.natural.sigla} ≠ ${c.espera.natural}`);
  confere(out.adaptado.sigla === c.espera.adaptado, `sigla do adaptado: ${out.adaptado.sigla} ≠ ${c.espera.adaptado}`);
  // o título É a sigla que o motor gravou para o natural (salvo empate múltiplo)
  confere(out.perfil.sigla === (ips.natural.perfil.empate_multiplo ? null : ips.natural.perfil.codigo), "título ≠ sigla gravada do natural");
  for (const conj of ["natural", "adaptado"]) {
    const g = out[conj];
    confere(JSON.stringify(g.letras.map((l) => l.key)) === JSON.stringify(est.dims.map((d) => d.key)), `${conj}: letras fora da ordem do instrumento`);
    g.letras.forEach((l, i) => {
      const doMotor = ips.letras[i][conj];
      confere(l.percentual === doMotor.percentual && l.posicao === doMotor.posicao, `${conj}/${l.key}: percentual/posição não são os do motor`);
      confere(l.na_sigla === (g.sigla !== null && ips[conj].perfil.chaves.includes(l.key)), `${conj}/${l.key}: marcação da sigla errada`);
    });
    const soma = g.letras.reduce((a, l) => a + l.percentual, 0);
    confere(Math.abs(soma - 100) < 1e-9, `${conj}: percentuais somam ${soma}, não 100`);
  }
  // SINAL MÍNIMO (#292)
  const baixas = out.sinal_baixo.map((l) => ({ key: l.key, sinal: l.sinal, fora_do_titulo: l.fora_do_titulo }));
  confere(JSON.stringify(baixas) === JSON.stringify(c.espera.sinal_baixo ?? []),
    `sinal baixo: ${JSON.stringify(baixas)} ≠ ${JSON.stringify(c.espera.sinal_baixo ?? [])}`);
  confere(out.marcacoes_no_teste === ips.n_blocos * 2, "marcações do teste ≠ blocos × 2");
  for (const conj of ["natural", "adaptado"]) {
    out[conj].letras.forEach((l, i) => {
      const lm = ips.letras[i];
      confere(l.sinal === lm.sinal && l.sinal_minimo === lm.sinal_minimo && l.pouca_informacao === !lm.sinal_suficiente,
        `${conj}/${l.key}: sinal na tela ≠ sinal do motor`);
      confere(!(l.na_sigla && !lm.sinal_suficiente), `${conj}/${l.key}: letra sem sinal ocupando o título`);
    });
  }
  const estado = out.texto?.estado ?? null;
  confere(estado === c.espera.texto, `texto: ${estado} ≠ ${c.espera.texto}`);
  if (estado === "publicado") confere(out.texto.corpo === corpoDoBanco(c.inst, out.perfil.sigla), "texto publicado ≠ corpo gravado no banco");
  // nada no resultado compara um gráfico com o outro
  const chaves = JSON.stringify(out).match(/"(\w+)":/g).map((k) => k.slice(1, -2));
  confere(!chaves.some((k) => /gap|diferen|delta|compar/i.test(k)), "apareceu campo de comparação entre natural e adaptado");
  const marca = out.sinal_baixo.length ? ` · pouca informação: ${out.sinal_baixo.map((l) => `${l.key}(${l.sinal})`).join(", ")}` : "";
  console.log(`${falhas === antes ? "✓" : "✗"} ${c.nome}: PERFIL ${out.perfil.sigla ?? "— sem predominância clara"} · natural ${out.natural.sigla ?? "—"} · adaptado ${out.adaptado.sigla ?? "—"} · texto ${estado ?? "(nenhum)"}${marca}`);
}

// --- o texto da versão vence o da plataforma; pendente e corpo vazio viram aviso ----------------------
{
  const antes = falhas; // o ✓/✗ desta linha é só deste bloco (antes olhava o total e herdava falha dos casos)
  const { est, ips } = resultado("disc", { C: 9, I: 9, D: 6, S: 4 }, { C: 3, I: 4, S: 11, D: 10 }); // natural CI, com sinal
  const monta = (linhas) =>
    montarIntensidade({ ipsativo: ips, dimensoes: est.dims, instrumentId: "disc", versionId: "v-dona", linhas });
  const global = linhasDoBanco;
  const daVersao = (status, body) => ({ section: "disc_perfil_texto", dimension_key: "CI", mode: "natural", status, title: "Título da dona", body, version_id: "v-dona" });
  const a = monta([...global, daVersao("publicado", "Texto escrito pela dona da versão.")]);
  confere(a.texto?.estado === "publicado" && a.texto.corpo === "Texto escrito pela dona da versão." && a.texto.titulo === "Título da dona", "texto da versão deveria vencer o da plataforma");
  const b = monta([...global, daVersao("pendente", "rascunho")]);
  confere(b.texto?.estado === "pendente", "linha da versão marcada pendente deveria virar aviso");
  const c = monta(global.map((r) => (r.dimension_key === "CI" && r.section === "disc_perfil_texto" ? { ...r, body: "   " } : r)));
  confere(c.texto?.estado === "pendente", "corpo vazio deveria virar aviso, não texto em branco");
  const d = monta([]);
  confere(d.texto?.estado === "pendente", "sigla sem linha nenhuma deveria virar aviso");
  const e = monta([...global, { ...daVersao("publicado", "de outra versão"), version_id: "v-outra" }]);
  confere(e.texto?.estado === "publicado" && e.texto.corpo === corpoDoBanco("disc", "CI"), "texto de OUTRA versão não pode aparecer");
  console.log(`${falhas === antes ? "✓" : "✗"} precedência dos textos: versão > plataforma; pendente, vazio e ausente viram aviso; texto de outra versão não vaza`);
}

console.log(falhas === 0 ? "\nRESULTADO: TUDO CERTO" : `\nRESULTADO: ${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
