/**
 * ASSISTENTE DO MÉTODO INTENÇÃO — Nível 1 (#289): o aluno conversa sobre o PRÓPRIO relatório.
 * Nível 2 (#305): ela passa a ler também o que o aluno tem na plataforma (`assistente/plataforma.server.ts`,
 * sempre com o login dele) e as observações do mentor (`assistente-observacoes.functions.ts`).
 *
 * Regras que valem para TODAS as funções daqui:
 * - Nenhuma recebe id de pessoa ou de login vindo do navegador. Quem é "o aluno" é sempre o login
 *   da sessão (`context.userId`). Por isso a prévia "ver como aluno" não tem como abrir conversa de
 *   ninguém: ela roda com o login do MENTOR.
 * - Toda LEITURA de conversa usa o cliente com o login do aluno — quem decide o que volta é a RLS
 *   (`user_id = auth.uid()`), não um filtro aqui. As escritas usam o service role, depois de conferir
 *   consentimento e liberação; o banco ainda recusa gravar sem consentimento ativo (gatilho).
 * - O mentor não tem função nenhuma aqui. Não existe caminho de leitura de conversa para ele. As
 *   observações que ele escreve (#305) vão num sentido só: dele para a assistente.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { MensagemDoHistorico } from "@/lib/assistente/modelo.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ERROS_DA_ASSISTENTE } from "@/lib/assistente/textos";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Situacao = {
  liberada: boolean;
  tem_relatorio: boolean;
  termo_publicado: boolean;
  consentimento_ativo: boolean;
  tem_historico: boolean;
};

export type SituacaoDaAssistente = Situacao & {
  /** Pode aceitar o termo e conversar agora. */
  pode_comecar: boolean;
  /** O item aparece no menu: pode começar, OU já tem dados guardados (ver, apagar, baixar, revogar). */
  no_menu: boolean;
};

type Cliente = SupabaseClient<Database>;

async function lerSituacao(supabase: Cliente): Promise<SituacaoDaAssistente> {
  const { data, error } = await supabase.rpc("assistente_situacao");
  if (error) throw new Error(`Não foi possível consultar a assistente (${error.message}).`);
  const s = data as unknown as Situacao;
  const pode_comecar = s.liberada && s.tem_relatorio && s.termo_publicado;
  return { ...s, pode_comecar, no_menu: pode_comecar || s.consentimento_ativo || s.tem_historico };
}

async function contaDoAluno(supabase: Cliente, userId: string): Promise<string> {
  const { data, error } = await supabase.rpc("conta_do_autor", { p_author_id: userId });
  if (error || !data) throw new Error(`Não foi possível identificar a conta do aluno (${error?.message ?? "vazio"}).`);
  return data as string;
}

/** Para o menu: uma chamada leve. */
export const situacaoDaAssistente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => lerSituacao(context.supabase));

export type ConversaResumo = { id: string; titulo: string; criada_em: string; atualizada_em: string };
export type Mensagem = { id: string; papel: "aluno" | "assistente"; conteudo: string; criada_em: string };

/** Tudo o que a página precisa ao abrir: situação, termo (se ainda não aceitou) e a lista de conversas. */
export const carregarAssistente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const situacao = await lerSituacao(supabase);

    const { data: consentimento, error: cErr } = await supabase
      .from("assistente_consentimentos")
      .select("id, termo_versao, aceito_em")
      .eq("user_id", userId)
      .is("revogado_em", null)
      .maybeSingle();
    if (cErr) throw new Error(`Não foi possível ler a sua autorização (${cErr.message}).`);

    const { data: conversas, error: vErr } = await supabase
      .from("assistente_conversas")
      .select("id, titulo, criada_em, atualizada_em")
      .eq("user_id", userId)
      .order("atualizada_em", { ascending: false });
    if (vErr) throw new Error(`Não foi possível ler as suas conversas (${vErr.message}).`);

    let termo: { id: string; versao: number; texto: string; rotulo_aceite: string } | null = null;
    if (!consentimento && situacao.pode_comecar) {
      const { data: t, error: tErr } = await supabase
        .from("assistente_termos")
        .select("id, versao, texto, rotulo_aceite")
        .eq("status", "publicado")
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (tErr) throw new Error(`Não foi possível ler o termo (${tErr.message}).`);
      termo = t;
    }

    return {
      situacao,
      consentimento: consentimento ?? null,
      termo,
      conversas: (conversas ?? []) as ConversaResumo[],
    };
  });

/** Aceite explícito do termo. O banco copia versão e texto da linha do termo — o cliente só aponta qual. */
export const aceitarTermo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ termo_id: z.string().uuid(), aceito: z.literal(true) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const situacao = await lerSituacao(supabase);
    if (situacao.consentimento_ativo) return { ok: true as const };
    if (!situacao.pode_comecar) throw new Error(ERROS_DA_ASSISTENTE.naoLiberada);

    const { data: termo, error: tErr } = await supabase
      .from("assistente_termos")
      .select("id, versao, texto, rotulo_aceite")
      .eq("id", data.termo_id)
      .eq("status", "publicado")
      .maybeSingle();
    if (tErr) throw new Error(`Não foi possível ler o termo (${tErr.message}).`);
    if (!termo) throw new Error("Este termo não está mais em vigor. Recarregue a página.");

    const conta = await contaDoAluno(supabase, userId);
    const db = await admin();
    const { error } = await db.from("assistente_consentimentos").insert({
      user_id: userId,
      conta_id: conta,
      termo_id: termo.id,
      termo_versao: termo.versao,
      texto_aceito: termo.texto,
      rotulo_aceito: termo.rotulo_aceite,
    });
    // 23505 = já havia um consentimento ativo (duplo clique): o resultado é o mesmo.
    if (error && error.code !== "23505") {
      throw new Error(
        error.message.includes("versão mais nova")
          ? "Este termo foi atualizado. Recarregue a página para ler a versão nova."
          : `Não foi possível registrar a autorização (${error.message}).`,
      );
    }
    return { ok: true as const };
  });

export const abrirConversa = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ conversa_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: msgs, error } = await context.supabase
      .from("assistente_mensagens")
      .select("id, papel, conteudo, criada_em")
      .eq("conversa_id", data.conversa_id)
      .eq("user_id", context.userId)
      .order("criada_em")
      .order("id");
    if (error) throw new Error(`Não foi possível abrir a conversa (${error.message}).`);
    return (msgs ?? []) as Mensagem[];
  });

const MAX_HISTORICO = 40;

function tituloDe(texto: string): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= 60) return limpo;
  const corte = limpo.slice(0, 60);
  return `${corte.slice(0, corte.lastIndexOf(" ") > 30 ? corte.lastIndexOf(" ") : 60)}…`;
}

/**
 * Uma pergunta do aluno. Se o modelo falhar, a pergunta NÃO fica guardada (a tela devolve o texto
 * para a caixa e o aluno tenta de novo) — nada de histórico com pergunta sem resposta.
 */
export const enviarMensagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      conversa_id: z.string().uuid().nullable().optional(),
      texto: z.string().trim().min(1).max(4000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const servidor = await import("@/lib/assistente/assistente.server");

    const situacao = await lerSituacao(supabase);
    if (!situacao.consentimento_ativo) throw new Error(ERROS_DA_ASSISTENTE.semConsentimento);
    if (!situacao.liberada) throw new Error(ERROS_DA_ASSISTENTE.naoLiberada);
    // Não dá mais para checar "tem chave?" antes de montar o contexto — a chave mora na edge
    // function, do outro lado da rede. Se estiver desligada, `perguntarAoModelo` cai no catch
    // abaixo com AssistenteDesligada, exatamente com o mesmo aviso final para o aluno.

    const db = await admin();
    const { nome, pessoas, relatorios } = await servidor.relatoriosDoAluno(supabase, db, userId);
    if (relatorios.length === 0) throw new Error(ERROS_DA_ASSISTENTE.semRelatorio);
    const conta = await contaDoAluno(supabase, userId);
    const contexto = await servidor.montarContexto({ supabase, admin: db, userId, conta, nome, pessoas, relatorios });

    // A conversa: a existente (lida com o login do aluno — se não for dele, não volta) ou uma nova.
    let conversaId = data.conversa_id ?? null;
    let conversaNova = false;
    if (conversaId) {
      const { data: c, error } = await supabase
        .from("assistente_conversas")
        .select("id")
        .eq("id", conversaId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(`Não foi possível abrir a conversa (${error.message}).`);
      if (!c) throw new Error(ERROS_DA_ASSISTENTE.conversaNaoEncontrada);
    } else {
      const { data: c, error } = await db
        .from("assistente_conversas")
        .insert({ user_id: userId, conta_id: conta, titulo: tituloDe(data.texto) })
        .select("id")
        .single();
      if (error || !c) throw new Error(`Não foi possível criar a conversa (${error?.message}).`);
      conversaId = c.id;
      conversaNova = true;
    }

    const { data: anteriores, error: hErr } = await supabase
      .from("assistente_mensagens")
      .select("papel, conteudo")
      .eq("conversa_id", conversaId)
      .eq("user_id", userId)
      .order("criada_em", { ascending: false })
      .order("id", { ascending: false })
      .limit(MAX_HISTORICO);
    if (hErr) throw new Error(`Não foi possível ler a conversa (${hErr.message}).`);

    const { data: pergunta, error: pErr } = await db
      .from("assistente_mensagens")
      .insert({ conversa_id: conversaId, user_id: userId, conta_id: conta, papel: "aluno", conteudo: data.texto })
      .select("id, papel, conteudo, criada_em")
      .single();
    if (pErr || !pergunta) throw new Error(`Não foi possível guardar a pergunta (${pErr?.message}).`);

    const historico: MensagemDoHistorico[] = (anteriores ?? [])
      .reverse()
      .map((m) => ({ role: m.papel === "aluno" ? ("user" as const) : ("assistant" as const), content: m.conteudo }));
    while (historico.length && historico[0].role !== "user") historico.shift();
    historico.push({ role: "user", content: data.texto });

    let resposta: Awaited<ReturnType<typeof servidor.perguntarAoModelo>>;
    try {
      resposta = await servidor.perguntarAoModelo(contexto, historico);
    } catch (e) {
      await db.from("assistente_mensagens").delete().eq("id", pergunta.id);
      if (conversaNova) await db.from("assistente_conversas").delete().eq("id", conversaId);
      await db.from("assistente_uso").insert({
        user_id: userId, conta_id: conta, conversa_id: conversaNova ? null : conversaId,
        modelo: servidor.MODELO_DA_ASSISTENTE, erro: servidor.resumoDoErro(e),
      });
      console.error("[assistente] falha ao responder:", servidor.resumoDoErro(e));
      throw new Error(e instanceof servidor.AssistenteDesligada ? ERROS_DA_ASSISTENTE.desligada : ERROS_DA_ASSISTENTE.falhou);
    }

    const texto =
      resposta.stopReason === "refusal" || !resposta.texto ? ERROS_DA_ASSISTENTE.recusa : resposta.texto;

    const { data: dita, error: aErr } = await db
      .from("assistente_mensagens")
      .insert({ conversa_id: conversaId, user_id: userId, conta_id: conta, papel: "assistente", conteudo: texto })
      .select("id, papel, conteudo, criada_em")
      .single();
    if (aErr || !dita) throw new Error(`Não foi possível guardar a resposta (${aErr?.message}).`);

    const [{ error: uErr }, { error: cErr }] = await Promise.all([
      db.from("assistente_uso").insert({
        user_id: userId, conta_id: conta, conversa_id: conversaId,
        modelo: servidor.MODELO_DA_ASSISTENTE, stop_reason: resposta.stopReason, duracao_ms: resposta.ms,
        ...resposta.uso,
      }),
      db.from("assistente_conversas").update({ atualizada_em: new Date().toISOString() }).eq("id", conversaId),
    ]);
    if (uErr) console.error("[assistente] registro de uso falhou:", uErr.message);
    if (cErr) console.error("[assistente] data da conversa não atualizou:", cErr.message);

    return { conversa_id: conversaId as string, mensagens: [pergunta, dita] as Mensagem[] };
  });

export const apagarConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ conversa_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Com o login do aluno: a RLS só deixa apagar o que é dele.
    const { data: apagadas, error } = await context.supabase
      .from("assistente_conversas")
      .delete()
      .eq("id", data.conversa_id)
      .eq("user_id", context.userId)
      .select("id");
    if (error) throw new Error(`Não foi possível apagar a conversa (${error.message}).`);
    if (!apagadas?.length) throw new Error(ERROS_DA_ASSISTENTE.conversaNaoEncontrada);
    return { ok: true as const };
  });

export const apagarTodasAsConversas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.from("assistente_conversas").delete().eq("user_id", context.userId);
    if (error) throw new Error(`Não foi possível apagar o histórico (${error.message}).`);
    return { ok: true as const };
  });

/** Revogar: uma operação só no banco — marca a revogação e apaga o histórico junto. */
export const revogarAssistente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.rpc("assistente_revogar");
    if (error) throw new Error(`Não foi possível retirar a autorização (${error.message}).`);
    return { ok: true as const };
  });

/** "Ver tudo o que a assistente guardou" e a cópia para baixar: autorizações + todas as conversas. */
export const meusDadosDaAssistente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: consentimentos, error: cErr }, { data: conversas, error: vErr }, { data: mensagens, error: mErr }] =
      await Promise.all([
        supabase
          .from("assistente_consentimentos")
          .select("termo_versao, texto_aceito, rotulo_aceito, aceito_em, revogado_em")
          .eq("user_id", userId)
          .order("aceito_em"),
        supabase
          .from("assistente_conversas")
          .select("id, titulo, criada_em, atualizada_em")
          .eq("user_id", userId)
          .order("criada_em"),
        supabase
          .from("assistente_mensagens")
          .select("conversa_id, papel, conteudo, criada_em")
          .eq("user_id", userId)
          .order("criada_em")
          .order("id"),
      ]);
    const erro = cErr ?? vErr ?? mErr;
    if (erro) throw new Error(`Não foi possível reunir os seus dados (${erro.message}).`);
    return {
      consentimentos: consentimentos ?? [],
      conversas: (conversas ?? []).map((c) => ({
        ...c,
        mensagens: (mensagens ?? []).filter((m) => m.conversa_id === c.id).map(({ conversa_id: _, ...m }) => m),
      })),
    };
  });
