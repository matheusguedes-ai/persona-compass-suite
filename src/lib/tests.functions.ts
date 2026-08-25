import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissao } from "@/lib/permissao.server";
import { membershipDoUsuario } from "@/lib/team.functions";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

// ============================================================
// Types
// ============================================================
export type QuestionType =
  | "multiple_choice"
  | "checkboxes"
  | "linear_scale"
  | "ranking"
  | "drag_order"
  | "forced_choice"
  | "short_text";

// #212 F1 — os 4 tipos que um teste SEM interpretação pode usar (coleta
// pura). Os outros 3 (ranking, drag_order, forced_choice) continuam
// existindo só para quem duplica um template e já tem interpretação ligada.
export const TIPOS_SEM_INTERPRETACAO: QuestionType[] = [
  "multiple_choice", "checkboxes", "linear_scale", "short_text",
];

// ============================================================
// Versions
// ============================================================
export const listTestVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ instrument_id: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    let q = context.supabase
      .from("test_versions")
      .select("*")
      .order("is_template", { ascending: false })
      .order("created_at", { ascending: false });
    if (data.instrument_id) q = q.eq("instrument_id", data.instrument_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const lista = rows ?? [];
    if (lista.length === 0) return lista.map((v) => ({ ...v, can_edit: false, respostas: 0 }));

    // A tela precisa de duas coisas que a linha sozinha não diz: se ESTA conta
    // pode editar, e quantas respostas já existem (apagar uma versão em uso
    // levaria o histórico junto — o banco barra, e a tela avisa antes).
    const { data: conta } = await context.supabase.rpc("acting_account");
    const { data: usos } = await context.supabase
      .from("test_responses")
      .select("version_id")
      .in("version_id", lista.map((v) => v.id));
    const porVersao = new Map<string, number>();
    for (const u of usos ?? []) porVersao.set(u.version_id, (porVersao.get(u.version_id) ?? 0) + 1);

    return lista.map((v) => ({
      ...v,
      can_edit: !!conta && v.mentor_id === conta,
      respostas: porVersao.get(v.id) ?? 0,
    }));
  });

export const getTestVersion = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const [{ data: version, error: vErr }, dims, questions, bands, sections, respostasRes] = await Promise.all([
      context.supabase.from("test_versions").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("test_dimensions").select("*").eq("version_id", data.id).order("sort_order"),
      context.supabase.from("test_questions").select("*").eq("version_id", data.id).order("sort_order"),
      context.supabase.from("test_result_bands").select("*").eq("version_id", data.id).order("sort_order"),
      context.supabase.from("test_sections").select("*").eq("version_id", data.id).order("sort_order"),
      // #212 item 6 — a tela avisa ANTES de editar, não só depois de forçar
      // uma versão nova: mesmo critério de "em uso" que já trava o Excluir.
      context.supabase.from("test_responses").select("id", { count: "exact", head: true }).eq("version_id", data.id),
    ]);
    if (vErr) throw new Error(vErr.message);
    if (!version) throw new Error("Versão não encontrada");
    if (dims.error) throw new Error(dims.error.message);
    if (questions.error) throw new Error(questions.error.message);
    if (bands.error) throw new Error(bands.error.message);
    if (sections.error) throw new Error(sections.error.message);

    const questionIds = (questions.data ?? []).map((q) => q.id);
    const [options, scores] = await Promise.all([
      questionIds.length
        ? context.supabase
            .from("test_options")
            .select("*")
            .in("question_id", questionIds)
            .order("sort_order")
        : Promise.resolve({ data: [] as never[], error: null }),
      questionIds.length
        ? context.supabase
            .from("option_scores")
            .select("id, option_id, dimension_id, points, test_options!inner(question_id)")
            .in("test_options.question_id", questionIds)
        : Promise.resolve({ data: [] as never[], error: null }),
    ]);
    if (options.error) throw new Error(options.error.message);
    if (scores.error) throw new Error(scores.error.message);

    return {
      version,
      respostas: respostasRes.count ?? 0,
      dimensions: dims.data ?? [],
      questions: questions.data ?? [],
      options: options.data ?? [],
      scores: (scores.data ?? []).map((s: { id: string; option_id: string; dimension_id: string; points: number }) => ({
        id: s.id,
        option_id: s.option_id,
        dimension_id: s.dimension_id,
        points: Number(s.points),
      })),
      bands: bands.data ?? [],
      sections: sections.data ?? [],
    };
  });

// duplicateVersion (#212 F5, mais abaixo) reaproveita clonarVersaoParaEdicao
// — a mesma clonagem que já serve o fork-por-edição-estrutural — em vez de
// manter uma segunda implementação de cópia. A antiga duplicateTemplate só
// copiava dimensão/pergunta/opção/pontuação/faixa (nunca seção, sempre
// forçava has_interpretation=true, nunca copiava is_anonymous); o clone
// compartilhado já corrige os três.

// #212 F1 — a porta de entrada em branco: nasce sem dimensão, sem pergunta,
// sem interpretação. "Duplicar" (acima) continua sendo o caminho de quem
// quer partir de um template; este é o caminho de quem quer um teste do
// zero. O anonimato só se escolhe AQUI — updateTestVersion (abaixo) nunca
// aceita mudar is_anonymous depois de criado.
export const createTestVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1000).optional().nullable(),
    is_anonymous: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const { data: row, error } = await context.supabase.from("test_versions").insert({
      instrument_id: "personalizado",
      mentor_id: context.userId,
      title: data.title,
      description: data.description ?? null,
      is_template: false,
      is_published: false,
      is_anonymous: data.is_anonymous,
      has_interpretation: false,
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

/** #212 F3, item 8 — não deixa publicar teste com interpretação mal
 * configurada: sem dimensão nenhuma, ou com pergunta pontuável (múltipla
 * escolha/caixas/escala linear) que não pontua em nenhuma dimensão. Texto
 * livre e os tipos só-de-template (ranking/drag_order/forced_choice) ficam
 * de fora de propósito — não é isto que esta fatia pontua. Sem interpretação
 * ligada, não há nada para validar aqui. */
async function validarPublicacao(supabase: SupabaseClient<Database>, versionId: string): Promise<void> {
  const { data: version, error: vErr } = await supabase
    .from("test_versions").select("has_interpretation").eq("id", versionId).maybeSingle();
  if (vErr) throw new Error(vErr.message);
  if (!version || !version.has_interpretation) return;

  const [{ data: dims, error: dErr }, { data: questions, error: qErr }] = await Promise.all([
    supabase.from("test_dimensions").select("id").eq("version_id", versionId),
    supabase.from("test_questions").select("id, prompt, type, config").eq("version_id", versionId).order("sort_order"),
  ]);
  if (dErr) throw new Error(dErr.message);
  if (qErr) throw new Error(qErr.message);

  const problemas: string[] = [];
  if (!dims || dims.length === 0) problemas.push("nenhuma dimensão criada");

  const qs = questions ?? [];
  const pontuaveis = qs.filter((q) => q.type === "multiple_choice" || q.type === "checkboxes" || q.type === "linear_scale");
  const comOpcoes = qs.filter((q) => q.type === "multiple_choice" || q.type === "checkboxes");

  const optionsComPontos = new Set<string>();
  const optionsPorPergunta = new Map<string, string[]>();
  if (comOpcoes.length > 0) {
    const { data: opts, error: oErr } = await supabase
      .from("test_options").select("id, question_id").in("question_id", comOpcoes.map((q) => q.id));
    if (oErr) throw new Error(oErr.message);
    for (const o of opts ?? []) {
      optionsPorPergunta.set(o.question_id, [...(optionsPorPergunta.get(o.question_id) ?? []), o.id]);
    }
    const optionIds = (opts ?? []).map((o) => o.id);
    const { data: scores, error: sErr } = optionIds.length
      ? await supabase.from("option_scores").select("option_id").in("option_id", optionIds)
      : { data: [] as never[], error: null };
    if (sErr) throw new Error(sErr.message);
    for (const s of scores ?? []) optionsComPontos.add(s.option_id);
  }

  for (const q of pontuaveis) {
    const rotulo = `"${q.prompt || "Pergunta sem texto"}"`;
    if (q.type === "linear_scale") {
      const cfg = (q.config ?? {}) as Record<string, unknown>;
      if (typeof cfg.dimension_id !== "string" || !cfg.dimension_id) {
        problemas.push(`${rotulo} não está ligada a nenhuma dimensão`);
      }
      continue;
    }
    const opcoesDaPergunta = optionsPorPergunta.get(q.id) ?? [];
    if (opcoesDaPergunta.length === 0 || !opcoesDaPergunta.some((id) => optionsComPontos.has(id))) {
      problemas.push(`${rotulo} não pontua em nenhuma dimensão`);
    }
  }

  if (problemas.length > 0) {
    throw new Error(`Não dá para publicar ainda: ${problemas.join("; ")}.`);
  }
}

export const updateTestVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      title: z.string().trim().min(1).max(160).optional(),
      description: z.string().trim().max(1000).optional().nullable(),
      is_published: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const { id, ...rest } = data;
    if (rest.is_published) await validarPublicacao(context.supabase, id);
    const { data: row, error } = await context.supabase
      .from("test_versions").update(rest).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

/** #212 F3 — a chavinha que liga o motor de interpretação (dimensão/
 * pontuação/faixa) já usado pelos 7 templates, agora também no construtor.
 * A mesma trava que já existe no banco (test_versions_anonimo_sem_interpretacao)
 * é checada aqui antes, pra dar um erro em português em vez da mensagem crua
 * do Postgres — o banco continua sendo quem garante de verdade. */
export const setHasInterpretation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    version_id: z.string().uuid(),
    has_interpretation: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const { data: version, error: vErr } = await context.supabase
      .from("test_versions").select("is_anonymous").eq("id", data.version_id).maybeSingle();
    if (vErr) throw new Error(vErr.message);
    if (!version) throw new Error("Versão não encontrada");
    if (data.has_interpretation && version.is_anonymous) {
      throw new Error("Teste anônimo não pode ter interpretação — não há como entregar devolutiva sem saber de quem é.");
    }
    const { versionId, forked } = await versaoEditavelPara(context.supabase, data.version_id);
    const { data: row, error } = await context.supabase
      .from("test_versions").update({ has_interpretation: data.has_interpretation }).eq("id", versionId).select().single();
    if (error) throw new Error(error.message);
    return { ...row, forked, new_version_id: forked ? versionId : null };
  });

export const deleteTestVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    // O banco tem um gatilho que recusa apagar versão já respondida (a FK é
    // ON DELETE CASCADE, então sem ele o histórico ia junto). Aqui só
    // repassamos a mensagem dele, que já é escrita para o mentor ler.
    const { error } = await context.supabase.from("test_versions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** #212 F5 — cria um teste novo a partir de um já existente: um dos 7
 * templates da plataforma OU um teste próprio do mentor (a RLS de
 * test_versions — `is_template = true OR mentor_id = acting_account()` —
 * já garante que não dá pra escolher o teste de outra conta; se o select
 * abaixo não achar nada, ou não existe ou não é uma origem permitida).
 *
 * Reaproveita clonarVersaoParaEdicao (a mesma clonagem do fork-por-edição)
 * em vez de manter uma segunda implementação: dimensão, seção, pergunta
 * (com config remapeado), opção, pontuação e faixa — o que a origem não
 * tiver (MBTI sem faixa, Big Five sem pontuação por opção) simplesmente não
 * entra, sem erro. A cópia nasce SEM histórico (não existe passo aqui que
 * toque test_responses/test_answers) e independente (editar uma não altera
 * a outra — só compartilham o `forked_from_id`, guardado como referência).
 *
 * Se qualquer parte da cópia falhar no meio, a versão nova (com o que já
 * tinha entrado até ali) é apagada antes de repassar o erro — nunca fica
 * teste pela metade no banco.
 */
export const duplicateVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    source_version_id: z.string().uuid(),
    title: z.string().trim().min(1).max(160).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const { supabase, userId } = context;
    const { data: origem, error: oErr } = await supabase
      .from("test_versions").select("title").eq("id", data.source_version_id).maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!origem) throw new Error("Teste não encontrado.");

    const clone = await clonarVersaoParaEdicao(supabase, data.source_version_id, {
      mentorId: userId,
      title: data.title?.trim() || `Cópia de ${origem.title}`,
    });
    return { id: clone.versionId };
  });

// ============================================================
// Versionamento (#212, item 6; ampliado no item 7 da Fatia 3)
//
// Teste SEM resposta: edita em cima, sempre — é só um rascunho ainda sendo
// desenhado. Teste COM resposta (mesmo critério que já trava o "Excluir" na
// lista: qualquer linha em test_responses, pendente ou não): mudança
// COSMÉTICA (título, descrição, texto/obrigatória/config de uma pergunta)
// edita em cima; mudança ESTRUTURAL (pergunta/opção nascendo, morrendo,
// mudando de tipo ou de rótulo; dimensão/pontuação/faixa de resultado
// nascendo, morrendo ou mudando de valor) clona a versão inteira e aplica
// ali — a antiga não muda, então quem já respondeu (ou já recebeu um
// resultado calculado) continua com o que foi calculado na hora.
//
// Reordenar (pergunta ou dimensão) é a exceção: não muda o que uma resposta
// já dada significa, só a ordem de exibição — por isso `reorderQuestions` e
// `reorderDimensions`, abaixo, editam em cima sempre, sem clonar.
// ============================================================

/** Clona uma versão inteira (mesma lógica de `duplicateTemplate`, remapeando
 * ids) e devolve os mapas antigo→novo de pergunta e opção, para quem chamou
 * saber onde a linha que ia mexer foi parar. */
async function clonarVersaoParaEdicao(
  supabase: SupabaseClient<Database>,
  origemId: string,
  overrides?: { mentorId?: string; title?: string },
) {
  const { data: origem, error: vErr } = await supabase
    .from("test_versions").select("*").eq("id", origemId).maybeSingle();
  if (vErr) throw new Error(vErr.message);
  if (!origem) throw new Error("Versão não encontrada");

  const [dimsRes, qsRes, bandsRes, secsRes] = await Promise.all([
    supabase.from("test_dimensions").select("*").eq("version_id", origemId),
    supabase.from("test_questions").select("*").eq("version_id", origemId),
    supabase.from("test_result_bands").select("*").eq("version_id", origemId),
    supabase.from("test_sections").select("*").eq("version_id", origemId),
  ]);
  if (dimsRes.error) throw new Error(dimsRes.error.message);
  if (qsRes.error) throw new Error(qsRes.error.message);
  if (bandsRes.error) throw new Error(bandsRes.error.message);
  if (secsRes.error) throw new Error(secsRes.error.message);
  const dims = dimsRes.data ?? [];
  const qs = qsRes.data ?? [];
  const bands = bandsRes.data ?? [];
  const secs = secsRes.data ?? [];

  let opts: Array<{ id: string; question_id: string; label: string; value: string | null; sort_order: number }> = [];
  let srcScores: Array<{ option_id: string; dimension_id: string; points: number }> = [];
  if (qs.length > 0) {
    const optsRes = await supabase.from("test_options").select("*").in("question_id", qs.map((q) => q.id));
    if (optsRes.error) throw new Error(optsRes.error.message);
    opts = optsRes.data ?? [];
    if (opts.length > 0) {
      const scoresRes = await supabase.from("option_scores").select("*").in("option_id", opts.map((o) => o.id));
      if (scoresRes.error) throw new Error(scoresRes.error.message);
      srcScores = scoresRes.data ?? [];
    }
  }

  const { data: newV, error: nErr } = await supabase.from("test_versions").insert({
    instrument_id: origem.instrument_id,
    mentor_id: overrides?.mentorId ?? origem.mentor_id,
    title: overrides?.title ?? origem.title,
    description: origem.description,
    is_template: false,
    is_published: false,
    is_anonymous: origem.is_anonymous,
    has_interpretation: origem.has_interpretation,
    forked_from_id: origem.id,
  }).select().single();
  if (nErr) throw new Error(nErr.message);

  // #212 F5, item 8 — a partir daqui, qualquer erro precisa apagar a versão
  // já criada antes de subir: senão fica teste pela metade no banco (o
  // cascade de test_versions limpa dimensão/seção/pergunta/opção/pontuação/
  // faixa que já tinham entrado). Cópia inteira, ou nenhuma.
  try {
    const dimMap = new Map<string, string>();
    if (dims.length > 0) {
      const { data: newDims, error } = await supabase
        .from("test_dimensions")
        .insert(dims.map((d) => ({
          version_id: newV.id, key: d.key, label: d.label,
          description: d.description, color: d.color, sort_order: d.sort_order,
        })))
        .select();
      if (error) throw new Error(error.message);
      dims.forEach((d, i) => dimMap.set(d.id, newDims![i].id));
    }

    // #212 F4 — seção clona ANTES de pergunta, porque pergunta precisa do
    // mapa antigo→novo pra remapear section_id (mesmo raciocínio de dimensão).
    const sectionMap = new Map<string, string>();
    if (secs.length > 0) {
      const { data: newSecs, error } = await supabase
        .from("test_sections")
        .insert(secs.map((s) => ({
          version_id: newV.id, title: s.title, description: s.description, sort_order: s.sort_order,
        })))
        .select();
      if (error) throw new Error(error.message);
      secs.forEach((s, i) => sectionMap.set(s.id, newSecs![i].id));
    }

    // Mesmo remapeamento de `duplicateTemplate`: sem dimensão correspondente,
    // zera em vez de manter um id de outra versão.
    type QuestionConfig = (typeof qs)[number]["config"];
    const remapQuestionConfig = (config: QuestionConfig): QuestionConfig => {
      if (!config || typeof config !== "object" || Array.isArray(config)) return config;
      const next: Record<string, unknown> = { ...config };
      if (typeof next.dimension_id === "string") {
        next.dimension_id = dimMap.get(next.dimension_id) ?? null;
      }
      return next as QuestionConfig;
    };

    const questionIdMap = new Map<string, string>();
    const optionIdMap = new Map<string, string>();
    if (qs.length > 0) {
      const { data: newQs, error } = await supabase
        .from("test_questions")
        .insert(qs.map((q) => ({
          version_id: newV.id, type: q.type, prompt: q.prompt, helper: q.helper,
          required: q.required, sort_order: q.sort_order, config: remapQuestionConfig(q.config),
          section_id: q.section_id ? sectionMap.get(q.section_id) ?? null : null,
        })))
        .select();
      if (error) throw new Error(error.message);
      qs.forEach((q, i) => questionIdMap.set(q.id, newQs![i].id));

      if (opts.length > 0) {
        const { data: newOpts, error: oErr } = await supabase
          .from("test_options")
          .insert(opts.map((o) => ({
            question_id: questionIdMap.get(o.question_id)!,
            label: o.label, value: o.value, sort_order: o.sort_order,
          })))
          .select();
        if (oErr) throw new Error(oErr.message);
        opts.forEach((o, i) => optionIdMap.set(o.id, newOpts![i].id));

        if (srcScores.length > 0) {
          const { error: sErr } = await supabase.from("option_scores").insert(
            srcScores.map((s) => ({
              option_id: optionIdMap.get(s.option_id)!,
              dimension_id: dimMap.get(s.dimension_id)!,
              points: s.points,
            })),
          );
          if (sErr) throw new Error(sErr.message);
        }
      }
    }

    const bandMap = new Map<string, string>();
    if (bands.length > 0) {
      const { data: newBands, error } = await supabase
        .from("test_result_bands")
        .insert(bands.map((b) => ({
          version_id: newV.id,
          dimension_id: b.dimension_id ? dimMap.get(b.dimension_id) : null,
          min_score: b.min_score, max_score: b.max_score,
          title: b.title, description: b.description, sort_order: b.sort_order,
          mode: b.mode,
        })))
        .select();
      if (error) throw new Error(error.message);
      bands.forEach((b, i) => bandMap.set(b.id, newBands![i].id));
    }

    return { versionId: newV.id as string, questionIdMap, optionIdMap, dimensionIdMap: dimMap, bandIdMap: bandMap, sectionIdMap: sectionMap };
  } catch (e) {
    await supabase.from("test_versions").delete().eq("id", newV.id);
    throw e;
  }
}

type VersaoEditavel = {
  versionId: string; forked: boolean;
  questionIdMap: Map<string, string>; optionIdMap: Map<string, string>;
  dimensionIdMap: Map<string, string>; bandIdMap: Map<string, string>;
  sectionIdMap: Map<string, string>;
};

/** Resolve para onde uma mudança ESTRUTURAL deve ir: a própria versão, se
 * ainda não tem resposta nenhuma; um clone novo (em rascunho), se já tem.
 * #212 F3 — dimensão/pontuação/faixa passam a usar isto também: mexer nelas
 * num teste já respondido tem de virar versão nova, igual pergunta/opção.
 * #212 F4 — seção entra na mesma regra. */
async function versaoEditavelPara(supabase: SupabaseClient<Database>, versionId: string): Promise<VersaoEditavel> {
  const { count, error } = await supabase
    .from("test_responses").select("id", { count: "exact", head: true }).eq("version_id", versionId);
  if (error) throw new Error(error.message);
  if (!count) {
    return {
      versionId, forked: false,
      questionIdMap: new Map(), optionIdMap: new Map(),
      dimensionIdMap: new Map(), bandIdMap: new Map(),
      sectionIdMap: new Map(),
    };
  }
  const { versionId: newId, questionIdMap, optionIdMap, dimensionIdMap, bandIdMap, sectionIdMap } =
    await clonarVersaoParaEdicao(supabase, versionId);
  return { versionId: newId, forked: true, questionIdMap, optionIdMap, dimensionIdMap, bandIdMap, sectionIdMap };
}

/** Mesmo papel de `versionIdDaOpcao`, mas dimensão já tem version_id direto
 * — um hop só. */
async function versionIdDaDimensao(supabase: SupabaseClient<Database>, dimensionId: string): Promise<string> {
  const { data, error } = await supabase
    .from("test_dimensions").select("version_id").eq("id", dimensionId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Dimensão não encontrada");
  return data.version_id;
}

/** Idem, para faixa de resultado. */
async function versionIdDaFaixa(supabase: SupabaseClient<Database>, bandId: string): Promise<string> {
  const { data, error } = await supabase
    .from("test_result_bands").select("version_id").eq("id", bandId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Faixa não encontrada");
  return data.version_id;
}

/** Idem, para seção. */
async function versionIdDaSecao(supabase: SupabaseClient<Database>, sectionId: string): Promise<string> {
  const { data, error } = await supabase
    .from("test_sections").select("version_id").eq("id", sectionId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Seção não encontrada");
  return data.version_id;
}

// ============================================================
// Sections (#212 F4) — agrupam perguntas em blocos. Opcional: teste sem
// seção continua lista corrida, como sempre foi.
// ============================================================
export const upsertSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    version_id: z.string().uuid(),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1000).optional().nullable(),
    sort_order: z.number().int().default(0),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const origemVersionId = data.id ? await versionIdDaSecao(context.supabase, data.id) : data.version_id;
    const { versionId, forked, sectionIdMap } = await versaoEditavelPara(context.supabase, origemVersionId);
    const targetId = data.id ? sectionIdMap.get(data.id) ?? (forked ? undefined : data.id) : undefined;
    if (data.id && !targetId) throw new Error("Não foi possível localizar a seção na nova versão.");
    const { id, version_id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("test_sections")
      .upsert({ ...rest, ...(targetId ? { id: targetId } : {}), version_id: versionId })
      .select().single();
    if (error) throw new Error(error.message);
    return { ...row, forked, new_version_id: forked ? versionId : null };
  });

/** Item 4 da demanda — nunca apaga pergunta em silêncio. A checagem roda
 * ANTES de decidir se forka: senão, tentar excluir uma seção cheia num
 * teste já respondido criaria uma versão nova à toa (a exclusão seria
 * recusada de qualquer forma, mas o clone já teria acontecido). */
export const deleteSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const { count, error: cErr } = await context.supabase
      .from("test_questions").select("id", { count: "exact", head: true }).eq("section_id", data.id);
    if (cErr) throw new Error(cErr.message);
    if (count) {
      throw new Error(
        count === 1
          ? "Esta seção tem 1 pergunta. Mova-a para outra seção (ou para fora de seção nenhuma) antes de excluir."
          : `Esta seção tem ${count} perguntas. Mova-as para outra seção (ou para fora de seção nenhuma) antes de excluir.`,
      );
    }

    const origemVersionId = await versionIdDaSecao(context.supabase, data.id);
    const { versionId, forked, sectionIdMap } = await versaoEditavelPara(context.supabase, origemVersionId);
    const targetId = forked ? sectionIdMap.get(data.id) : data.id;
    if (!targetId) throw new Error("Não foi possível localizar a seção na nova versão.");
    const { error } = await context.supabase.from("test_sections").delete().eq("id", targetId);
    if (error) throw new Error(error.message);
    return { ok: true, forked, new_version_id: forked ? versionId : null };
  });

/** Reordenar é cosmético — edita em cima sempre, mesmo padrão de
 * `reorderQuestions`/`reorderDimensions`. */
export const reorderSections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    version_id: z.string().uuid(),
    ordered_ids: z.array(z.string().uuid()),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const results = await Promise.all(
      data.ordered_ids.map((id, i) =>
        context.supabase.from("test_sections").update({ sort_order: i + 1 }).eq("id", id),
      ),
    );
    for (const r of results) {
      if (r.error) throw new Error(r.error.message);
    }
    return { ok: true };
  });

// ============================================================
// Dimensions
// ============================================================
export const upsertDimension = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    version_id: z.string().uuid(),
    key: z.string().trim().min(1).max(20),
    label: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500).optional().nullable(),
    color: z.string().trim().max(20).optional().nullable(),
    sort_order: z.number().int().default(0),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const origemVersionId = data.id ? await versionIdDaDimensao(context.supabase, data.id) : data.version_id;
    const { versionId, forked, dimensionIdMap } = await versaoEditavelPara(context.supabase, origemVersionId);
    const targetId = data.id ? dimensionIdMap.get(data.id) ?? (forked ? undefined : data.id) : undefined;
    if (data.id && !targetId) throw new Error("Não foi possível localizar a dimensão na nova versão.");
    const { id, version_id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("test_dimensions")
      .upsert({ ...rest, ...(targetId ? { id: targetId } : {}), version_id: versionId })
      .select().single();
    if (error) throw new Error(error.message);
    return { ...row, forked, new_version_id: forked ? versionId : null };
  });

export const deleteDimension = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const origemVersionId = await versionIdDaDimensao(context.supabase, data.id);
    const { versionId, forked, dimensionIdMap } = await versaoEditavelPara(context.supabase, origemVersionId);
    const targetId = forked ? dimensionIdMap.get(data.id) : data.id;
    if (!targetId) throw new Error("Não foi possível localizar a dimensão na nova versão.");
    const { error } = await context.supabase.from("test_dimensions").delete().eq("id", targetId);
    if (error) throw new Error(error.message);
    return { ok: true, forked, new_version_id: forked ? versionId : null };
  });

/** Reordenar é cosmético (não muda o que uma resposta já dada significa) —
 * edita em cima sempre, mesmo padrão de `reorderQuestions`. */
export const reorderDimensions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    version_id: z.string().uuid(),
    ordered_ids: z.array(z.string().uuid()),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const results = await Promise.all(
      data.ordered_ids.map((id, i) =>
        context.supabase.from("test_dimensions").update({ sort_order: i + 1 }).eq("id", id),
      ),
    );
    for (const r of results) {
      if (r.error) throw new Error(r.error.message);
    }
    return { ok: true };
  });

// ============================================================
// Questions
// ============================================================
const questionTypeSchema = z.enum(["multiple_choice", "checkboxes", "linear_scale", "ranking", "drag_order", "forced_choice", "short_text"]);

export const createQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    version_id: z.string().uuid(),
    type: questionTypeSchema,
  }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const { versionId, forked } = await versaoEditavelPara(context.supabase, data.version_id);
    const { data: max } = await context.supabase
      .from("test_questions").select("sort_order").eq("version_id", versionId)
      .order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const sort_order = (max?.sort_order ?? 0) + 1;
    const defaultConfig =
      data.type === "linear_scale" ? { min: 1, max: 5, minLabel: "Discordo", maxLabel: "Concordo" } :
      data.type === "ranking" || data.type === "drag_order" ? { top_weight: 3 } :
      data.type === "forced_choice" ? { hint: "Escolha a que MAIS e a que MENOS descreve você." } : {};
    const { data: row, error } = await context.supabase.from("test_questions").insert({
      version_id: versionId, type: data.type, prompt: "", required: true,
      sort_order, config: defaultConfig,
    }).select().single();
    if (error) throw new Error(error.message);
    return { ...row, forked, new_version_id: forked ? versionId : null };
  });

export const updateQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    prompt: z.string().trim().max(500).optional(),
    helper: z.string().trim().max(500).optional().nullable(),
    required: z.boolean().optional(),
    type: questionTypeSchema.optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    sort_order: z.number().int().optional(),
    section_id: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const { data: atual, error: qErr } = await context.supabase
      .from("test_questions").select("version_id, type, section_id").eq("id", data.id).maybeSingle();
    if (qErr) throw new Error(qErr.message);
    if (!atual) throw new Error("Pergunta não encontrada");

    // Mudar de TIPO ou de SEÇÃO é estrutural aqui — texto/obrigatória/config
    // continuam editando em cima mesmo com resposta (#212 F4: mover pergunta
    // de seção entra na mesma régua de "mudou de tipo").
    const mudaTipo = data.type !== undefined && data.type !== atual.type;
    const mudaSecao = data.section_id !== undefined && data.section_id !== atual.section_id;
    const { versionId, forked, questionIdMap, sectionIdMap } = (mudaTipo || mudaSecao)
      ? await versaoEditavelPara(context.supabase, atual.version_id)
      : { versionId: atual.version_id, forked: false, questionIdMap: new Map<string, string>(), sectionIdMap: new Map<string, string>() };
    const targetId = forked ? questionIdMap.get(data.id) : data.id;
    if (!targetId) throw new Error("Não foi possível localizar a pergunta na nova versão.");

    const { id, config, section_id, ...rest } = data;
    const patch = {
      ...rest,
      ...(config !== undefined ? { config: config as Json } : {}),
      ...(section_id !== undefined
        ? { section_id: forked ? (section_id ? sectionIdMap.get(section_id) ?? null : null) : section_id }
        : {}),
    };
    const { data: row, error } = await context.supabase
      .from("test_questions").update(patch).eq("id", targetId).select().single();
    if (error) throw new Error(error.message);
    return { ...row, forked, new_version_id: forked ? versionId : null };
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const { data: q, error: qErr } = await context.supabase
      .from("test_questions").select("version_id").eq("id", data.id).maybeSingle();
    if (qErr) throw new Error(qErr.message);
    if (!q) throw new Error("Pergunta não encontrada");
    const { versionId, forked, questionIdMap } = await versaoEditavelPara(context.supabase, q.version_id);
    const targetId = forked ? questionIdMap.get(data.id) : data.id;
    if (!targetId) throw new Error("Não foi possível localizar a pergunta na nova versão.");
    const { error } = await context.supabase.from("test_questions").delete().eq("id", targetId);
    if (error) throw new Error(error.message);
    return { ok: true, forked, new_version_id: forked ? versionId : null };
  });

export const reorderQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    version_id: z.string().uuid(),
    ordered_ids: z.array(z.string().uuid()),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const results = await Promise.all(
      data.ordered_ids.map((id, i) =>
        context.supabase.from("test_questions").update({ sort_order: i + 1 }).eq("id", id),
      ),
    );
    for (const r of results) {
      if (r.error) throw new Error(r.error.message);
    }
    return { ok: true };
  });

// ============================================================
// Options
// ============================================================
/** Sobe de opção até a versão dona da pergunta — duas consultas simples em
 * vez de embed, pra não depender de FK de leitura entre tabelas (armadilha
 * já registrada: embed sem FK direta não funciona pelo PostgREST). */
async function versionIdDaOpcao(supabase: SupabaseClient<Database>, optionId: string): Promise<string> {
  const { data: o, error: oErr } = await supabase
    .from("test_options").select("question_id").eq("id", optionId).maybeSingle();
  if (oErr) throw new Error(oErr.message);
  if (!o) throw new Error("Opção não encontrada");
  const { data: q, error: qErr } = await supabase
    .from("test_questions").select("version_id").eq("id", o.question_id).maybeSingle();
  if (qErr) throw new Error(qErr.message);
  if (!q) throw new Error("Pergunta não encontrada");
  return q.version_id;
}

export const createOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ question_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const { data: q, error: qErr } = await context.supabase
      .from("test_questions").select("version_id").eq("id", data.question_id).maybeSingle();
    if (qErr) throw new Error(qErr.message);
    if (!q) throw new Error("Pergunta não encontrada");
    const { versionId, forked, questionIdMap } = await versaoEditavelPara(context.supabase, q.version_id);
    const targetQuestionId = forked ? questionIdMap.get(data.question_id) : data.question_id;
    if (!targetQuestionId) throw new Error("Não foi possível localizar a pergunta na nova versão.");
    const { data: max } = await context.supabase
      .from("test_options").select("sort_order").eq("question_id", targetQuestionId)
      .order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const sort_order = (max?.sort_order ?? 0) + 1;
    const { data: row, error } = await context.supabase
      .from("test_options").insert({ question_id: targetQuestionId, label: "", sort_order }).select().single();
    if (error) throw new Error(error.message);
    return { ...row, forked, new_version_id: forked ? versionId : null };
  });

// #212 item 6 — rótulo/valor de opção é ESTRUTURAL, não cosmético: ao
// contrário do texto de uma pergunta, o rótulo É o conteúdo que a pessoa
// escolheu. Renomear "Sim" pra "Não" depois mudaria o que uma resposta
// antiga significa sem quem respondeu ter feito nada.
export const updateOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    label: z.string().trim().max(300).optional(),
    value: z.string().trim().max(80).optional().nullable(),
    sort_order: z.number().int().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const origemVersionId = await versionIdDaOpcao(context.supabase, data.id);
    const { versionId, forked, optionIdMap } = await versaoEditavelPara(context.supabase, origemVersionId);
    const targetId = forked ? optionIdMap.get(data.id) : data.id;
    if (!targetId) throw new Error("Não foi possível localizar a opção na nova versão.");
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("test_options").update(rest).eq("id", targetId).select().single();
    if (error) throw new Error(error.message);
    return { ...row, forked, new_version_id: forked ? versionId : null };
  });

export const deleteOption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const origemVersionId = await versionIdDaOpcao(context.supabase, data.id);
    const { versionId, forked, optionIdMap } = await versaoEditavelPara(context.supabase, origemVersionId);
    const targetId = forked ? optionIdMap.get(data.id) : data.id;
    if (!targetId) throw new Error("Não foi possível localizar a opção na nova versão.");
    const { error } = await context.supabase.from("test_options").delete().eq("id", targetId);
    if (error) throw new Error(error.message);
    return { ok: true, forked, new_version_id: forked ? versionId : null };
  });

export const setOptionScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    option_id: z.string().uuid(),
    dimension_id: z.string().uuid(),
    points: z.number().finite(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const origemVersionId = await versionIdDaOpcao(context.supabase, data.option_id);
    const { versionId, forked, optionIdMap, dimensionIdMap } = await versaoEditavelPara(context.supabase, origemVersionId);
    const optionId = forked ? optionIdMap.get(data.option_id) : data.option_id;
    const dimensionId = forked ? dimensionIdMap.get(data.dimension_id) : data.dimension_id;
    if (!optionId || !dimensionId) throw new Error("Não foi possível localizar a opção ou a dimensão na nova versão.");
    if (data.points === 0) {
      await context.supabase.from("option_scores").delete()
        .eq("option_id", optionId).eq("dimension_id", dimensionId);
      return { ok: true, forked, new_version_id: forked ? versionId : null };
    }
    const { error } = await context.supabase.from("option_scores").upsert(
      { option_id: optionId, dimension_id: dimensionId, points: data.points },
      { onConflict: "option_id,dimension_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, forked, new_version_id: forked ? versionId : null };
  });

// ============================================================
// Result bands
// ============================================================
export const upsertBand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    version_id: z.string().uuid(),
    dimension_id: z.string().uuid().nullable().optional(),
    min_score: z.number().finite(),
    max_score: z.number().finite(),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1000).optional().nullable(),
    sort_order: z.number().int().default(0),
    mode: z.enum(["natural", "adaptado"]).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const origemVersionId = data.id ? await versionIdDaFaixa(context.supabase, data.id) : data.version_id;
    const { versionId, forked, bandIdMap, dimensionIdMap } = await versaoEditavelPara(context.supabase, origemVersionId);
    const targetId = data.id ? bandIdMap.get(data.id) ?? (forked ? undefined : data.id) : undefined;
    if (data.id && !targetId) throw new Error("Não foi possível localizar a faixa na nova versão.");
    // Sem dimensão (faixa "geral") continua sem; com dimensão, remapeia se
    // forkou — igual ao que o clone já faz com band.dimension_id.
    const dimensionId = !data.dimension_id ? null : (forked ? dimensionIdMap.get(data.dimension_id) ?? null : data.dimension_id);
    const { id, version_id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("test_result_bands")
      .upsert({ ...rest, ...(targetId ? { id: targetId } : {}), version_id: versionId, dimension_id: dimensionId })
      .select().single();
    if (error) throw new Error(error.message);
    return { ...row, forked, new_version_id: forked ? versionId : null };
  });

export const deleteBand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const origemVersionId = await versionIdDaFaixa(context.supabase, data.id);
    const { versionId, forked, bandIdMap } = await versaoEditavelPara(context.supabase, origemVersionId);
    const targetId = forked ? bandIdMap.get(data.id) : data.id;
    if (!targetId) throw new Error("Não foi possível localizar a faixa na nova versão.");
    const { error } = await context.supabase.from("test_result_bands").delete().eq("id", targetId);
    if (error) throw new Error(error.message);
    return { ok: true, forked, new_version_id: forked ? versionId : null };
  });

// ============================================================
// #212 Fase 4, Fatia 2 — Painel de respostas
// ============================================================

/** Sobe até a raiz da linhagem (encadeada por forked_from_id) e desce
 * juntando TODAS as versões — pra tela deixar trocar de versão sem
 * misturar contagem de uma com a de outra (#212 F2 item 7). */
async function linhagemDaVersao(
  supabase: SupabaseClient<Database>, versionId: string, forkedFromId: string | null,
): Promise<Array<{ id: string; title: string; is_published: boolean; created_at: string }>> {
  let raizId = versionId;
  let cursor = forkedFromId;
  const visitados = new Set([versionId]);
  for (let i = 0; i < 50 && cursor; i++) {
    if (visitados.has(cursor)) break;
    visitados.add(cursor);
    raizId = cursor;
    const { data } = await supabase.from("test_versions").select("forked_from_id").eq("id", cursor).maybeSingle();
    cursor = data?.forked_from_id ?? null;
  }

  const todas = new Map<string, { id: string; title: string; is_published: boolean; created_at: string }>();
  let nivel = [raizId];
  for (let i = 0; i < 50 && nivel.length > 0; i++) {
    const { data: linha } = await supabase
      .from("test_versions").select("id, title, is_published, created_at").in("id", nivel);
    for (const v of linha ?? []) todas.set(v.id, v);
    const { data: filhos } = await supabase
      .from("test_versions").select("id").in("forked_from_id", nivel);
    nivel = (filhos ?? []).map((f) => f.id).filter((id) => !todas.has(id));
  }
  return Array.from(todas.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Visão agregada, pergunta por pergunta, de uma versão. Em teste anônimo
 * com menos de 3 respostas SUBMETIDAS, devolve `locked: true` e não busca
 * nenhum conteúdo — a trava de verdade é a RLS de `test_answers`
 * (`pode_ver_conteudo_resposta`); isto aqui só evita a consulta à toa e
 * garante a mensagem certa mesmo se um dia essa checagem daqui divergir. */
export const getResponsesSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ version_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const { supabase } = context;

    const { data: version, error: vErr } = await supabase
      .from("test_versions").select("*").eq("id", data.version_id).maybeSingle();
    if (vErr) throw new Error(vErr.message);
    if (!version) throw new Error("Versão não encontrada");

    const lineage = await linhagemDaVersao(supabase, version.id, version.forked_from_id);

    const { data: responses, error: rErr } = await supabase
      .from("test_responses")
      .select("id, person_id, submitted_at, people(id, full_name, avatar_url)")
      .eq("version_id", data.version_id)
      .eq("kind", "self");
    if (rErr) throw new Error(rErr.message);
    const todasRespostas = responses ?? [];
    const submetidas = todasRespostas.filter((r) => r.submitted_at);
    const invited = todasRespostas.length;
    const responded = submetidas.length;
    const missing = invited - responded;
    const locked = version.is_anonymous && responded < 3;

    const { data: questions, error: qErr } = await supabase
      .from("test_questions").select("*").eq("version_id", data.version_id).order("sort_order");
    if (qErr) throw new Error(qErr.message);
    const qs = questions ?? [];
    const { data: options, error: oErr } = qs.length
      ? await supabase.from("test_options").select("*").in("question_id", qs.map((q) => q.id)).order("sort_order")
      : { data: [] as never[], error: null };
    if (oErr) throw new Error(oErr.message);
    const opts = options ?? [];
    // #212 F4 — resultados agrupados por seção; teste sem seção volta [].
    const { data: sections, error: sErr } = await supabase
      .from("test_sections").select("*").eq("version_id", data.version_id).order("sort_order");
    if (sErr) throw new Error(sErr.message);
    const secs = sections ?? [];

    const base = { version, lineage, invited, responded, missing, locked, questions: qs, options: opts, sections: secs };
    if (locked) return { ...base, aggregates: null, respondents: null };

    const submittedIds = submetidas.map((r) => r.id);
    const { data: answers, error: aErr } = submittedIds.length
      ? await supabase.from("test_answers").select("response_id, question_id, payload").in("response_id", submittedIds)
      : { data: [] as never[], error: null };
    if (aErr) throw new Error(aErr.message);
    const ans = answers ?? [];

    const aggregates = qs.map((q) => {
      const doQ = ans.filter((a) => a.question_id === q.id);
      if (q.type === "multiple_choice" || q.type === "checkboxes") {
        const counts = new Map<string, number>();
        let comResposta = 0;
        for (const a of doQ) {
          const payload = a.payload as Record<string, unknown>;
          const ids = q.type === "multiple_choice"
            ? (typeof payload.option_id === "string" ? [payload.option_id] : [])
            : (Array.isArray(payload.option_ids) ? (payload.option_ids as unknown[]).filter((x): x is string => typeof x === "string") : []);
          if (ids.length > 0) comResposta++;
          for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
        }
        const questionOptions = opts.filter((o) => o.question_id === q.id);
        return {
          question_id: q.id, type: q.type as QuestionType, total_respondentes: comResposta,
          opcoes: questionOptions.map((o) => ({
            option_id: o.id, label: o.label,
            count: counts.get(o.id) ?? 0,
            pct: comResposta > 0 ? Math.round(((counts.get(o.id) ?? 0) / comResposta) * 100) : 0,
          })),
        };
      }
      if (q.type === "linear_scale") {
        const valores = doQ
          .map((a) => (a.payload as Record<string, unknown>).value)
          .filter((v): v is number => typeof v === "number");
        const cfg = (q.config ?? {}) as Record<string, unknown>;
        const min = Number(cfg.min ?? 1);
        const max = Number(cfg.max ?? 5);
        const distribuicaoMap = new Map<number, number>();
        for (const v of valores) distribuicaoMap.set(v, (distribuicaoMap.get(v) ?? 0) + 1);
        return {
          question_id: q.id, type: q.type as QuestionType, total_respondentes: valores.length,
          media: valores.length > 0 ? Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 10) / 10 : null,
          distribuicao: Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i).map((n) => ({
            valor: n, count: distribuicaoMap.get(n) ?? 0,
          })),
        };
      }
      if (q.type === "short_text") {
        return {
          question_id: q.id, type: q.type as QuestionType,
          total_respondentes: doQ.length,
          textos: doQ
            .map((a) => ({ response_id: a.response_id, text: (a.payload as Record<string, unknown>).text }))
            .filter((t): t is { response_id: string; text: string } => typeof t.text === "string" && t.text.length > 0),
        };
      }
      return { question_id: q.id, type: q.type as QuestionType, total_respondentes: doQ.length };
    });

    // #212 F2 item 3 — lista de respondentes só existe em teste
    // IDENTIFICADO: sem person_id gravado, não há "abrir a resposta de
    // fulano" pra oferecer.
    const respondents = version.is_anonymous
      ? null
      : submetidas
          .filter((r) => r.person_id)
          .map((r) => ({
            response_id: r.id,
            person_id: r.person_id as string,
            full_name: r.people?.full_name ?? "—",
            avatar_url: r.people?.avatar_url ?? null,
            submitted_at: r.submitted_at as string,
          }));

    return { ...base, aggregates, respondents };
  });

/** #280 — corpo de `getIndividualResponse` extraído para reaproveitar no
 * download de PDF (`getIndividualResponseParaPdf`, em
 * exportar-respostas.functions.ts), que precisa da MESMA busca com uma
 * checagem de dono a mais na frente, em vez de duplicar a consulta. */
export async function carregarRespostaIndividual(supabase: SupabaseClient<Database>, responseId: string) {
  const { data: response, error: rErr } = await supabase
    .from("test_responses")
    .select("id, version_id, person_id, submitted_at, people(id, full_name, avatar_url)")
    .eq("id", responseId)
    .maybeSingle();
  if (rErr) throw new Error(rErr.message);
  if (!response) throw new Error("Resposta não encontrada.");
  if (!response.person_id) throw new Error("Este teste é anônimo — não existe visão individual.");

  const [{ data: version }, { data: questions, error: qErr }] = await Promise.all([
    supabase.from("test_versions").select("id, title").eq("id", response.version_id).maybeSingle(),
    supabase.from("test_questions").select("*").eq("version_id", response.version_id).order("sort_order"),
  ]);
  if (qErr) throw new Error(qErr.message);
  const qs = questions ?? [];
  const { data: options, error: oErr } = qs.length
    ? await supabase.from("test_options").select("*").in("question_id", qs.map((q) => q.id)).order("sort_order")
    : { data: [] as never[], error: null };
  if (oErr) throw new Error(oErr.message);
  const { data: answers, error: aErr } = await supabase
    .from("test_answers").select("question_id, payload").eq("response_id", responseId);
  if (aErr) throw new Error(aErr.message);
  const porPergunta = new Map((answers ?? []).map((a) => [a.question_id, a.payload]));

  return {
    person: response.people,
    version,
    submitted_at: response.submitted_at,
    questions: qs.map((q) => ({
      ...q,
      question_options: (options ?? []).filter((o) => o.question_id === q.id),
      payload: porPergunta.get(q.id) ?? null,
    })),
  };
}

/** Resposta de UMA pessoa, pergunta por pergunta — só existe pra teste
 * identificado (RLS de test_responses já garante que só o dono vê; aqui
 * garantimos também que não é uma resposta anônima disfarçada). */
export const getIndividualResponse = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ response_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    return carregarRespostaIndividual(context.supabase, data.response_id);
  });

/** Formata o payload de UMA pergunta no texto exibido — usado tanto no
 * diálogo do painel de respostas quanto no PDF individual (#280): mesma
 * regra por tipo, uma função só. */
export function formatarResposta(q: { type: string; question_options: Array<{ id: string; label: string }>; payload: unknown }): string {
  if (q.payload == null) return "— não respondida —";
  const payload = q.payload as Record<string, unknown>;
  if (q.type === "multiple_choice") {
    const opt = q.question_options.find((o) => o.id === payload.option_id);
    return opt?.label ?? "—";
  }
  if (q.type === "checkboxes") {
    const ids = Array.isArray(payload.option_ids) ? (payload.option_ids as unknown[]) : [];
    const labels = q.question_options.filter((o) => ids.includes(o.id)).map((o) => o.label);
    return labels.length > 0 ? labels.join(", ") : "—";
  }
  if (q.type === "linear_scale") {
    return typeof payload.value === "number" ? String(payload.value) : "—";
  }
  if (q.type === "short_text") {
    return typeof payload.text === "string" && payload.text ? payload.text : "—";
  }
  return "—";
}

// ============================================================
// Responses (mentor-authenticated)
// ============================================================
export const startResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    version_id: z.string().uuid(),
    person_id: z.string().uuid(),
    group_id: z.string().uuid().optional().nullable(),
    expires_at: z.string().datetime().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "envios");
    // Verify ownership: person must belong to this mentor, and version must be
    // either a global template or owned by this mentor.
    const [personRes, versionRes] = await Promise.all([
      context.supabase.from("people").select("id, mentor_id").eq("id", data.person_id).maybeSingle(),
      context.supabase.from("test_versions").select("id, mentor_id, is_template, is_anonymous").eq("id", data.version_id).maybeSingle(),
    ]);
    if (personRes.error) throw new Error(personRes.error.message);
    if (versionRes.error) throw new Error(versionRes.error.message);
    if (!personRes.data || personRes.data.mentor_id !== context.userId) {
      throw new Error("Pessoa não encontrada ou não pertence a você.");
    }
    const v = versionRes.data;
    if (!v || (!v.is_template && v.mentor_id !== context.userId)) {
      throw new Error("Versão de teste não encontrada ou não pertence a você.");
    }
    // #212 item 5a — teste anônimo não grava quem respondeu: o vínculo nunca
    // entra na linha, mesmo você tendo escolhido a pessoa pra endereçar o
    // link. A trava é aqui, não escondida na tela.
    const { data: row, error } = await context.supabase.from("test_responses").insert({
      version_id: data.version_id,
      person_id: v.is_anonymous ? null : data.person_id,
      group_id: data.group_id ?? null,
      mentor_id: context.userId,
      status: "pending",
      expires_at: data.expires_at ?? null,
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listResponses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    group_id: z.string().uuid().optional(),
    person_id: z.string().uuid().optional(),
    person_ids: z.array(z.string().uuid()).optional(),
  }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    // Duas telas, dois donos: a de Envios (permissão 'envios') e o painel do
    // MENTOR dentro do grupo que ele acompanha (`_app.grupos.$id.tsx`, sem
    // permissão de funcionalidade nenhuma — só o grupo atribuído). Uma
    // checagem só de permissão bloquearia o mentor.
    //
    // Para o mentor não precisa checar nada aqui: a policy `tr_mentor_all` em
    // test_responses já usa `can_see_person()`, que recorta pelos GRUPOS dele
    // (`visible_group_ids()`) — pedir sem filtro ou com o id de outro grupo
    // simplesmente não traz nada, o RLS já resolve. Só o colaborador precisa
    // da permissão explícita, porque para ele `can_see_person()` não recorta
    // nada (`member_kind() <> 'mentor'` libera geral).
    const m = await membershipDoUsuario(context.supabase, context.userId);
    if (m.kind === "colaborador" && !m.permissions.includes("envios")) {
      throw new Error("Você não tem acesso a esta área.");
    }
    if (m.kind !== "owner" && m.kind !== "colaborador" && m.kind !== "mentor") {
      throw new Error("Você não tem acesso a esta área.");
    }
    let q = context.supabase
      .from("test_responses")
      .select("*, people(id, full_name, email), test_versions(id, title, instrument_id)")
      .eq("kind", "self")
      .is("assessment_response_id", null)
      .order("created_at", { ascending: false });
    if (data.group_id) q = q.eq("group_id", data.group_id);
    if (data.person_id) q = q.eq("person_id", data.person_id);
    if (data.person_ids && data.person_ids.length > 0) q = q.in("person_id", data.person_ids);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    if (list.length === 0) return list;
    const { data: observers, error: obsErr } = await context.supabase
      .from("test_responses")
      .select("id, parent_response_id, submitted_at")
      .eq("kind", "observer")
      .in("parent_response_id", list.map((r) => r.id));
    if (obsErr) throw new Error(obsErr.message);
    const counts = new Map<string, { invited: number; answered: number }>();
    for (const o of observers ?? []) {
      if (!o.parent_response_id) continue;
      const c = counts.get(o.parent_response_id) ?? { invited: 0, answered: 0 };
      c.invited += 1;
      if (o.submitted_at) c.answered += 1;
      counts.set(o.parent_response_id, c);
    }
    // Quais versões aceitam percepção externa.
    //
    // `createObserverInvite` já recusava as que não aceitam ("Este teste não
    // suporta percepção externa"), mas o BOTÃO aparecia em todas — então a
    // pessoa descobria o limite errando, uma vez por avaliado. O critério é o
    // mesmo dos dois lados: precisa ter pergunta `forced_choice`.
    //
    // A razão de fundo não é técnica: os itens de Big Five e QI são escritos na
    // primeira pessoa ("eu me preocupo…", "qual figura completa a sequência").
    // Um observador respondendo isso responderia sobre si mesmo — e QI é
    // conhecimento, que ninguém responde no lugar do outro.
    //
    // Uma consulta para a página inteira, não uma por linha.
    const versoes = [...new Set(list.map((r) => r.version_id))];
    const { data: comEscolha, error: fcErr } = await context.supabase
      .from("test_questions")
      .select("version_id")
      .eq("type", "forced_choice")
      .in("version_id", versoes);
    if (fcErr) throw new Error(fcErr.message);
    const aceitaObservador = new Set((comEscolha ?? []).map((q) => q.version_id));

    return list.map((r) => ({
      ...r,
      observers_invited: counts.get(r.id)?.invited ?? 0,
      observers_answered: counts.get(r.id)?.answered ?? 0,
      aceita_observador: aceitaObservador.has(r.version_id),
    }));
  });

// Cria um convite de observador (percepção externa 360°) vinculado a uma
// response própria (kind='self') do mentor autenticado.
export const createObserverInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ response_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "envios");
    const { data: parent, error } = await context.supabase
      .from("test_responses")
      .select("id, kind, version_id, person_id, mentor_id")
      .eq("id", data.response_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!parent || parent.mentor_id !== context.userId) {
      throw new Error("Resposta não encontrada ou não pertence a você.");
    }
    if (parent.kind !== "self") throw new Error("Só é possível convidar observadores para a resposta do próprio avaliado.");
    const { count, error: qErr } = await context.supabase
      .from("test_questions")
      .select("id", { count: "exact", head: true })
      .eq("version_id", parent.version_id)
      .eq("type", "forced_choice");
    if (qErr) throw new Error(qErr.message);
    if (!count || count === 0) throw new Error("Este teste não suporta percepção externa.");
    const { data: row, error: insErr } = await context.supabase.from("test_responses").insert({
      version_id: parent.version_id,
      person_id: parent.person_id,
      mentor_id: context.userId,
      status: "pending",
      kind: "observer",
      parent_response_id: parent.id,
    }).select("id").single();
    if (insErr) throw new Error(insErr.message);
    return { id: row.id };
  });
// ============================================================
// Bateria unificada (assessment_responses)
// ============================================================
export const startAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    person_id: z.string().uuid(),
    version_ids: z.array(z.string().uuid()).min(1).max(10),
    group_id: z.string().uuid().optional().nullable(),
    expires_at: z.string().datetime().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "envios");
    const { supabase, userId } = context;
    const versionIds = Array.from(new Set(data.version_ids));

    const [personRes, versionsRes] = await Promise.all([
      supabase.from("people").select("id, mentor_id").eq("id", data.person_id).maybeSingle(),
      supabase.from("test_versions").select("id, mentor_id, is_template, is_anonymous").in("id", versionIds),
    ]);
    if (personRes.error) throw new Error(personRes.error.message);
    if (versionsRes.error) throw new Error(versionsRes.error.message);
    if (!personRes.data || personRes.data.mentor_id !== userId) {
      throw new Error("Pessoa não encontrada ou não pertence a você.");
    }
    const byId = new Map((versionsRes.data ?? []).map((v) => [v.id, v]));
    for (const vid of versionIds) {
      const v = byId.get(vid);
      if (!v || (!v.is_template && v.mentor_id !== userId)) {
        throw new Error("Versão de teste não encontrada ou não pertence a você.");
      }
    }

    const { data: assessment, error: aErr } = await supabase.from("assessment_responses").insert({
      mentor_id: userId,
      person_id: data.person_id,
      group_id: data.group_id ?? null,
      status: "pending",
      expires_at: data.expires_at ?? null,
    }).select("id").single();
    if (aErr) throw new Error(aErr.message);

    // #212 item 5a — cada etapa segue o anonimato da SUA versão: uma bateria
    // pode misturar teste identificado com anônimo.
    const { error: rErr } = await supabase.from("test_responses").insert(
      data.version_ids.map((version_id, idx) => ({
        version_id,
        person_id: byId.get(version_id)?.is_anonymous ? null : data.person_id,
        group_id: data.group_id ?? null,
        mentor_id: userId,
        status: "pending",
        kind: "self",
        expires_at: data.expires_at ?? null,
        assessment_response_id: assessment.id,
        assessment_sort: idx,
      })),
    );
    if (rErr) {
      await supabase.from("assessment_responses").delete().eq("id", assessment.id);
      throw new Error(rErr.message);
    }
    return { id: assessment.id };
  });

export const listAssessments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ person_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "envios");
    let q = context.supabase
      .from("assessment_responses")
      .select("*, people(id, full_name, email)")
      .order("created_at", { ascending: false });
    if (data.person_id) q = q.eq("person_id", data.person_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    if (list.length === 0) return [];
    const { data: parts, error: pErr } = await context.supabase
      .from("test_responses")
      .select("id, assessment_response_id, assessment_sort, submitted_at, test_versions(id, title, instrument_id)")
      .in("assessment_response_id", list.map((a) => a.id))
      .order("assessment_sort");
    if (pErr) throw new Error(pErr.message);
    return list.map((a) => {
      const mine = (parts ?? []).filter((p) => p.assessment_response_id === a.id);
      return {
        ...a,
        total: mine.length,
        done: mine.filter((p) => p.submitted_at).length,
        parts: mine.map((p) => ({
          response_id: p.id,
          title: p.test_versions?.title ?? "Teste",
          instrument_id: p.test_versions?.instrument_id ?? null,
          submitted: !!p.submitted_at,
        })),
      };
    });
  });

// ============================================================
// Link aberto (invite_links)
// Um único link que várias pessoas respondem, identificando-se na hora.
// ============================================================

export const createInviteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    version_ids: z.array(z.string().uuid()).min(1).max(10),
    title: z.string().trim().max(160).optional().nullable(),
    group_id: z.string().uuid().optional().nullable(),
    expires_at: z.string().datetime().optional().nullable(),
    max_responses: z.number().int().positive().max(10000).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "envios");
    const { supabase, userId } = context;
    const versionIds = Array.from(new Set(data.version_ids));

    // Mesma regra dos envios: template global ou versão do próprio mentor.
    const { data: versions, error: vErr } = await supabase
      .from("test_versions").select("id, mentor_id, is_template").in("id", versionIds);
    if (vErr) throw new Error(vErr.message);
    const byId = new Map((versions ?? []).map((v) => [v.id, v]));
    for (const vid of versionIds) {
      const v = byId.get(vid);
      if (!v || (!v.is_template && v.mentor_id !== userId)) {
        throw new Error("Versão de teste não encontrada ou não pertence a você.");
      }
    }
    if (data.group_id) {
      const { data: g } = await supabase
        .from("groups").select("id, mentor_id").eq("id", data.group_id).maybeSingle();
      if (!g || g.mentor_id !== userId) throw new Error("Grupo não encontrado ou não pertence a você.");
    }

    const { data: row, error } = await supabase.from("invite_links").insert({
      mentor_id: userId,
      title: data.title?.trim() || null,
      version_ids: versionIds,
      group_id: data.group_id ?? null,
      expires_at: data.expires_at ?? null,
      max_responses: data.max_responses ?? null,
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listInviteLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPermissao(context.supabase, context.userId, "envios");
    // ⚠️ Mesma correção de getPerson/getDashboardStats: `mentor_id` é a
    // CONTA, não quem está logado — um colaborador com Envios via esta lista
    // sempre vazia.
    const { data: conta } = await context.supabase.rpc("acting_account");
    const { data, error } = await context.supabase
      .from("invite_links")
      .select("*, groups(name)")
      .eq("mentor_id", conta ?? context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setInviteLinkActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "envios");
    const { data: conta } = await context.supabase.rpc("acting_account");
    const { data: row, error } = await context.supabase
      .from("invite_links")
      .update({ is_active: data.is_active })
      .eq("id", data.id)
      .eq("mentor_id", conta ?? context.userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ============================================================
// Reteste autorizado
// O avaliado só refaz quando o mentor libera. Cada autorização cria uma NOVA
// aplicação encadeada à anterior — nada é sobrescrito, o histórico fica inteiro.
// ============================================================

export const authorizeRetake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    response_id: z.string().uuid(),
    expires_at: z.string().datetime().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "envios");
    const { supabase, userId } = context;
    const { data: prev, error } = await supabase
      .from("test_responses")
      .select("id, person_id, version_id, group_id, mentor_id, attempt, submitted_at")
      .eq("id", data.response_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!prev || prev.mentor_id !== userId) throw new Error("Resposta não encontrada ou não pertence a você.");
    if (!prev.submitted_at) throw new Error("Esta aplicação ainda não foi concluída. Não há o que refazer.");

    const { data: row, error: insErr } = await supabase.from("test_responses").insert({
      version_id: prev.version_id,
      person_id: prev.person_id,
      group_id: prev.group_id,
      mentor_id: userId,
      kind: "self",
      status: "pending",
      attempt: (prev.attempt ?? 1) + 1,
      previous_response_id: prev.id,
      expires_at: data.expires_at ?? null,
    }).select().single();
    if (insErr) throw new Error(insErr.message);
    return row;
  });

export const authorizeRetakeAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    assessment_id: z.string().uuid(),
    expires_at: z.string().datetime().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "envios");
    const { supabase, userId } = context;
    const { data: prev, error } = await supabase
      .from("assessment_responses")
      .select("id, person_id, group_id, mentor_id, attempt")
      .eq("id", data.assessment_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!prev || prev.mentor_id !== userId) throw new Error("Bateria não encontrada ou não pertence a você.");

    // Refaz exatamente os mesmos testes, na mesma ordem da aplicação anterior.
    const { data: parts, error: pErr } = await supabase
      .from("test_responses")
      .select("version_id, assessment_sort")
      .eq("assessment_response_id", prev.id)
      .order("assessment_sort");
    if (pErr) throw new Error(pErr.message);
    if (!parts || parts.length === 0) throw new Error("Bateria sem testes para refazer.");

    const { data: assessment, error: aErr } = await supabase.from("assessment_responses").insert({
      mentor_id: userId,
      person_id: prev.person_id,
      group_id: prev.group_id,
      status: "pending",
      attempt: (prev.attempt ?? 1) + 1,
      previous_assessment_id: prev.id,
      expires_at: data.expires_at ?? null,
    }).select("id").single();
    if (aErr) throw new Error(aErr.message);

    const { error: rErr } = await supabase.from("test_responses").insert(
      parts.map((p, idx) => ({
        version_id: p.version_id,
        person_id: prev.person_id,
        group_id: prev.group_id,
        mentor_id: userId,
        kind: "self",
        status: "pending",
        assessment_response_id: assessment.id,
        assessment_sort: p.assessment_sort ?? idx,
        attempt: (prev.attempt ?? 1) + 1,
        expires_at: data.expires_at ?? null,
      })),
    );
    if (rErr) throw new Error(rErr.message);
    return assessment;
  });

// ============================================================
// Cancelar e excluir envio
// ============================================================
/**
 * Cancelar ≠ excluir.
 *
 * Cancelar derruba o link e mantém o registro — é reversível, e é o que se
 * quer quando o envio foi para a pessoa errada ou a aplicação foi adiada.
 * Excluir some com tudo, inclusive respostas e relatório.
 */
export const setResponseCanceled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), canceled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "envios");
    const { data: row, error } = await context.supabase
      .from("test_responses")
      .update({ canceled_at: data.canceled ? new Date().toISOString() : null })
      .eq("id", data.id)
      .select("id, canceled_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const setAssessmentCanceled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), canceled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "envios");
    const quando = data.canceled ? new Date().toISOString() : null;
    const { data: row, error } = await context.supabase
      .from("assessment_responses")
      .update({ canceled_at: quando })
      .eq("id", data.id)
      .select("id, canceled_at")
      .single();
    if (error) throw new Error(error.message);
    // As etapas acompanham a bateria: cancelar a bateria e deixar as etapas
    // abertas deixaria o link de cada teste ainda funcionando.
    const { error: pErr } = await context.supabase
      .from("test_responses")
      .update({ canceled_at: quando })
      .eq("assessment_response_id", data.id);
    if (pErr) throw new Error(pErr.message);
    return row;
  });

export const deleteResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "envios");
    const { error } = await context.supabase.from("test_responses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "envios");
    // As etapas caem junto pela FK (ON DELETE CASCADE).
    const { error } = await context.supabase.from("assessment_responses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
