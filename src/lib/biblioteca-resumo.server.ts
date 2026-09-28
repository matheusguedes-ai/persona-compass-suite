/**
 * #320 — gera e guarda o RESUMO de um material em texto, uma vez só (mapa-e-junção quando o livro não
 * cabe numa chamada). Chamada dentro de `salvarMaterial`, depois que `indexarMaterialPdf` já extraiu
 * os trechos, e do backfill (`scripts/gerar_resumos_biblioteca.ts`).
 *
 * NÃO lê o PDF de novo: junta de volta, em ordem, os TRECHOS que a indexação (#312) já extraiu e
 * gravou em `biblioteca_material_trechos` — a extração roda uma vez só. Lê TODOS os trechos do
 * material pela regra #314 (`lerTodasOuRecusar`): um livro gigante não pode virar resumo de só uma
 * fatia dele com cara de resumo completo.
 *
 * QUEM FALA COM A ANTHROPIC é a edge function `biblioteca-resumo` (chave só nos secrets dela — mesma
 * regra da assistente, #289). Esta função só monta texto e instruções e chama pela CHAVE DE SERVIÇO:
 * não existe sessão de aluno aqui, é o servidor gerando o resumo, ninguém está perguntando.
 *
 * MAPA-E-JUNÇÃO: até GRUPO_TRECHOS trechos (~8 mil palavras) cabe numa chamada única. Livro maior é
 * dividido em grupos contíguos; cada grupo vira um resumo PARCIAL (esforço "low", mais barato); os
 * parciais, na ORDEM do livro, alimentam uma chamada final (esforço "medium") que produz o resumo de
 * verdade — sem o modelo precisar ver o livro inteiro de uma vez só. Sem import de Vite/TanStack: o
 * backfill roda fora dele (`npx tsx`), mesma regra de `biblioteca-indexacao.server.ts`. Quem chama
 * entrega o cliente Supabase (com a chave de serviço) já pronto.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { lerTodasOuRecusar } from "@/lib/ler-todas";

const GRUPO_TRECHOS = 40;
const LIMITE_PALAVRAS_PARCIAL = 220;
const LIMITE_PALAVRAS_FINAL = 700;

const REGRAS_DE_AUTORIA =
  "Você resume uma obra comercial protegida por direitos autorais. Escreva SEMPRE com suas próprias " +
  "palavras — nunca copie ou cole frases do texto original, nem monte uma colagem de trechos. O " +
  "resumo explica as ideias e o argumento do livro, em português do Brasil, de um jeito que ajuda " +
  "alguém a entender do que o livro trata e decidir se quer lê-lo — nunca substitui a leitura. Não " +
  "invente conteúdo que não está no texto de entrada.";

function instrucoesParcial(titulo: string): string {
  return [
    REGRAS_DE_AUTORIA,
    `O texto a seguir é UM TRECHO (não o livro inteiro) de "${titulo}". Resuma só as ideias que ` +
      `aparecem NESTE trecho, em até ${LIMITE_PALAVRAS_PARCIAL} palavras, em parágrafo corrido — este ` +
      "resumo parcial vai ser juntado com os de outros trechos depois, então não diga \"este trecho\" " +
      "nem numere partes, escreva como se já fosse parte do resumo final.",
  ].join("\n\n");
}

function instrucoesResumoDireto(titulo: string): string {
  return [
    REGRAS_DE_AUTORIA,
    `O texto a seguir é o CONTEÚDO INTEIRO de "${titulo}". Escreva um resumo do livro todo, em até ` +
      `${LIMITE_PALAVRAS_FINAL} palavras: as ideias e o argumento principal, a estrutura geral do ` +
      "livro (não precisa seguir capítulo a capítulo) e para quem ele é útil. Parágrafos corridos, " +
      "sem numerar seções.",
  ].join("\n\n");
}

function instrucoesResumoDaJuncao(titulo: string): string {
  return [
    REGRAS_DE_AUTORIA,
    `O texto a seguir traz RESUMOS PARCIAIS de "${titulo}", na ORDEM em que aparecem no livro (cada ` +
      `um já resume um pedaço). Junte-os num resumo coeso do livro inteiro, em até ` +
      `${LIMITE_PALAVRAS_FINAL} palavras: as ideias e o argumento principal, a estrutura geral do ` +
      "livro e para quem ele é útil. Parágrafos corridos, sem numerar seções nem mencionar que veio " +
      "de partes.",
  ].join("\n\n");
}

type Uso = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
};

export type UsoDoResumo = { chamadas: number; uso: Uso; modelo: string };

function usoZerado(): Uso {
  return { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
}

function somar(a: Uso, b: Uso): Uso {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    cache_creation_input_tokens: a.cache_creation_input_tokens + b.cache_creation_input_tokens,
    cache_read_input_tokens: a.cache_read_input_tokens + b.cache_read_input_tokens,
  };
}

async function chamarResumo(
  admin: SupabaseClient<Database>,
  instrucoes: string,
  texto: string,
  esforco: "low" | "medium",
): Promise<{ texto: string; uso: Uso; modelo: string }> {
  const { data, error } = await admin.functions.invoke("biblioteca-resumo", {
    body: { instrucoes, texto, esforco },
  });
  if (error) throw new Error(`biblioteca-resumo falhou: ${error.message}`);
  if (!data || typeof data.texto !== "string" || !data.usage) {
    throw new Error("biblioteca-resumo devolveu uma resposta em formato inesperado");
  }
  return { texto: data.texto as string, uso: data.usage as Uso, modelo: (data.modelo as string) ?? "?" };
}

export type ResultadoDoResumo =
  | { ok: true; resumo: string; usoTotal: UsoDoResumo }
  | { ok: false; erro: string; usoTotal: UsoDoResumo };

/**
 * Gera o resumo de UM material a partir dos trechos já indexados, e grava em `biblioteca_materiais`
 * (`resumo`, `resumo_status`, `resumo_erro`, `resumo_gerado_em`). Nunca lança — erro vira
 * `{ok:false}` e fica em `resumo_erro`, com `resumo_status='erro'`, para o material continuar
 * utilizável (a busca por trecho não depende disto) mesmo quando o resumo não pôde ser gerado.
 */
export async function gerarResumoDoMaterial(
  admin: SupabaseClient<Database>,
  material: { id: string; titulo: string },
): Promise<ResultadoDoResumo> {
  const usoTotal: UsoDoResumo = { chamadas: 0, uso: usoZerado(), modelo: "" };
  const registrar = (r: { uso: Uso; modelo: string }) => {
    usoTotal.chamadas += 1;
    usoTotal.uso = somar(usoTotal.uso, r.uso);
    usoTotal.modelo = r.modelo;
  };

  try {
    const trechos = await lerTodasOuRecusar(
      (de, ate) =>
        admin
          .from("biblioteca_material_trechos")
          .select("conteudo", { count: "exact" })
          .eq("material_id", material.id)
          .order("ordem")
          .range(de, ate),
      `os trechos de "${material.titulo}"`,
    );
    if (!trechos.length) throw new Error("material sem trechos indexados — rode a indexação primeiro");

    let resumo: string;
    if (trechos.length <= GRUPO_TRECHOS) {
      const textoInteiro = trechos.map((t) => t.conteudo).join("\n\n");
      const r = await chamarResumo(admin, instrucoesResumoDireto(material.titulo), textoInteiro, "medium");
      registrar(r);
      resumo = r.texto;
    } else {
      const grupos: string[][] = [];
      for (let i = 0; i < trechos.length; i += GRUPO_TRECHOS) {
        grupos.push(trechos.slice(i, i + GRUPO_TRECHOS).map((t) => t.conteudo));
      }
      const parciais: string[] = [];
      for (const grupo of grupos) {
        const r = await chamarResumo(admin, instrucoesParcial(material.titulo), grupo.join("\n\n"), "low");
        registrar(r);
        parciais.push(r.texto);
      }
      const r = await chamarResumo(
        admin,
        instrucoesResumoDaJuncao(material.titulo),
        parciais.join("\n\n---\n\n"),
        "medium",
      );
      registrar(r);
      resumo = r.texto;
    }

    if (!resumo.trim()) throw new Error("a chamada devolveu um resumo vazio");

    const { error } = await admin
      .from("biblioteca_materiais")
      .update({ resumo, resumo_status: "pronto", resumo_erro: null, resumo_gerado_em: new Date().toISOString() })
      .eq("id", material.id);
    if (error) throw new Error(`gravar resumo: ${error.message}`);

    return { ok: true, resumo, usoTotal };
  } catch (e) {
    const erro = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    try {
      await admin
        .from("biblioteca_materiais")
        .update({ resumo_status: "erro", resumo_erro: erro })
        .eq("id", material.id);
    } catch (e2) {
      console.error("[biblioteca-resumo] não consegui nem gravar o erro:", e2 instanceof Error ? e2.message : String(e2));
    }
    return { ok: false, erro, usoTotal };
  }
}

const PRECOS: Record<string, { entrada: number; saida: number }> = {
  "claude-sonnet-5": { entrada: 2, saida: 10 },
};

/** Custo em dólar de uma rodada de chamadas (soma de `uso`), pelo preço do modelo que respondeu. */
export function custoDoResumo(u: UsoDoResumo): number {
  const p = PRECOS[u.modelo];
  if (!p) return 0;
  // Cache não entra na conta aqui de propósito: cada chamada desta função é única (sem histórico
  // repetido), então não há cache_read a descontar — só entrada e saída "cheias".
  return (u.uso.input_tokens * p.entrada + u.uso.output_tokens * p.saida) / 1e6;
}
