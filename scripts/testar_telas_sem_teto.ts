/**
 * #314 — as outras leituras que crescem com o uso: lista de presença, conclusão do treinamento e da trilha
 * (as duas decidem CERTIFICADO) e os pontos dos rankings. Roda as MESMAS funções da plataforma, direto no
 * banco, com a chave de serviço — só leitura.
 *
 *   npx tsx scripts/testar_telas_sem_teto.ts fotografar SAIDA.json
 *       Todas as turmas e trilhas REAIS: tabela de presença, conclusões do treinamento e da trilha.
 *   npx tsx scripts/testar_telas_sem_teto.ts comparar SAIDA.json
 *       Calcula de novo e compara com a fotografia — tem de sair IGUAL (a mudança não pode mexer em número
 *       de ninguém abaixo do teto).
 *   npx tsx scripts/testar_telas_sem_teto.ts teto FIXTURE.json
 *       A turma FICTÍCIA de `testar_leitura_sem_teto.py turma` (mais de 1.000 linhas em cada leitura):
 *       mostra o que cada função entrega. Rodado antes e depois do conserto, é a prova.
 *
 * Nunca imprime nome de pessoa: só ids, contagens e percentuais.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { lerTodas } from "@/lib/ler-todas";

function doEnvLocal(nome: string): string {
  for (const linha of readFileSync(".env.local", "utf8").split("\n")) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] === nome) return m[2].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error(`${nome} ausente no .env.local`);
}
const SUPABASE_URL = doEnvLocal("SUPABASE_URL").replace(/\/$/, "");
const CHAVE_DE_SERVICO = doEnvLocal("SUPABASE_SERVICE_ROLE_KEY");
process.env.SUPABASE_URL = SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = CHAVE_DE_SERVICO;
const admin = createClient<Database>(SUPABASE_URL, CHAVE_DE_SERVICO, { auth: { persistSession: false, autoRefreshToken: false } });

async function funcoes() {
  const { montarTabelaPresenca } = await import("@/lib/presenca.server");
  const { calcularConclusoesDoTreinamento } = await import("@/lib/classroom.functions");
  const { calcularConclusoesDaTrilha } = await import("@/lib/learning.functions");
  return { montarTabelaPresenca, calcularConclusoesDoTreinamento, calcularConclusoesDaTrilha };
}

/** `referencia` é a hora em que a tabela foi montada — muda a cada leitura por desenho. */
function semHora<T extends { referencia?: string }>(t: T): Omit<T, "referencia"> {
  const { referencia: _, ...resto } = t;
  return resto;
}

async function idsDe(tabela: "treinamentos" | "learning_tracks"): Promise<string[]> {
  const { linhas } = await lerTodas((de, ate) =>
    admin.from(tabela).select("id", { count: "exact" }).order("id").range(de, ate),
  );
  return linhas.map((l) => l.id);
}

async function calcular() {
  const f = await funcoes();
  const saida: Record<string, unknown> = {};
  for (const id of await idsDe("treinamentos")) {
    saida[`presenca:${id}`] = semHora(await f.montarTabelaPresenca(admin, id));
    saida[`conclusao-treinamento:${id}`] = await f.calcularConclusoesDoTreinamento(admin, id);
  }
  for (const id of await idsDe("learning_tracks")) {
    saida[`conclusao-trilha:${id}`] = await f.calcularConclusoesDaTrilha(admin, id);
  }
  return saida;
}

function diferencas(a: unknown, b: unknown, caminho = "$", out: string[] = []): string[] {
  if (out.length > 20) return out;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) out.push(`${caminho}: ${a.length} itens antes × ${b.length} depois`);
    a.forEach((x, i) => i < b.length && diferencas(x, b[i], `${caminho}[${i}]`, out));
  } else if (a && b && typeof a === "object" && typeof b === "object") {
    const chaves = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
    for (const k of chaves) diferencas((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${caminho}.${k}`, out);
  } else if (JSON.stringify(a) !== JSON.stringify(b)) {
    out.push(`${caminho}: ${JSON.stringify(a)?.slice(0, 60)} antes × ${JSON.stringify(b)?.slice(0, 60)} depois`);
  }
  return out;
}

async function fotografar(arquivo: string) {
  const s = await calcular();
  writeFileSync(arquivo, JSON.stringify(s));
  console.log(`${Object.keys(s).length} cálculos guardados em ${arquivo}`);
}

async function comparar(arquivo: string) {
  const antes = JSON.parse(readFileSync(arquivo, "utf8")) as Record<string, unknown>;
  const depois = JSON.parse(JSON.stringify(await calcular())) as Record<string, unknown>;
  let ruins = 0;
  for (const chave of new Set([...Object.keys(antes), ...Object.keys(depois)])) {
    if (!(chave in antes)) {
      console.log(`${chave.padEnd(60)} NOVO (criado depois da fotografia — não entra na comparação)`);
      continue;
    }
    const d = diferencas(antes[chave], depois[chave]);
    if (d.length) ruins++;
    console.log(`${chave.padEnd(60)} ${d.length ? `DIFERENTE: ${d.slice(0, 4).join(" | ")}` : "IDÊNTICO"}`);
  }
  console.log(`\nRESULTADO: ${ruins ? `${ruins} DIFERENÇA(S)` : "TUDO IDÊNTICO"}`);
  process.exitCode = ruins ? 1 : 0;
}

async function teto(arquivo: string) {
  const fx = JSON.parse(readFileSync(arquivo, "utf8")) as {
    mentor_user: string; treinamento: string; trilha: string; alunos_login: string[];
    presencas: string[]; marcacoes: string[]; pontos: string[];
  };
  if (!fx.treinamento) throw new Error("fixture sem turma — rode `testar_leitura_sem_teto.py turma` antes");
  const f = await funcoes();

  // Presença: quantas presenças a tabela usou, e a frequência de cada aluno.
  const tabela = await f.montarTabelaPresenca(admin, fx.treinamento);
  const usadas = tabela.linhas.filter((l) => l.tem_registro).length;
  const pcts = tabela.resumo.map((r) => r.pct ?? 0);
  console.log(`LISTA DE PRESENÇA — ${fx.presencas.length} presenças no banco (${tabela.aulas.length} aulas × ${tabela.alunos.length} alunos)`);
  console.log(`  presenças na tabela: ${usadas}; frequência menor ${Math.min(...pcts)}%, maior ${Math.max(...pcts)}%; ` +
    `alunos abaixo de 100%: ${pcts.filter((p) => p < 100).length}`);

  const conc = await f.calcularConclusoesDoTreinamento(admin, fx.treinamento);
  const concluiram = conc.pessoas.filter((p) => p.concluido).length;
  console.log(`CONCLUSÃO DO TREINAMENTO (régua 100%) — concluíram ${concluiram} de ${conc.pessoas.length}; ` +
    `menor "feitos": ${Math.min(...conc.pessoas.map((p) => p.feitos))} de ${conc.pessoas[0]?.total ?? 0}`);

  const trilha = await f.calcularConclusoesDaTrilha(admin, fx.trilha);
  const comLogin = trilha.pessoas.filter((p) => p.user_id && fx.alunos_login.includes(p.user_id));
  console.log(`CONCLUSÃO DA TRILHA (régua 100%) — ${fx.marcacoes.length} marcações no banco, ${trilha.total_itens} aulas`);
  for (const p of comLogin) {
    console.log(`  login ${p.user_id}: ${p.feitos} de ${p.total} (${p.percentual}%) — ${p.concluido ? "concluiu" : "NÃO concluiu"}`);
  }

  // Pontos: a leitura de antes (uma consulta, como o ranking e o extrato faziam) e o ajudante novo.
  const umaConsulta = await admin.from("pontos").select("user_id, pontos, acao")
    .in("user_id", [fx.alunos_login[0]]).eq("mentor_id", fx.mentor_user);
  if (umaConsulta.error) throw new Error(umaConsulta.error.message);
  const soma = (xs: Array<{ pontos: number }>) => xs.reduce((a, b) => a + b.pontos, 0);
  console.log(`PONTOS — ${fx.pontos.length} registros de 1 ponto no banco`);
  console.log(`  numa consulta só (como era): ${umaConsulta.data.length} registros, total ${soma(umaConsulta.data)}`);
  const modulo = (await import("@/lib/pontos.functions")) as Record<string, unknown>;
  const lerPontos = modulo.lerPontos as
    | ((s: typeof admin, f: { userIds: string[]; conta: string | null }) => Promise<Array<{ pontos: number }>>)
    | undefined;
  if (lerPontos) {
    const todos = await lerPontos(admin, { userIds: [fx.alunos_login[0]], conta: fx.mentor_user });
    console.log(`  pelo ajudante do ranking e do extrato (lerPontos): ${todos.length} registros, total ${soma(todos)}`);
  } else {
    console.log("  (o ajudante lerPontos ainda não existe neste código — é o código de antes)");
  }
}

const [cmd, arq] = process.argv.slice(2);
const comandos: Record<string, (a: string) => Promise<void>> = { fotografar, comparar, teto };
if (!comandos[cmd] || !arq) {
  console.error("uso: npx tsx scripts/testar_telas_sem_teto.ts fotografar|comparar|teto ARQUIVO.json");
  process.exit(2);
}
comandos[cmd](arq).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
