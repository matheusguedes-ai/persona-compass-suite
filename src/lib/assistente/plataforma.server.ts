/**
 * O QUE A ASSISTENTE ENXERGA DA PLATAFORMA (#305, Nível 2) — tudo o que o ALUNO enxerga, nem uma
 * linha a mais.
 *
 * A trava é a mesma de cada tela do aluno, e não uma cópia dela:
 * - TODA leitura daqui usa o cliente com o LOGIN do aluno (`supabase`), então quem decide o que
 *   volta é a RLS — as mesmas policies que alimentam /aluno/educacao, /aluno/classroom,
 *   /aluno/agenda, /aluno/mentorias, /aluno/comunidade e /aluno/ranking. Não há service role aqui.
 * - Área que o grupo dele fechou (`groups.areas_aluno`) nem é consultada: a lista vem de
 *   `minhas_areas()`, a mesma que monta o menu. Área fechada na tela = área fechada para ela.
 * - Por cima da RLS, os mesmos recortes que a tela faz: só trilha PUBLICADA e LIBERADA para ele
 *   (`trilhas_liberadas` — trilha trancada nem aparece, nem como "existe mas está fechada"), só aula
 *   publicada, só treinamento publicado, só material de aula marcado "visível ao aluno", só material
 *   da biblioteca liberado (`bib_materiais_liberados`).
 * - Colegas: só pela função `perfil_do_colega`, a MESMA que abre o perfil do colega na Comunidade.
 *   É ela que corta e-mail, telefone, profissão e redes quando a pessoa não autorizou
 *   (`people.perfil_visivel`). Quando não autorizou, o dado nem sai do banco.
 * - Nenhum id vem do navegador: quem é "o aluno" é sempre o login da sessão.
 *
 * O que NÃO entra, de propósito: o feed da comunidade (texto de outras pessoas), a lista de presença
 * dos colegas, anotações do professor sobre a aula e `mentorias.observacoes` (o campo do mentor, que a
 * tela do aluno não mostra).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { situacaoDe, type Situacao, type AulaPresenca, type Registro } from "@/lib/presenca";
import { aulaRealizada } from "@/lib/janela";
import { ACOES } from "@/lib/pontos.functions";
import type {
  AulaDoAluno,
  ColegaDoAluno,
  PlataformaDoAluno,
  TrilhaDoAluno,
  TreinamentoDoAluno,
} from "@/lib/assistente/plataforma";

type Cliente = SupabaseClient<Database>;

/** Falha numa área não derruba a conversa: ela fica sem aquela área, e o log diz qual. */
function falhou(area: string, e: { message: string } | null | undefined): never {
  throw new Error(`assistente/plataforma: ${area} (${e?.message ?? "vazio"})`);
}

const AGENDA_ANTES_DIAS = 7;
const AGENDA_DEPOIS_DIAS = 120;
const MAX_MEMBROS_POR_GRUPO = 80;

/**
 * As ações que HOJE dão ponto de verdade (quem chama `darPonto`: presença no Classroom, mentoria
 * concluída, publicar/comentar/curtir na comunidade). `aula` e `perfil` estão na tabela de valores, mas
 * nenhum código os concede ainda — se entrassem aqui, a assistente prometeria ponto que não vem.
 * Quando alguém ligar essas duas, é só incluir.
 */
const ACOES_QUE_PONTUAM = new Set<keyof typeof ACOES>(["presenca", "mentoria", "publicar", "comentar", "curtir"]);

type PerfilColega = {
  id: string;
  full_name: string;
  role_at_company: string | null;
  company_name: string | null;
  profession: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  site_url: string | null;
  autorizou: boolean;
};

async function areasDoAluno(supabase: Cliente): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("minhas_areas");
  if (error) falhou("áreas", error);
  return new Set((data ?? []) as string[]);
}

async function trilhas(supabase: Cliente, userId: string): Promise<TrilhaDoAluno[]> {
  const { data: liberadas, error: lErr } = await supabase.rpc("trilhas_liberadas", { _person_id: null });
  if (lErr) falhou("trilhas liberadas", lErr);
  const ids = [...new Set((liberadas ?? []) as string[])];
  if (!ids.length) return [];

  const [t, m, l, mat, p] = await Promise.all([
    supabase.from("learning_tracks").select("id, title, description, sort_order, is_published, audience")
      .in("id", ids).eq("is_published", true).in("audience", ["alunos", "ambos"])
      .order("sort_order").order("id"),
    supabase.from("learning_modules").select("id, track_id, title, sort_order")
      .in("track_id", ids).order("sort_order").order("id"),
    supabase.from("learning_lessons").select("id, track_id, module_id, title, description, duration_min, sort_order")
      .in("track_id", ids).eq("is_published", true).order("sort_order").order("id"),
    supabase.from("learning_materials").select("track_id, lesson_id, title, kind, sort_order")
      .in("track_id", ids).order("sort_order").order("title"),
    supabase.from("learning_progress").select("lesson_id").eq("user_id", userId).in("track_id", ids),
  ]);
  for (const [nome, r] of [["trilhas", t], ["módulos", m], ["aulas da trilha", l], ["materiais da trilha", mat], ["progresso", p]] as const) {
    if (r.error) falhou(nome, r.error);
  }
  const vistas = new Set((p.data ?? []).map((x) => x.lesson_id));
  const modulo = new Map((m.data ?? []).map((x) => [x.id, x.title]));
  const materiaisDaAula = new Map<string, string[]>();
  const materiaisDaTrilha = new Map<string, string[]>();
  for (const x of mat.data ?? []) {
    const alvo = x.lesson_id ? materiaisDaAula : materiaisDaTrilha;
    const chave = (x.lesson_id ?? x.track_id) as string;
    alvo.set(chave, [...(alvo.get(chave) ?? []), `${x.title} (${x.kind})`]);
  }

  return (t.data ?? []).map((tr) => ({
    titulo: tr.title,
    descricao: tr.description,
    materiais: materiaisDaTrilha.get(tr.id) ?? [],
    aulas: (l.data ?? [])
      .filter((a) => a.track_id === tr.id)
      .map((a) => ({
        titulo: a.title,
        descricao: a.description,
        modulo: a.module_id ? modulo.get(a.module_id) ?? null : null,
        duracaoMin: a.duration_min,
        vista: vistas.has(a.id),
        materiais: materiaisDaAula.get(a.id) ?? [],
      })),
  }));
}

async function biblioteca(supabase: Cliente): Promise<PlataformaDoAluno["biblioteca"]> {
  const { data: liberados, error: lErr } = await supabase.rpc("bib_materiais_liberados", { _person_id: null });
  if (lErr) falhou("biblioteca liberada", lErr);
  const ids = [...new Set((liberados ?? []) as string[])];
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("biblioteca_materiais")
    .select("id, titulo, descricao, kind, categoria, pasta_id, biblioteca_pastas(titulo)")
    .in("id", ids)
    .order("titulo")
    .order("id");
  if (error) falhou("biblioteca", error);
  return (data ?? []).map((b) => ({
    titulo: b.titulo,
    descricao: b.descricao,
    tipo: b.kind,
    categoria: b.categoria,
    pasta: (b.biblioteca_pastas as { titulo: string } | null)?.titulo ?? null,
  }));
}

async function treinamentos(
  supabase: Cliente,
  pessoas: string[],
  agora: number,
): Promise<TreinamentoDoAluno[]> {
  const { data: ts, error: tErr } = await supabase
    .from("treinamentos")
    .select("id, titulo, descricao, percentual_minimo, tolerancia_atraso_min, treinamento_grupos(group_id)")
    .eq("publicado", true)
    .order("created_at")
    .order("id");
  if (tErr) falhou("treinamentos", tErr);
  if (!ts?.length) return [];

  const { data: mods, error: mErr } = await supabase
    .from("treinamento_modulos")
    .select("id, treinamento_id, titulo, ordem")
    .in("treinamento_id", ts.map((t) => t.id))
    .order("ordem")
    .order("id");
  if (mErr) falhou("módulos do treinamento", mErr);
  const modIds = (mods ?? []).map((m) => m.id);
  if (!modIds.length) return ts.map((t) => ({ titulo: t.titulo, descricao: t.descricao, aulas: [], frequencia: null }));

  const { data: aulas, error: aErr } = await supabase
    .from("treinamento_aulas")
    .select("id, modulo_id, titulo, descricao, comeca_em, termina_em, local, ordem, fechada_em, cancelada")
    .in("modulo_id", modIds)
    .order("ordem")
    .order("id");
  if (aErr) falhou("aulas do treinamento", aErr);
  const aulaIds = (aulas ?? []).map((a) => a.id);

  const [mat, pres, concl, membros] = await Promise.all([
    aulaIds.length
      ? supabase.from("treinamento_materiais").select("aula_id, titulo, kind, ordem")
          .in("aula_id", aulaIds).eq("visivel_aluno", true).order("ordem").order("id")
      : Promise.resolve({ data: [], error: null }),
    aulaIds.length && pessoas.length
      ? supabase.from("treinamento_presencas").select("aula_id, person_id, situacao, escaneado_em, registrado_em, origem")
          .in("aula_id", aulaIds).in("person_id", pessoas)
      : Promise.resolve({ data: [], error: null }),
    aulaIds.length && pessoas.length
      ? supabase.from("treinamento_aula_conclusoes").select("aula_id").in("aula_id", aulaIds).in("person_id", pessoas)
      : Promise.resolve({ data: [], error: null }),
    pessoas.length
      ? supabase.from("group_members").select("group_id, added_at").in("person_id", pessoas)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const [nome, r] of [["materiais de aula", mat], ["presenças", pres], ["aulas concluídas", concl], ["grupos do aluno", membros]] as const) {
    if (r.error) falhou(nome, r.error);
  }

  const materiais = new Map<string, string[]>();
  for (const x of (mat.data ?? []) as Array<{ aula_id: string; titulo: string; kind: string }>) {
    materiais.set(x.aula_id, [...(materiais.get(x.aula_id) ?? []), `${x.titulo} (${x.kind})`]);
  }
  const presenca = new Map<string, Registro>();
  for (const r of (pres.data ?? []) as Array<Pick<Registro, "aula_id" | "person_id" | "situacao" | "escaneado_em" | "registrado_em" | "origem">>) {
    presenca.set(r.aula_id, { ...r, observacao: null, marcado_por_nome: null, grupo: null });
  }
  const concluidas = new Set(((concl.data ?? []) as Array<{ aula_id: string }>).map((c) => c.aula_id));
  const entrouNoGrupo = new Map<string, number>();
  for (const g of (membros.data ?? []) as Array<{ group_id: string; added_at: string }>) {
    const t = new Date(g.added_at).getTime();
    entrouNoGrupo.set(g.group_id, Math.min(t, entrouNoGrupo.get(g.group_id) ?? t));
  }

  return ts.map((t) => {
    const tolerancia = t.tolerancia_atraso_min ?? undefined;
    // Desde quando o treinamento conta para ele: a entrada mais antiga num grupo do treinamento.
    // Quem entrou na 4ª aula não "deve" as três de antes — a mesma regra da frequência da tela.
    const desdes = ((t.treinamento_grupos ?? []) as Array<{ group_id: string }>)
      .map((g) => entrouNoGrupo.get(g.group_id))
      .filter((x): x is number => x != null);
    const desde = desdes.length ? Math.min(...desdes) : null;
    const modulosDoTreinamento = (mods ?? []).filter((m) => m.treinamento_id === t.id);
    const tituloDoModulo = new Map(modulosDoTreinamento.map((m) => [m.id, m.titulo]));
    const lista: AulaDoAluno[] = [];
    let estive = 0;
    let de = 0;
    for (const m of modulosDoTreinamento) {
      for (const a of (aulas ?? []).filter((x) => x.modulo_id === m.id)) {
        const ap: AulaPresenca = {
          id: a.id, titulo: a.titulo, modulo: m.titulo, local: a.local,
          comeca_em: a.comeca_em, termina_em: a.termina_em, fechada_em: a.fechada_em, cancelada: a.cancelada,
        };
        const gravada = !a.comeca_em;
        const realizada = !gravada && aulaRealizada(ap, agora);
        const antesDeEntrar = desde != null && !!a.comeca_em && new Date(a.comeca_em).getTime() < desde;
        let situacao: Situacao | null = null;
        if (realizada && !a.cancelada && !antesDeEntrar) {
          situacao = situacaoDe(presenca.get(a.id), ap, tolerancia);
          if (a.fechada_em) {
            de += 1;
            if (situacao === "presente" || situacao === "atrasado") estive += 1;
          }
        }
        lista.push({
          titulo: a.titulo,
          descricao: a.descricao,
          modulo: tituloDoModulo.get(a.modulo_id) ?? null,
          comecaEm: a.comeca_em,
          terminaEm: a.termina_em,
          local: a.local,
          cancelada: a.cancelada,
          gravada,
          realizada,
          antesDeEntrar,
          situacao,
          concluidaGravada: gravada ? concluidas.has(a.id) : false,
          materiais: materiais.get(a.id) ?? [],
        });
      }
    }
    return { titulo: t.titulo, descricao: t.descricao, aulas: lista, frequencia: de ? { estive, de } : null };
  });
}

async function agenda(supabase: Cliente, agora: number): Promise<PlataformaDoAluno["agenda"]> {
  const dia = 86_400_000;
  const { data, error } = await supabase
    .from("eventos")
    .select("id, titulo, descricao, quando, termina_em, link_url, aula_id")
    .gte("quando", new Date(agora - AGENDA_ANTES_DIAS * dia).toISOString())
    .lt("quando", new Date(agora + AGENDA_DEPOIS_DIAS * dia).toISOString())
    .order("quando")
    .order("id");
  if (error) falhou("agenda", error);
  return (data ?? []).map((e) => ({
    titulo: e.titulo,
    descricao: e.descricao,
    quando: e.quando,
    terminaEm: e.termina_em,
    temLink: !!e.link_url,
    deAula: !!e.aula_id,
  }));
}

async function mentorias(supabase: Cliente, pessoas: string[]): Promise<PlataformaDoAluno["mentorias"]> {
  if (!pessoas.length) return [];
  // Sem `observacoes`: é o campo do mentor, que a tela do aluno não mostra.
  const { data, error } = await supabase
    .from("mentorias")
    .select(
      "id, titulo, status, sessoes_contratadas, created_at, " +
        "mentoria_sessoes(id, quando, termina_em, modalidade, local, status, resumo, checklist_titulo, concluida_em, " +
        "mentoria_tarefas(titulo, ordem, concluida))",
    )
    .in("person_id", pessoas)
    .order("created_at")
    .order("id");
  if (error) falhou("mentorias", error);
  type Sessao = {
    id: string; quando: string | null; termina_em: string | null; modalidade: string | null; local: string | null;
    status: string; resumo: string | null; checklist_titulo: string | null; concluida_em: string | null;
    mentoria_tarefas: Array<{ titulo: string; ordem: number; concluida: boolean }> | null;
  };
  type Linha = { titulo: string; status: string; sessoes_contratadas: number | null; mentoria_sessoes: Sessao[] | null };
  return ((data ?? []) as unknown as Linha[]).map((m) => ({
    titulo: m.titulo,
    status: m.status,
    sessoesContratadas: m.sessoes_contratadas,
    sessoes: (m.mentoria_sessoes ?? [])
      .filter((s) => s.status !== "cancelada")
      .sort((a, b) => (a.quando ?? "").localeCompare(b.quando ?? "") || a.id.localeCompare(b.id))
      .map((s) => ({
        quando: s.quando,
        terminaEm: s.termina_em,
        modalidade: s.modalidade,
        local: s.local,
        status: s.status,
        resumo: s.resumo,
        tarefas: [...(s.mentoria_tarefas ?? [])]
          .sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo))
          .map((t) => ({ titulo: t.titulo, concluida: t.concluida })),
      })),
  }));
}

async function comunidade(supabase: Cliente, pessoas: string[]): Promise<PlataformaDoAluno["comunidade"]> {
  const { data: meus, error: gErr } = await supabase.rpc("meus_grupos_como_avaliado");
  if (gErr) falhou("grupos", gErr);
  const ids = [...new Set((meus ?? []) as string[])];
  if (!ids.length) return [];
  const [{ data: grupos, error: nErr }, { data: membros, error: mErr }] = await Promise.all([
    supabase.from("groups").select("id, name").in("id", ids).order("name").order("id"),
    supabase.from("group_members").select("group_id, person_id").in("group_id", ids).order("person_id"),
  ]);
  if (nErr) falhou("nomes dos grupos", nErr);
  if (mErr) falhou("membros dos grupos", mErr);

  const eu = new Set(pessoas);
  const colegas = [...new Set((membros ?? []).map((m) => m.person_id).filter((p) => !eu.has(p)))];
  // Um por um, pela função que a tela usa. Quem ela não devolve (não divide grupo) não entra.
  const perfis = new Map<string, PerfilColega>();
  const rpc = supabase.rpc as never as (n: string, a: unknown) => Promise<{ data: PerfilColega[] | null; error: { message: string } | null }>;
  for (let i = 0; i < colegas.length; i += 10) {
    const lote = await Promise.all(colegas.slice(i, i + 10).map((p) => rpc.call(supabase, "perfil_do_colega", { p_person: p })));
    for (const r of lote) {
      if (r.error) falhou("perfil de colega", r.error);
      const perfil = r.data?.[0];
      if (perfil) perfis.set(perfil.id, perfil);
    }
  }

  return (grupos ?? []).map((g) => ({
    nome: g.name,
    membros: (membros ?? [])
      .filter((m) => m.group_id === g.id && perfis.has(m.person_id))
      .map((m) => perfis.get(m.person_id)!)
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR") || a.id.localeCompare(b.id))
      .slice(0, MAX_MEMBROS_POR_GRUPO)
      .map((p): ColegaDoAluno => ({
        nome: p.full_name,
        cargo: p.role_at_company,
        empresa: p.company_name,
        // Contato só com autorização — o banco já devolve nulo quando não há; o `autorizou` aqui é
        // a segunda trava, para nenhum ajuste futuro na função vazar contato por engano.
        autorizou: p.autorizou,
        profissao: p.autorizou ? p.profession : null,
        email: p.autorizou ? p.email : null,
        telefone: p.autorizou ? p.phone : null,
        linkedin: p.autorizou ? p.linkedin_url : null,
        instagram: p.autorizou ? p.instagram_url : null,
        site: p.autorizou ? p.site_url : null,
      })),
  }));
}

async function pontos(supabase: Cliente, userId: string, conta: string): Promise<PlataformaDoAluno["pontos"]> {
  // A RLS devolve as linhas dele e, com a comunidade aberta, as dos colegas de grupo — a mesma base do
  // ranking da tela. Dos colegas só se usa a SOMA, para a posição; nada de quem é quem.
  const { data, error } = await supabase
    .from("pontos")
    .select("user_id, acao, pontos, created_at")
    .eq("mentor_id", conta)
    .order("created_at", { ascending: false })
    .order("id")
    .limit(5000);
  if (error) falhou("pontos", error);
  const linhas = data ?? [];
  const meus = linhas.filter((l) => l.user_id === userId);
  const porAcao: Record<string, { vezes: number; pontos: number }> = {};
  for (const l of meus) {
    const a = (porAcao[l.acao] ??= { vezes: 0, pontos: 0 });
    a.vezes += 1;
    a.pontos += l.pontos;
  }
  const soma = new Map<string, number>();
  for (const l of linhas) soma.set(l.user_id, (soma.get(l.user_id) ?? 0) + l.pontos);
  const total = soma.get(userId) ?? 0;
  const lugar = [...soma.values()].filter((v) => v > total).length + 1;
  return {
    total,
    porAcao,
    ultimos: meus.slice(0, 20).map((l) => ({ acao: l.acao, pontos: l.pontos, quando: l.created_at })),
    posicao: soma.size > 1 ? { lugar, de: Math.max(soma.size, lugar) } : null,
    regras: (Object.keys(ACOES) as Array<keyof typeof ACOES>)
      .filter((acao) => ACOES_QUE_PONTUAM.has(acao))
      .map((acao) => ({ acao, rotulo: ACOES[acao].rotulo, pontos: ACOES[acao].pontos, tetoDiario: ACOES[acao].tetoDiario })),
  };
}

/**
 * Tudo o que a assistente lê da plataforma para este aluno. Uma área que falhar sai do contexto (e
 * fica no log); as outras seguem — ela nunca inventa o que não recebeu, e a orientação manda dizer
 * que não conseguiu ver aquela parte agora.
 */
export async function plataformaDoAluno(
  supabase: Cliente,
  userId: string,
  pessoas: string[],
  conta: string,
  agora: number,
): Promise<PlataformaDoAluno> {
  const indisponiveis: string[] = [];
  // Sem saber quais áreas estão abertas, não se lê área nenhuma — na dúvida, fechado. Ela segue só
  // com o relatório e sabe que a plataforma não pôde ser lida agora.
  let areas = new Set<string>();
  try {
    areas = await areasDoAluno(supabase);
  } catch (e) {
    console.error("[assistente] áreas do aluno:", e instanceof Error ? e.message : String(e));
    indisponiveis.push("a plataforma (aulas, agenda, materiais, comunidade)");
  }
  async function tenta<T>(area: string, aberta: boolean, f: () => Promise<T>, vazio: T): Promise<T> {
    if (!aberta) return vazio;
    try {
      return await f();
    } catch (e) {
      console.error("[assistente] leitura da plataforma falhou:", e instanceof Error ? e.message : String(e));
      indisponiveis.push(area);
      return vazio;
    }
  }
  const [trs, bib, trein, ag, ment, com, pts] = await Promise.all([
    tenta("Academy", areas.has("academy"), () => trilhas(supabase, userId), []),
    tenta("Biblioteca", areas.has("academy"), () => biblioteca(supabase), []),
    tenta("Classroom", areas.has("classroom"), () => treinamentos(supabase, pessoas, agora), []),
    tenta("Agenda", areas.has("agenda"), () => agenda(supabase, agora), []),
    tenta("Mentorias", areas.has("mentorias"), () => mentorias(supabase, pessoas), []),
    tenta("Comunidade", areas.has("comunidade"), () => comunidade(supabase, pessoas), []),
    tenta("Ranking", areas.has("comunidade"), () => pontos(supabase, userId, conta), null),
  ]);
  return {
    areas: [...areas].sort(),
    indisponiveis: indisponiveis.sort(),
    trilhas: trs,
    biblioteca: bib,
    treinamentos: trein,
    agenda: ag,
    mentorias: ment,
    comunidade: com,
    pontos: pts,
  };
}
