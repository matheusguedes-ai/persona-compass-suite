/**
 * A lista de presença, montada num lugar só.
 *
 * A tela e a planilha saem DAQUI. Se a exportação remontasse por conta própria,
 * o número impresso e o número na tela discordariam — e é justamente a planilha
 * que vai para o RH decidir certificado e reembolso.
 *
 * Mesmo motivo para o `referencia`: um instante só, decidido aqui, usado nos dois
 * lados e impresso no rodapé. Duas exportações no mesmo dia batem, e quando não
 * batem o arquivo diz por quê.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  type Aluno, type AulaPresenca, type Registro, type Situacao,
  frequenciaDe, situacaoDe, atrasoMin, aulaContaNaFrequencia,
  ROTULO_SITUACAO, TOLERANCIA_ATRASO_MIN,
  quandoBr, quandoComFuso, textoAtraso, textoChegada, textoOrigem, ehOverride,
} from "@/lib/presenca";

export type LinhaPresenca = {
  aula_id: string;
  person_id: string;
  aluno: string;
  email: string | null;
  grupo: string | null;
  chegada: string;
  /** A hora crua da chegada, para a planilha imprimir com fuso explícito. */
  chegada_iso: string | null;
  origem: string;
  atraso_min: number | null;
  atraso_texto: string;
  situacao: Situacao;
  situacao_rotulo: string;
  override: boolean;
  frequencia: string;
  frequencia_pct: number | null;
  observacao: string | null;
  quem: string | null;
  tem_registro: boolean;
  saiu_do_grupo: boolean;
};

export type TabelaPresenca = {
  treinamento: { id: string; titulo: string };
  aulas: AulaPresenca[];
  alunos: Aluno[];
  /** Linhas por aula: aula_id → linhas, na ordem em que devem ser exibidas. */
  linhas: LinhaPresenca[];
  resumo: Array<{
    person_id: string; aluno: string; email: string | null; grupo: string | null;
    presentes: number; contadas: number; justificadas: number; pct: number | null;
    conta_desde: string | null; saiu_do_grupo: boolean;
  }>;
  referencia: string;
  /** Aulas que ficaram FORA da conta, e por quê — o rodapé imprime. */
  fora_da_conta: Array<{ titulo: string; motivo: string }>;
  tolerancia_min: number;
};

/**
 * Ordem estável em tudo que a planilha imprime: o ICU do servidor e o do
 * navegador não ordenam "Ângela" e "Andre" igual, e a planilha nasce aqui
 * enquanto a tela renderiza lá. Sem desempate por id, duas leituras trocariam
 * linhas de lugar.
 */
function porNome<T extends { nome: string; person_id: string }>(a: T, b: T) {
  return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
    || a.person_id.localeCompare(b.person_id);
}

export async function montarTabelaPresenca(
  supabase: SupabaseClient<Database>,
  treinamentoId: string,
): Promise<TabelaPresenca> {
  const agora = Date.now();

  const { data: treinamento, error: eT } = await supabase
    .from("treinamentos").select("id, titulo").eq("id", treinamentoId).maybeSingle();
  if (eT) throw new Error(eT.message);
  if (!treinamento) throw new Error("Treinamento não encontrado.");

  const { data: modulos, error: eM } = await supabase
    .from("treinamento_modulos")
    .select("id, titulo, ordem")
    .eq("treinamento_id", treinamentoId);
  if (eM) throw new Error(eM.message);
  const modIds = (modulos ?? []).map((m) => m.id);

  const { data: aulasCru, error: eA } = modIds.length
    ? await supabase
        .from("treinamento_aulas")
        .select("id, titulo, comeca_em, termina_em, local, ordem, modulo_id, fechada_em, cancelada")
        .in("modulo_id", modIds)
    : { data: [], error: null };
  if (eA) throw new Error(eA.message);

  const nomeDoModulo = new Map((modulos ?? []).map((m) => [m.id, m.titulo]));
  const ordemDoModulo = new Map((modulos ?? []).map((m) => [m.id, m.ordem]));

  // Aulas em ordem de calendário, com a ordem do módulo como desempate e o id
  // por último — a mesma sequência em toda leitura. Sem data vai para o fim.
  const aulas: AulaPresenca[] = (aulasCru ?? [])
    .map((a) => ({
      id: a.id,
      titulo: a.titulo,
      modulo: nomeDoModulo.get(a.modulo_id) ?? "",
      comeca_em: a.comeca_em,
      termina_em: a.termina_em,
      local: a.local,
      fechada_em: a.fechada_em,
      cancelada: a.cancelada,
      _ordem: (ordemDoModulo.get(a.modulo_id) ?? 0) * 1000 + a.ordem,
    }))
    .sort((x, y) => {
      const tx = x.comeca_em ? new Date(x.comeca_em).getTime() : Number.POSITIVE_INFINITY;
      const ty = y.comeca_em ? new Date(y.comeca_em).getTime() : Number.POSITIVE_INFINITY;
      return tx - ty || x._ordem - y._ordem || x.id.localeCompare(y.id);
    })
    .map(({ _ordem, ...a }) => a);

  const aulaIds = aulas.map((a) => a.id);

  const { data: presencasCru, error: eP } = aulaIds.length
    ? await supabase
        .from("treinamento_presencas")
        .select("aula_id, person_id, origem, escaneado_em, registrado_em, situacao, observacao, group_id, group_nome, marcado_por_nome")
        .in("aula_id", aulaIds)
    : { data: [], error: null };
  if (eP) throw new Error(eP.message);

  // A turma: membros ATUAIS dos grupos do treinamento, mais quem tem presença
  // e já saiu. Quem participou tem de continuar na lista — a aula em que ele
  // esteve aconteceu, e a lista dela não pode perder gente depois.
  const { data: tg } = await supabase
    .from("treinamento_grupos").select("group_id").eq("treinamento_id", treinamentoId);
  const groupIds = (tg ?? []).map((g) => g.group_id);
  const { data: membros } = groupIds.length
    ? await supabase
        .from("group_members")
        .select("person_id, group_id, added_at, people(full_name, email), groups(name)")
        .in("group_id", groupIds)
    : { data: [] as never[] };

  const alunosPorId = new Map<string, Aluno>();
  for (const m of membros ?? []) {
    const p = m.people as unknown as { full_name: string; email: string | null } | null;
    const g = m.groups as unknown as { name: string } | null;
    if (!p) continue;
    const jaTem = alunosPorId.get(m.person_id);
    // Em dois grupos do treinamento: fica o primeiro em ordem alfabética, e a
    // contagem começa na entrada mais antiga.
    if (jaTem) {
      if ((g?.name ?? "") < (jaTem.grupo ?? "")) jaTem.grupo = g?.name ?? null;
      if (m.added_at && jaTem.conta_desde && m.added_at < jaTem.conta_desde) {
        jaTem.conta_desde = m.added_at;
      }
      continue;
    }
    alunosPorId.set(m.person_id, {
      person_id: m.person_id,
      nome: p.full_name,
      email: p.email,
      grupo: g?.name ?? null,
      conta_desde: m.added_at ?? null,
      saiu_do_grupo: false,
    });
  }

  const idsComPresenca = [...new Set((presencasCru ?? []).map((p) => p.person_id))];
  const faltando = idsComPresenca.filter((id) => !alunosPorId.has(id));
  if (faltando.length) {
    const { data: exMembros } = await supabase
      .from("people").select("id, full_name, email").in("id", faltando);
    for (const p of exMembros ?? []) {
      const linha = (presencasCru ?? []).find((x) => x.person_id === p.id);
      alunosPorId.set(p.id, {
        person_id: p.id,
        nome: p.full_name,
        email: p.email,
        grupo: linha?.group_nome ?? null,
        conta_desde: null,
        saiu_do_grupo: true,
      });
    }
  }

  const alunos = [...alunosPorId.values()].sort(porNome);

  // A primeira presença também abre a contagem: garante numerador ⊆ denominador
  // mesmo quando o `added_at` do grupo é posterior (re-inclusão, importação).
  const primeiraPresenca = new Map<string, string>();
  for (const p of presencasCru ?? []) {
    const aula = aulas.find((a) => a.id === p.aula_id);
    const quando = aula?.comeca_em ?? p.registrado_em;
    const atual = primeiraPresenca.get(p.person_id);
    if (!atual || quando < atual) primeiraPresenca.set(p.person_id, quando);
  }
  for (const a of alunos) {
    const pp = primeiraPresenca.get(a.person_id);
    if (pp && (!a.conta_desde || pp < a.conta_desde)) a.conta_desde = pp;
  }

  const registros: Registro[] = (presencasCru ?? []).map((p) => ({
    aula_id: p.aula_id,
    person_id: p.person_id,
    origem: p.origem,
    escaneado_em: p.escaneado_em,
    registrado_em: p.registrado_em,
    situacao: p.situacao,
    observacao: p.observacao,
    marcado_por_nome: p.marcado_por_nome,
    grupo: p.group_nome,
  }));

  const porPessoa = new Map<string, Map<string, Registro>>();
  for (const r of registros) {
    let m = porPessoa.get(r.person_id);
    if (!m) { m = new Map(); porPessoa.set(r.person_id, m); }
    m.set(r.aula_id, r);
  }

  const linhas: LinhaPresenca[] = [];
  for (const aula of aulas) {
    for (const aluno of alunos) {
      const meus = porPessoa.get(aluno.person_id) ?? new Map<string, Registro>();
      const reg = meus.get(aula.id);
      // Aluno que já saiu só aparece nas aulas em que tem registro: listar
      // ausência dele numa aula posterior à saída seria inventar falta.
      if (!reg && aluno.saiu_do_grupo) continue;
      const s = situacaoDe(reg, aula);
      // "Frequência até esta aula": a linha da aula de junho não pode exibir o
      // total de julho — é o número que vai para uma conversa sobre junho.
      const f = frequenciaDe(aluno, aulas, meus, agora, aula);
      linhas.push({
        aula_id: aula.id,
        person_id: aluno.person_id,
        aluno: aluno.nome,
        email: aluno.email,
        grupo: reg?.grupo ?? aluno.grupo,
        chegada: textoChegada(reg),
        chegada_iso: reg?.escaneado_em ?? null,
        origem: textoOrigem(reg),
        atraso_min: atrasoMin(reg, aula),
        atraso_texto: textoAtraso(reg, aula),
        situacao: s,
        situacao_rotulo: ROTULO_SITUACAO[s],
        override: ehOverride(reg, aula),
        frequencia: f.texto,
        frequencia_pct: f.pct,
        observacao: reg?.observacao ?? null,
        quem: reg?.marcado_por_nome ?? null,
        tem_registro: !!reg,
        saiu_do_grupo: aluno.saiu_do_grupo,
      });
    }
  }

  const resumo = alunos.map((aluno) => {
    const f = frequenciaDe(aluno, aulas, porPessoa.get(aluno.person_id) ?? new Map(), agora);
    return {
      person_id: aluno.person_id,
      aluno: aluno.nome,
      email: aluno.email,
      grupo: aluno.grupo,
      presentes: f.presentes,
      contadas: f.contadas,
      justificadas: f.justificadas,
      pct: f.pct,
      conta_desde: aluno.conta_desde,
      saiu_do_grupo: aluno.saiu_do_grupo,
    };
  });

  const fora_da_conta = aulas
    .filter((a) => !aulaContaNaFrequencia(a, agora))
    .map((a) => ({
      titulo: a.titulo,
      motivo: a.cancelada
        ? "cancelada"
        : !a.comeca_em
          ? "sem data marcada"
          : !a.fechada_em
            ? "lista ainda não fechada"
            : "ainda não aconteceu",
    }));

  return {
    treinamento,
    aulas,
    alunos,
    linhas,
    resumo,
    referencia: new Date(agora).toISOString(),
    fora_da_conta,
    tolerancia_min: TOLERANCIA_ATRASO_MIN,
  };
}

/** As 9 colunas aprovadas, no formato que vai para a planilha. */
export function linhasParaPlanilha(t: TabelaPresenca) {
  const porAula = new Map(t.aulas.map((a) => [a.id, a]));
  return t.linhas.map((l) => {
    const aula = porAula.get(l.aula_id)!;
    return {
      Treinamento: t.treinamento.titulo,
      Módulo: aula.modulo,
      Aula: aula.titulo,
      "Data prevista": quandoComFuso(aula.comeca_em),
      Local: aula.local ?? "",
      Aluno: l.aluno,
      "E-mail": l.email ?? "",
      Grupo: l.grupo ?? "",
      // A hora do SCAN, com o fuso escrito: a planilha viaja para fora da tela,
      // e "19:07" sem offset é ambíguo para quem abre em outro lugar.
      Chegada: quandoComFuso(l.chegada_iso),
      "Como foi registrada": l.origem,
      // Numérico de propósito: vazio = não deu para medir, 0 = medido e deu zero.
      // Colapsar os dois em texto mataria soma e média no Excel.
      "Atraso (min)": l.atraso_min,
      Situação: l.situacao_rotulo + (l.override ? " (definido pelo professor)" : ""),
      "Frequência até esta aula": l.frequencia,
      Observação: l.observacao ?? "",
      "Quem tocou nesta linha": l.quem ?? "",
    };
  });
}

export function resumoParaPlanilha(t: TabelaPresenca) {
  return t.resumo.map((r) => ({
    Aluno: r.aluno,
    "E-mail": r.email ?? "",
    Grupo: r.grupo ?? "",
    Presenças: r.presentes,
    "Aulas na conta": r.contadas,
    "Faltas justificadas": r.justificadas,
    "Frequência (%)": r.pct,
    "Conta desde": r.conta_desde ? quandoBr(r.conta_desde) : "",
    Situação: r.saiu_do_grupo ? "não está mais na turma" : "",
  }));
}
