/**
 * #312 — indexa (ou reindexa, com --forcar) os PDFs que já estavam na Biblioteca antes desta demanda.
 * Daqui em diante, `salvarMaterial` já indexa sozinho no upload; este script é só o backfill dos que
 * já existiam, e serve para reprocessar todos depois de um ajuste no jeito de quebrar em trechos.
 *
 * Roda fora do Vite (`npx tsx`): lê `.env.local` direto, como `avaliar_assistente.ts` já faz — nunca
 * `process.env.SUPABASE_URL` puro (no Lovable aponta para o banco errado).
 *
 *   npx tsx scripts/indexar_biblioteca_existente.ts            # só os que ainda não estão "pronto"
 *   npx tsx scripts/indexar_biblioteca_existente.ts --forcar   # todos os PDFs, de novo
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { indexarMaterialPdf } from "@/lib/biblioteca-indexacao.server";

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

async function main() {
  const forcar = process.argv.includes("--forcar");
  let q = admin
    .from("biblioteca_materiais")
    .select("id, mentor_id, titulo, url, indexacao_status")
    .eq("kind", "pdf");
  if (!forcar) q = q.neq("indexacao_status", "pronto");
  const { data: materiais, error } = await q.order("titulo");
  if (error) throw new Error(error.message);
  if (!materiais?.length) {
    console.log(
      forcar
        ? "Nenhum PDF na Biblioteca."
        : 'Nenhum PDF pendente — todos já estão "pronto" (use --forcar para reprocessar).',
    );
    return;
  }

  console.log(`${materiais.length} PDF(s) para indexar:\n`);
  let ok = 0;
  let falhou = 0;
  let trechosTotal = 0;
  let paginasTotal = 0;
  for (const m of materiais) {
    process.stdout.write(`- "${m.titulo}"... `);
    const resultado = await indexarMaterialPdf(admin, {
      id: m.id,
      mentor_id: m.mentor_id,
      url: m.url,
    });
    if (resultado.ok) {
      ok += 1;
      trechosTotal += resultado.trechos;
      paginasTotal += resultado.paginas;
      console.log(`ok — ${resultado.paginas} páginas, ${resultado.trechos} trechos`);
    } else {
      falhou += 1;
      console.log(`ERRO — ${resultado.erro}`);
    }
  }

  console.log(
    `\n${ok} indexados, ${falhou} com erro. Total: ${paginasTotal} páginas, ${trechosTotal} trechos.`,
  );
  if (falhou) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
