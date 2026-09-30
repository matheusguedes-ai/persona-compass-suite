/**
 * "Enviar mensagem" — a função genérica da camada de canal (#291 F1a).
 *
 * Fluxo: valida o destino → grava o registro como PENDENTE → chama o adaptador do canal → atualiza
 * para ENVIADO ou FALHOU (com o motivo). Nunca lança erro por falha de envio: quem chama recebe o
 * resultado e a tela segue. Nada de reenvio automático nesta fatia.
 *
 * O registro só é escrito por aqui, com a chave de serviço (a tabela não tem policy de escrita).
 * O telefone completo nunca é gravado: só a versão mascarada.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { adaptadorZapster } from "./zapster.server";
import { normalizarTelefoneBR } from "./telefone";
import type { AdaptadorDeCanal, Canal } from "./tipos";

/** O canal → adaptador. É aqui (e só aqui) que se troca de fornecedor. */
export function adaptadorDoCanal(canal: Canal): AdaptadorDeCanal | null {
  if (canal === "whatsapp") return adaptadorZapster;
  return null; // e-mail: o envio existente segue como está, ainda fora desta camada
}

export type ResultadoDoEnvio =
  | { status: "enviado"; registroId: string }
  | { status: "falhou"; registroId: string | null; motivo: string };

export async function enviarMensagem(
  admin: SupabaseClient,
  args: {
    contaId: string;
    criadoPor: string | null;
    canal: Canal;
    tipo: string;
    /** Telefone como digitado ou cadastrado (qualquer formato). */
    destino: string;
    texto: string;
    personId?: string | null;
  },
): Promise<ResultadoDoEnvio> {
  const fone = normalizarTelefoneBR(args.destino);
  const adaptador = adaptadorDoCanal(args.canal);

  const { data: reg, error: insErr } = await admin
    .from("envios_mensagens")
    .insert({
      conta_id: args.contaId,
      criado_por: args.criadoPor,
      person_id: args.personId ?? null,
      canal: args.canal,
      tipo: args.tipo,
      destino_mascarado: fone.mascarado,
      status: "pendente",
      fornecedor: adaptador?.fornecedor ?? null,
    })
    .select("id")
    .single();
  if (insErr || !reg) {
    console.error("[canal] não consegui gravar o registro do envio:", insErr?.message);
    return { status: "falhou", registroId: null, motivo: "Não consegui gravar o registro do envio" };
  }

  const falhar = async (motivo: string): Promise<ResultadoDoEnvio> => {
    const { error } = await admin
      .from("envios_mensagens")
      .update({ status: "falhou", motivo_falha: motivo })
      .eq("id", reg.id);
    if (error) console.error("[canal] não consegui marcar a falha:", error.message);
    return { status: "falhou", registroId: reg.id, motivo };
  };

  if (!adaptador) return falhar("Canal sem adaptador nesta versão");
  // Número inválido: NÃO chama o fornecedor.
  if (!fone.ok) return falhar(fone.motivo);

  const r = await adaptador.enviarTexto(fone.internacional, args.texto);
  if (!r.ok) return falhar(r.motivo);

  const { error: updErr } = await admin
    .from("envios_mensagens")
    .update({ status: "enviado", fornecedor_msg_id: r.idNoFornecedor, enviado_em: new Date().toISOString() })
    .eq("id", reg.id);
  if (updErr) console.error("[canal] enviado, mas não consegui atualizar o registro:", updErr.message);
  return { status: "enviado", registroId: reg.id };
}

/**
 * Registra um envio que NÃO foi feito, com o motivo (ex.: limite diário). Nenhum fornecedor é chamado.
 * Guarda só o número mascarado, como todo registro desta tabela.
 */
export async function registrarEnvioNaoFeito(
  admin: SupabaseClient,
  args: { contaId: string; personId: string | null; tipo: string; destino: string; motivo: string; canal?: Canal },
): Promise<void> {
  const canal = args.canal ?? "whatsapp";
  const { error } = await admin.from("envios_mensagens").insert({
    conta_id: args.contaId, person_id: args.personId, canal, tipo: args.tipo,
    destino_mascarado: normalizarTelefoneBR(args.destino).mascarado, status: "falhou", motivo_falha: args.motivo,
    fornecedor: adaptadorDoCanal(canal)?.fornecedor ?? null,
  });
  if (error) console.error("[canal] não consegui registrar o envio não feito:", error.message);
}
