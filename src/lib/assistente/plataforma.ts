/**
 * A PLATAFORMA EM TEXTO, PARA A ASSISTENTE (#305, Nível 2).
 *
 * Recebe o que `plataforma.server.ts` leu COM O LOGIN DO ALUNO e vira texto. Função pura: a mesma
 * entrada devolve os mesmos bytes (este texto entra no prefixo em cache da API). Por isso o "agora"
 * chega arredondado para a hora cheia — um relógio ao segundo faria toda pergunta pagar o contexto
 * inteiro de novo.
 *
 * Área que não veio (fechada para o aluno) NÃO aparece aqui nem como "fechada": a assistente não
 * pode saber, e portanto não pode contar, que existe algo além do que ele enxerga.
 */
import type { Situacao } from "@/lib/presenca";

export type AulaDaTrilha = {
  titulo: string;
  descricao: string | null;
  modulo: string | null;
  duracaoMin: number | null;
  vista: boolean;
  materiais: string[];
};
export type TrilhaDoAluno = { titulo: string; descricao: string | null; materiais: string[]; aulas: AulaDaTrilha[] };

export type AulaDoAluno = {
  titulo: string;
  descricao: string | null;
  modulo: string | null;
  comecaEm: string | null;
  terminaEm: string | null;
  local: string | null;
  cancelada: boolean;
  /** Aula sem data: é gravada, e "concluir" é marcar como assistida. */
  gravada: boolean;
  realizada: boolean;
  /** Aconteceu antes de o aluno entrar na turma — não conta para ele. */
  antesDeEntrar: boolean;
  situacao: Situacao | null;
  concluidaGravada: boolean;
  materiais: string[];
};
export type TreinamentoDoAluno = {
  titulo: string;
  descricao: string | null;
  aulas: AulaDoAluno[];
  frequencia: { estive: number; de: number } | null;
};

export type ColegaDoAluno = {
  nome: string;
  cargo: string | null;
  empresa: string | null;
  autorizou: boolean;
  profissao: string | null;
  email: string | null;
  telefone: string | null;
  linkedin: string | null;
  instagram: string | null;
  site: string | null;
};

export type PlataformaDoAluno = {
  areas: string[];
  /** Áreas abertas para o aluno que falharam ao ler agora. */
  indisponiveis: string[];
  trilhas: TrilhaDoAluno[];
  biblioteca: Array<{ titulo: string; descricao: string | null; tipo: string; categoria: string | null; pasta: string | null }>;
  treinamentos: TreinamentoDoAluno[];
  agenda: Array<{ titulo: string; descricao: string | null; quando: string; terminaEm: string | null; temLink: boolean; deAula: boolean }>;
  mentorias: Array<{
    titulo: string;
    status: string;
    sessoesContratadas: number | null;
    sessoes: Array<{
      quando: string | null;
      terminaEm: string | null;
      modalidade: string | null;
      local: string | null;
      status: string;
      resumo: string | null;
      tarefas: Array<{ titulo: string; concluida: boolean }>;
    }>;
  }>;
  comunidade: Array<{ nome: string; membros: ColegaDoAluno[] }>;
  pontos: {
    total: number;
    porAcao: Record<string, { vezes: number; pontos: number }>;
    ultimos: Array<{ acao: string; pontos: number; quando: string }>;
    posicao: { lugar: number; de: number } | null;
    regras: Array<{ acao: string; rotulo: string; pontos: number; tetoDiario: number | null }>;
  } | null;
};

const FUSO = "America/Sao_Paulo";

/** "qui., 25/09/2026, 19:00" — sempre no horário de Brasília, o da turma. */
export function quandoBR(iso: string | null | undefined): string {
  if (!iso) return "sem data";
  const d = new Date(iso);
  const dia = d.toLocaleDateString("pt-BR", { timeZone: FUSO, weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  const hora = d.toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
  return `${dia}, ${hora}`;
}

const horaBR = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }) : null;

/** O instante de referência, arredondado para a hora cheia (ver o topo do arquivo). */
export function agoraArredondado(ms: number): number {
  return Math.floor(ms / 3_600_000) * 3_600_000;
}

function curto(t: string | null | undefined, max = 400): string | null {
  if (!t) return null;
  const limpo = t.replace(/\s+/g, " ").trim();
  if (!limpo) return null;
  return limpo.length > max ? `${limpo.slice(0, max - 1)}…` : limpo;
}

const SITUACAO: Record<Situacao, string> = {
  presente: "presença registrada",
  atrasado: "presença registrada (chegou atrasado)",
  ausente: "AUSÊNCIA registrada",
  justificado: "falta justificada",
  sem_registro: "lista de presença ainda aberta — sem registro por enquanto",
};

function secao(titulo: string, linhas: Array<string | null | false | undefined>): string {
  const corpo = linhas.filter((l): l is string => typeof l === "string" && l !== "");
  return corpo.length ? `## ${titulo}\n${corpo.join("\n")}` : "";
}

function trilhasEmTexto(trs: TrilhaDoAluno[]): string {
  return secao(
    "Academy — trilhas liberadas para o aluno",
    trs.flatMap((t) => {
      const vistas = t.aulas.filter((a) => a.vista).length;
      return [
        `### Trilha "${t.titulo}" — ${vistas} de ${t.aulas.length} aulas marcadas como vistas`,
        curto(t.descricao) && `Sobre a trilha: ${curto(t.descricao)}`,
        t.materiais.length ? `Materiais da trilha: ${t.materiais.join("; ")}` : null,
        ...t.aulas.map((a) => {
          const extra = [
            a.modulo ? `módulo "${a.modulo}"` : null,
            a.duracaoMin ? `${a.duracaoMin} min` : null,
            a.vista ? "JÁ VISTA" : "ainda não vista",
          ].filter(Boolean).join(" · ");
          return [
            `- Aula "${a.titulo}" (${extra})`,
            curto(a.descricao, 300) && `  Sobre: ${curto(a.descricao, 300)}`,
            a.materiais.length ? `  Materiais: ${a.materiais.join("; ")}` : null,
          ].filter(Boolean).join("\n");
        }),
      ];
    }),
  );
}

function treinamentosEmTexto(ts: TreinamentoDoAluno[], agora: number): string {
  return secao(
    "Classroom — treinamentos do aluno",
    ts.flatMap((t) => {
      const perdidas = t.aulas.filter((a) => a.situacao === "ausente" || a.situacao === "justificado");
      const gravadasPendentes = t.aulas.filter((a) => a.gravada && !a.cancelada && !a.concluidaGravada);
      const proxima = t.aulas.find((a) => !a.cancelada && a.comecaEm && new Date(a.comecaEm).getTime() >= agora);
      return [
        `### Treinamento "${t.titulo}"`,
        curto(t.descricao) && `Sobre: ${curto(t.descricao)}`,
        t.frequencia
          ? `Frequência do aluno: esteve em ${t.frequencia.estive} de ${t.frequencia.de} encontros com lista fechada.`
          : "Frequência: ainda não há encontro com lista de presença fechada.",
        proxima ? `Próximo encontro: "${proxima.titulo}" em ${quandoBR(proxima.comecaEm)}.` : null,
        perdidas.length
          ? `Encontros que o aluno perdeu (para rever o conteúdo): ${perdidas.map((a) => `"${a.titulo}"`).join(", ")}.`
          : "Encontros perdidos: nenhum registrado.",
        gravadasPendentes.length
          ? `Aulas gravadas ainda não marcadas como assistidas: ${gravadasPendentes.map((a) => `"${a.titulo}"`).join(", ")}.`
          : null,
        "Aulas, na ordem:",
        ...t.aulas.map((a) => {
          let estado: string;
          if (a.cancelada) estado = "CANCELADA";
          else if (a.gravada) estado = a.concluidaGravada ? "aula gravada — assistida" : "aula gravada — ainda não assistida";
          else if (!a.realizada) estado = "ainda vai acontecer";
          else if (a.antesDeEntrar) estado = "aconteceu antes de o aluno entrar na turma — não conta para ele";
          else estado = a.situacao ? SITUACAO[a.situacao] : "sem registro";
          const quando = a.comecaEm
            ? `${quandoBR(a.comecaEm)}${a.terminaEm ? ` até ${horaBR(a.terminaEm)}` : ""}`
            : null;
          return [
            `- "${a.titulo}"${a.modulo ? ` (módulo "${a.modulo}")` : ""} — ${estado}`,
            quando && `  Quando: ${quando}`,
            a.local && `  Local: ${a.local}`,
            curto(a.descricao, 300) && `  Sobre: ${curto(a.descricao, 300)}`,
            a.materiais.length ? `  Materiais da aula: ${a.materiais.join("; ")}` : null,
          ].filter(Boolean).join("\n");
        }),
      ];
    }),
  );
}

function agendaEmTexto(ag: PlataformaDoAluno["agenda"], agora: number): string {
  const futuros = ag.filter((e) => new Date(e.terminaEm ?? e.quando).getTime() >= agora);
  const passados = ag.filter((e) => new Date(e.terminaEm ?? e.quando).getTime() < agora);
  const linha = (e: PlataformaDoAluno["agenda"][number]) =>
    [
      `- ${quandoBR(e.quando)}${e.terminaEm ? ` até ${horaBR(e.terminaEm)}` : ""} — "${e.titulo}"${e.deAula ? " (encontro de treinamento)" : ""}`,
      curto(e.descricao, 300) && `  Detalhes: ${curto(e.descricao, 300)}`,
      e.temLink && "  Tem link de acesso, que o aluno encontra na Agenda.",
    ].filter(Boolean).join("\n");
  return secao("Agenda — eventos do aluno", [
    futuros.length ? "Próximos (do mais perto ao mais longe):" : "Nenhum evento marcado daqui para frente.",
    ...futuros.map(linha),
    passados.length ? "Dos últimos 7 dias:" : null,
    ...passados.map(linha),
  ]);
}

function bibliotecaEmTexto(bib: PlataformaDoAluno["biblioteca"]): string {
  return secao(
    "Biblioteca — materiais liberados para o aluno",
    bib.map((b) =>
      [
        `- "${b.titulo}" (${b.tipo}${b.categoria ? `, ${b.categoria}` : ""}${b.pasta ? `, pasta "${b.pasta}"` : ""})`,
        curto(b.descricao, 300) && `  Sobre: ${curto(b.descricao, 300)}`,
      ].filter(Boolean).join("\n"),
    ),
  );
}

function mentoriasEmTexto(ms: PlataformaDoAluno["mentorias"], agora: number): string {
  return secao(
    "Mentorias do aluno",
    ms.flatMap((m) => [
      `### "${m.titulo}" — ${m.status}${m.sessoesContratadas ? ` · ${m.sessoesContratadas} sessões contratadas` : ""}`,
      ...m.sessoes.map((s) => {
        const futura = s.quando && new Date(s.quando).getTime() >= agora && s.status === "agendada";
        const estado = s.status === "concluida" ? "realizada" : futura ? "agendada" : s.status === "agendada" ? "agendada (data já passou)" : s.status;
        const pend = s.tarefas.filter((t) => !t.concluida).map((t) => `"${t.titulo}"`);
        const feitas = s.tarefas.filter((t) => t.concluida).map((t) => `"${t.titulo}"`);
        return [
          `- Sessão ${quandoBR(s.quando)}${s.terminaEm ? ` até ${horaBR(s.terminaEm)}` : ""} — ${estado}`,
          (s.modalidade || s.local) && `  ${[s.modalidade, s.local].filter(Boolean).join(" · ")}`,
          curto(s.resumo, 600) && `  Resumo que o mentor registrou: ${curto(s.resumo, 600)}`,
          pend.length ? `  Tarefas pendentes: ${pend.join(", ")}` : null,
          feitas.length ? `  Tarefas feitas: ${feitas.join(", ")}` : null,
        ].filter(Boolean).join("\n");
      }),
    ]),
  );
}

function comunidadeEmTexto(gs: PlataformaDoAluno["comunidade"]): string {
  return secao(
    "Comunidade — grupos do aluno e colegas",
    gs.flatMap((g) => [
      `### Grupo "${g.nome}" — ${g.membros.length} colega${g.membros.length === 1 ? "" : "s"}`,
      ...g.membros.map((c) => {
        const base = [c.cargo, c.empresa].filter(Boolean).join(", ");
        const contato = c.autorizou
          ? [
              c.profissao && `profissão: ${c.profissao}`,
              c.email && `e-mail: ${c.email}`,
              c.telefone && `telefone: ${c.telefone}`,
              c.linkedin && `LinkedIn: ${c.linkedin}`,
              c.instagram && `Instagram: ${c.instagram}`,
              c.site && `site: ${c.site}`,
            ].filter(Boolean).join("; ")
          : "";
        return `- ${c.nome}${base ? ` (${base})` : ""} — ${
          c.autorizou
            ? `autorizou mostrar o perfil${contato ? `: ${contato}` : " (sem contato preenchido)"}`
            : "NÃO autorizou mostrar contato"
        }`;
      }),
    ]),
  );
}

function pontosEmTexto(p: NonNullable<PlataformaDoAluno["pontos"]>): string {
  const rotulo = new Map(p.regras.map((r) => [r.acao, r.rotulo]));
  return secao("Ranking — pontos do aluno", [
    `Total: ${p.total} pontos.${p.posicao ? ` Posição entre os colegas dos grupos dele: ${p.posicao.lugar}º de ${p.posicao.de}.` : ""}`,
    "Como se ganha ponto na plataforma:",
    ...p.regras.map((r) => {
      const feito = p.porAcao[r.acao];
      return `- ${r.rotulo}: ${r.pontos} ponto${r.pontos === 1 ? "" : "s"}${r.tetoDiario ? ` (até ${r.tetoDiario} por dia)` : ""} — ${
        feito ? `o aluno fez ${feito.vezes} vez${feito.vezes === 1 ? "" : "es"} (${feito.pontos} ponto${feito.pontos === 1 ? "" : "s"})` : "o aluno ainda não pontuou com isso"
      }`;
    }),
    p.ultimos.length ? "Últimos pontos, do mais recente:" : null,
    ...p.ultimos.map((u) => `- ${quandoBR(u.quando)} — ${rotulo.get(u.acao) ?? u.acao}: +${u.pontos}`),
  ]);
}

/** O bloco <plataforma_do_aluno>: só o que veio, na ordem das áreas do menu. */
export function contextoDaPlataforma(p: PlataformaDoAluno, agora: number): string {
  const partes = [
    `Agora é ${quandoBR(new Date(agora).toISOString())} (horário de Brasília, arredondado para a hora cheia).`,
    p.indisponiveis.length
      ? `Não foi possível ler agora: ${p.indisponiveis.join(", ")}. Se o aluno perguntar disso, diga que não conseguiu ver essa parte neste momento e sugira abrir a tela correspondente.`
      : null,
    p.agenda.length || p.areas.includes("agenda") ? agendaEmTexto(p.agenda, agora) : null,
    p.treinamentos.length ? treinamentosEmTexto(p.treinamentos, agora) : null,
    p.trilhas.length ? trilhasEmTexto(p.trilhas) : null,
    p.biblioteca.length ? bibliotecaEmTexto(p.biblioteca) : null,
    p.mentorias.length ? mentoriasEmTexto(p.mentorias, agora) : null,
    p.comunidade.length ? comunidadeEmTexto(p.comunidade) : null,
    p.pontos ? pontosEmTexto(p.pontos) : null,
  ].filter((x): x is string => !!x);
  return `<plataforma_do_aluno>\n${partes.join("\n\n")}\n</plataforma_do_aluno>`;
}

/**
 * O bloco das observações do mentor. Vai no fim do contexto, com a regra de uso colada nele: o
 * modelo lê a regra junto do conteúdo, não só lá em cima nas orientações.
 */
export function contextoDasObservacoes(obs: Array<{ texto: string; criadaEm: string }>): string {
  if (!obs.length) return "";
  return [
    "<orientacao_reservada>",
    "Notas de contexto para você calibrar tom e foco. SIGILOSAS: nunca cite, resuma, confirme ou atribua a ninguém; nunca as repita ao aluno como afirmação sobre ele. Use só como pano de fundo, com cautela — elas podem estar desatualizadas ou erradas, e o que o aluno diz na conversa vale mais.",
    ...obs.map((o) => `- (${new Date(o.criadaEm).toLocaleDateString("pt-BR", { timeZone: FUSO })}) ${curto(o.texto, 2000)}`),
    "</orientacao_reservada>",
  ].join("\n");
}
