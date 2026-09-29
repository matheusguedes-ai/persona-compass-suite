/**
 * #320 — gera (ou regera, com --forcar) o RESUMO dos PDFs da Biblioteca que já estão indexados
 * (`indexacao_status = 'pronto'`). Roda DEPOIS de `indexar_biblioteca_existente.ts` — o resumo é feito
 * a partir dos trechos já extraídos, nunca do PDF de novo. Daqui em diante, `salvarMaterial` já gera o
 * resumo sozinho no upload; este script é só o backfill dos que já existiam (os 9 livros de hoje) e
 * serve para reprocessar todos depois de um ajuste no jeito de resumir.
 *
 * Roda fora do Vite (`npx tsx`): lê `.env.local` direto, como `indexar_biblioteca_existente.ts` já faz.
 *
 *   npx tsx scripts/gerar_resumos_biblioteca.ts            # só os que ainda não estão "pronto"
 *   npx tsx scripts/gerar_resumos_biblioteca.ts --forcar   # todos os PDFs indexados, de novo
 *   npx tsx scripts/gerar_resumos_biblioteca.ts --limpar   # só passa `limparResumo` nos já gravados
 *                                                           # (sem chamar o modelo, custo zero)
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { custoDoResumo, gerarResumoDoMaterial, limparResumo } from "@/lib/biblioteca-resumo.server";

function doEnvLocal(nome: string): string {
  for (const linha of readFileSync(".env.local", "utf8").split("\n")) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && m[1] === nome) return m[2].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error(`${nome} ausente no .env.local`);
}

const SUPABASE_URL = doEnvLocal("SUPABASE_URL").replace(/\/$/, "");
const CHAVE_DE_SERVICO = doEnvLocal("SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient<Database>(SUPABASE_URL, CHAVE_DE_SERVICO, {
  auth: { persistSession: false },
});

/**
 * Passa a mesma limpeza da geração (`limparResumo`) nos resumos JÁ gravados — para os que saíram com
 * título em Markdown ou apêndice inventado antes de a limpeza existir (29/09/2026: o do Schafer). Não
 * chama o modelo; cita cada material que mudou, com o tamanho antes e depois.
 */
async function limparGravados() {
  const { data, error } = await admin
    .from("biblioteca_materiais")
    .select("id, titulo, resumo")
    .eq("kind", "pdf")
    .not("resumo", "is", null)
    .order("titulo");
  if (error) throw new Error(error.message);
  let mudaram = 0;
  for (const m of data ?? []) {
    const limpo = limparResumo(m.resumo ?? "");
    if (!limpo || limpo === m.resumo) continue;
    const { error: e } = await admin.from("biblioteca_materiais").update({ resumo: limpo }).eq("id", m.id);
    if (e) throw new Error(`${m.titulo}: ${e.message}`);
    mudaram += 1;
    console.log(`- "${m.titulo}" [${m.id}]: ${m.resumo?.length} → ${limpo.length} caracteres`);
  }
  console.log(`${mudaram} de ${data?.length ?? 0} resumo(s) limpo(s); os demais já estavam limpos.`);
}

async function main() {
  if (process.argv.includes("--limpar")) return limparGravados();
  const forcar = process.argv.includes("--forcar");
  let q = admin
    .from("biblioteca_materiais")
    .select("id, titulo, indexacao_status, resumo_status")
    .eq("kind", "pdf")
    .eq("indexacao_status", "pronto");
  if (!forcar) q = q.neq("resumo_status", "pronto");
  const { data: materiais, error } = await q.order("titulo");
  if (error) throw new Error(error.message);
  if (!materiais?.length) {
    console.log(
      forcar
        ? "Nenhum PDF indexado na Biblioteca."
        : 'Nenhum resumo pendente — todos já estão "pronto" (use --forcar para reprocessar).',
    );
    return;
  }

  console.log(`${materiais.length} livro(s) para resumir:\n`);
  let ok = 0;
  let falhou = 0;
  let custoTotal = 0;
  let chamadasTotal = 0;
  for (const m of materiais) {
    process.stdout.write(`- "${m.titulo}"... `);
    const resultado = await gerarResumoDoMaterial(admin, { id: m.id, titulo: m.titulo });
    chamadasTotal += resultado.usoTotal.chamadas;
    const custo = custoDoResumo(resultado.usoTotal);
    custoTotal += custo;
    if (resultado.ok) {
      ok += 1;
      console.log(`ok — ${resultado.usoTotal.chamadas} chamada(s), US$ ${custo.toFixed(3)}, ${resultado.resumo.split(/\s+/).length} palavras`);
    } else {
      falhou += 1;
      console.log(`ERRO — ${resultado.erro}`);
    }
  }

  console.log(
    `\n${ok} resumido(s), ${falhou} com erro. ${chamadasTotal} chamada(s) ao modelo no total. Custo total: US$ ${custoTotal.toFixed(2)}.`,
  );
  if (falhou) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
