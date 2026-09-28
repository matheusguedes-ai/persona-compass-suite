/**
 * O QUE A ASSISTENTE DO MENTOR ENXERGA (#307) — os resultados e o uso da plataforma dos alunos da conta,
 * e nada além do que o próprio mentor enxerga no painel.
 *
 * A trava não é um filtro daqui; é o LOGIN de quem pergunta:
 * - TODA leitura usa o cliente com o login do mentor (`supabase`, o do `requireSupabaseAuth`), então
 *   quem decide o que volta é a RLS de cada tabela — as mesmas policies que alimentam Pessoas, Grupos,
 *   Classroom, Academy, Mentorias, Agenda e Campanhas. Aluno de outra conta não volta porque este login
 *   não o enxerga. Não há chave de serviço aqui.
 * - Por cima da RLS, cada consulta também é recortada pela conta (`mentor_id`/`owner_id`/`conta_id` =
 *   `conta`) — as tabelas que um ALUNO também lê (as dele) nunca misturam uma conta com outra.
 * - Os relatórios saem do MESMO `buildReport` da tela, que confere de novo, com o token desta sessão,
 *   se esta pessoa pode ser vista (`podeVerPessoaAutenticado`).
 * - As contas de presença e de conclusão são as das telas do mentor (`montarTabelaPresenca`,
 *   `calcularConclusoesDoTreinamento`, `calcularConclusoesDaTrilha`) — só a parte que LÊ: as cascas que
 *   emitem certificado (`listaDeConcluidos*`) não são chamadas daqui.
 *
 * #310 — TUDO OU O AVISO. A API do banco devolve no máximo um lote por consulta e corta o resto sem
 * avisar. Aqui, toda lista que cresce com a conta é lida INTEIRA, em páginas, conferida com a contagem
 * exata (`lerTodas`), e cada área registra o que cobriu (`cobertura`): quantos itens existem e se todos
 * chegaram. Onde não dá para garantir (o teto de relatórios detalhados, a janela da Agenda, as leituras
 * de dentro das telas), o recorte vai escrito no texto — a assistente nunca responde "quais são" com
 * uma fatia sem saber que é fatia.
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
import { lerTodas } from "@/lib/ler-todas";
import {
  leituraDoRelatorio,
  type AulaDoTreinamento,
  type BibliotecaDaConta,
  type CampanhaDaConta,
  type CompromissoDaAgenda,
  type DadosDaConta,
  type GrupoDaConta,
  type ItemDaCobertura,
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
 * Teto de relatórios MONTADOS por pergunta. Cada `buildReport` custa umas dez consultas; o teto segura a
 * chamada inteira bem longe do limite de consultas de uma requisição no Cloudflare. Hoje a conta tem
 * duas dúzias de resultados vigentes. Passando disso, TODO resultado continua na lista (quem respondeu o
 * quê e quando) — só os mais antigos vão sem o detalhe do perfil, marcados como "não detalhado".
 */
const MAX_RELATORIOS = 80;
/** Relatórios montados ao mesmo tempo — o bastante para não esperar em fila, pouco para não disputar conexão. */
const EM_PARALELO = 4;
/**
 * O lote máximo que a API do banco devolve numa consulta (o "max rows" do Supabase — medido em 26/09
 * com 1.200 linhas de teste). As funções das TELAS (`montarTabelaPresenca`, `calcularConclusoes*`) leem
 * sem paginar: acima disto, a conta delas — e a da tela — pode sair incompleta, e a cobertura avisa.
 */
const LOTE_DA_API = 1000;
/** A Agenda entra a partir de 90 dias atrás (e tudo o que vem pela frente); o que for mais antigo é contado e declarado. */
const AGENDA_PASSADO_DIAS = 90;

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

const mil = (n: number) => n.toLocaleString("pt-BR");

async function pessoasEGrupos(supabase: Cliente, conta: string) {
  const [pes, grs] = await Promise.all([
    lerTodas((de, ate) =>
      supabase.from("people").select("id, full_name, user_id, created_at", { count: "exact" })
        .eq("mentor_id", conta).order("id").range(de, ate),
    ),
    supabase.from("groups").select("id, name").eq("mentor_id", conta).order("name").order("id"),
  ]);
  if (grs.error) falhou("grupos", grs.error);
  const pessoas: PessoaDaConta[] = pes.linhas.map((p) => ({
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
        lerTodas((de, ate) =>
          supabase.from("group_members").select("group_id, person_id", { count: "exact" })
            .in("group_id", grupoIds).order("group_id").order("person_id").range(de, ate),
        ),
        supabase.from("group_instruments").select("group_id, instrument_id, version_id, instruments(name)").in("group_id", grupoIds),
      ])
    : [{ linhas: [], total: 0, completo: true }, { data: [], error: null }];
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
    membros: [...new Set(mem.linhas.filter((m) => m.group_id === g.id && ids.has(m.person_id)).map((m) => m.person_id))],
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
  const cobertura: ItemDaCobertura[] = [
    pes.completo && mem.completo
      ? { area: "alunos", texto: `todos os ${mil(pes.total)} alunos cadastrados na conta e os ${mil(grupos.length)} grupos`, parcial: false }
      : {
          area: "alunos",
          texto: `recebi ${mil(pes.linhas.length)} de ${mil(pes.total)} alunos e ${mil(mem.linhas.length)} de ${mil(mem.total)} vínculos com grupos — os demais não chegaram`,
          parcial: true,
        },
  ];
  return { pessoas, grupos, cobertura };
}

/**
 * Quem monta cada relatório. Na produção é sempre `buildReport`, a mesma função da tela. O script de teste
 * (`scripts/testar_assistente_mentor.ts`, fora do servidor) passa uma que chama a rota da tela
 * (`/api/public/report/$id`) com o token do mentor fictício — o mesmo `buildReport`, do outro lado da rede.
 */
export type MontarRelatorio = (responseId: string) => Promise<{ status: number; data?: unknown }>;

/**
 * O resultado VIGENTE de cada teste, por pessoa — o mais recente concluído, a regra do dono (#298) —, e
 * os envios ainda sem resposta. A lista vem da consulta com o login do mentor (RLS de `test_responses`);
 * só depois cada relatório é montado.
 */
async function resultadosEPendentes(supabase: Cliente, conta: string, pessoas: Set<string>, relatorio: MontarRelatorio) {
  type Versao = { title: string; instrument_id: string | null } | null;
  const [feitas, abertas, catalogo] = await Promise.all([
    lerTodas((de, ate) =>
      supabase.from("test_responses")
        .select("id, person_id, version_id, attempt, submitted_at, test_versions(title, instrument_id)", { count: "exact" })
        .eq("mentor_id", conta).eq("kind", "self").not("submitted_at", "is", null).is("canceled_at", null)
        .order("submitted_at", { ascending: false }).order("id").range(de, ate),
    ),
    lerTodas((de, ate) =>
      supabase.from("test_responses")
        .select("id, person_id, version_id, created_at, started_at, expires_at, assessment_response_id, test_versions(title, instrument_id)", { count: "exact" })
        .eq("mentor_id", conta).eq("kind", "self").is("submitted_at", null).is("canceled_at", null)
        .order("created_at", { ascending: false }).order("id").range(de, ate),
    ),
    supabase.from("instruments").select("id, name"),
  ]);
  if (catalogo.error) falhou("catálogo de testes", catalogo.error);
  const nomeDoInstrumento = new Map((catalogo.data ?? []).map((i) => [i.id, i.name]));

  const vistos = new Set<string>();
  const vigentes: Array<{ id: string; pessoaId: string; versao: string; chave: string; titulo: string; instrumento: string | null; concluidoEm: string; tentativa: number }> = [];
  for (const r of feitas.linhas) {
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

  // Os mais recentes são detalhados; os demais continuam na lista, marcados — nunca somem.
  const detalhar = vigentes.slice(0, MAX_RELATORIOS);
  const montados = await emLotes(detalhar, async (v) => ({ v, rep: await relatorio(v.id) }));
  const semDetalhe = vigentes.slice(MAX_RELATORIOS).map((v) => ({ v, rep: null }));
  const resultados: ResultadoDaPessoa[] = [];
  const jaTem = new Set<string>();
  for (const { v, rep } of [...montados, ...semDetalhe]) {
    const r = rep && rep.status === 200 ? (rep.data as Report) : null;
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
      leitura: !rep ? { tipo: "nao_detalhado" } : r ? leituraDoRelatorio(r) : { tipo: "sem_relatorio" },
    });
  }

  const vistosAbertos = new Set<string>();
  const pendentes: PendenteDaPessoa[] = [];
  for (const r of abertas.linhas) {
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

  const naoDetalhados = resultados.filter((r) => r.leitura.tipo === "nao_detalhado").length;
  const cobertura: ItemDaCobertura[] = [
    !feitas.completo
      ? {
          area: "resultados",
          texto: `recebi ${mil(feitas.linhas.length)} de ${mil(feitas.total)} testes concluídos — os demais não chegaram, e contagens de "quem respondeu" podem estar incompletas`,
          parcial: true,
        }
      : naoDetalhados
        ? {
            area: "resultados",
            texto: `todos os ${mil(resultados.length)} resultados vigentes (o mais recente de cada teste, por aluno); ${mil(resultados.length - naoDetalhados)} com o perfil detalhado e ${mil(naoDetalhados)} só listados, sem o perfil (limite de ${MAX_RELATORIOS} relatórios por pergunta)`,
            parcial: true,
          }
        : { area: "resultados", texto: `todos os ${mil(resultados.length)} resultados vigentes (o mais recente de cada teste, por aluno), todos com o perfil detalhado`, parcial: false },
    abertas.completo
      ? { area: "envios", texto: `todos os ${mil(abertas.total)} envios de teste ainda sem resposta`, parcial: false }
      : { area: "envios", texto: `recebi ${mil(abertas.linhas.length)} de ${mil(abertas.total)} envios sem resposta — os demais não chegaram`, parcial: true },
  ];
  return { resultados, pendentes, cobertura };
}

async function treinamentos(supabase: Cliente, conta: string) {
  const { data: ts, error } = await supabase
    .from("treinamentos")
    .select("id, titulo, publicado, percentual_minimo, tolerancia_atraso_min, created_at, treinamento_grupos(groups(name))")
    .eq("mentor_id", conta)
    .order("created_at")
    .order("id");
  if (error) falhou("treinamentos", error);
  const saida: TreinamentoDaConta[] = [];
  const avisos: string[] = [];
  let totalAulas = 0;
  let totalPresencas = 0;
  // Em série: cada treinamento já faz as consultas dele em paralelo por dentro.
  for (const t of ts ?? []) {
    const [tabela, conclusao] = await Promise.all([
      montarTabelaPresenca(supabase, t.id),
      calcularConclusoesDoTreinamento(supabase, t.id),
    ]);
    const aulaIds = tabela.aulas.map((a) => a.id);
    const gravadas = tabela.aulas.filter((a) => !a.comeca_em).map((a) => a.id);
    const [aval, concl, contagem] = await Promise.all([
      aulaIds.length
        ? supabase.from("treinamento_avaliacoes").select("aula_id, person_id, estrelas, comentario, avaliada_em")
            .in("aula_id", aulaIds).order("avaliada_em").order("id")
        : Promise.resolve({ data: [], error: null }),
      gravadas.length
        ? supabase.from("treinamento_aula_conclusoes").select("aula_id, person_id").in("aula_id", gravadas).order("person_id")
        : Promise.resolve({ data: [], error: null }),
      // A lista de presença da tela lê as presenças de uma vez só: conferir se todas couberam.
      aulaIds.length
        ? supabase.from("treinamento_presencas").select("id", { count: "exact", head: true }).in("aula_id", aulaIds)
        : Promise.resolve({ count: 0, error: null }),
    ]);
    if (aval.error) falhou("avaliações de aula", aval.error);
    if (concl.error) falhou("aulas gravadas assistidas", concl.error);
    if (contagem.error) falhou("contagem de presenças", contagem.error);
    const presencasNoBanco = contagem.count ?? 0;
    const presencasLidas = tabela.linhas.filter((l) => l.tem_registro).length;
    if (presencasNoBanco > presencasLidas) {
      avisos.push(
        `no treinamento "${t.titulo}" o banco tem ${mil(presencasNoBanco)} registros de presença e a lista de presença leu ${mil(presencasLidas)} — a frequência e a conclusão dele podem estar INCOMPLETAS (a tela tem o mesmo limite)`,
      );
    }
    totalAulas += tabela.aulas.length;
    totalPresencas += presencasNoBanco;

    const referencia = new Date(tabela.referencia).getTime();
    const aulas: AulaDoTreinamento[] = tabela.aulas.map((a) => ({
      id: a.id,
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
  const cobertura: ItemDaCobertura = avisos.length
    ? { area: "classroom", texto: avisos.join("; "), parcial: true }
    : {
        area: "classroom",
        texto: `todos os ${mil(saida.length)} treinamentos, com todas as ${mil(totalAulas)} aulas e todos os ${mil(totalPresencas)} registros de presença`,
        parcial: false,
      };
  return { treinamentos: saida, cobertura };
}

async function trilhas(supabase: Cliente, conta: string, pessoas: PessoaDaConta[]) {
  const { data: trs, error } = await supabase
    .from("learning_tracks")
    .select("id, title, is_published, audience, percentual_minimo, sort_order")
    .eq("owner_id", conta)
    .order("sort_order")
    .order("id");
  if (error) falhou("trilhas", error);
  const ids = (trs ?? []).map((t) => t.id);
  if (!ids.length) {
    return { trilhas: [] as TrilhaDaConta[], cobertura: { area: "academy", texto: "a conta não tem trilha", parcial: false } as ItemDaCobertura };
  }
  const [aulas, modulos, progresso, destinos] = await Promise.all([
    lerTodas((de, ate) =>
      supabase.from("learning_lessons").select("id, track_id, module_id, title, is_published, sort_order", { count: "exact" })
        .in("track_id", ids).order("sort_order").order("id").range(de, ate),
    ),
    supabase.from("learning_modules").select("id, title").in("track_id", ids),
    lerTodas((de, ate) =>
      supabase.from("learning_progress").select("lesson_id, user_id, track_id", { count: "exact" })
        .in("track_id", ids).order("id").range(de, ate),
    ),
    supabase.from("learning_track_destinos").select("track_id, group_id, person_id, groups(name)").in("track_id", ids),
  ]);
  for (const [nome, r] of [["módulos", modulos], ["destinos das trilhas", destinos]] as const) {
    if (r.error) falhou(nome, r.error);
  }
  const pessoaPorLogin = new Map(pessoas.filter((p) => p.userId).map((p) => [p.userId as string, p.id]));
  const modulo = new Map((modulos.data ?? []).map((m) => [m.id, m.title]));
  const saida: TrilhaDaConta[] = [];
  const avisos: string[] = [];
  if (!aulas.completo) avisos.push(`recebi ${mil(aulas.linhas.length)} de ${mil(aulas.total)} aulas das trilhas`);
  if (!progresso.completo) avisos.push(`recebi ${mil(progresso.linhas.length)} de ${mil(progresso.total)} marcações de "vista"`);
  for (const t of trs ?? []) {
    const conclusao = await calcularConclusoesDaTrilha(supabase, t.id);
    // A conta de conclusão da TELA lê as marcações da trilha de uma vez: acima do lote, pode faltar.
    const marcacoesDaTrilha = progresso.linhas.filter((p) => p.track_id === t.id).length;
    if (marcacoesDaTrilha >= LOTE_DA_API) {
      avisos.push(`a conclusão da trilha "${t.title}" pode estar INCOMPLETA: ela tem ${mil(marcacoesDaTrilha)} marcações de "vista", acima do que a tela lê de uma vez`);
    }
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
      aulas: aulas.linhas
        .filter((a) => a.track_id === t.id)
        .map((a) => ({
          titulo: a.title,
          modulo: a.module_id ? modulo.get(a.module_id) ?? null : null,
          publicada: a.is_published,
          vistaPor: [
            ...new Set(
              progresso.linhas
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
  const cobertura: ItemDaCobertura = avisos.length
    ? { area: "academy", texto: avisos.join("; "), parcial: true }
    : {
        area: "academy",
        texto: `todas as ${mil(saida.length)} trilhas, com todas as ${mil(aulas.total)} aulas e todas as ${mil(progresso.total)} marcações de "vista"`,
        parcial: false,
      };
  return { trilhas: saida, cobertura };
}

/** A mesma conta da tela Testes → Campanhas (`listCampanhas`): uma unidade por bateria ou teste avulso. */
async function campanhas(supabase: Cliente, conta: string, agora: number) {
  const { data: links, error } = await supabase
    .from("invite_links")
    .select("id, title, version_ids, is_active, starts_at, expires_at, max_responses, created_at, groups(name)")
    .eq("mentor_id", conta)
    .order("created_at", { ascending: false })
    .order("id");
  if (error) falhou("campanhas", error);
  const lista = links ?? [];
  if (!lista.length) {
    return { campanhas: [] as CampanhaDaConta[], cobertura: { area: "campanhas", texto: "a conta não tem campanha", parcial: false } as ItemDaCobertura };
  }
  const ids = lista.map((l) => l.id);
  const versoes = [...new Set(lista.flatMap((l) => l.version_ids ?? []))];
  const [avulsas, baterias, vs] = await Promise.all([
    lerTodas((de, ate) =>
      supabase.from("test_responses").select("invite_link_id, person_id, submitted_at, canceled_at", { count: "exact" })
        .in("invite_link_id", ids).is("assessment_response_id", null).order("id").range(de, ate),
    ),
    lerTodas((de, ate) =>
      supabase.from("assessment_responses").select("invite_link_id, person_id, submitted_at, canceled_at", { count: "exact" })
        .in("invite_link_id", ids).order("id").range(de, ate),
    ),
    versoes.length
      ? supabase.from("test_versions").select("id, title").in("id", versoes)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (vs.error) falhou("testes das campanhas", vs.error);
  const titulo = new Map(((vs.data ?? []) as Array<{ id: string; title: string }>).map((v) => [v.id, v.title]));
  const saida: CampanhaDaConta[] = lista.map((l) => {
    const naoComecou = !!l.starts_at && new Date(l.starts_at).getTime() > agora;
    const expirada = !!l.expires_at && new Date(l.expires_at).getTime() < agora;
    const unidades = [
      ...avulsas.linhas.filter((r) => r.invite_link_id === l.id).map((r) => ({ ...r, bateria: false })),
      ...baterias.linhas.filter((r) => r.invite_link_id === l.id).map((r) => ({ ...r, bateria: true })),
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
  const cobertura: ItemDaCobertura =
    avulsas.completo && baterias.completo
      ? { area: "campanhas", texto: `todas as ${mil(saida.length)} campanhas, com todos os envios de cada uma`, parcial: false }
      : {
          area: "campanhas",
          texto: `todas as ${mil(saida.length)} campanhas, mas recebi só ${mil(avulsas.linhas.length + baterias.linhas.length)} de ${mil(avulsas.total + baterias.total)} envios — as contagens de respondidos e pendentes podem estar incompletas`,
          parcial: true,
        };
  return { campanhas: saida, cobertura };
}

async function pontos(supabase: Cliente, conta: string) {
  const lidos = await lerTodas((de, ate) =>
    supabase.from("pontos").select("user_id, acao, pontos", { count: "exact" })
      .eq("mentor_id", conta).order("id").range(de, ate),
  );
  const cobertura: ItemDaCobertura = lidos.completo
    ? { area: "ranking", texto: `todos os ${mil(lidos.total)} registros de pontos`, parcial: false }
    : { area: "ranking", texto: `recebi ${mil(lidos.linhas.length)} de ${mil(lidos.total)} registros de pontos — os totais podem estar abaixo do real`, parcial: true };
  return { pontos: lidos.linhas.map((p) => ({ userId: p.user_id, acao: p.acao, pontos: p.pontos })), cobertura };
}

async function mentorias(supabase: Cliente, conta: string) {
  // Sem `observacoes` e sem o `resumo` das sessões: são as anotações do próprio mentor, não uso do aluno.
  const { data, error } = await supabase
    .from("mentorias")
    .select("id, person_id, titulo, status, sessoes_contratadas, created_at, mentoria_sessoes(quando, termina_em, status, avaliacao_estrelas, avaliacao_comentario)")
    .eq("mentor_id", conta)
    .order("created_at")
    .order("id");
  if (error) falhou("mentorias", error);
  type Sessao = { quando: string | null; termina_em: string | null; status: string; avaliacao_estrelas: number | null; avaliacao_comentario: string | null };
  const lista: MentoriaDaConta[] = (data ?? []).map((m) => ({
    pessoaId: m.person_id,
    titulo: m.titulo ?? "Mentoria",
    status: m.status,
    contratadas: m.sessoes_contratadas,
    sessoes: ((m.mentoria_sessoes ?? []) as Sessao[])
      .map((s) => ({ quando: s.quando, terminaEm: s.termina_em, status: s.status, estrelas: s.avaliacao_estrelas, comentario: s.avaliacao_comentario }))
      .sort((a, b) => (a.quando ?? "").localeCompare(b.quando ?? "")),
  }));
  const sessoes = lista.reduce((s, m) => s + m.sessoes.length, 0);
  return {
    mentorias: lista,
    cobertura: { area: "mentorias", texto: `todas as ${mil(lista.length)} mentorias, com todas as ${mil(sessoes)} sessões`, parcial: false } as ItemDaCobertura,
  };
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
 * #312 — o acervo da Biblioteca da conta. Com a sessão do MENTOR, `bib_visiveis()` já devolve tudo
 * (ele é o dono/equipe — a mesma regra de `bib_pode_ver_material`): sem o limite de permissão do
 * aluno, e sem função separada — é a mesma porta, só chamada com outro login.
 */
async function biblioteca(supabase: Cliente) {
  const { data: liberados, error: lErr } = await supabase.rpc("bib_materiais_liberados", { _person_id: null });
  if (lErr) falhou("biblioteca", lErr);
  const ids = [...new Set((liberados ?? []) as string[])];
  if (!ids.length) {
    return {
      biblioteca: [] as BibliotecaDaConta[],
      cobertura: { area: "biblioteca", texto: "a conta não tem material na Biblioteca", parcial: false } as ItemDaCobertura,
    };
  }
  const { data, error } = await supabase
    .from("biblioteca_materiais")
    .select("id, titulo, descricao, kind, categoria, pasta_id, indexacao_status, biblioteca_pastas(titulo)")
    .in("id", ids)
    .order("titulo")
    .order("id");
  if (error) falhou("biblioteca", error);
  const lista: BibliotecaDaConta[] = (data ?? []).map((b) => ({
    titulo: b.titulo,
    descricao: b.descricao,
    tipo: b.kind,
    categoria: b.categoria,
    pasta: (b.biblioteca_pastas as { titulo: string } | null)?.titulo ?? null,
    conteudoLegivel: b.indexacao_status === "pronto",
    aindaProcessando: b.kind === "pdf" && b.indexacao_status !== "pronto" && b.indexacao_status !== "erro",
  }));
  return {
    biblioteca: lista,
    cobertura: { area: "biblioteca", texto: `todos os ${mil(lista.length)} materiais da Biblioteca`, parcial: false } as ItemDaCobertura,
  };
}

/**
 * Os eventos da Agenda do painel (a mesma tabela da tela Agenda), a partir de `desde` — e QUANTOS
 * existem antes disso, para o texto dizer "há mais antigos que não recebi" em vez de calar.
 */
async function eventosDaAgenda(supabase: Cliente, conta: string, desde: string) {
  const [lidos, antes] = await Promise.all([
    lerTodas((de, ate) =>
      supabase.from("eventos").select("id, titulo, quando, termina_em, aula_id", { count: "exact" })
        .eq("conta_id", conta).gte("quando", desde).order("quando").order("id").range(de, ate),
    ),
    supabase.from("eventos").select("id", { count: "exact", head: true }).eq("conta_id", conta).lt("quando", desde),
  ]);
  if (antes.error) falhou("eventos antigos", antes.error);
  return { eventos: lidos.linhas, total: lidos.total, completo: lidos.completo, anteriores: antes.count ?? 0 };
}

/**
 * O calendário: o que a Agenda do painel mostra (eventos + sessões de mentoria não canceladas) e, junto,
 * as aulas do Classroom que por algum motivo não viraram evento — uma pergunta de "quais aulas em
 * outubro" não pode depender de a aula ter sido espelhada na Agenda. Cada aula entra uma vez só.
 */
function montarAgenda(
  desde: string,
  ev: Awaited<ReturnType<typeof eventosDaAgenda>> | null,
  trs: TreinamentoDaConta[],
  mts: MentoriaDaConta[],
): { itens: CompromissoDaAgenda[]; anterioresMentorias: number } {
  const inicio = new Date(desde).getTime();
  const treinamentoDaAula = new Map<string, { treinamento: string; cancelada: boolean }>();
  for (const t of trs) for (const a of t.aulas) treinamentoDaAula.set(a.id, { treinamento: t.titulo, cancelada: a.cancelada });
  const itens: CompromissoDaAgenda[] = [];
  const aulasNaAgenda = new Set<string>();
  for (const e of ev?.eventos ?? []) {
    const aula = e.aula_id ? treinamentoDaAula.get(e.aula_id) : undefined;
    if (e.aula_id) aulasNaAgenda.add(e.aula_id);
    itens.push({
      quando: e.quando,
      terminaEm: e.termina_em,
      titulo: e.titulo,
      tipo: e.aula_id ? "aula" : "evento",
      treinamento: aula?.treinamento ?? null,
      pessoaId: null,
      cancelada: aula?.cancelada ?? false,
      realizada: false,
      naAgenda: true,
    });
  }
  for (const t of trs) {
    for (const a of t.aulas) {
      if (!a.comecaEm || aulasNaAgenda.has(a.id) || new Date(a.comecaEm).getTime() < inicio) continue;
      itens.push({
        quando: a.comecaEm,
        terminaEm: a.terminaEm,
        titulo: a.titulo,
        tipo: "aula",
        treinamento: t.titulo,
        pessoaId: null,
        cancelada: a.cancelada,
        realizada: false,
        naAgenda: false,
      });
    }
  }
  let anterioresMentorias = 0;
  for (const m of mts) {
    for (const s of m.sessoes) {
      if (!s.quando || s.status === "cancelada") continue; // a Agenda do painel não mostra sessão cancelada
      if (new Date(s.quando).getTime() < inicio) {
        anterioresMentorias += 1;
        continue;
      }
      itens.push({
        quando: s.quando,
        terminaEm: s.terminaEm,
        titulo: m.titulo,
        tipo: "mentoria",
        treinamento: null,
        pessoaId: m.pessoaId,
        cancelada: false,
        realizada: s.status === "concluida",
        naAgenda: true,
      });
    }
  }
  itens.sort((a, b) => a.quando.localeCompare(b.quando) || a.titulo.localeCompare(b.titulo, "pt-BR"));
  return { itens, anterioresMentorias };
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
  const base = await pessoasEGrupos(supabase, conta);
  const ids = new Set(base.pessoas.map((p) => p.id));
  const desde = new Date(agora - AGENDA_PASSADO_DIAS * 86_400_000).toISOString();
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
  const nada = (area: ItemDaCobertura["area"]): ItemDaCobertura => ({ area, texto: "não foi possível ler agora", parcial: true });
  const [rp, trs, tls, cps, pts, mts, cts, bib, ev] = await Promise.all([
    tenta("resultados dos testes", () => resultadosEPendentes(supabase, conta, ids, relatorio), {
      resultados: [], pendentes: [], cobertura: [nada("resultados"), nada("envios")],
    }),
    tenta("Classroom", () => treinamentos(supabase, conta), { treinamentos: [], cobertura: nada("classroom") }),
    tenta("Academy", () => trilhas(supabase, conta, base.pessoas), { trilhas: [], cobertura: nada("academy") }),
    tenta("campanhas", () => campanhas(supabase, conta, agora), { campanhas: [], cobertura: nada("campanhas") }),
    tenta("ranking", () => pontos(supabase, conta), { pontos: [], cobertura: nada("ranking") }),
    tenta("mentorias", () => mentorias(supabase, conta), { mentorias: [], cobertura: nada("mentorias") }),
    tenta("certificados", () => certificados(supabase, conta), []),
    tenta("Biblioteca", () => biblioteca(supabase), { biblioteca: [], cobertura: nada("biblioteca") }),
    tenta("Agenda", () => eventosDaAgenda(supabase, conta, desde), null),
  ]);
  const agenda = montarAgenda(desde, ev, trs.treinamentos, mts.mentorias);
  const anteriores = (ev?.anteriores ?? 0) + agenda.anterioresMentorias;
  const coberturaAgenda: ItemDaCobertura = !ev
    ? nada("agenda")
    : !ev.completo
      ? {
          area: "agenda",
          texto: `recebi ${mil(ev.eventos.length)} de ${mil(ev.total)} eventos a partir do recorte — os demais não chegaram`,
          parcial: true,
        }
      : {
          area: "agenda",
          texto: `todos os ${mil(agenda.itens.length)} compromissos (aulas, eventos da Agenda e sessões de mentoria) de ${new Date(desde).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} em diante${
            anteriores ? `; existem ${mil(anteriores)} mais antigos que NÃO recebi` : "; não há compromissos mais antigos"
          }`,
          parcial: anteriores > 0,
        };
  return {
    pessoas: base.pessoas,
    grupos: base.grupos,
    resultados: rp.resultados,
    pendentes: rp.pendentes,
    treinamentos: trs.treinamentos,
    trilhas: tls.trilhas,
    campanhas: cps.campanhas,
    pontos: pts.pontos,
    regrasDePontos: ACOES_QUE_PONTUAM.map((acao) => ({
      acao,
      rotulo: ACOES[acao].rotulo,
      pontos: ACOES[acao].pontos,
      tetoDiario: ACOES[acao].tetoDiario,
    })),
    mentorias: mts.mentorias,
    certificados: cts,
    biblioteca: bib.biblioteca,
    agenda: { desde, anteriores, itens: agenda.itens },
    cobertura: [
      ...base.cobertura,
      ...rp.cobertura,
      trs.cobertura,
      tls.cobertura,
      coberturaAgenda,
      pts.cobertura,
      cps.cobertura,
      mts.cobertura,
      bib.cobertura,
    ],
    indisponiveis: indisponiveis.sort(),
  };
}
