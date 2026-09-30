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
 * - #316A — o aceite do termo, as quatro chaves de privacidade, "apagar tudo" e a revogação são funções
 *   do banco sobre `auth.uid()` (`assistente_aceitar`, `_definir_chaves`, `_apagar_tudo`, `_revogar`),
 *   chamadas com o login do aluno: a regra das chaves e o registro de cada escolha moram lá.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { MensagemDoHistorico } from "@/lib/assistente/modelo.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ERROS_DA_ASSISTENTE } from "@/lib/assistente/textos";
import { avisoDeHistoricoCortado } from "@/lib/assistente/historico";
import { perguntaComTrechosDaBiblioteca } from "@/lib/assistente/biblioteca-busca.server";
import { CATEGORIAS, naOrdem, nivelEmUso, type Categoria } from "@/lib/assistente/niveis";
import { escolhaLembrada, niveisDaTela } from "@/lib/assistente/niveis.server";
import { CHAVES, lerChaves, type EstadoDasChaves } from "@/lib/assistente/chaves";
import { lerTodas } from "@/lib/ler-todas";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Situacao = {
  liberada: boolean;
  tem_relatorio: boolean;
  termo_publicado: boolean;
  /** Tem aceite VIGENTE (não revogado e não substituído por versão mais nova) — de qualquer versão. */
  consentimento_ativo: boolean;
  tem_historico: boolean;
  /** #317 — o teto do aluno, na ordem da escada. Vazio ⇔ `liberada` falso. */
  categorias: Categoria[];
  /** #316A — a versão do termo em vigor (a maior publicada) e a do aceite vigente do aluno. */
  termo_versao: number | null;
  consentimento_versao: number | null;
  /** O aceite vigente é da versão em vigor. Sem isso não se conversa: o aluno lê a versão nova antes. */
  consentimento_em_dia: boolean;
  /** O termo que o aluno aceitou explica as chaves — só então elas aparecem e podem ser ligadas. */
  chaves_disponiveis: boolean;
  /** O estado das quatro chaves (sem linha no banco = todas desligadas). */
  chaves: EstadoDasChaves;
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
  const bruta = data as unknown as Partial<Record<keyof Situacao, unknown>>;
  // Com o app novo no ar antes do banco (ou o contrário), uma chave pode faltar: vale o valor mais
  // fechado (sem aceite em dia, sem chaves), nunca `undefined`.
  const s: Situacao = {
    liberada: bruta.liberada === true,
    tem_relatorio: bruta.tem_relatorio === true,
    termo_publicado: bruta.termo_publicado === true,
    consentimento_ativo: bruta.consentimento_ativo === true,
    tem_historico: bruta.tem_historico === true,
    categorias: naOrdem(Array.isArray(bruta.categorias) ? bruta.categorias : []),
    termo_versao: typeof bruta.termo_versao === "number" ? bruta.termo_versao : null,
    consentimento_versao: typeof bruta.consentimento_versao === "number" ? bruta.consentimento_versao : null,
    consentimento_em_dia: bruta.consentimento_em_dia === true,
    chaves_disponiveis: bruta.chaves_disponiveis === true,
    chaves: lerChaves(bruta.chaves),
  };
  const pode_comecar = s.liberada && s.tem_relatorio && s.termo_publicado;
  return { ...s, pode_comecar, no_menu: pode_comecar || s.consentimento_ativo || s.tem_historico };
}

/**
 * O banco explica a recusa em português, com o prefixo "assistente: " (ver a migração das chaves). Para o
 * aluno, sai só a frase; erro que não é da assistente vira a mensagem genérica de quem chamou.
 */
function mensagemDoBanco(erro: { message: string }, generica: string): string {
  const m = /^assistente: (.+)$/s.exec(erro.message.trim());
  if (!m) return `${generica} (${erro.message})`;
  const frase = m[1].trim();
  return frase.charAt(0).toUpperCase() + frase.slice(1) + (/[.!?]$/.test(frase) ? "" : ".");
}

const esquemaDasChaves = z.object(
  Object.fromEntries(CHAVES.map((c) => [c, z.boolean()])) as Record<(typeof CHAVES)[number], z.ZodBoolean>,
);
// zod 4: `record` com chave enum exige TODAS as chaves; aqui vêm só as que o aluno desligou.
const esquemaAoDesligar = z.partialRecord(z.enum(CHAVES), z.enum(["apagar", "manter"])).optional();

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

    // Vigente = não revogado e não substituído por uma versão mais nova (#316A).
    const { data: consentimento, error: cErr } = await supabase
      .from("assistente_consentimentos")
      .select("id, termo_versao, aceito_em")
      .eq("user_id", userId)
      .is("revogado_em", null)
      .is("substituido_em", null)
      .maybeSingle();
    if (cErr) throw new Error(`Não foi possível ler a sua autorização (${cErr.message}).`);

    const { data: conversas, error: vErr } = await supabase
      .from("assistente_conversas")
      .select("id, titulo, criada_em, atualizada_em")
      .eq("user_id", userId)
      .order("atualizada_em", { ascending: false });
    if (vErr) throw new Error(`Não foi possível ler as suas conversas (${vErr.message}).`);

    // O termo vai para a tela quando falta o aceite da versão em vigor: primeiro uso OU texto novo
    // depois de um aceite antigo (#316A — quem aceitou a versão anterior lê a nova antes de continuar).
    let termo: TermoEmVigor | null = null;
    if (!situacao.consentimento_em_dia && situacao.pode_comecar) {
      const { data: t, error: tErr } = await supabase
        .from("assistente_termos")
        .select("id, versao, texto, rotulo_aceite, explica_chaves")
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
      // #317 — o seletor de nível: só aparece na tela quando há mais de um liberado.
      niveis: await niveisDaTela(supabase, userId, "aluno", situacao.categorias),
    };
  });

export type TermoEmVigor = { id: string; versao: number; texto: string; rotulo_aceite: string; explica_chaves: boolean };

/**
 * Aceite explícito do termo, junto com a escolha das chaves (#316A). Uma operação só no banco
 * (`assistente_aceitar`): marca o aceite anterior como substituído, registra o novo — o banco copia
 * versão e texto da linha do termo, o cliente só aponta qual — e grava as chaves com o registro.
 * `ao_desligar` só existe se, nesta tela, o aluno desligou uma chave que estava ligada.
 */
export const aceitarTermo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      termo_id: z.string().uuid(),
      aceito: z.literal(true),
      chaves: esquemaDasChaves,
      ao_desligar: esquemaAoDesligar,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const situacao = await lerSituacao(supabase);
    if (situacao.consentimento_em_dia) return { ok: true as const };
    if (!situacao.pode_comecar) throw new Error(ERROS_DA_ASSISTENTE.naoLiberada);

    const { error } = await supabase.rpc("assistente_aceitar", {
      _termo_id: data.termo_id,
      _lembrar_conversas: data.chaves.lembrar_conversas,
      _aprender_plataforma: data.chaves.aprender_plataforma,
      _mentor_acompanha: data.chaves.mentor_acompanha,
      _melhorar_assistente: data.chaves.melhorar_assistente,
      _ao_desligar: data.ao_desligar ?? null,
    });
    if (error) {
      throw new Error(
        error.message.includes("versão mais nova")
          ? "Este termo foi atualizado. Recarregue a página para ler a versão nova."
          : mensagemDoBanco(error, "Não foi possível registrar a autorização"),
      );
    }
    return { ok: true as const };
  });

/**
 * Mudar as chaves depois do aceite (#316A). O banco confere tudo de novo: ligar pede o aceite em dia
 * com um termo que explica as chaves; desligar vale sempre, e exige a escolha — apagar o que a chave
 * guardou ou manter em espera — para cada chave que desliga.
 */
export const definirChaves = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ chaves: esquemaDasChaves, ao_desligar: esquemaAoDesligar }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("assistente_definir_chaves", {
      _lembrar_conversas: data.chaves.lembrar_conversas,
      _aprender_plataforma: data.chaves.aprender_plataforma,
      _mentor_acompanha: data.chaves.mentor_acompanha,
      _melhorar_assistente: data.chaves.melhorar_assistente,
      _ao_desligar: data.ao_desligar ?? null,
    });
    if (error) throw new Error(mensagemDoBanco(error, "Não foi possível mudar a chave"));
    const resposta = (r ?? {}) as { chaves?: unknown; apagados?: unknown };
    return { chaves: lerChaves(resposta.chaves), apagados: typeof resposta.apagados === "number" ? resposta.apagados : 0 };
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
 *
 * #317 — `categoria` é o nível escolhido na tela. Vale se estiver dentro do teto dele AGORA; se o mentor
 * tirou aquele nível depois que a tela abriu, a pergunta sai no mais baixo liberado (nunca erro) e a
 * resposta diz qual nível respondeu, para a tela acompanhar.
 */
export const enviarMensagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      conversa_id: z.string().uuid().nullable().optional(),
      texto: z.string().trim().min(1).max(4000),
      categoria: z.enum(CATEGORIAS).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const servidor = await import("@/lib/assistente/assistente.server");

    const situacao = await lerSituacao(supabase);
    if (!situacao.consentimento_ativo) throw new Error(ERROS_DA_ASSISTENTE.semConsentimento);
    // #316A — aceite de uma versão anterior do termo não basta: o aluno lê a versão nova antes.
    if (!situacao.consentimento_em_dia) throw new Error(ERROS_DA_ASSISTENTE.termoNovo);
    if (!situacao.liberada) throw new Error(ERROS_DA_ASSISTENTE.naoLiberada);
    const categoria = nivelEmUso(situacao.categorias, data.categoria ?? (await escolhaLembrada(supabase, userId, "aluno")));
    if (!categoria) throw new Error(ERROS_DA_ASSISTENTE.naoLiberada);
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
      .limit(MAX_HISTORICO + 1); // uma a mais só para saber se houve corte (#310)
    if (hErr) throw new Error(`Não foi possível ler a conversa (${hErr.message}).`);
    const historicoCortado = (anteriores ?? []).length > MAX_HISTORICO;

    const { data: pergunta, error: pErr } = await db
      .from("assistente_mensagens")
      .insert({ conversa_id: conversaId, user_id: userId, conta_id: conta, papel: "aluno", conteudo: data.texto })
      .select("id, papel, conteudo, criada_em")
      .single();
    if (pErr || !pergunta) throw new Error(`Não foi possível guardar a pergunta (${pErr?.message}).`);

    const historico: MensagemDoHistorico[] = (anteriores ?? [])
      .slice(0, MAX_HISTORICO)
      .reverse()
      .map((m) => ({ role: m.papel === "aluno" ? ("user" as const) : ("assistant" as const), content: m.conteudo }));
    while (historico.length && historico[0].role !== "user") historico.shift();
    historico.push({ role: "user", content: data.texto });
    // #312: busca nos trechos do acervo (com a sessão do aluno — a permissão é a mesma da tela) e, se
    // achar algo, entra na ÚLTIMA mensagem do histórico — nunca no `contexto` (que fica em cache).
    historico[historico.length - 1].content = await perguntaComTrechosDaBiblioteca(supabase, data.texto);

    let resposta: Awaited<ReturnType<typeof servidor.perguntarAoModelo>>;
    try {
      // #310: conversa longa não perde o começo em silêncio — ela é avisada de que só viu o final.
      resposta = await servidor.perguntarAoModelo(
        historicoCortado ? `${contexto}\n\n${avisoDeHistoricoCortado(MAX_HISTORICO)}` : contexto,
        historico,
        undefined,
        { categoria },
      );
    } catch (e) {
      await db.from("assistente_mensagens").delete().eq("id", pergunta.id);
      if (conversaNova) await db.from("assistente_conversas").delete().eq("id", conversaId);
      await db.from("assistente_uso").insert({
        user_id: userId, conta_id: conta, conversa_id: conversaNova ? null : conversaId,
        modelo: servidor.modeloDoErro(e), categoria, erro: servidor.resumoDoErro(e),
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

    const respondeu = resposta.categoria ?? categoria;
    const [{ error: uErr }, { error: cErr }] = await Promise.all([
      db.from("assistente_uso").insert({
        user_id: userId, conta_id: conta, conversa_id: conversaId,
        modelo: resposta.modelo, categoria: respondeu, stop_reason: resposta.stopReason, duracao_ms: resposta.ms,
        ...resposta.uso,
      }),
      db.from("assistente_conversas").update({ atualizada_em: new Date().toISOString() }).eq("id", conversaId),
    ]);
    if (uErr) console.error("[assistente] registro de uso falhou:", uErr.message);
    if (cErr) console.error("[assistente] data da conversa não atualizou:", cErr.message);

    return { conversa_id: conversaId as string, mensagens: [pergunta, dita] as Mensagem[], categoria: respondeu };
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

/**
 * #316A — apagar TUDO o que o aluno informou à assistente: as conversas e o que as chaves guardaram
 * (inclusive o que estava em espera). Sempre disponível — não depende de aceitar termo novo. Não revoga
 * nem mexe nas chaves; o aceite e o registro das escolhas ficam, como prova, com a linha "apagar_tudo".
 */
export const apagarTudoDaAssistente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("assistente_apagar_tudo");
    if (error) throw new Error(mensagemDoBanco(error, "Não foi possível apagar"));
    const r = (data ?? {}) as { conversas?: unknown };
    return { conversas: typeof r.conversas === "number" ? r.conversas : 0 };
  });

/** Revogar: uma operação só no banco — marca a revogação e apaga o histórico junto. */
export const revogarAssistente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.rpc("assistente_revogar");
    if (error) throw new Error(`Não foi possível retirar a autorização (${error.message}).`);
    return { ok: true as const };
  });

export type EventoDasChaves = {
  evento: "aceite" | "mudanca" | "apagar_tudo" | "revogacao";
  termo_versao: number | null;
  criado_em: string;
  chaves: EstadoDasChaves;
  desligadas: string[];
  ao_desligar: Record<string, string> | null;
};

/**
 * "Ver tudo o que a assistente guardou" e a cópia para baixar: autorizações (com as versões substituídas),
 * as chaves e o histórico delas (#316A), e todas as conversas. Tudo lido INTEIRO, em partes (regra #314):
 * a cópia é um direito do aluno, e uma cópia cortada em silêncio no milésimo item não é a cópia.
 */
export const meusDadosDaAssistente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [consentimentos, registro, conversas, mensagens] = await Promise.all([
      lerTodas((de, ate) =>
        supabase
          .from("assistente_consentimentos")
          .select("termo_versao, texto_aceito, rotulo_aceito, aceito_em, revogado_em, substituido_em", { count: "exact" })
          .eq("user_id", userId)
          .order("aceito_em")
          .order("id")
          .range(de, ate),
      ),
      lerTodas((de, ate) =>
        supabase
          .from("assistente_chaves_registro")
          .select(
            "evento, termo_versao, criado_em, lembrar_conversas, aprender_plataforma, mentor_acompanha, melhorar_assistente, desligadas, ao_desligar",
            { count: "exact" },
          )
          .eq("user_id", userId)
          .order("criado_em")
          .order("id")
          .range(de, ate),
      ),
      lerTodas((de, ate) =>
        supabase
          .from("assistente_conversas")
          .select("id, titulo, criada_em, atualizada_em", { count: "exact" })
          .eq("user_id", userId)
          .order("criada_em")
          .order("id")
          .range(de, ate),
      ),
      lerTodas((de, ate) =>
        supabase
          .from("assistente_mensagens")
          .select("conversa_id, papel, conteudo, criada_em", { count: "exact" })
          .eq("user_id", userId)
          .order("criada_em")
          .order("id")
          .range(de, ate),
      ),
    ]).catch((e: unknown) => {
      throw new Error(`Não foi possível reunir os seus dados (${e instanceof Error ? e.message : String(e)}).`);
    });
    const situacao = await lerSituacao(supabase);
    return {
      consentimentos: consentimentos.linhas,
      chaves: situacao.chaves,
      chaves_disponiveis: situacao.chaves_disponiveis,
      historico_das_chaves: registro.linhas.map(
        (r): EventoDasChaves => ({
          evento: r.evento as EventoDasChaves["evento"],
          termo_versao: r.termo_versao,
          criado_em: r.criado_em,
          chaves: lerChaves(r),
          desligadas: r.desligadas ?? [],
          ao_desligar: (r.ao_desligar ?? null) as Record<string, string> | null,
        }),
      ),
      conversas: conversas.linhas.map((c) => ({
        ...c,
        mensagens: mensagens.linhas.filter((m) => m.conversa_id === c.id).map(({ conversa_id: _, ...m }) => m),
      })),
      // Se um dia bater o teto de segurança da leitura, a cópia DIZ que não está inteira.
      completa: consentimentos.completo && registro.completo && conversas.completo && mensagens.completo,
    };
  });
