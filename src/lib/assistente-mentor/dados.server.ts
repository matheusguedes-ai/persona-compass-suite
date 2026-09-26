/**
 * O QUE A ASSISTENTE DO MENTOR ENXERGA (#307) — os resultados e o uso da plataforma dos alunos da conta,
 * e nada além do que o próprio mentor enxerga no painel.
 *
 * A trava não é um filtro daqui; é o LOGIN de quem pergunta:
 * - TODA leitura usa o cliente com o login do mentor (`supabase`, o do `requireSupabaseAuth`), então
 *   quem decide o que volta é a RLS de cada tabela — as mesmas policies que alimentam Pessoas, Grupos,
 *   Classroom, Academy, Mentorias e Campanhas. Aluno de outra conta não volta porque este login não o
 *   enxerga. Não há chave de serviço aqui.
 * - Por cima da RLS, cada consulta também é recortada pela conta (`mentor_id`/`owner_id`/`conta_id` =
 *   `conta`) — as tabelas que um ALUNO também lê (as dele) nunca misturam uma conta com outra.
 * - Os relatórios saem do MESMO `buildReport` da tela, que confere de novo, com o token desta sessão,
 *   se esta pessoa pode ser vista (`podeVerPessoaAutenticado`).
 * - As contas de presença e de conclusão são as das telas do mentor (`montarTabelaPresenca`,
 *   `calcularConclusoesDoTreinamento`, `calcularConclusoesDaTrilha`) — só a parte que LÊ: as cascas que
 *   emitem certificado (`listaDeConcluidos*`) não são chamadas daqui.
 *
 * O que NUNCA é lido aqui: `assistente_conversas`, `assistente_mensagens`, `assistente_consentimentos`,
 * `assistente_uso` e `assistente_observacoes` — as conversas dos alunos com a assistente deles não são
 * dado do mentor (`scripts/testar_assistente_mentor.py` confere que nenhum arquivo desta pasta cita
 * essas tabelas). Nem e-mail, telefone e redes dos alunos.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Report } from "@/components/report/sections";
import { buildReport } from "@/lib/report.server";
import { montarTabelaPresenca } from "@/lib/presenca.server";
import { aulaRealizada } from "@/lib/janela";
import { calcularConclusoesDoTreinamento } from "@/lib/classroom.functions";
import { calcularConclusoesDaTrilha } from "@/lib/learning.functions";
import { ACOES } from "@/lib/pontos.functions";
import {
  leituraDoRelatorio,
  type AulaDoTreinamento,
  type CampanhaDaConta,
  type DadosDaConta,
  type GrupoDaConta,
  type MentoriaDaConta,
  type PendenteDaPessoa,
  type PessoaDaConta,
  type ResultadoDaPessoa,
  type SituacaoNaAula,
  type TreinamentoDaConta,
  type TrilhaDaConta,
} from "@/lib/assistente-mentor/contexto";

type Cliente = SupabaseClient<Database>;

/**
 * Teto de relatórios montados por pergunta. Cada `buildReport` custa umas dez consultas; o teto segura
 * a chamada inteira bem longe do limite de consultas de uma requisição no Cloudflare. Hoje a conta tem
 * duas dúzias de resultados vigentes. O que passar disso não some calado: o texto diz quantos ficaram de
 * fora (`resultadosNaoDetalhados`).
 */
const MAX_RELATORIOS = 80;
/** Relatórios montados ao mesmo tempo — o bastante para não esperar em fila, pouco para não disputar conexão. */
const EM_PARALELO = 4;
const MAX_LINHAS = 5000;

/**
 * As ações que HOJE dão ponto de verdade — a mesma lista de `assistente/plataforma.server.ts` (`aula` e
 * `perfil` estão na tabela de valores, mas nenhum código os concede). Quando alguém ligar as duas, incluir
 * aqui e lá.
 */
const ACOES_QUE_PONTUAM = ["presenca", "mentoria", "publicar", "comentar", "curtir"] as const;

function falhou(area: string, e: { message: string } | null | undefined): never {
  throw new Error(`assistente-mentor: ${area} (${e?.message ?? "vazio"})`);
}

/** "O mesmo teste": o instrumento — mas cada teste personalizado é um teste diferente (a versão). */
function chaveDoTeste(instrumento: string | null | undefined, versao: string): string {
  return !instrumento || instrumento === "personalizado" ? `v:${versao}` : `i:${instrumento}`;
}

async function emLotes<T, R>(itens: T[], f: (x: T) => Promise<R>): Promise<R[]> {
  const saida: R[] = [];
  for (let i = 0; i < itens.length; i += EM_PARALELO) {
    saida.push(...(await Promise.all(itens.slice(i, i + EM_PARALELO).map(f))));
  }
  return saida;
}

async function pessoasEGrupos(supabase: Cliente, conta: string) {
  const [pes, grs] = await Promise.all([
    supabase.from("people").select("id, full_name, user_id, created_at").eq("mentor_id", conta)
      .order("full_name").order("id").range(0, MAX_LINHAS - 1),
    supabase.from("groups").select("id, name").eq("mentor_id", conta).order("name").order("id"),
  ]);
  if (pes.error) falhou("pessoas", pes.error);
  if (grs.error) falhou("grupos", grs.error);
  const pessoas: PessoaDaConta[] = (pes.data ?? []).map((p) => ({
    id: p.id,
    nome: p.full_name,
    temLogin: !!p.user_id,
    userId: p.user_id,
    cadastradaEm: p.created_at,
  }));
  const ids = new Set(pessoas.map((p) => p.id));
  const grupoIds = (grs.data ?? []).map((g) => g.id);

  const [mem, lib] = grupoIds.length
    ? await Promise.all([
        supabase.from("group_members").select("group_id, person_id").in("group_id", grupoIds).order("person_id"),
        supabase.from("group_instruments").select("group_id, instrument_id, version_id, instruments(name)").in("group_id", grupoIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (mem.error) falhou("membros dos grupos", mem.error);
  if (lib.error) falhou("testes liberados", lib.error);

  // Personalizado liberado com versão escolhida: o nome é o título da versão.
  const versoesLiberadas = [...new Set((lib.data ?? []).map((l) => l.version_id).filter((v): v is string => !!v))];
  const { data: vl, error: vlErr } = versoesLiberadas.length
    ? await supabase.from("test_versions").select("id, title").in("id", versoesLiberadas)
    : { data: [], error: null };
  if (vlErr) falhou("versões liberadas", vlErr);
  const tituloDaVersao = new Map((vl ?? []).map((v) => [v.id, v.title]));

  const grupos: GrupoDaConta[] = (grs.data ?? []).map((g) => ({
    id: g.id,
    nome: g.name,
    membros: [...new Set((mem.data ?? []).filter((m) => m.group_id === g.id && ids.has(m.person_id)).map((m) => m.person_id))],
    liberados: (lib.data ?? [])
      .filter((l) => l.group_id === g.id)
      .map((l) => {
        const nomeDoInstrumento = (l.instruments as { name: string } | null)?.name ?? l.instrument_id;
        const personalizadoComVersao = l.instrument_id === "personalizado" && l.version_id;
        return {
          chave: personalizadoComVersao ? `v:${l.version_id}` : `i:${l.instrument_id}`,
          nome: personalizadoComVersao ? tituloDaVersao.get(l.version_id as string) ?? nomeDoInstrumento : nomeDoInstrumento,
        };
      })
      .filter((l, i, todos) => todos.findIndex((x) => x.chave === l.chave) === i),
  }));
  return { pessoas, grupos };
}

/**
 * O resultado VIGENTE de cada teste, por pessoa — o mais recente concluído, a regra do dono (#298) —, e
 * os envios ainda sem resposta. A lista vem da consulta com o login do mentor (RLS de `test_responses`);
 * só depois cada relatório é montado.
 */
/**
 * Quem monta cada relatório. Na produção é sempre `buildReport`, a mesma função da tela. O script de teste
 * (`scripts/testar_assistente_mentor.ts`, fora do servidor) passa uma que chama a rota da tela
 * (`/api/public/report/$id`) com o token do mentor fictício — o mesmo `buildReport`, do outro lado da rede.
 */
export type MontarRelatorio = (responseId: string) => Promise<{ status: number; data?: unknown }>;

async function resultadosEPendentes(supabase: Cliente, conta: string, pessoas: Set<string>, relatorio: MontarRelatorio) {
  const [feitas, abertas, catalogo] = await Promise.all([
    supabase.from("test_responses")
      .select("id, person_id, version_id, attempt, submitted_at, test_versions(title, instrument_id)")
      .eq("mentor_id", conta).eq("kind", "self").not("submitted_at", "is", null).is("canceled_at", null)
      .order("submitted_at", { ascending: false }).order("id").range(0, MAX_LINHAS - 1),
    supabase.from("test_responses")
      .select("id, person_id, version_id, created_at, started_at, expires_at, assessment_response_id, test_versions(title, instrument_id)")
      .eq("mentor_id", conta).eq("kind", "self").is("submitted_at", null).is("canceled_at", null)
      .order("created_at", { ascending: false }).order("id").range(0, MAX_LINHAS - 1),
    supabase.from("instruments").select("id, name"),
  ]);
  if (feitas.error) falhou("respostas concluídas", feitas.error);
  if (abertas.error) falhou("envios em aberto", abertas.error);
  if (catalogo.error) falhou("catálogo de testes", catalogo.error);
  const nomeDoInstrumento = new Map((catalogo.data ?? []).map((i) => [i.id, i.name]));

  type Versao = { title: string; instrument_id: string | null } | null;
  const vistos = new Set<string>();
  const vigentes: Array<{ id: string; pessoaId: string; versao: string; chave: string; titulo: string; instrumento: string | null; concluidoEm: string; tentativa: number }> = [];
  for (const r of feitas.data ?? []) {
    if (!r.person_id || !pessoas.has(r.person_id)) continue;
    const v = r.test_versions as Versao;
    const chave = chaveDoTeste(v?.instrument_id, r.version_id);
    const k = `${r.person_id}|${chave}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    vigentes.push({
      id: r.id,
      pessoaId: r.person_id,
      versao: r.version_id,
      chave,
      titulo: v?.title ?? "Teste",
      instrumento: v?.instrument_id ?? null,
      concluidoEm: r.submitted_at as string,
      tentativa: r.attempt ?? 1,
    });
  }

  const detalhar = vigentes.slice(0, MAX_RELATORIOS);
  const montados = await emLotes(detalhar, async (v) => ({ v, rep: await relatorio(v.id) }));
  const resultados: ResultadoDaPessoa[] = [];
  const jaTem = new Set<string>();
  for (const { v, rep } of montados) {
    const r = rep.status === 200 ? (rep.data as Report) : null;
    // Versão que a RLS não deixou ler (de outra conta, não modelo): o instrumento vem do relatório.
    const instrumento = v.instrumento ?? r?.instrument_id ?? null;
    const chave = v.instrumento ? v.chave : chaveDoTeste(instrumento, v.versao);
    if (jaTem.has(`${v.pessoaId}|${chave}`)) continue; // já veio o mais recente deste teste
    jaTem.add(`${v.pessoaId}|${chave}`);
    resultados.push({
      pessoaId: v.pessoaId,
      chave,
      teste: r?.test_title ?? v.titulo,
      instrumento,
      instrumentoNome: instrumento && instrumento !== "personalizado" ? nomeDoInstrumento.get(instrumento) ?? null : null,
      concluidoEm: v.concluidoEm,
      tentativa: v.tentativa,
      confiabilidade: r?.qualidade?.nivel ?? null,
      observadores: r?.external?.count ?? 0,
      leitura: r ? leituraDoRelatorio(r) : { tipo: "sem_relatorio" },
    });
  }

  const vistosAbertos = new Set<string>();
  const pendentes: PendenteDaPessoa[] = [];
  for (const r of abertas.data ?? []) {
    if (!r.person_id || !pessoas.has(r.person_id)) continue;
    const v = r.test_versions as Versao;
    const chave = chaveDoTeste(v?.instrument_id, r.version_id);
    const k = `${r.person_id}|${chave}`;
    if (vistosAbertos.has(k)) continue; // o envio mais recente de cada teste
    vistosAbertos.add(k);
    pendentes.push({
      pessoaId: r.person_id,
      chave,
      teste: v?.title ?? "Teste",
      enviadoEm: r.created_at,
      prazo: r.expires_at,
      comecou: !!r.started_at,
      daBateria: !!r.assessment_response_id,
    });
  }
  return { resultados, pendentes, naoDetalhados: vigentes.length - detalhar.length };
}

async function treinamentos(supabase: Cliente, conta: string): Promise<TreinamentoDaConta[]> {
  const { data: ts, error } = await supabase
    .from("treinamentos")
    .select("id, titulo, publicado, percentual_minimo, tolerancia_atraso_min, created_at, treinamento_grupos(groups(name))")
    .eq("mentor_id", conta)
    .order("created_at")
    .order("id");
  if (error) falhou("treinamentos", error);
  const saida: TreinamentoDaConta[] = [];
  // Em série: cada treinamento já faz as consultas dele em paralelo por dentro.
  for (const t of ts ?? []) {
    const [tabela, conclusao] = await Promise.all([
      montarTabelaPresenca(supabase, t.id),
      calcularConclusoesDoTreinamento(supabase, t.id),
    ]);
    const aulaIds = tabela.aulas.map((a) => a.id);
    const gravadas = tabela.aulas.filter((a) => !a.comeca_em).map((a) => a.id);
    const [aval, concl] = await Promise.all([
      aulaIds.length
        ? supabase.from("treinamento_avaliacoes").select("aula_id, person_id, estrelas, comentario, avaliada_em")
            .in("aula_id", aulaIds).order("avaliada_em").order("id")
        : Promise.resolve({ data: [], error: null }),
      gravadas.length
        ? supabase.from("treinamento_aula_conclusoes").select("aula_id, person_id").in("aula_id", gravadas).order("person_id")
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (aval.error) falhou("avaliações de aula", aval.error);
    if (concl.error) falhou("aulas gravadas assistidas", concl.error);

    const referencia = new Date(tabela.referencia).getTime();
    const aulas: AulaDoTreinamento[] = tabela.aulas.map((a) => ({
      titulo: a.titulo,
      modulo: a.modulo,
      comecaEm: a.comeca_em,
      terminaEm: a.termina_em,
      cancelada: a.cancelada,
      gravada: !a.comeca_em,
      listaFechada: !!a.fechada_em,
      realizada: !!a.comeca_em && aulaRealizada(a, referencia),
      situacoes: tabela.linhas
        .filter((l) => l.aula_id === a.id)
        .map((l) => ({ pessoaId: l.person_id, situacao: l.situacao as SituacaoNaAula })),
      assistiram: ((concl.data ?? []) as Array<{ aula_id: string; person_id: string }>)
        .filter((c) => c.aula_id === a.id)
        .map((c) => c.person_id),
      avaliacoes: ((aval.data ?? []) as Array<{ aula_id: string; person_id: string; estrelas: number; comentario: string | null }>)
        .filter((x) => x.aula_id === a.id)
        .map((x) => ({ pessoaId: x.person_id, estrelas: x.estrelas, comentario: x.comentario })),
    }));
    type Grupo = { groups: { name: string } | null };
    saida.push({
      titulo: t.titulo,
      publicado: t.publicado,
      grupos: ((t.treinamento_grupos ?? []) as Grupo[])
        .map((g) => g.groups?.name)
        .filter((n): n is string => !!n)
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
      percentualMinimo: t.percentual_minimo,
      toleranciaMin: tabela.tolerancia_min,
      aulas,
      frequencia: tabela.resumo.map((r) => ({
        pessoaId: r.person_id,
        presentes: r.presentes,
        contadas: r.contadas,
        justificadas: r.justificadas,
        pct: r.pct,
        saiuDoGrupo: r.saiu_do_grupo,
      })),
      conclusao: conclusao.pessoas.map((p) => ({
        pessoaId: p.person_id,
        feitos: p.feitos,
        total: p.total,
        percentual: p.percentual,
        concluido: p.concluido,
      })),
      totalItens: conclusao.total_itens,
      foraDaConta: tabela.fora_da_conta,
    });
  }
  return saida;
}

async function trilhas(supabase: Cliente, conta: string, pessoas: PessoaDaConta[]): Promise<TrilhaDaConta[]> {
  const { data: trs, error } = await supabase
    .from("learning_tracks")
    .select("id, title, is_published, audience, percentual_minimo, sort_order")
    .eq("owner_id", conta)
    .order("sort_order")
    .order("id");
  if (error) falhou("trilhas", error);
  const ids = (trs ?? []).map((t) => t.id);
  if (!ids.length) return [];
  const [aulas, modulos, progresso, destinos] = await Promise.all([
    supabase.from("learning_lessons").select("id, track_id, module_id, title, is_published, sort_order")
      .in("track_id", ids).order("sort_order").order("id"),
    supabase.from("learning_modules").select("id, title").in("track_id", ids),
    supabase.from("learning_progress").select("lesson_id, user_id").in("track_id", ids).range(0, MAX_LINHAS - 1),
    supabase.from("learning_track_destinos").select("track_id, group_id, person_id, groups(name)").in("track_id", ids),
  ]);
  for (const [nome, r] of [["aulas das trilhas", aulas], ["módulos", modulos], ["aulas vistas", progresso], ["destinos das trilhas", destinos]] as const) {
    if (r.error) falhou(nome, r.error);
  }
  const pessoaPorLogin = new Map(pessoas.filter((p) => p.userId).map((p) => [p.userId as string, p.id]));
  const modulo = new Map((modulos.data ?? []).map((m) => [m.id, m.title]));
  const saida: TrilhaDaConta[] = [];
  for (const t of trs ?? []) {
    const conclusao = await calcularConclusoesDaTrilha(supabase, t.id);
    const meusDestinos = (destinos.data ?? []).filter((d) => d.track_id === t.id);
    saida.push({
      titulo: t.title,
      publicada: t.is_published,
      publico: t.audience,
      percentualMinimo: t.percentual_minimo,
      destinos: {
        grupos: meusDestinos
          .map((d) => (d.groups as { name: string } | null)?.name)
          .filter((n): n is string => !!n)
          .sort((a, b) => a.localeCompare(b, "pt-BR")),
        pessoas: meusDestinos.map((d) => d.person_id).filter((p): p is string => !!p),
      },
      aulas: (aulas.data ?? [])
        .filter((a) => a.track_id === t.id)
        .map((a) => ({
          titulo: a.title,
          modulo: a.module_id ? modulo.get(a.module_id) ?? null : null,
          publicada: a.is_published,
          vistaPor: [
            ...new Set(
              (progresso.data ?? [])
                .filter((p) => p.lesson_id === a.id)
                .map((p) => pessoaPorLogin.get(p.user_id))
                .filter((p): p is string => !!p),
            ),
          ],
        })),
      conclusao: conclusao.pessoas.map((p) => ({
        pessoaId: p.person_id,
        feitos: p.feitos,
        total: p.total,
        percentual: p.percentual,
        concluido: p.concluido,
      })),
    });
  }
  return saida;
}

/** A mesma conta da tela Testes → Campanhas (`listCampanhas`): uma unidade por bateria ou teste avulso. */
async function campanhas(supabase: Cliente, conta: string, agora: number): Promise<CampanhaDaConta[]> {
  const { data: links, error } = await supabase
    .from("invite_links")
    .select("id, title, version_ids, is_active, starts_at, expires_at, max_responses, created_at, groups(name)")
    .eq("mentor_id", conta)
    .order("created_at", { ascending: false })
    .order("id");
  if (error) falhou("campanhas", error);
  const lista = links ?? [];
  if (!lista.length) return [];
  const ids = lista.map((l) => l.id);
  const versoes = [...new Set(lista.flatMap((l) => l.version_ids ?? []))];
  const [avulsas, baterias, vs] = await Promise.all([
    supabase.from("test_responses").select("invite_link_id, person_id, submitted_at, canceled_at")
      .in("invite_link_id", ids).is("assessment_response_id", null).range(0, MAX_LINHAS - 1),
    supabase.from("assessment_responses").select("invite_link_id, person_id, submitted_at, canceled_at")
      .in("invite_link_id", ids).range(0, MAX_LINHAS - 1),
    versoes.length
      ? supabase.from("test_versions").select("id, title").in("id", versoes)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const [nome, r] of [["envios avulsos", avulsas], ["baterias", baterias], ["testes das campanhas", vs]] as const) {
    if (r.error) falhou(nome, r.error);
  }
  const titulo = new Map(((vs.data ?? []) as Array<{ id: string; title: string }>).map((v) => [v.id, v.title]));
  return lista.map((l) => {
    const naoComecou = !!l.starts_at && new Date(l.starts_at).getTime() > agora;
    const expirada = !!l.expires_at && new Date(l.expires_at).getTime() < agora;
    const unidades = [
      ...(avulsas.data ?? []).filter((r) => r.invite_link_id === l.id).map((r) => ({ ...r, bateria: false })),
      ...(baterias.data ?? []).filter((r) => r.invite_link_id === l.id).map((r) => ({ ...r, bateria: true })),
    ]
      .filter((r) => !r.canceled_at)
      .map((r) => ({ pessoaId: r.person_id, respondida: !!r.submitted_at, bateria: r.bateria }));
    return {
      titulo: l.title ?? "Campanha sem nome",
      estado: !l.is_active ? "Encerrada" : expirada ? "Expirada" : naoComecou ? "Agendada" : "Ativa",
      testes: (l.version_ids ?? []).map((v) => titulo.get(v)).filter((t): t is string => !!t),
      grupo: (l.groups as { name: string } | null)?.name ?? null,
      criadaEm: l.created_at,
      comecaEm: l.starts_at,
      expiraEm: l.expires_at,
      limite: l.max_responses,
      unidades,
    };
  });
}

async function pontos(supabase: Cliente, conta: string) {
  const { data, error } = await supabase
    .from("pontos")
    .select("user_id, acao, pontos")
    .eq("mentor_id", conta)
    .order("created_at")
    .order("id")
    .range(0, MAX_LINHAS * 4 - 1);
  if (error) falhou("pontos", error);
  return (data ?? []).map((p) => ({ userId: p.user_id, acao: p.acao, pontos: p.pontos }));
}

async function mentorias(supabase: Cliente, conta: string): Promise<MentoriaDaConta[]> {
  // Sem `observacoes` e sem o `resumo` das sessões: são as anotações do próprio mentor, não uso do aluno.
  const { data, error } = await supabase
    .from("mentorias")
    .select("id, person_id, titulo, status, sessoes_contratadas, created_at, mentoria_sessoes(quando, status, avaliacao_estrelas, avaliacao_comentario)")
    .eq("mentor_id", conta)
    .order("created_at")
    .order("id");
  if (error) falhou("mentorias", error);
  type Sessao = { quando: string | null; status: string; avaliacao_estrelas: number | null; avaliacao_comentario: string | null };
  return (data ?? []).map((m) => ({
    pessoaId: m.person_id,
    titulo: m.titulo ?? "Mentoria",
    status: m.status,
    contratadas: m.sessoes_contratadas,
    sessoes: ((m.mentoria_sessoes ?? []) as Sessao[])
      .map((s) => ({ quando: s.quando, status: s.status, estrelas: s.avaliacao_estrelas, comentario: s.avaliacao_comentario }))
      .sort((a, b) => (a.quando ?? "").localeCompare(b.quando ?? "")),
  }));
}

async function certificados(supabase: Cliente, conta: string) {
  const { data, error } = await supabase
    .from("certificados")
    .select("person_id, treinamento_id, nome_item, percentual_atingido, emitido_em")
    .eq("conta_id", conta)
    .order("emitido_em")
    .order("id");
  if (error) falhou("certificados", error);
  return (data ?? []).map((c) => ({
    pessoaId: c.person_id,
    item: c.nome_item,
    tipo: (c.treinamento_id ? "treinamento" : "trilha") as "treinamento" | "trilha",
    emitidoEm: c.emitido_em,
    percentual: c.percentual_atingido,
  }));
}

/**
 * Tudo o que a assistente do mentor lê, com o login dele. Pessoas e grupos são a base: sem eles não há
 * o que responder, e a falha sobe. Qualquer outra área que falhar sai do texto com um aviso ("não foi
 * possível ler agora") — ela nunca inventa o que não recebeu.
 */
export async function lerDadosDaConta(
  supabase: Cliente,
  conta: string,
  agora: number,
  relatorio: MontarRelatorio = buildReport,
): Promise<DadosDaConta> {
  const { pessoas, grupos } = await pessoasEGrupos(supabase, conta);
  const ids = new Set(pessoas.map((p) => p.id));
  const indisponiveis: string[] = [];
  async function tenta<T>(area: string, f: () => Promise<T>, vazio: T): Promise<T> {
    try {
      return await f();
    } catch (e) {
      console.error("[assistente-mentor] leitura falhou:", e instanceof Error ? e.message : String(e));
      indisponiveis.push(area);
      return vazio;
    }
  }
  const [rp, trs, tls, cps, pts, mts, cts] = await Promise.all([
    tenta("resultados dos testes", () => resultadosEPendentes(supabase, conta, ids, relatorio), { resultados: [], pendentes: [], naoDetalhados: 0 }),
    tenta("Classroom", () => treinamentos(supabase, conta), []),
    tenta("Academy", () => trilhas(supabase, conta, pessoas), []),
    tenta("campanhas", () => campanhas(supabase, conta, agora), []),
    tenta("ranking", () => pontos(supabase, conta), []),
    tenta("mentorias", () => mentorias(supabase, conta), []),
    tenta("certificados", () => certificados(supabase, conta), []),
  ]);
  return {
    pessoas,
    grupos,
    resultados: rp.resultados,
    resultadosNaoDetalhados: rp.naoDetalhados,
    pendentes: rp.pendentes,
    treinamentos: trs,
    trilhas: tls,
    campanhas: cps,
    pontos: pts,
    regrasDePontos: ACOES_QUE_PONTUAM.map((acao) => ({
      acao,
      rotulo: ACOES[acao].rotulo,
      pontos: ACOES[acao].pontos,
      tetoDiario: ACOES[acao].tetoDiario,
    })),
    mentorias: mts,
    certificados: cts,
    indisponiveis: indisponiveis.sort(),
  };
}
