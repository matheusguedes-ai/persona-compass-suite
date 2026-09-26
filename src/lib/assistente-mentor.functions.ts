/**
 * ASSISTENTE DO MENTOR (#307) — o dono da conta conversa sobre os RESULTADOS e o USO DA PLATAFORMA
 * dos alunos dele. É outra assistente, com outras conversas: nada aqui lê nem grava nas tabelas da
 * assistente do aluno (`assistente_conversas`, `assistente_mensagens`, `assistente_consentimentos`).
 * As conversas dos alunos com a assistente DELES não chegam a este arquivo por caminho nenhum.
 *
 * Regras que valem para TODAS as funções daqui:
 * - Nenhuma recebe id de pessoa, de conta ou de login vindo do navegador. Quem pergunta é o login da
 *   sessão (`context.userId`), e o portão é o banco (`assistente_mentor_liberada`: dono da conta,
 *   agindo pela própria conta, com alunos). Hoje a conta é o próprio dono.
 * - Os DADOS DA CONTA são lidos com o LOGIN do mentor (`assistente-mentor/dados.server.ts`): quem
 *   decide o que volta é a RLS de cada tabela — a mesma que alimenta o painel. Aluno de outra conta
 *   não volta porque o login do mentor não o enxerga, não porque um filtro aqui o tirou.
 * - Leitura de conversa: com o login do mentor (RLS `user_id = auth.uid()`). Escrita: chave de
 *   serviço, depois do portão; e o banco ainda recusa gravar para quem não é dono com alunos (gatilho).
 * - O registro de custo (`assistente_uso`, escopo 'mentor') guarda só números — nunca o texto.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MensagemDoHistorico } from "@/lib/assistente/modelo.server";
import { ERROS_DA_ASSISTENTE_DO_MENTOR as ERROS } from "@/lib/assistente-mentor/textos";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Cliente = SupabaseClient<Database>;

async function liberada(supabase: Cliente): Promise<boolean> {
  const { data, error } = await supabase.rpc("assistente_mentor_liberada");
  if (error) throw new Error(`Não foi possível consultar a assistente (${error.message}).`);
  return data === true;
}

/** Para o menu: uma chamada leve. */
export const situacaoDaAssistenteDoMentor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ liberada: await liberada(context.supabase) }));

export type ConversaDoMentor = { id: string; titulo: string; criada_em: string; atualizada_em: string };
export type MensagemDoMentor = { id: string; papel: "mentor" | "assistente"; conteudo: string; criada_em: string };

/** Tudo o que a página precisa ao abrir: se está liberada e a lista de conversas DO PRÓPRIO mentor. */
export const carregarAssistenteDoMentor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const ok = await liberada(supabase);
    const { data, error } = await supabase
      .from("assistente_mentor_conversas")
      .select("id, titulo, criada_em, atualizada_em")
      .eq("user_id", userId)
      .order("atualizada_em", { ascending: false })
      .order("id");
    if (error) throw new Error(`Não foi possível ler as suas conversas (${error.message}).`);
    return { liberada: ok, conversas: (data ?? []) as ConversaDoMentor[] };
  });

export const abrirConversaDoMentor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ conversa_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: msgs, error } = await context.supabase
      .from("assistente_mentor_mensagens")
      .select("id, papel, conteudo, criada_em")
      .eq("conversa_id", data.conversa_id)
      .eq("user_id", context.userId)
      .order("criada_em")
      .order("id");
    if (error) throw new Error(`Não foi possível abrir a conversa (${error.message}).`);
    return (msgs ?? []) as MensagemDoMentor[];
  });

const MAX_HISTORICO = 40;

function tituloDe(texto: string): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= 60) return limpo;
  const corte = limpo.slice(0, 60);
  return `${corte.slice(0, corte.lastIndexOf(" ") > 30 ? corte.lastIndexOf(" ") : 60)}…`;
}

/**
 * Uma pergunta do mentor. Os dados da conta são lidos DE NOVO a cada pergunta (com o login dele), então
 * a resposta sai do estado de agora. Se o modelo falhar, a pergunta NÃO fica guardada — a tela devolve
 * o texto para a caixa.
 */
export const enviarMensagemDoMentor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      conversa_id: z.string().uuid().nullable().optional(),
      texto: z.string().trim().min(1).max(4000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await liberada(supabase))) throw new Error(ERROS.naoLiberada);
    // O portão acima garante acting_account() = o próprio login: a conta é ele.
    const conta = userId;
    const servidor = await import("@/lib/assistente-mentor/assistente.server");

    let contexto: string;
    try {
      contexto = await servidor.montarContextoDoMentor(supabase, conta);
    } catch (e) {
      console.error("[assistente-mentor] dados da conta:", e instanceof Error ? e.message : String(e));
      throw new Error(ERROS.semDados);
    }

    const db = await admin();
    // A conversa: a existente (lida com o login do mentor — se não for dele, não volta) ou uma nova.
    let conversaId = data.conversa_id ?? null;
    let conversaNova = false;
    if (conversaId) {
      const { data: c, error } = await supabase
        .from("assistente_mentor_conversas")
        .select("id")
        .eq("id", conversaId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(`Não foi possível abrir a conversa (${error.message}).`);
      if (!c) throw new Error(ERROS.conversaNaoEncontrada);
    } else {
      const { data: c, error } = await db
        .from("assistente_mentor_conversas")
        .insert({ user_id: userId, conta_id: conta, titulo: tituloDe(data.texto) })
        .select("id")
        .single();
      if (error || !c) throw new Error(`Não foi possível criar a conversa (${error?.message}).`);
      conversaId = c.id;
      conversaNova = true;
    }

    const { data: anteriores, error: hErr } = await supabase
      .from("assistente_mentor_mensagens")
      .select("papel, conteudo")
      .eq("conversa_id", conversaId)
      .eq("user_id", userId)
      .order("criada_em", { ascending: false })
      .order("id", { ascending: false })
      .limit(MAX_HISTORICO);
    if (hErr) throw new Error(`Não foi possível ler a conversa (${hErr.message}).`);

    const { data: pergunta, error: pErr } = await db
      .from("assistente_mentor_mensagens")
      .insert({ conversa_id: conversaId, user_id: userId, conta_id: conta, papel: "mentor", conteudo: data.texto })
      .select("id, papel, conteudo, criada_em")
      .single();
    if (pErr || !pergunta) throw new Error(`Não foi possível guardar a pergunta (${pErr?.message}).`);

    const historico: MensagemDoHistorico[] = (anteriores ?? [])
      .reverse()
      .map((m) => ({ role: m.papel === "mentor" ? ("user" as const) : ("assistant" as const), content: m.conteudo }));
    while (historico.length && historico[0].role !== "user") historico.shift();
    historico.push({ role: "user", content: data.texto });

    let resposta: Awaited<ReturnType<typeof servidor.perguntarAoModelo>>;
    try {
      resposta = await servidor.perguntarAoModelo(contexto, historico, undefined, {
        instrucoes: servidor.INSTRUCOES_DO_MENTOR,
        escopo: "mentor",
      });
    } catch (e) {
      await db.from("assistente_mentor_mensagens").delete().eq("id", pergunta.id);
      if (conversaNova) await db.from("assistente_mentor_conversas").delete().eq("id", conversaId);
      await db.from("assistente_uso").insert({
        user_id: userId, conta_id: conta, escopo: "mentor", conversa_mentor_id: conversaNova ? null : conversaId,
        modelo: servidor.MODELO_DA_ASSISTENTE, erro: servidor.resumoDoErro(e),
      });
      console.error("[assistente-mentor] falha ao responder:", servidor.resumoDoErro(e));
      throw new Error(e instanceof servidor.AssistenteDesligada ? ERROS.desligada : ERROS.falhou);
    }

    const texto = resposta.stopReason === "refusal" || !resposta.texto ? ERROS.recusa : resposta.texto;

    const { data: dita, error: aErr } = await db
      .from("assistente_mentor_mensagens")
      .insert({ conversa_id: conversaId, user_id: userId, conta_id: conta, papel: "assistente", conteudo: texto })
      .select("id, papel, conteudo, criada_em")
      .single();
    if (aErr || !dita) throw new Error(`Não foi possível guardar a resposta (${aErr?.message}).`);

    const [{ error: uErr }, { error: cErr }] = await Promise.all([
      db.from("assistente_uso").insert({
        user_id: userId, conta_id: conta, escopo: "mentor", conversa_mentor_id: conversaId,
        modelo: servidor.MODELO_DA_ASSISTENTE, stop_reason: resposta.stopReason, duracao_ms: resposta.ms,
        ...resposta.uso,
      }),
      db.from("assistente_mentor_conversas").update({ atualizada_em: new Date().toISOString() }).eq("id", conversaId),
    ]);
    if (uErr) console.error("[assistente-mentor] registro de uso falhou:", uErr.message);
    if (cErr) console.error("[assistente-mentor] data da conversa não atualizou:", cErr.message);

    return { conversa_id: conversaId as string, mensagens: [pergunta, dita] as MensagemDoMentor[] };
  });

export const apagarConversaDoMentor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ conversa_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Com o login do mentor: a RLS só deixa apagar o que é dele.
    const { data: apagadas, error } = await context.supabase
      .from("assistente_mentor_conversas")
      .delete()
      .eq("id", data.conversa_id)
      .eq("user_id", context.userId)
      .select("id");
    if (error) throw new Error(`Não foi possível apagar a conversa (${error.message}).`);
    if (!apagadas?.length) throw new Error(ERROS.conversaNaoEncontrada);
    return { ok: true as const };
  });

export const apagarTodasAsConversasDoMentor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("assistente_mentor_conversas")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(`Não foi possível apagar as conversas (${error.message}).`);
    return { ok: true as const };
  });
