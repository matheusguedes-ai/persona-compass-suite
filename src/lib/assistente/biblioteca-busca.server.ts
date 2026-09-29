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

/**
 * #320 — qual livro um PEDIDO DE RESUMO cita. A regra de `materialCitado` (metade das palavras do título
 * inteiro) é boa para restringir a busca por tema, mas perde as frases mais naturais: "resumo do livro do
 * Dale Carnegie" tem 2 de 7 palavras do título "Dale Carnegie - Como Falar em Publico e Encantar as
 * Pessoas", e "resuma Como Falar em Público", 3 de 7 — medido em 29/09, as duas caíam na busca por
 * trechos soltos, o que a #320 existe para acabar. Aqui cada LADO do título ("autor - nome", em qualquer
 * ordem) vale sozinho: metade das palavras de um lado basta. Só um livro pode vencer — "o livro do
 * Goleman" bate nos dois dele e fica sem escolha (volta à regra de sempre), em vez de resumir um ao acaso.
 */
function livroDoPedidoDeResumo(
  pergunta: string,
  materiais: Array<{ id: string; titulo: string }>,
): string | null {
  const alvo = semAcento(pergunta);
  const nota = (titulo: string) =>
    Math.max(
      ...titulo.split(/\s+-\s+/).map((lado) => {
        const palavras = semAcento(lado).split(/\s+/).filter((w) => w.length > 3);
        return palavras.length ? palavras.filter((w) => alvo.includes(w)).length / palavras.length : 0;
      }),
    );
  const notas = materiais.map((m) => ({ id: m.id, nota: nota(m.titulo) })).filter((m) => m.nota >= 0.5);
  if (!notas.length) return null;
  const melhor = Math.max(...notas.map((m) => m.nota));
  const vencedores = notas.filter((m) => m.nota === melhor);
  return vencedores.length === 1 ? vencedores[0].id : null;
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
 * Os trechos relevantes para esta pergunta, só do que quem pergunta pode ver — busca por tema, com o
 * material citado, se algum, restringindo a busca a ele. Pedido de RESUMO de um livro identificado
 * não passa por aqui — vai por `buscarResumoDaBiblioteca` (#320): resumo de verdade, não amostra.
 */
export async function buscarTrechosDaBiblioteca(
  supabase: Cliente,
  pergunta: string,
  materialId: string | null,
): Promise<TrechoDaBusca[]> {
  const { data, error } = await supabase.rpc("bib_buscar_trechos", {
    _query: pergunta,
    _material_id: materialId,
    _limite: LIMITE_TEMA,
  });
  if (error) throw error;
  return normalizarLinhas(data);
}

/**
 * #320 — os materiais liberados para quem pergunta, com id e título (mesma porta de sempre,
 * `bib_materiais_liberados`/`bib_visiveis`). Usado para achar qual material a pergunta cita, antes de
 * decidir entre resumo e busca por trecho.
 */
async function materiaisLiberados(supabase: Cliente): Promise<Array<{ id: string; titulo: string }>> {
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
  return materiais ?? [];
}

/** #320 — o resumo de UM material (ou "ainda preparando"), só se `bib_visiveis()` deixaria ver. */
export type ResumoDaBusca = { titulo: string } & ({ pronto: true; resumo: string } | { pronto: false });

async function buscarResumoDaBiblioteca(supabase: Cliente, materialId: string): Promise<ResumoDaBusca | null> {
  const { data, error } = await supabase.rpc("bib_resumo_material", { _material_id: materialId });
  if (error) throw error;
  const linha = (data ?? [])[0] as { titulo: string; resumo: string | null; resumo_status: string } | undefined;
  if (!linha) return null; // não visível para quem pergunta — bib_visiveis já barrou (nem existência)
  if (linha.resumo_status === "pronto" && linha.resumo) return { titulo: linha.titulo, pronto: true, resumo: linha.resumo };
  return { titulo: linha.titulo, pronto: false };
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
 * #320 — o resumo pronto de um livro, ou o aviso de que ele ainda está sendo preparado. Nunca a amostra
 * de trechos: essa dava resultado parcial com cara de resumo completo — a causa desta demanda.
 */
function blocoDeResumo(r: ResumoDaBusca): string {
  if (r.pronto) {
    return [
      "<resumo_do_livro>",
      `Resumo de "${r.titulo}" — já em palavras próprias, gerado uma vez a partir do livro inteiro. ` +
        "Use-o para responder ao pedido de resumo (pode reformular, mas não é uma citação do livro: " +
        "não coloque entre aspas como se fosse trecho original). Se pedirem para transcrever um " +
        "trecho maior, colar o texto ou 'ler o capítulo', recuse em uma frase e explique que é uma " +
        "obra comercial protegida — você explica e indica onde encontrar, não substitui a leitura.",
      r.resumo,
      "</resumo_do_livro>",
    ].join("\n\n");
  }
  return [
    "<resumo_do_livro>",
    `O resumo de "${r.titulo}" ainda está sendo preparado. Diga isso a quem perguntou, sem rodeios — ` +
      "não invente um resumo nem use pedaços soltos do livro como se já fossem o livro inteiro. " +
      "Ofereça responder uma pergunta mais específica sobre um tema do livro, se a pessoa quiser.",
    "</resumo_do_livro>",
  ].join("\n\n");
}

/**
 * O bloco de conteúdo da Biblioteca para esta pergunta: resumo pronto (ou "ainda preparando") quando é
 * um pedido de resumo de um livro identificado; busca por tema (trechos) em qualquer outro caso.
 */
async function blocoDaBiblioteca(supabase: Cliente, pergunta: string): Promise<string> {
  const materiais = await materiaisLiberados(supabase);
  if (!materiais.length) return "";
  const materialId = materialCitado(pergunta, materiais);
  const livroDoResumo = PISTA_DE_RESUMO.test(pergunta)
    ? (materialId ?? livroDoPedidoDeResumo(pergunta, materiais))
    : null;

  if (livroDoResumo) {
    const resumo = await buscarResumoDaBiblioteca(supabase, livroDoResumo);
    if (resumo) return blocoDeResumo(resumo);
    // bib_resumo_material não devolveu linha (não deveria acontecer, já que materialId veio de
    // materiaisLiberados — mas se bib_visiveis mudar entre as duas chamadas, cai na busca por tema).
  }

  const trechos = await buscarTrechosDaBiblioteca(supabase, pergunta, materialId);
  return blocoDeTrechos(trechos);
}

/**
 * A pergunta, pronta para virar a última mensagem do histórico: com o bloco da Biblioteca na frente,
 * quando existe, ou sem alteração nenhuma quando não há (livro ainda não indexado, nada bateu, aluno
 * sem Biblioteca liberada). Nunca lança — falha na busca não derruba a conversa, só sai sem o bloco.
 */
export async function perguntaComTrechosDaBiblioteca(
  supabase: Cliente,
  pergunta: string,
): Promise<string> {
  try {
    const bloco = await blocoDaBiblioteca(supabase, pergunta);
    return bloco ? `${bloco}\n\n<pergunta>\n${pergunta}\n</pergunta>` : pergunta;
  } catch (e) {
    console.error(
      "[assistente] busca na biblioteca falhou:",
      e instanceof Error ? e.message : String(e),
    );
    return pergunta;
  }
}
