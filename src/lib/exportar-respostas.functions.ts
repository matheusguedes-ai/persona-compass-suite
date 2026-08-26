/**
 * #280 — aba Respostas: listar testes com resposta, listar quem respondeu um
 * template, e os dois downloads (planilha completa e PDF individual).
 *
 * Regra que atravessa o arquivo inteiro: SÓ O DONO baixa (decisão do
 * Matheus, 25/08). Colaborador com a permissão "testes" continua vendo a
 * lista e abrindo o painel/relatório — a trava de download é sempre checada
 * aqui dentro (`exigirDonoParaBaixar`), nunca só escondendo o botão na tela.
 *
 * A trava de anonimato (3+ respostas SUBMETIDAS) não precisa de código novo:
 * quem consulta test_answers usa o cliente autenticado normal, e a RLS
 * (`pode_ver_conteudo_resposta`, #212 F2) já barra sozinha o conteúdo. Teste
 * anônimo nunca tem interpretação (constraint do banco,
 * `test_versions_anonimo_sem_interpretacao`), e por isso nunca é template —
 * as regras de anonimato só entram em jogo para teste do construtor.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissao } from "@/lib/permissao.server";
import { membershipDoUsuario } from "@/lib/team.functions";
import { carregarRespostaIndividual } from "@/lib/tests.functions";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function exigirDonoParaBaixar(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const m = await membershipDoUsuario(supabase, userId);
  if (m.kind !== "owner") {
    throw new Error(
      "Só o dono da conta pode baixar respostas — colaborador vê a tela, mas o arquivo é restrito ao dono.",
    );
  }
}

const MARCAS_DIACRITICAS = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(texto: string): string {
  return (
    texto
      .normalize("NFD")
      .replace(MARCAS_DIACRITICAS, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "teste"
  );
}

// ============================================================
// 1) Lista da aba — um teste por linha, só os que têm resposta
// ============================================================
export const listRespostasPorTeste = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const { supabase } = context;

    // "Tem resposta" = tem pelo menos uma SUBMETIDA — pendente/em andamento
    // não conta (mesmo critério de getResponsesSummary/pode_ver_conteudo_resposta).
    const { data: rows, error } = await supabase
      .from("test_responses")
      .select(
        "version_id, submitted_at, test_versions(id, title, is_template, is_anonymous, created_at)",
      )
      .eq("kind", "self")
      .not("submitted_at", "is", null);
    if (error) throw new Error(error.message);

    type Agrupado = {
      version_id: string;
      title: string;
      is_template: boolean;
      is_anonymous: boolean;
      version_created_at: string;
      respostas: number;
      ultima_resposta: string;
    };
    const porVersao = new Map<string, Agrupado>();
    for (const r of rows ?? []) {
      const v = r.test_versions;
      if (!v || !r.submitted_at) continue;
      const atual = porVersao.get(v.id);
      if (!atual) {
        porVersao.set(v.id, {
          version_id: v.id,
          title: v.title,
          is_template: v.is_template,
          is_anonymous: v.is_anonymous,
          version_created_at: v.created_at,
          respostas: 1,
          ultima_resposta: r.submitted_at,
        });
      } else {
        atual.respostas++;
        if (r.submitted_at > atual.ultima_resposta) atual.ultima_resposta = r.submitted_at;
      }
    }
    return Array.from(porVersao.values()).sort((a, b) =>
      b.ultima_resposta.localeCompare(a.ultima_resposta),
    );
  });

// ============================================================
// 2) Quem respondeu um teste TEMPLATE — o clique da linha, para decidir
// entre /relatorio/$responseId e /relatorio-bateria/$assessmentId (mesma
// escolha que a ficha da pessoa já faz em buildHistory, _app.pessoas.$id.tsx).
// ============================================================
export const listRespondentesDoTeste = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ version_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    const { supabase } = context;
    const { data: version, error: vErr } = await supabase
      .from("test_versions")
      .select("id, title, is_anonymous")
      .eq("id", data.version_id)
      .maybeSingle();
    if (vErr) throw new Error(vErr.message);
    if (!version) throw new Error("Versão não encontrada");
    if (version.is_anonymous) throw new Error("Teste anônimo não tem lista de respondentes.");

    const { data: rows, error } = await supabase
      .from("test_responses")
      .select("id, assessment_response_id, submitted_at, people(id, full_name, avatar_url)")
      .eq("version_id", data.version_id)
      .eq("kind", "self")
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false });
    if (error) throw new Error(error.message);

    // #281 — bucket 'avatares' é privado: sem assinar, o círculo de foto vira
    // sempre a inicial, mesmo para quem já subiu a foto.
    const linhas = rows ?? [];
    const { assinarUrls, TTL_AVATAR_SEGUNDOS } = await import("@/lib/storage-assinado.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const avatares = await assinarUrls(
      supabaseAdmin, linhas.map((r) => r.people?.avatar_url ?? null), TTL_AVATAR_SEGUNDOS,
    );

    return {
      title: version.title,
      respondentes: linhas.map((r, i) => ({
        response_id: r.id,
        assessment_response_id: r.assessment_response_id,
        full_name: r.people?.full_name ?? "—",
        avatar_url: avatares[i],
        submitted_at: r.submitted_at as string,
      })),
    };
  });

// ============================================================
// 3) Planilha completa — uma linha por pessoa, uma coluna por pergunta
// ============================================================
function textoDaResposta(
  q: { id: string; type: string },
  opts: Array<{ id: string; question_id: string; label: string }>,
  payload: unknown,
): string {
  if (payload == null) return "";
  const p = payload as Record<string, unknown>;
  const optLabel = (id: unknown) => opts.find((o) => o.id === id)?.label ?? "";
  switch (q.type) {
    case "multiple_choice":
      return optLabel(p.option_id);
    case "checkboxes": {
      const ids = Array.isArray(p.option_ids) ? (p.option_ids as unknown[]) : [];
      return ids.map(optLabel).filter(Boolean).join("; ");
    }
    case "linear_scale":
      return typeof p.value === "number" ? String(p.value) : "";
    case "short_text":
      return typeof p.text === "string" ? p.text : "";
    // Só templates usam estes três tipos (TIPOS_SEM_INTERPRETACAO exclui os
    // três de teste do construtor) — mesmos nomes de campo do payload que
    // api.public.response.$id.ts grava.
    case "ranking":
    case "drag_order": {
      const ids = Array.isArray(p.ordered_option_ids) ? (p.ordered_option_ids as unknown[]) : [];
      return ids.map((id, i) => `${i + 1}º: ${optLabel(id)}`).join("; ");
    }
    case "forced_choice":
      return `Mais: ${optLabel(p.most_option_id)} · Menos: ${optLabel(p.least_option_id)}`;
    default:
      return "";
  }
}

export const baixarPlanilhaDeRespostas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ version_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    await exigirDonoParaBaixar(context.supabase, context.userId);
    const { supabase, userId } = context;

    const { data: version, error: vErr } = await supabase
      .from("test_versions")
      .select("id, title, is_anonymous, created_at")
      .eq("id", data.version_id)
      .maybeSingle();
    if (vErr) throw new Error(vErr.message);
    if (!version) throw new Error("Versão não encontrada");

    const { data: questions, error: qErr } = await supabase
      .from("test_questions")
      .select("id, prompt, type")
      .eq("version_id", data.version_id)
      .order("sort_order");
    if (qErr) throw new Error(qErr.message);
    const qs = questions ?? [];
    const { data: options, error: oErr } = qs.length
      ? await supabase
          .from("test_options")
          .select("id, question_id, label")
          .in(
            "question_id",
            qs.map((q) => q.id),
          )
      : { data: [] as never[], error: null };
    if (oErr) throw new Error(oErr.message);
    const opts = options ?? [];

    const { data: responses, error: rErr } = await supabase
      .from("test_responses")
      .select("id, submitted_at, people(full_name)")
      .eq("version_id", data.version_id)
      .eq("kind", "self")
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: true });
    if (rErr) throw new Error(rErr.message);
    const resps = responses ?? [];

    // Mesma trava do painel (#212 F2): teste anônimo com menos de 3
    // respostas não libera conteúdo — a RLS de test_answers bloquearia de
    // qualquer forma; isto só dá o aviso certo antes de tentar.
    if (version.is_anonymous && resps.length < 3) {
      throw new Error(
        `Este teste é anônimo e tem só ${resps.length} resposta(s) — o arquivo libera com 3.`,
      );
    }
    if (resps.length === 0) throw new Error("Este teste ainda não tem resposta nenhuma.");

    const { data: answers, error: aErr } = await supabase
      .from("test_answers")
      .select("response_id, question_id, payload")
      .in(
        "response_id",
        resps.map((r) => r.id),
      );
    if (aErr) throw new Error(aErr.message);

    const porResposta = new Map<string, Map<string, unknown>>();
    for (const a of answers ?? []) {
      const m = porResposta.get(a.response_id) ?? new Map<string, unknown>();
      m.set(a.question_id, a.payload);
      porResposta.set(a.response_id, m);
    }

    // Cabeçalho = enunciado da pergunta; duplicado ganha um número, senão uma
    // coluna apagaria a outra em silêncio.
    const vistos = new Map<string, number>();
    const cabecalhos = qs.map((q) => {
      const base = q.prompt.trim() || "Pergunta sem texto";
      const n = (vistos.get(base) ?? 0) + 1;
      vistos.set(base, n);
      return n > 1 ? `${base} (${n})` : base;
    });

    // #280 regra 5a — teste anônimo: nem nome, nem e-mail, nem identificador,
    // nem data/hora exata. Só o dado da resposta, com um rótulo sem nexo com
    // ninguém ("#1", "#2"...) em vez de nome.
    const linhas = resps.map((r, i) => {
      const porPergunta = porResposta.get(r.id) ?? new Map<string, unknown>();
      const linha: Record<string, string> = version.is_anonymous
        ? { Resposta: `#${i + 1}` }
        : {
            Nome: r.people?.full_name ?? "—",
            "Respondido em": new Date(r.submitted_at as string).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            }),
          };
      qs.forEach((q, idx) => {
        linha[cabecalhos[idx]] = textoDaResposta(q, opts, porPergunta.get(q.id));
      });
      return linha;
    });

    // Quem baixou e quando vai no rastro (export_logs) — não bloqueia o
    // download se falhar, mesmo padrão de dadosParaExportar (Pessoas).
    const { data: ownerId } = await supabase.rpc("acting_account");
    if (ownerId) {
      const { error: erroRastro } = await supabase.from("export_logs").insert({
        owner_id: ownerId,
        exported_by: userId,
        kind: "respostas",
        formato: "xlsx",
        row_count: linhas.length,
      });
      if (erroRastro) console.error("Falha ao gravar rastro de exportação:", erroRastro.message);
    }

    const dataVersao = new Date(version.created_at).toLocaleDateString("pt-BR");
    return {
      linhas,
      // #280 regra 3 — o nome do arquivo deixa claro de qual VERSÃO ele é,
      // pra não ter dúvida quando o mesmo teste tem mais de uma.
      nome_arquivo: `respostas-${slugify(version.title)}-v${dataVersao.replace(/\//g, "-")}.xlsx`,
      titulo: version.title,
      data_versao: dataVersao,
    };
  });

// ============================================================
// 4) PDF individual (construtor, pergunta a pergunta) — mesmo mecanismo do
// resto da plataforma (impressão do navegador com PRINT_CSS, ver
// src/routes/_app.testes.$versionId.respostas.$responseId.tsx). Nenhuma
// biblioteca de PDF nova.
// ============================================================
export const getIndividualResponseParaPdf = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ response_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissao(context.supabase, context.userId, "testes");
    await exigirDonoParaBaixar(context.supabase, context.userId);
    const resultado = await carregarRespostaIndividual(context.supabase, data.response_id);

    const { data: ownerId } = await context.supabase.rpc("acting_account");
    if (ownerId) {
      const { error: erroRastro } = await context.supabase.from("export_logs").insert({
        owner_id: ownerId,
        exported_by: context.userId,
        kind: "respostas",
        formato: "pdf",
        row_count: 1,
      });
      if (erroRastro) console.error("Falha ao gravar rastro de exportação:", erroRastro.message);
    }
    return resultado;
  });
