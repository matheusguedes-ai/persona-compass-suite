/**
 * #312 — busca trechos do acervo da Biblioteca para a pergunta de quem está falando com a assistente
 * (aluno OU mentor — a mesma função serve as duas, e o script de avaliação, #289).
 *
 * NÃO decide permissão aqui: `bib_buscar_trechos`/`bib_amostra_trechos` (banco) filtram por
 * `bib_visiveis()`, a MESMA porta que decide o que aparece na tela e no item de menu. Um material
 * bloqueado ou fora do menu nunca chega nestes trechos — nem para dizer que existe. Chamado sempre com
 * a sessão de quem perguntou (`supabase`), nunca chave de serviço.
 *
 * Fica dentro da MENSAGEM DO USUÁRIO (não em `<plataforma_do_aluno>` nem em outro bloco de sistema): o
 * texto da pergunta muda a cada vez, e o resto do contexto (relatórios, plataforma, orientações) fica
 * em cache na API. Se os trechos entrassem no bloco de sistema, toda pergunta pagaria esse bloco
 * inteiro de novo — ver `docs/biblioteca-acesso.md` e `CLAUDE.md` § Assistente.
 *
 * Usada por `assistente.functions.ts` (aluno), `assistente-mentor.functions.ts` (mentor) e
 * `scripts/avaliar_assistente.ts` — o script monta a mensagem sozinho, então tem de chamar a MESMA
 * função, ou a avaliação testaria uma versão da assistente mais burra que a real (aviso da sessão que
 * cuida do script de avaliação, 28/09).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Cliente = SupabaseClient<Database>;

const LIMITE_TEMA = 6;
const LIMITE_RESUMO = 12;

/** "resuma o livro X", "sobre o que fala Y", "do que trata Z" — sinal de que é o livro inteiro, não um tema. */
const PISTA_DE_RESUMO =
  /\b(resum[ao]?|resumir|resumindo|sintetiz\w*|s[ií]ntese|do que trata|de que trata|sobre o que (fala|trata)|o livro (inteiro|todo))\b/i;

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Qual material (se algum) a pergunta cita pelo título — por palavras significativas, não substring cega. */
function materialCitado(
  pergunta: string,
  materiais: Array<{ id: string; titulo: string }>,
): string | null {
  const alvo = semAcento(pergunta);
  // Título mais longo primeiro: evita um título curto "vencer" por estar contido num mais específico.
  for (const m of [...materiais].sort((a, b) => b.titulo.length - a.titulo.length)) {
    const palavras = semAcento(m.titulo)
      .split(/\s+/)
      .filter((w) => w.length > 3);
    if (!palavras.length) continue;
    const achadas = palavras.filter((w) => alvo.includes(w));
    if (achadas.length / palavras.length >= 0.5) return m.id;
  }
  return null;
}

export type TrechoDaBusca = {
  materialId: string;
  titulo: string;
  ordem: number;
  conteudo: string;
  paginaInicio: number | null;
  paginaFim: number | null;
};

function normalizarLinhas(data: unknown): TrechoDaBusca[] {
  return (
    (data ?? []) as Array<{
      material_id: string;
      titulo: string;
      ordem: number;
      conteudo: string;
      pagina_inicio: number | null;
      pagina_fim: number | null;
    }>
  ).map((r) => ({
    materialId: r.material_id,
    titulo: r.titulo,
    ordem: r.ordem,
    conteudo: r.conteudo,
    paginaInicio: r.pagina_inicio,
    paginaFim: r.pagina_fim,
  }));
}

/**
 * Os trechos relevantes para esta pergunta, só do que quem pergunta pode ver. Pedido de resumo de um
 * livro identificado vira amostra espalhada pelo livro inteiro; o resto é busca por tema (com o
 * material citado, se algum, restringindo a busca a ele).
 */
export async function buscarTrechosDaBiblioteca(
  supabase: Cliente,
  pergunta: string,
): Promise<TrechoDaBusca[]> {
  const { data: liberados, error: eLib } = await supabase.rpc("bib_materiais_liberados", {
    _person_id: null,
  });
  if (eLib) throw eLib;
  const ids = [...new Set((liberados ?? []) as string[])];
  if (!ids.length) return [];

  const { data: materiais, error: eMat } = await supabase
    .from("biblioteca_materiais")
    .select("id, titulo")
    .in("id", ids);
  if (eMat) throw eMat;

  const materialId = materialCitado(pergunta, materiais ?? []);

  if (materialId && PISTA_DE_RESUMO.test(pergunta)) {
    const { data, error } = await supabase.rpc("bib_amostra_trechos", {
      _material_id: materialId,
      _limite: LIMITE_RESUMO,
    });
    if (error) throw error;
    return normalizarLinhas(data);
  }

  const { data, error } = await supabase.rpc("bib_buscar_trechos", {
    _query: pergunta,
    _material_id: materialId,
    _limite: LIMITE_TEMA,
  });
  if (error) throw error;
  return normalizarLinhas(data);
}

/** Os trechos, agrupados por livro, prontos para entrar na mensagem — com o lembrete de uso junto do conteúdo. */
export function blocoDeTrechos(trechos: TrechoDaBusca[]): string {
  if (!trechos.length) return "";
  const porLivro = new Map<string, { titulo: string; partes: TrechoDaBusca[] }>();
  for (const t of trechos) {
    const g = porLivro.get(t.materialId) ?? { titulo: t.titulo, partes: [] };
    g.partes.push(t);
    porLivro.set(t.materialId, g);
  }
  const blocos = [...porLivro.values()].map((g) => {
    const corpo = [...g.partes]
      .sort((a, b) => a.ordem - b.ordem)
      .map((t) => {
        const pag =
          t.paginaInicio == null
            ? ""
            : ` (por volta da página ${t.paginaInicio}${t.paginaFim && t.paginaFim !== t.paginaInicio ? `–${t.paginaFim}` : ""})`;
        return `[trecho${pag}]\n${t.conteudo}`;
      })
      .join("\n\n");
    return `### "${g.titulo}"\n${corpo}`;
  });
  return [
    "<trechos_da_biblioteca>",
    "Trechos do acervo que bateram com a pergunta — só dos materiais liberados para quem está perguntando. " +
      "São para você EXPLICAR com suas próprias palavras, resumir uma ideia e indicar onde no livro o tema " +
      "aparece — não para copiar. Cite no máximo uma frase curta (até ~20 palavras) entre aspas por resposta; " +
      "o resto é sempre parafraseado. Se pedirem para transcrever um trecho maior, colar o texto ou 'ler o " +
      "capítulo', recuse em uma frase e explique que é uma obra comercial protegida — você explica e indica " +
      "onde encontrar, não substitui a leitura do livro. Se a pergunta não tem nada a ver com estes trechos, " +
      "ignore-os.",
    ...blocos,
    "</trechos_da_biblioteca>",
  ].join("\n\n");
}

/**
 * A pergunta, pronta para virar a última mensagem do histórico: com os trechos relevantes na frente,
 * quando existem, ou sem alteração nenhuma quando não há (livro ainda não indexado, nada bateu, aluno
 * sem Biblioteca liberada). Nunca lança — falha na busca não derruba a conversa, só sai sem os trechos.
 */
export async function perguntaComTrechosDaBiblioteca(
  supabase: Cliente,
  pergunta: string,
): Promise<string> {
  try {
    const trechos = await buscarTrechosDaBiblioteca(supabase, pergunta);
    const bloco = blocoDeTrechos(trechos);
    return bloco ? `${bloco}\n\n<pergunta>\n${pergunta}\n</pergunta>` : pergunta;
  } catch (e) {
    console.error(
      "[assistente] busca na biblioteca falhou:",
      e instanceof Error ? e.message : String(e),
    );
    return pergunta;
  }
}
