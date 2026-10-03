/**
 * M1c-4: a TRAVA DE SEGURANÇA contra defeito — no máximo 20 WhatsApp enviados por dia por pessoa, somando tudo (lembretes,
 * respostas, avisos). Não é um limite de uso: no uso normal ela nunca aparece. Existe para que um erro (laço, evento repetido,
 * código novo com falha) não encha o celular de alguém. O limite antigo de 3 por dia saiu em 03/10/2026: ele contava as
 * respostas e os avisos e derrubou lembretes de verdade.
 *
 * Atingida: não envia, registra o motivo "trava de segurança" (uma vez por pessoa por dia) e avisa o DONO no sino (uma vez por dia).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarEnvioNaoFeito } from "./enviar.server";

export const LIMITE_DE_SEGURANCA_POR_DIA = 20;
/** Só para os testes (o dono, que recebe os avisos de todos os alunos, passa de 20 numa prova longa). Em produção a variável não existe. */
const limiteEmVigor = () => Number(process.env.WHATSAPP_TRAVA_MAX_DE_TESTE) || LIMITE_DE_SEGURANCA_POR_DIA;
const MOTIVO = `trava de segurança: ${LIMITE_DE_SEGURANCA_POR_DIA} WhatsApp por dia por pessoa atingidos`;

/** Meia-noite de Brasília (UTC−3, sem horário de verão) do dia de `d`, em ISO. */
function inicioDoDia(d: Date): string {
  return `${new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)}T03:00:00.000Z`;
}

export async function travaDeSegurancaAtingida(
  admin: SupabaseClient, args: { contaId: string; personId: string; destino: string; tipo: string; agora?: Date },
): Promise<boolean> {
  const desde = inicioDoDia(args.agora ?? new Date());
  const { count } = await admin.from("envios_mensagens").select("id", { count: "exact", head: true })
    .eq("person_id", args.personId).eq("canal", "whatsapp").eq("status", "enviado").gte("criado_em", desde);
  if ((count ?? 0) < limiteEmVigor()) return false;

  // Registro do motivo e aviso: pela hora REAL do banco (os registros nascem com ela), uma vez por pessoa/dia — não a cada tentativa.
  const hoje = inicioDoDia(new Date());
  const { count: jaRegistrado } = await admin.from("envios_mensagens").select("id", { count: "exact", head: true })
    .eq("person_id", args.personId).eq("canal", "whatsapp").eq("status", "falhou").eq("motivo_falha", MOTIVO).gte("criado_em", hoje);
  if ((jaRegistrado ?? 0) === 0) {
    await registrarEnvioNaoFeito(admin, { contaId: args.contaId, personId: args.personId, tipo: args.tipo, destino: args.destino, motivo: MOTIVO });
  }
  // Aviso ao DONO no sino: uma vez por dia (pela hora real do banco).
  const { count: jaAvisado } = await admin.from("notificacoes").select("id", { count: "exact", head: true })
    .eq("user_id", args.contaId).eq("tipo", "whatsapp_trava_seguranca").gte("created_at", hoje);
  if ((jaAvisado ?? 0) === 0) {
    const { error } = await admin.from("notificacoes").insert({
      user_id: args.contaId, conta_id: args.contaId, tipo: "whatsapp_trava_seguranca", link: "/configuracoes",
      titulo: `A trava de segurança do WhatsApp foi atingida: uma pessoa já recebeu ${LIMITE_DE_SEGURANCA_POR_DIA} mensagens hoje e os próximos envios para ela foram bloqueados. Isso não é uso normal — vale conferir.`,
    });
    if (error) console.error("[trava-seguranca] aviso ao dono não gravado:", error.message);
  }
  return true;
}
