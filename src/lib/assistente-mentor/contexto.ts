/**
 * OS DADOS DA CONTA EM TEXTO, PARA A ASSISTENTE DO MENTOR (#307).
 *
 * Recebe o que `dados.server.ts` leu COM O LOGIN DO MENTOR e vira o bloco <dados_da_conta>. Função
 * pura: a mesma entrada devolve os mesmos bytes (o bloco é prefixo em cache na API), por isso o "agora"
 * chega arredondado para a hora cheia e toda lista tem ordem estável (nome, depois id).
 *
 * O que faz a assistente acertar número — o pedido do dono: "sempre a partir do dado real, sempre
 * dizendo de onde tirou, nunca inventando número":
 * - as contagens que as perguntas do dia a dia pedem vêm PRONTAS daqui ("contado pelo sistema"): o
 *   modelo copia, não conta;
 * - toda seção diz de onde o dado vem, com o nome da tela onde o mentor confere;
 * - resultado incerto chega com a marca que o relatório usa ("sem predominância clara", "pouca
 *   informação", eixo "em aberto", confiabilidade).
 *
 * Natural e adaptado (Etapa 2a — a mesma regra da assistente do aluno): do gráfico NATURAL vão os
 * números; do ADAPTADO, só a sigla e a ordem das letras. Sem dois números lado a lado, não sobra conta
 * errada a fazer entre duas réguas diferentes.
 *
 * O que NÃO entra, de propósito: e-mail, telefone e redes dos alunos; as observações e os resumos que o
 * mentor escreve nas mentorias; as respostas de questionário (texto livre); a média de percentuais de
 * um grupo (a régua do "DNA do grupo" é uma decisão de método ainda em aberto). E — por desenho, num
 * nível abaixo deste arquivo — nada das conversas dos alunos com a assistente deles, que nem é lido.
 */
import type { Report } from "@/components/report/sections";
import { INTENSIDADE } from "@/components/report/textos";
import { quandoBR } from "@/lib/assistente/plataforma";

const FUSO = "America/Sao_Paulo";

// ---------------------------------------------------------------------------------------------
// Tipos — o que `dados.server.ts` entrega.
// ---------------------------------------------------------------------------------------------

export type PessoaDaConta = {
  id: string;
  nome: string;
  temLogin: boolean;
  /** Login (auth) da pessoa — só para ligar pontos e Academy, que são por login. Nunca vai para o texto. */
  userId: string | null;
  cadastradaEm: string;
};

export type LetraDoResumo = { key: string; label: string; pct: number; naSigla: boolean; poucaInformacao: boolean };

export type LeituraDoResultado =
  | {
      tipo: "ipsativo";
      /** DISC (os índices só existem nele). */
      disc: boolean;
      sigla: string | null;
      rotulos: string[];
      /** Por que não há sigla, quando não há. */
      semPredominancia: "empate" | "sem_sinal" | null;
      /** Na ordem do ranking do NATURAL (1ª = a que lidera). */
      natural: LetraDoResumo[];
      adaptado: { sigla: string | null; ordem: string[] };
      indices: Array<{ rotulo: string; valor: number | null }>;
    }
  | {
      tipo: "mbti";
      /** `null` quando dois ou mais eixos ficaram em aberto — o relatório não declara tipo. */
      tipoMbti: string | null;
      eixos: Array<{ esquerda: string; direita: string; pctEsquerda: number; pctDireita: number; preferencia: string | null }>;
    }
  | {
      tipo: "dimensional";
      /** Só no DISC do formato antigo (sem a página de intensidade). */
      sigla: string | null;
      semPredominancia: boolean;
      /** Da maior para a menor. */
      dimensoes: Array<{ key: string; label: string; pct: number; faixa: string | null }>;
    }
  | { tipo: "oculto" }
  | { tipo: "sem_relatorio" };

export type ResultadoDaPessoa = {
  pessoaId: string;
  /** A chave do "mesmo teste": o instrumento — ou a versão, nos personalizados (cada um é um teste). */
  chave: string;
  teste: string;
  instrumento: string | null;
  /** O nome do instrumento no catálogo ("Análise DISC") — o que a aba "Testes liberados" mostra. */
  instrumentoNome: string | null;
  concluidoEm: string;
  tentativa: number;
  confiabilidade: "alta" | "media" | "baixa" | null;
  observadores: number;
  leitura: LeituraDoResultado;
};

export type PendenteDaPessoa = {
  pessoaId: string;
  chave: string;
  teste: string;
  enviadoEm: string;
  prazo: string | null;
  comecou: boolean;
  daBateria: boolean;
};

export type GrupoDaConta = {
  id: string;
  nome: string;
  membros: string[];
  /** Testes liberados na aba "Testes liberados" do grupo. */
  liberados: Array<{ chave: string; nome: string }>;
};

export type SituacaoNaAula = "presente" | "atrasado" | "ausente" | "justificado" | "sem_registro";

export type AulaDoTreinamento = {
  titulo: string;
  modulo: string;
  comecaEm: string | null;
  terminaEm: string | null;
  cancelada: boolean;
  gravada: boolean;
  listaFechada: boolean;
  realizada: boolean;
  /** pessoaId → situação, como a lista de presença mostra. Só para aula com data. */
  situacoes: Array<{ pessoaId: string; situacao: SituacaoNaAula }>;
  /** Aula gravada: quem marcou como assistida. */
  assistiram: string[];
  avaliacoes: Array<{ pessoaId: string; estrelas: number; comentario: string | null }>;
};

export type TreinamentoDaConta = {
  titulo: string;
  publicado: boolean;
  grupos: string[];
  percentualMinimo: number;
  toleranciaMin: number;
  aulas: AulaDoTreinamento[];
  frequencia: Array<{ pessoaId: string; presentes: number; contadas: number; justificadas: number; pct: number | null; saiuDoGrupo: boolean }>;
  conclusao: Array<{ pessoaId: string; feitos: number; total: number; percentual: number | null; concluido: boolean }>;
  totalItens: number;
  foraDaConta: Array<{ titulo: string; motivo: string }>;
};

export type TrilhaDaConta = {
  titulo: string;
  publicada: boolean;
  publico: string;
  percentualMinimo: number;
  /** Vazio = aberta a todos os alunos da conta. */
  destinos: { grupos: string[]; pessoas: string[] };
  aulas: Array<{ titulo: string; modulo: string | null; publicada: boolean; vistaPor: string[] }>;
  conclusao: Array<{ pessoaId: string; feitos: number; total: number; percentual: number | null; concluido: boolean }>;
};

export type CampanhaDaConta = {
  titulo: string;
  estado: "Ativa" | "Agendada" | "Expirada" | "Encerrada";
  testes: string[];
  grupo: string | null;
  criadaEm: string;
  comecaEm: string | null;
  expiraEm: string | null;
  limite: number | null;
  unidades: Array<{ pessoaId: string | null; respondida: boolean; bateria: boolean }>;
};

export type MentoriaDaConta = {
  pessoaId: string;
  titulo: string;
  status: string;
  contratadas: number | null;
  sessoes: Array<{ quando: string | null; status: string; estrelas: number | null; comentario: string | null }>;
};

export type CertificadoDaConta = { pessoaId: string; item: string; tipo: "treinamento" | "trilha"; emitidoEm: string; percentual: number };

export type DadosDaConta = {
  pessoas: PessoaDaConta[];
  grupos: GrupoDaConta[];
  resultados: ResultadoDaPessoa[];
  /** Resultados vigentes que existem mas não foram detalhados (teto de leitura). */
  resultadosNaoDetalhados: number;
  pendentes: PendenteDaPessoa[];
  treinamentos: TreinamentoDaConta[];
  trilhas: TrilhaDaConta[];
  campanhas: CampanhaDaConta[];
  /** Por LOGIN; só vale para quem tem login. */
  pontos: Array<{ userId: string; acao: string; pontos: number }>;
  regrasDePontos: Array<{ acao: string; rotulo: string; pontos: number; tetoDiario: number | null }>;
  mentorias: MentoriaDaConta[];
  certificados: CertificadoDaConta[];
  /** Áreas que falharam ao ler agora. */
  indisponiveis: string[];
};

// ---------------------------------------------------------------------------------------------
// Do relatório (o MESMO `buildReport` da tela) para o resumo de uma linha.
// ---------------------------------------------------------------------------------------------

/**
 * A leitura de um relatório, com as mesmas marcas da tela. Respeita o que o mentor escondeu nas
 * Configurações do relatório (`hidden_blocks`): bloco escondido na tela não vira dado aqui.
 */
export function leituraDoRelatorio(r: Report): LeituraDoResultado {
  const oculto = r.settings?.hidden_blocks ?? [];
  if (oculto.includes("fatores")) return { tipo: "oculto" };
  const it = r.intensidade;
  if (it) {
    const disc = r.is_disc !== false;
    const indices =
      disc && !oculto.includes("derivados") && r.derived
        ? r.derived.indices.map((i) => ({ rotulo: i.label, valor: i.value }))
        : [];
    return {
      tipo: "ipsativo",
      disc,
      sigla: it.perfil.sigla,
      rotulos: it.perfil.labels,
      semPredominancia: it.perfil.sigla ? null : it.natural.tipo === "sem_sinal" ? "sem_sinal" : "empate",
      natural: [...it.natural.letras]
        .sort((a, b) => a.posicao - b.posicao)
        .map((l) => ({
          key: l.key,
          label: l.label,
          pct: Math.round(l.percentual),
          naSigla: l.na_sigla,
          poucaInformacao: l.pouca_informacao,
        })),
      adaptado: {
        sigla: it.adaptado.sigla,
        ordem: [...it.adaptado.letras].sort((a, b) => a.posicao - b.posicao).map((l) => l.key),
      },
      indices,
    };
  }
  if (r.is_mbti && r.mbti) {
    const eixos = r.mbti.pares.map((p) => ({
      esquerda: p.left,
      direita: p.right,
      pctEsquerda: Math.round(p.leftPct),
      pctDireita: Math.round(p.rightPct),
      // A mesma régua da tela: eixo abaixo de 55% está em aberto e não vira letra.
      preferencia: Math.max(p.leftPct, p.rightPct) < 55 ? null : p.preferred,
    }));
    const emAberto = eixos.filter((e) => e.preferencia == null).length;
    return { tipo: "mbti", tipoMbti: emAberto < 2 ? r.mbti.tipo : null, eixos };
  }
  const medidas = r.factors.filter((f) => f.has_data !== false);
  return {
    tipo: "dimensional",
    sigla: r.is_disc !== false && !r.perfil_indefinido ? r.profile : null,
    semPredominancia: !!r.perfil_indefinido,
    dimensoes: [...medidas]
      .sort((a, b) => b.natural_norm - a.natural_norm || a.key.localeCompare(b.key))
      .map((f) => ({ key: f.key, label: f.label, pct: Math.round(f.natural_norm), faixa: f.band_natural?.title ?? null })),
  };
}

// ---------------------------------------------------------------------------------------------
// Pequenas ferramentas de texto.
// ---------------------------------------------------------------------------------------------

const porNome = (a: { nome: string; id: string }, b: { nome: string; id: string }) =>
  a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }) || a.id.localeCompare(b.id);

function dataBR(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: FUSO }) : "sem data";
}

/** "A, B e C" — ou "ninguém". */
function nomes(lista: string[]): string {
  if (lista.length === 0) return "ninguém";
  if (lista.length === 1) return lista[0];
  return `${lista.slice(0, -1).join(", ")} e ${lista[lista.length - 1]}`;
}

function curto(t: string | null | undefined, max = 300): string | null {
  if (!t) return null;
  const limpo = t.replace(/\s+/g, " ").trim();
  if (!limpo) return null;
  return limpo.length > max ? `${limpo.slice(0, max - 1)}…` : limpo;
}

function secao(titulo: string, linhas: Array<string | null | false | undefined>): string {
  const corpo = linhas.filter((l): l is string => typeof l === "string" && l !== "");
  return corpo.length ? `## ${titulo}\n${corpo.join("\n")}` : "";
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

const CONFIABILIDADE: Record<string, string> = {
  media: "confiabilidade MÉDIA (o relatório traz um aviso)",
  baixa: "confiabilidade BAIXA (o relatório pede cautela na leitura)",
};

/** Uma linha com a leitura de um resultado — números só do natural. */
function leituraEmTexto(l: LeituraDoResultado): string {
  switch (l.tipo) {
    case "ipsativo": {
      const titulo = l.sigla
        ? `PERFIL ${l.sigla}${l.rotulos.length ? ` (${l.rotulos.join(" + ")})` : ""}`
        : `sem predominância clara (${l.semPredominancia === "sem_sinal" ? "nenhuma letra com sinal suficiente" : "três ou mais letras praticamente empatadas no natural"})`;
      const natural = l.natural
        .map((x) => `${x.key} ${x.pct}${x.poucaInformacao ? ` (${INTENSIDADE.poucaInformacao})` : ""}`)
        .join(" · ");
      const adaptado = `${l.adaptado.sigla ? `sigla ${l.adaptado.sigla}` : "sem sigla"}; ordem ${l.adaptado.ordem.join(" > ")}`;
      const indices = l.indices.length
        ? ` Índices: ${l.indices.map((i) => `${i.rotulo} ${i.valor == null ? "sem valor" : i.valor.toFixed(2)}`).join(" · ")}.`
        : "";
      return `${titulo}. Natural: ${natural}. Adaptado: ${adaptado}.${indices}`;
    }
    case "mbti": {
      const eixos = l.eixos
        .map((e) =>
          `${e.esquerda} ${e.pctEsquerda}% × ${e.direita} ${e.pctDireita}%${e.preferencia ? ` (${e.preferencia})` : " (EM ABERTO)"}`,
        )
        .join("; ");
      const abertos = l.eixos.filter((e) => e.preferencia == null).length;
      const tipo = l.tipoMbti
        ? `tipo ${l.tipoMbti}${abertos === 1 ? " (com um eixo em aberto: o relatório lê as duas possibilidades)" : ""}`
        : "sem tipo declarado (dois ou mais eixos em aberto)";
      return `${tipo}. Eixos: ${eixos}.`;
    }
    case "dimensional": {
      const cabeca = l.sigla ? `perfil ${l.sigla}. ` : l.semPredominancia ? "sem predominância clara (dimensões praticamente empatadas). " : "";
      const dims = l.dimensoes.map((d) => `${d.label} ${d.pct}${d.faixa ? ` (${d.faixa})` : ""}`).join(" · ");
      return `${cabeca}Da maior para a menor: ${dims}.`;
    }
    case "oculto":
      return "o bloco de resultados está ESCONDIDO nas Configurações do relatório, então não o leio.";
    case "sem_relatorio":
      return "este teste não gera relatório comportamental (é questionário) — as respostas ficam na aba Respostas e não chegam a esta assistente.";
  }
}

/** Como o grupo se distribui num teste: a sigla do NATURAL (ou o tipo, ou a dimensão que lidera). */
function rotuloDaDistribuicao(l: LeituraDoResultado): string | null {
  switch (l.tipo) {
    case "ipsativo":
      return l.sigla ?? "sem predominância clara";
    case "mbti":
      return l.tipoMbti ?? "tipo em aberto";
    case "dimensional":
      return l.sigla ?? (l.semPredominancia ? "sem predominância clara" : l.dimensoes[0]?.label ?? null);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------------------------
// As seções.
// ---------------------------------------------------------------------------------------------

type Indice = {
  nome: Map<string, string>;
  pessoaPorLogin: Map<string, string>;
  resultadosDe: Map<string, ResultadoDaPessoa[]>;
  pendentesDe: Map<string, PendenteDaPessoa[]>;
  gruposDe: Map<string, string[]>;
  testes: Array<{ chave: string; nome: string }>;
};

function indexar(d: DadosDaConta): Indice {
  const nome = new Map(d.pessoas.map((p) => [p.id, p.nome]));
  const pessoaPorLogin = new Map(d.pessoas.filter((p) => p.userId).map((p) => [p.userId as string, p.id]));
  const resultadosDe = new Map<string, ResultadoDaPessoa[]>();
  for (const r of d.resultados) resultadosDe.set(r.pessoaId, [...(resultadosDe.get(r.pessoaId) ?? []), r]);
  const pendentesDe = new Map<string, PendenteDaPessoa[]>();
  for (const p of d.pendentes) pendentesDe.set(p.pessoaId, [...(pendentesDe.get(p.pessoaId) ?? []), p]);
  const gruposDe = new Map<string, string[]>();
  for (const g of [...d.grupos].sort((a, b) => porNome(a, b))) {
    for (const m of g.membros) gruposDe.set(m, [...(gruposDe.get(m) ?? []), g.nome]);
  }
  // O nome de cada teste nas contagens é o do catálogo (o mesmo da aba "Testes liberados").
  const vistos = new Map<string, string>();
  for (const r of d.resultados) if (!vistos.has(r.chave)) vistos.set(r.chave, r.instrumentoNome ?? r.teste);
  for (const g of d.grupos) for (const l of g.liberados) if (!vistos.has(l.chave)) vistos.set(l.chave, l.nome);
  const testes = [...vistos.entries()]
    .map(([chave, nome]) => ({ chave, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.chave.localeCompare(b.chave));
  return { nome, pessoaPorLogin, resultadosDe, pendentesDe, gruposDe, testes };
}

const nomesDe = (ix: Indice, ids: string[]) =>
  ids
    .map((id) => ({ id, nome: ix.nome.get(id) ?? "(pessoa fora da lista)" }))
    .sort(porNome)
    .map((p) => p.nome);

function resumoDaConta(d: DadosDaConta, ix: Indice): string {
  const comLogin = d.pessoas.filter((p) => p.temLogin);
  const semLogin = d.pessoas.filter((p) => !p.temLogin);
  const comTeste = d.pessoas.filter((p) => (ix.resultadosDe.get(p.id) ?? []).length > 0);
  const semTeste = d.pessoas.filter((p) => (ix.resultadosDe.get(p.id) ?? []).length === 0);
  const semGrupo = d.pessoas.filter((p) => !(ix.gruposDe.get(p.id) ?? []).length);
  const comPendente = new Set(d.pendentes.map((p) => p.pessoaId));
  return secao("Resumo da conta (contado pelo sistema)", [
    `- Alunos cadastrados: ${d.pessoas.length}.`,
    `- Com login na plataforma: ${comLogin.length}. Sem login: ${semLogin.length} — ${nomes(nomesDe(ix, semLogin.map((p) => p.id)))}. ("Sem login" = ainda não criou o acesso à área do aluno; responder teste por link e ter presença não dependem de login.)`,
    `- Grupos: ${d.grupos.length}. Alunos sem grupo: ${semGrupo.length}${semGrupo.length ? ` — ${nomes(nomesDe(ix, semGrupo.map((p) => p.id)))}` : ""}.`,
    `- Com pelo menos um teste concluído: ${comTeste.length}. Sem NENHUM teste concluído: ${semTeste.length} — ${nomes(nomesDe(ix, semTeste.map((p) => p.id)))}.`,
    `- Resultados vigentes (o mais recente de cada teste, por aluno): ${d.resultados.length}.`,
    `- Alunos com teste enviado e ainda sem resposta: ${comPendente.size}.`,
    d.resultadosNaoDetalhados > 0
      ? `- ATENÇÃO: ${d.resultadosNaoDetalhados} resultados mais antigos existem mas não foram detalhados aqui (limite de leitura). Se a pergunta depender deles, diga isso e indique a ficha da pessoa.`
      : null,
  ]);
}

function distribuicao(ix: Indice, membros: string[], chave: string): string | null {
  const porRotulo = new Map<string, string[]>();
  const sem: string[] = [];
  for (const id of membros) {
    const r = (ix.resultadosDe.get(id) ?? []).find((x) => x.chave === chave);
    const rotulo = r ? rotuloDaDistribuicao(r.leitura) : null;
    if (!r) sem.push(id);
    else if (rotulo) porRotulo.set(rotulo, [...(porRotulo.get(rotulo) ?? []), id]);
  }
  const com = membros.length - sem.length;
  if (com === 0) return null;
  const partes = [...porRotulo.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "pt-BR"))
    .map(([rotulo, ids]) => `${rotulo}: ${ids.length} (${nomes(nomesDe(ix, ids))})`);
  return `${com} de ${membros.length} com resultado — ${partes.join("; ")}${sem.length ? `; ainda sem este teste: ${sem.length}` : ""}`;
}

function gruposEmTexto(d: DadosDaConta, ix: Indice): string {
  const todos = d.pessoas.map((p) => p.id);
  const blocos: Array<string | null> = [
    "Distribuição dos perfis = contagem da sigla do gráfico NATURAL (no MBTI, o tipo; em Valores e Big Five, a dimensão que lidera). Não há média de percentuais: a régua do \"DNA do grupo\" é outra tela.",
    "### Toda a conta",
    ...ix.testes.map((t) => {
      const linha = distribuicao(ix, todos, t.chave);
      return linha ? `- ${t.nome}: ${linha}.` : null;
    }),
  ];
  for (const g of [...d.grupos].sort(porNome)) {
    const liberados = [...g.liberados].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    blocos.push(`### Grupo "${g.nome}" — ${plural(g.membros.length, "aluno", "alunos")}`);
    blocos.push(`Alunos: ${nomes(nomesDe(ix, g.membros))}.`);
    blocos.push(
      liberados.length
        ? `Testes liberados no grupo (aba "Testes liberados"): ${liberados.map((l) => l.nome).join(", ")}.`
        : 'Nenhum teste liberado na aba "Testes liberados" deste grupo.',
    );
    for (const l of liberados) {
      const faltam = g.membros.filter((id) => !(ix.resultadosDe.get(id) ?? []).some((r) => r.chave === l.chave));
      blocos.push(
        `- Liberado "${l.nome}": ${faltam.length === 0 ? "todos responderam" : `${faltam.length} de ${g.membros.length} ainda não responderam — ${nomes(nomesDe(ix, faltam))}`} (contado pelo sistema).`,
      );
    }
    const dist = ix.testes
      .map((t) => {
        const linha = distribuicao(ix, g.membros, t.chave);
        return linha ? `- ${t.nome}: ${linha}.` : null;
      })
      .filter(Boolean);
    if (dist.length) blocos.push("Distribuição dos perfis no grupo (contado pelo sistema):", ...dist);
  }
  return secao("Grupos e distribuição dos perfis (fonte: Grupos + resultados dos testes)", blocos);
}

function alunosEmTexto(d: DadosDaConta, ix: Indice): string {
  const linhas: string[] = [
    "Cada aluno com: login, grupos, o resultado VIGENTE de cada teste (o mais recente concluído — como no painel) e os envios ainda sem resposta. Números do perfil: só do gráfico natural; do adaptado, só sigla e ordem.",
  ];
  const freq = new Map<string, string[]>();
  for (const t of d.treinamentos) {
    for (const f of t.frequencia) {
      freq.set(f.pessoaId, [
        ...(freq.get(f.pessoaId) ?? []),
        `Classroom "${t.titulo}": frequência ${f.contadas ? `${f.presentes} de ${f.contadas} (${f.pct}%)` : "ainda sem encontro com lista fechada"}`,
      ]);
    }
  }
  for (const p of [...d.pessoas].sort((a, b) => porNome(a, b))) {
    const grupos = ix.gruposDe.get(p.id) ?? [];
    linhas.push(
      `### ${p.nome} — login: ${p.temLogin ? "sim" : "NÃO"}; grupos: ${grupos.length ? grupos.join(", ") : "nenhum"}; cadastrado em ${dataBR(p.cadastradaEm)}`,
    );
    const rs = [...(ix.resultadosDe.get(p.id) ?? [])].sort(
      (a, b) => a.teste.localeCompare(b.teste, "pt-BR") || a.chave.localeCompare(b.chave),
    );
    if (!rs.length) linhas.push("Testes concluídos: nenhum.");
    for (const r of rs) {
      const extras = [
        r.tentativa > 1 ? `${r.tentativa}ª tentativa` : null,
        r.confiabilidade && CONFIABILIDADE[r.confiabilidade] ? CONFIABILIDADE[r.confiabilidade] : null,
        r.observadores ? `${plural(r.observadores, "observador", "observadores")} (360°)` : null,
      ].filter(Boolean);
      const nome = r.instrumentoNome && r.instrumentoNome !== r.teste ? `${r.instrumentoNome} (teste "${r.teste}")` : r.teste;
      linhas.push(
        `- ${nome} — concluído em ${dataBR(r.concluidoEm)}${extras.length ? `; ${extras.join("; ")}` : ""}: ${leituraEmTexto(r.leitura)}`,
      );
    }
    const pend = (ix.pendentesDe.get(p.id) ?? []).filter((x) => !rs.some((r) => r.chave === x.chave));
    if (pend.length) {
      linhas.push(
        `Enviados e ainda sem resposta: ${pend
          .map((x) => `${x.teste} (enviado em ${dataBR(x.enviadoEm)}${x.comecou ? ", começou e não terminou" : ""}${x.prazo ? `, prazo ${dataBR(x.prazo)}` : ""})`)
          .join("; ")}.`,
      );
    }
    for (const f of freq.get(p.id) ?? []) linhas.push(`${f}.`);
  }
  return secao("Alunos (fonte: Pessoas + resultados dos testes)", linhas);
}

const SITUACAO: Record<SituacaoNaAula, string> = {
  presente: "presentes",
  atrasado: "chegaram atrasados (conta como presença)",
  ausente: "AUSENTES",
  justificado: "falta justificada",
  sem_registro: "sem registro (lista ainda aberta)",
};

function classroomEmTexto(d: DadosDaConta, ix: Indice, agora: number): string {
  if (!d.treinamentos.length) return secao("Classroom", ["A conta não tem treinamento cadastrado."]);
  const linhas: string[] = [
    'Duas contas diferentes, cada uma com a sua régua — não misture:',
    "- FREQUÊNCIA (a da lista de presença): só encontros que já aconteceram E tiveram a lista fechada; não conta encontro de antes de o aluno entrar na turma. Chegar atrasado conta como presença; falta justificada não.",
    "- CONCLUSÃO (a da aba Conclusão, que emite o certificado): aulas com presença + aulas gravadas marcadas como assistidas, sobre TODAS as aulas não canceladas — inclusive as que ainda vão acontecer. No meio do curso ninguém está perto de concluir, e isso é normal.",
    'A plataforma NÃO tem um limite de "presença baixa". Se perguntarem, mostre a frequência de cada um (a lista abaixo já vem da menor para a maior) e diga que o corte é do mentor.',
  ];
  for (const t of d.treinamentos) {
    linhas.push(
      `### Treinamento "${t.titulo}" — ${t.publicado ? "publicado" : "NÃO publicado"}; grupos: ${t.grupos.length ? t.grupos.join(", ") : "nenhum"}; tolerância de atraso: ${t.toleranciaMin} min; régua de conclusão: ${t.percentualMinimo}%`,
    );
    const freq = [...t.frequencia].sort(
      (a, b) =>
        (a.pct ?? Number.POSITIVE_INFINITY) - (b.pct ?? Number.POSITIVE_INFINITY) ||
        (ix.nome.get(a.pessoaId) ?? "").localeCompare(ix.nome.get(b.pessoaId) ?? "", "pt-BR") ||
        a.pessoaId.localeCompare(b.pessoaId),
    );
    linhas.push("Frequência por aluno, da menor para a maior (contado pelo sistema):");
    for (const f of freq) {
      linhas.push(
        `- ${ix.nome.get(f.pessoaId) ?? "(fora da lista)"}: ${
          f.contadas ? `${f.presentes} de ${f.contadas} (${f.pct}%)` : "ainda sem encontro com lista fechada"
        }${f.justificadas ? `; ${plural(f.justificadas, "falta justificada", "faltas justificadas")}` : ""}${f.saiuDoGrupo ? "; NÃO está mais na turma" : ""}`,
      );
    }
    const concluiram = t.conclusao.filter((c) => c.concluido);
    linhas.push(
      `Conclusão (${t.totalItens} ${t.totalItens === 1 ? "aula conta" : "aulas contam"}; régua ${t.percentualMinimo}%): ${
        concluiram.length ? `${concluiram.length} concluíram — ${nomes(nomesDe(ix, concluiram.map((c) => c.pessoaId)))}` : "ninguém concluiu ainda"
      } (contado pelo sistema).`,
    );
    for (const c of [...t.conclusao].sort((a, b) => (ix.nome.get(a.pessoaId) ?? "").localeCompare(ix.nome.get(b.pessoaId) ?? "", "pt-BR"))) {
      linhas.push(`- ${ix.nome.get(c.pessoaId) ?? "(fora da lista)"}: ${c.feitos} de ${c.total}${c.percentual != null ? ` (${c.percentual}%)` : ""}${c.concluido ? " — CONCLUIU" : ""}`);
    }
    linhas.push("Aulas, na ordem do calendário:");
    for (const a of t.aulas) {
      const quando = a.comecaEm ? quandoBR(a.comecaEm) : "sem data (aula gravada)";
      let estado: string;
      if (a.cancelada) estado = "CANCELADA";
      else if (a.gravada) estado = `aula gravada — marcada como assistida por ${a.assistiram.length}: ${nomes(nomesDe(ix, a.assistiram))}`;
      else if (!a.realizada) estado = a.comecaEm && new Date(a.comecaEm).getTime() > agora ? "ainda vai acontecer" : "sem registro de realização";
      else {
        const por = new Map<SituacaoNaAula, string[]>();
        for (const s of a.situacoes) por.set(s.situacao, [...(por.get(s.situacao) ?? []), s.pessoaId]);
        const partes = (["presente", "atrasado", "ausente", "justificado", "sem_registro"] as SituacaoNaAula[])
          .filter((s) => (por.get(s) ?? []).length)
          .map((s) => `${SITUACAO[s]} ${(por.get(s) ?? []).length}: ${nomes(nomesDe(ix, por.get(s) ?? []))}`);
        const presentes = (por.get("presente") ?? []).length + (por.get("atrasado") ?? []).length;
        estado = `${a.listaFechada ? "lista FECHADA" : "lista ainda ABERTA"} — estiveram ${presentes}. ${partes.join("; ")}`;
      }
      const aval = a.avaliacoes.length
        ? ` Avaliação da aula: média ${(a.avaliacoes.reduce((s, x) => s + x.estrelas, 0) / a.avaliacoes.length).toFixed(1)} estrelas (${plural(a.avaliacoes.length, "avaliação", "avaliações")})${
            a.avaliacoes.some((x) => curto(x.comentario))
              ? `; comentários: ${a.avaliacoes
                  .filter((x) => curto(x.comentario))
                  .map((x) => `${ix.nome.get(x.pessoaId) ?? "aluno"} (${x.estrelas}★): "${curto(x.comentario, 200)}"`)
                  .join("; ")}`
              : ""
          }.`
        : "";
      linhas.push(`- "${a.titulo}" (módulo "${a.modulo}") — ${quando} — ${estado}.${aval}`);
    }
    if (t.foraDaConta.length) {
      linhas.push(`Fora da conta da frequência: ${t.foraDaConta.map((f) => `"${f.titulo}" (${f.motivo})`).join("; ")}.`);
    }
  }
  return secao("Classroom (fonte: lista de presença e aba Conclusão de cada treinamento)", linhas);
}

function academyEmTexto(d: DadosDaConta, ix: Indice): string {
  if (!d.trilhas.length) return secao("Academy", ["A conta não tem trilha cadastrada."]);
  const linhas: string[] = [
    '"Vista" = o aluno clicou em "Marcar como vista". A plataforma não mede se o vídeo foi assistido, nem por quanto tempo. Quem não tem login nunca aparece como tendo visto.',
  ];
  for (const t of d.trilhas) {
    const destino =
      t.destinos.grupos.length || t.destinos.pessoas.length
        ? [
            t.destinos.grupos.length ? `grupos ${t.destinos.grupos.join(", ")}` : null,
            t.destinos.pessoas.length ? `alunos ${nomes(nomesDe(ix, t.destinos.pessoas))}` : null,
          ]
            .filter(Boolean)
            .join(" e ")
        : "todos os alunos da conta";
    linhas.push(
      `### Trilha "${t.titulo}" — ${t.publicada ? "publicada" : "NÃO publicada"}; aberta a: ${destino}; régua de conclusão: ${t.percentualMinimo}%`,
    );
    for (const a of t.aulas) {
      linhas.push(
        `- Aula "${a.titulo}"${a.modulo ? ` (módulo "${a.modulo}")` : ""}${a.publicada ? "" : " — NÃO publicada"}: vista por ${a.vistaPor.length}${a.vistaPor.length ? ` — ${nomes(nomesDe(ix, a.vistaPor))}` : ""} (contado pelo sistema).`,
      );
    }
    if (t.publicada) {
      const concluiram = t.conclusao.filter((c) => c.concluido);
      const comAlguma = t.conclusao.filter((c) => c.feitos > 0);
      linhas.push(
        `Conclusão da trilha: ${concluiram.length ? `${concluiram.length} concluíram — ${nomes(nomesDe(ix, concluiram.map((c) => c.pessoaId)))}` : "ninguém concluiu"}; com pelo menos uma aula vista: ${comAlguma.length} de ${t.conclusao.length} alunos da trilha (contado pelo sistema).`,
      );
    }
  }
  return secao("Academy (fonte: trilhas e o botão \"Marcar como vista\")", linhas);
}

function rankingEmTexto(d: DadosDaConta, ix: Indice): string {
  const total = new Map<string, number>();
  const porAcao = new Map<string, Map<string, { vezes: number; pontos: number }>>();
  for (const p of d.pontos) {
    const pessoa = ix.pessoaPorLogin.get(p.userId);
    if (!pessoa) continue;
    total.set(pessoa, (total.get(pessoa) ?? 0) + p.pontos);
    const m = porAcao.get(pessoa) ?? new Map();
    const a = m.get(p.acao) ?? { vezes: 0, pontos: 0 };
    a.vezes += 1;
    a.pontos += p.pontos;
    m.set(p.acao, a);
    porAcao.set(pessoa, m);
  }
  const rotulo = new Map(d.regrasDePontos.map((r) => [r.acao, r.rotulo]));
  const comLogin = d.pessoas
    .filter((p) => p.temLogin)
    .map((p) => ({ id: p.id, nome: p.nome, total: total.get(p.id) ?? 0 }))
    .sort((a, b) => b.total - a.total || porNome(a, b));
  return secao("Ranking (fonte: pontos — o mesmo do \"Ranking geral\" do Dashboard)", [
    `Como se ganha ponto hoje: ${d.regrasDePontos.map((r) => `${r.rotulo} ${r.pontos}${r.tetoDiario ? ` (até ${r.tetoDiario} por dia)` : ""}`).join("; ")}. Responder teste e ver aula na Academy NÃO dão ponto.`,
    "Só aluno com login pontua; quem não tem login não aparece.",
    ...comLogin.map((p, i) => {
      const acoes = [...(porAcao.get(p.id) ?? new Map()).entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([acao, v]) => `${rotulo.get(acao) ?? acao} ${v.vezes}× = ${v.pontos}`)
        .join("; ");
      return `- ${i + 1}º ${p.nome}: ${p.total} pontos${acoes ? ` (${acoes})` : ""}`;
    }),
  ]);
}

function mentoriasEmTexto(d: DadosDaConta, ix: Indice, agora: number): string {
  if (!d.mentorias.length) return secao("Mentorias", ["Nenhuma mentoria cadastrada."]);
  const linhas = [...d.mentorias]
    .sort(
      (a, b) =>
        (ix.nome.get(a.pessoaId) ?? "").localeCompare(ix.nome.get(b.pessoaId) ?? "", "pt-BR") || a.titulo.localeCompare(b.titulo),
    )
    .map((m) => {
      const validas = m.sessoes.filter((s) => s.status !== "cancelada");
      const feitas = validas.filter((s) => s.status === "concluida");
      const futuras = validas
        .filter((s) => s.status === "agendada" && s.quando && new Date(s.quando).getTime() >= agora)
        .sort((a, b) => (a.quando ?? "").localeCompare(b.quando ?? ""));
      const avaliadas = m.sessoes.filter((s) => s.estrelas != null);
      return `- ${ix.nome.get(m.pessoaId) ?? "(fora da lista)"} — "${m.titulo}": ${m.status}; ${m.contratadas ? `${m.contratadas} sessões contratadas; ` : ""}${plural(feitas.length, "sessão realizada", "sessões realizadas")}; ${
        futuras.length ? `próxima em ${quandoBR(futuras[0].quando)}` : "nenhuma sessão futura agendada"
      }${
        avaliadas.length
          ? `; avaliações do aluno: ${avaliadas.map((s) => `${s.estrelas}★${curto(s.comentario, 200) ? ` "${curto(s.comentario, 200)}"` : ""}`).join("; ")}`
          : ""
      }.`;
    });
  return secao("Mentorias (fonte: Mentorias)", linhas);
}

function campanhasEmTexto(d: DadosDaConta, ix: Indice): string {
  if (!d.campanhas.length) return secao("Campanhas de teste", ["Nenhuma campanha."]);
  const linhas: string[] = [
    "Unidade = um envio (uma bateria conta como um só). Respondida = entregue inteira. É a mesma conta da tela Testes → Campanhas. No link aberto, quem nunca abriu o link não aparece.",
  ];
  for (const c of d.campanhas) {
    const validas = c.unidades;
    const resp = validas.filter((u) => u.respondida);
    const pend = validas.filter((u) => !u.respondida);
    const nomesDas = (us: typeof validas) => nomes(nomesDe(ix, us.filter((u) => u.pessoaId).map((u) => u.pessoaId as string)));
    linhas.push(
      `- "${c.titulo}" — ${c.estado}; testes: ${c.testes.join(", ") || "—"}; ${c.grupo ? `grupo ${c.grupo}; ` : ""}criada em ${dataBR(c.criadaEm)}${c.comecaEm ? `; começa em ${dataBR(c.comecaEm)}` : ""}${c.expiraEm ? `; ${c.estado === "Expirada" ? "expirou" : "expira"} em ${dataBR(c.expiraEm)}` : ""}${c.limite ? `; limite de ${c.limite} respostas` : ""}. Envios: ${validas.length}; respondidos: ${resp.length}${resp.length ? ` (${nomesDas(resp)})` : ""}; pendentes: ${pend.length}${pend.length ? ` (${nomesDas(pend)})` : ""} (contado pelo sistema).`,
    );
  }
  return secao("Campanhas de teste (fonte: Testes → Campanhas)", linhas);
}

function certificadosEmTexto(d: DadosDaConta, ix: Indice): string {
  if (!d.certificados.length) return secao("Certificados", ["Nenhum certificado emitido até agora."]);
  return secao(
    "Certificados emitidos (fonte: certificados de conclusão)",
    [...d.certificados]
      .sort((a, b) => a.emitidoEm.localeCompare(b.emitidoEm))
      .map((c) => `- ${ix.nome.get(c.pessoaId) ?? "(fora da lista)"} — ${c.tipo} "${c.item}" (${c.percentual}%), emitido em ${dataBR(c.emitidoEm)}`),
  );
}

function legendaEmTexto(): string {
  return secao("Como ler os números dos testes", [
    "- DISC, Temperamentos e VAK (escolha forçada): cada gráfico divide 100 pontos entre as letras; o que vale é a ORDEM. \"PERFIL\" é a sigla do gráfico natural (uma letra, ou duas quando empatam de perto).",
    `- Natural: ${INTENSIDADE.naturalExplica}`,
    `- Adaptado: ${INTENSIDADE.adaptadoExplica}`,
    `- ${INTENSIDADE.reguasSeparadas}`,
    `- "${INTENSIDADE.poucaInformacao}": a letra quase não foi marcada; ela fica no gráfico, mas não ocupa o título.`,
    ...Object.entries(INTENSIDADE.indiceExplica).map(
      ([k, v]) => `- Índice ${k[0].toUpperCase()}${k.slice(1)} (DISC, de 0 a 1; texto do relatório, escrito para o aluno): ${v}`,
    ),
    "- MBTI: eixo abaixo de 55% fica EM ABERTO e não vira letra; com dois ou mais eixos em aberto, o relatório não declara tipo.",
    "- Valores e Big Five: dimensões de 0 a 100, com a faixa do relatório entre parênteses.",
  ]);
}

function limitesEmTexto(d: DadosDaConta): string {
  return secao("O que NÃO está neste bloco", [
    "- Registro de acesso: a plataforma não registra entradas, visitas nem tempo de uso. Não dá para saber quem entrou, quando ou quantas vezes.",
    "- As conversas dos alunos com a assistente deles: não chegam aqui, por desenho — nem texto, nem tema, nem se usam.",
    "- Contato (e-mail, telefone, redes): fica na ficha da pessoa, no painel.",
    "- Respostas de questionários (como o Mapa da Intenção): ficam na aba Respostas.",
    "- Observações e resumos que o mentor escreve nas mentorias.",
    d.indisponiveis.length
      ? `- NÃO FOI POSSÍVEL LER AGORA: ${d.indisponiveis.join(", ")}. Se a pergunta depender disso, diga que não conseguiu ver essa parte neste momento e indique a tela.`
      : null,
  ]);
}

/** O bloco <dados_da_conta> inteiro, na ordem: resumo → grupos → alunos → áreas → limites. */
export function contextoDaConta(d: DadosDaConta, agora: number): string {
  const ix = indexar(d);
  const partes = [
    `Agora é ${quandoBR(new Date(agora).toISOString())} (horário de Brasília, arredondado para a hora cheia). Estes são os dados da conta que o mentor enxerga no painel, lidos agora com o login dele.`,
    resumoDaConta(d, ix),
    legendaEmTexto(),
    gruposEmTexto(d, ix),
    alunosEmTexto(d, ix),
    classroomEmTexto(d, ix, agora),
    academyEmTexto(d, ix),
    rankingEmTexto(d, ix),
    mentoriasEmTexto(d, ix, agora),
    campanhasEmTexto(d, ix),
    certificadosEmTexto(d, ix),
    limitesEmTexto(d),
  ].filter((x) => !!x);
  return `<dados_da_conta>\n${partes.join("\n\n")}\n</dados_da_conta>`;
}
