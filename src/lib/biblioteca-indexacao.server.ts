/**
 * #312 — extrai o texto de um PDF da Biblioteca e grava em `biblioteca_material_trechos`, em pedaços.
 *
 * Roda UMA VEZ por material (no upload/edição, dentro de `salvarMaterial`, e no backfill dos que já
 * existiam — `scripts/indexar_biblioteca_existente.ts`). A pergunta do aluno nunca lê o PDF de novo:
 * só busca nos trechos já gravados (`bib_buscar_trechos` / `bib_amostra_trechos`, na migração
 * `20260928120000_biblioteca_trechos.sql`).
 *
 * Sem import de nada do Vite/TanStack (`getRequest`, `import.meta.env`): o script de backfill roda
 * fora do Vite (`npx tsx`), e um import desses aqui estouraria lá — a mesma lição da #289
 * (`modelo.server.ts`). Quem chama entrega o cliente Supabase já pronto (com a chave de serviço —
 * a escrita não passa pela sessão de quem fez upload). `storage-assinado.server.ts` também não
 * importa nada do Vite, então é seguro chamar dos dois lugares.
 *
 * `unpdf` foi escolhido por rodar em qualquer runtime JS, Cloudflare Workers incluído — nada de
 * `fs`, `canvas` nem dependência nativa. O bucket `biblioteca` é PRIVADO desde 31/07 (migração
 * `20260731050000_...`): o valor gravado em `biblioteca_materiais.url` não abre sozinho — é preciso
 * assinar pelo servidor primeiro (`assinarUrl`, chave de serviço), como a tela de listagem já faz.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { assinarUrl, TTL_ARQUIVO_SEGUNDOS } from "@/lib/storage-assinado.server";

const PALAVRAS_POR_TRECHO = 200;
const SOBREPOSICAO = 25;
const LOTE_DE_GRAVACAO = 200;

type Trecho = { conteudo: string; paginaInicio: number; paginaFim: number };

/** Achata as páginas em palavras com a página de origem, para o trecho saber onde começa e termina. */
function palavrasComPagina(paginas: string[]): Array<{ palavra: string; pagina: number }> {
  const out: Array<{ palavra: string; pagina: number }> = [];
  paginas.forEach((texto, i) => {
    const limpo = texto.replace(/\s+/g, " ").trim();
    if (!limpo) return;
    for (const palavra of limpo.split(" ")) out.push({ palavra, pagina: i + 1 });
  });
  return out;
}

/** Janelas de ~200 palavras com 25 de sobra da anterior — para uma ideia não cortar bem no meio. */
function emTrechos(paginas: string[]): Trecho[] {
  const todas = palavrasComPagina(paginas);
  const trechos: Trecho[] = [];
  let i = 0;
  while (i < todas.length) {
    const fatia = todas.slice(i, i + PALAVRAS_POR_TRECHO);
    if (!fatia.length) break;
    trechos.push({
      conteudo: fatia.map((p) => p.palavra).join(" "),
      paginaInicio: fatia[0].pagina,
      paginaFim: fatia[fatia.length - 1].pagina,
    });
    if (i + PALAVRAS_POR_TRECHO >= todas.length) break;
    i += PALAVRAS_POR_TRECHO - SOBREPOSICAO;
  }
  return trechos;
}

export type ResultadoDaIndexacao =
  { ok: true; trechos: number; paginas: number } | { ok: false; erro: string };

/**
 * Baixa o PDF, extrai o texto, quebra em trechos e grava — substituindo os trechos antigos do mesmo
 * material, se houver (reprocessar é seguro: apaga e regrava). Nunca lança: erro vira `{ok:false}` e
 * fica registrado em `biblioteca_materiais.indexacao_erro`, para o material continuar salvo mesmo
 * quando o PDF não pôde ser lido (imagem escaneada sem camada de texto, arquivo corrompido etc.).
 */
export async function indexarMaterialPdf(
  admin: SupabaseClient<Database>,
  material: { id: string; mentor_id: string; url: string },
): Promise<ResultadoDaIndexacao> {
  try {
    const urlAssinada = await assinarUrl(admin, material.url, TTL_ARQUIVO_SEGUNDOS);
    if (!urlAssinada)
      throw new Error(
        "não consegui assinar a URL do arquivo (caminho inválido ou arquivo ausente do bucket)",
      );
    const resp = await fetch(urlAssinada);
    if (!resp.ok) throw new Error(`não baixei o arquivo (status ${resp.status})`);
    const bytes = new Uint8Array(await resp.arrayBuffer());

    const { extractText } = await import("unpdf");
    const { totalPages, text } = await extractText(bytes, { mergePages: false });
    const trechos = emTrechos(text);
    if (!trechos.length) {
      throw new Error(
        "nenhum texto encontrado no PDF (pode ser página escaneada, sem camada de texto)",
      );
    }

    const { error: eDel } = await admin
      .from("biblioteca_material_trechos")
      .delete()
      .eq("material_id", material.id);
    if (eDel) throw new Error(`limpar trechos antigos: ${eDel.message}`);

    const linhas = trechos.map((t, ordem) => ({
      mentor_id: material.mentor_id,
      material_id: material.id,
      ordem,
      pagina_inicio: t.paginaInicio,
      pagina_fim: t.paginaFim,
      conteudo: t.conteudo,
    }));
    for (let i = 0; i < linhas.length; i += LOTE_DE_GRAVACAO) {
      const { error } = await admin
        .from("biblioteca_material_trechos")
        .insert(linhas.slice(i, i + LOTE_DE_GRAVACAO));
      if (error) throw new Error(`gravar trechos: ${error.message}`);
    }

    const { error: eUpd } = await admin
      .from("biblioteca_materiais")
      .update({
        indexacao_status: "pronto",
        indexacao_erro: null,
        indexado_em: new Date().toISOString(),
        paginas: totalPages,
        trechos_count: trechos.length,
      })
      .eq("id", material.id);
    if (eUpd) throw new Error(`gravar status: ${eUpd.message}`);

    return { ok: true, trechos: trechos.length, paginas: totalPages };
  } catch (e) {
    const erro = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    try {
      await admin
        .from("biblioteca_materiais")
        .update({ indexacao_status: "erro", indexacao_erro: erro })
        .eq("id", material.id);
    } catch (e2) {
      console.error(
        "[biblioteca-indexacao] não consegui nem gravar o erro:",
        e2 instanceof Error ? e2.message : String(e2),
      );
    }
    return { ok: false, erro };
  }
}
