/**
 * WhatsApp — teste de conexão (#291 F1a). Só o DONO da conta.
 *
 * Todo envio sai daqui, do SERVIDOR: a tela só pede "mande um teste para este número" e recebe o
 * resultado. Quem grava o registro é a camada de canal (`canal/enviar.server.ts`), com a chave de
 * serviço; a tela lê os últimos envios pelo login do dono, e a RLS confere de novo que é dele.
 *
 * ⚠️ NÃO usar `exigirDono()` de team.functions aqui: `member_kind()` responde 'owner' também para
 * ALUNO. O portão é `whatsapp_dono()` (dono agindo pela própria conta, com alunos cadastrados).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const LIMITE_TESTES_POR_DIA = 5;
export const TIPO_TESTE = "teste_conexao";
export const TEXTO_DO_TESTE = "Teste de conexão — Plataforma Método Intenção.";

async function exigirDonoDoWhatsapp(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.rpc("whatsapp_dono");
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Só o dono da conta pode usar o WhatsApp da plataforma.");
}

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
    await exigirDonoDoWhatsapp(supabase);
    const { adaptadorDoCanal } = await import("@/lib/canal/enviar.server");
    const conexao = await adaptadorDoCanal("whatsapp")!.estadoDaConexao();

    const { data: recentes, error } = await supabase
      .from("envios_mensagens")
      .select("id, canal, tipo, destino_mascarado, status, motivo_falha, fornecedor, fornecedor_msg_id, criado_em, enviado_em")
      .order("criado_em", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);

    const usados = await contarTestesDeHoje(userId);
    return {
      conexao,
      recentes: recentes ?? [],
      testes: { usados, limite: LIMITE_TESTES_POR_DIA },
    };
  });

/** Manda a mensagem fixa de teste para o número digitado. Nunca lança por falha de envio: devolve o resultado. */
export const sendWhatsappTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ numero: z.string().trim().min(1).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await exigirDonoDoWhatsapp(supabase);

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
