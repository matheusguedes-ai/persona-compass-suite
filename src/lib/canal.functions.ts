/**
 * WhatsApp — teste de conexão (#291 F1a). Só o DONO da conta.
 *
 * Todo envio sai daqui, do SERVIDOR: a tela só pede "mande um teste para este número" e recebe o
 * resultado. Quem grava o registro é a camada de canal (`canal/enviar.server.ts`), com a chave de
 * serviço; a tela lê os últimos envios pelo login do dono, e a RLS confere de novo que é dele.
 *
 * O portão é a checagem central de dono (`exigirDono`, que pergunta `is_account_owner()` ao banco) e a
 * RLS da tabela de registro pergunta a mesma coisa (`whatsapp_dono()` = `is_account_owner()`).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirDono } from "@/lib/team.functions";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const LIMITE_TESTES_POR_DIA = 5;
export const TIPO_TESTE = "teste_conexao";
export const TEXTO_DO_TESTE = "Teste de conexão — Plataforma Método Intenção.";

/** Início do dia de hoje no horário de Brasília (UTC−3, sem horário de verão), em ISO. */
function inicioDoDiaEmBrasilia(agora = new Date()): string {
  const brasilia = new Date(agora.getTime() - 3 * 3_600_000);
  const dia = brasilia.toISOString().slice(0, 10);
  return new Date(`${dia}T03:00:00.000Z`).toISOString();
}

async function contarTestesDeHoje(contaId: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("envios_mensagens")
    .select("id", { count: "exact", head: true })
    .eq("conta_id", contaId)
    .eq("tipo", TIPO_TESTE)
    .gte("criado_em", inicioDoDiaEmBrasilia());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Estado da conexão + últimos envios + quantos testes ainda cabem hoje. */
export const getWhatsappPainel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await exigirDono(supabase);
    const { adaptadorDoCanal } = await import("@/lib/canal/enviar.server");
    const conexao = await adaptadorDoCanal("whatsapp")!.estadoDaConexao();

    const { data: recentes, error } = await supabase
      .from("envios_mensagens")
      .select("id, canal, tipo, destino_mascarado, status, motivo_falha, fornecedor, fornecedor_msg_id, criado_em, enviado_em, entregue_em, lido_em")
      .order("criado_em", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);

    const usados = await contarTestesDeHoje(userId);
    // Menu Mensagens M1a: o webhook está configurado? (só se as duas variáveis existem a porta responde) e quando chegou
    // a última mensagem. Nunca devolve os valores — só se existem.
    const segredoBruto = process.env.ZAPSTER_WEBHOOK_SEGREDO || process.env.APP_ZAPSTER_WEBHOOK_SEGREDO || "";
    const numeroBruto = process.env.ZAPSTER_NUMERO || process.env.APP_ZAPSTER_NUMERO || "";
    const webhookConfigurado = segredoBruto.trim() !== "" && numeroBruto.replace(/\D/g, "") !== "";
    const { data: eventos } = await supabase.from("webhook_eventos").select("id, recebido_em, tipo, acao, detalhe")
      .order("recebido_em", { ascending: false }).limit(8);
    const { data: ultima } = await supabase.from("mensagens_recebidas").select("recebida_em").order("recebida_em", { ascending: false }).limit(1);
    return {
      conexao,
      recentes: recentes ?? [],
      testes: { usados, limite: LIMITE_TESTES_POR_DIA },
      webhook: {
        configurado: webhookConfigurado,
        // Só TAMANHOS (nunca os valores), para achar erro de colagem: o segredo nasce com 64 caracteres, o número tem 12 ou 13 dígitos.
        segredoTamanho: segredoBruto.length,
        segredoComEspacoNasPontas: segredoBruto !== segredoBruto.trim(),
        numeroDigitos: numeroBruto.replace(/\D/g, "").length,
        ultimaRecebidaEm: (ultima ?? [])[0]?.recebida_em ?? null,
        eventos: eventos ?? [],
      },
    };
  });

/** Manda a mensagem fixa de teste para o número digitado. Nunca lança por falha de envio: devolve o resultado. */
export const sendWhatsappTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ numero: z.string().trim().min(1).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await exigirDono(supabase);

    const usados = await contarTestesDeHoje(userId);
    if (usados >= LIMITE_TESTES_POR_DIA) {
      throw new Error(`Limite de ${LIMITE_TESTES_POR_DIA} testes por dia atingido. Amanhã libera de novo.`);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { enviarMensagem } = await import("@/lib/canal/enviar.server");
    // O portão garante acting_account() = o próprio login: a conta é o dono.
    return enviarMensagem(supabaseAdmin as never, {
      contaId: userId,
      criadoPor: userId,
      canal: "whatsapp",
      tipo: TIPO_TESTE,
      destino: data.numero,
      texto: TEXTO_DO_TESTE,
    });
  });

/**
 * As últimas 50 mensagens recebidas (Menu Mensagens M1a). Só o DONO; só leitura. O telefone completo NUNCA sai do
 * servidor: para quem não foi identificado vai só a versão mascarada.
 */
export const listarMensagensRecebidas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    await exigirDono(supabase);
    const { data, error } = await supabase
      .from("mensagens_recebidas")
      .select("id, recebida_em, remetente, remetente_nome, telefone, candidatos, tipo, texto, botao_rotulo, citada_texto, tratamento")
      .order("recebida_em", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const { mascararTelefone } = await import("@/lib/canal/telefone");
    return (data ?? []).map(({ telefone, ...m }) => ({ ...m, telefone_mascarado: mascararTelefone(telefone) }));
  });

// ------------------------------------------------------------------------------------------ webhook na Zapster
export const EVENTOS_DO_WEBHOOK = ["message.received", "message.delivered", "message.read", "instance.disconnected"];

async function enderecoDoWebhook(): Promise<string | null> {
  const segredo = (process.env.ZAPSTER_WEBHOOK_SEGREDO || process.env.APP_ZAPSTER_WEBHOOK_SEGREDO || "").trim();
  if (!segredo) return null;
  const { siteUrl } = await import("@/lib/site-url.server");
  return `${siteUrl()}/api/webhook/zapster/${segredo}`;
}

/** O webhook está cadastrado na Zapster? Só o dono. Nunca devolve o endereço (ele leva o segredo). */
export const verificarWebhookNaZapster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirDono(context.supabase);
    const url = await enderecoDoWebhook();
    if (!url) return { ok: false as const, motivo: "Falta ZAPSTER_WEBHOOK_SEGREDO nos Secrets" };
    const { verificarWebhookZapster } = await import("@/lib/canal/zapster.server");
    return verificarWebhookZapster(url);
  });

/** Cadastra o webhook na Zapster pelo servidor (o endereço com o segredo nunca passa pela tela). Só o dono. */
export const cadastrarWebhookNaZapster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirDono(context.supabase);
    const url = await enderecoDoWebhook();
    if (!url) return { criado: false as const, tentativas: [{ formato: "—", resultado: "Falta ZAPSTER_WEBHOOK_SEGREDO nos Secrets" }] };
    const { verificarWebhookZapster, cadastrarWebhookZapster } = await import("@/lib/canal/zapster.server");
    // Já existe o nosso? Não cria outro (dois webhooks iguais fariam o mesmo aviso chegar duas vezes).
    const antes = await verificarWebhookZapster(url);
    if (antes.ok && antes.nossos.some((w) => w.doNossoEndereco)) {
      return { criado: false as const, jaExistia: true as const, tentativas: [{ formato: "—", resultado: "já existe um webhook com o nosso endereço" }] };
    }
    const r = await cadastrarWebhookZapster({ url, nome: "Plataforma Método Intenção", eventos: EVENTOS_DO_WEBHOOK });
    return { ...r, jaExistia: false as const };
  });
