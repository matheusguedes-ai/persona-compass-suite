/**
 * Menu Mensagens — M1b: o que a plataforma FAZ quando chega uma mensagem (depois de registrá-la).
 *
 *  1. SAIR: se a mensagem for só SAIR, PARAR, STOP ou CANCELAR, o WhatsApp de quem escreveu é desligado na hora
 *     (consentimento revogado com o motivo "pediu_sair") e a pessoa recebe UMA confirmação. Número em mais de um
 *     cadastro: todos os cadastros são desligados (na dúvida, vale o pedido de sair).
 *  2. Resposta automática: a um ALUNO cadastrado que escreve qualquer outra coisa, uma frase curta — no máximo 1 por
 *     dia por pessoa e só entre 8h e 20h. Equipe, desconhecido e ambíguo não recebem.
 *  3. Mentor avisado: no sino (dono e mentores dos grupos do aluno) e por WhatsApp (dono e esses mentores, se tiverem
 *     consentimento vigente e telefone válido; só entre 8h e 20h; no máximo 3 por dia por pessoa). Uma conversa em
 *     andamento não enche o sino: nova mensagem do mesmo aluno em até 15 minutos não avisa de novo.
 *
 * A confirmação de SAIR e a resposta automática respondem a quem ESCREVEU primeiro, por isso não dependem de
 * consentimento (como o código de confirmação da F1b). Mensagem antiga (reenvio tardio da Zapster, mais de 30 min) é
 * só registrada: nunca se responde nem se avisa por ela.
 *
 * Nunca lança para o webhook: quem chama protege com try/catch. Nada daqui é logado com texto ou telefone.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarMensagem } from "./enviar.server";
import { podeEnviarWhatsapp } from "./consentimento.server";
import { inicioDoDiaEmBrasilia, janelaDoWhatsappAberta } from "./lembrete-whatsapp.server";
import { mascararTelefone } from "./telefone";

export const TIPO_CONFIRMACAO_SAIR = "confirmacao_sair";
export const TIPO_RESPOSTA_AUTOMATICA = "resposta_automatica";
export const TIPO_AVISO_AO_MENTOR = "mentor_resposta_aluno";
export const LIMITE_AVISOS_POR_DIA = 3;
export const IDADE_MAXIMA_MIN = 30;
export const COALESCER_MIN = 15;

export const TEXTO_CONFIRMACAO_SAIR =
  "Pronto: você não receberá mais mensagens da Plataforma Método Intenção pelo WhatsApp. Os avisos continuam chegando por e-mail. " +
  "Se quiser voltar, é só ativar de novo no seu perfil da plataforma, em Recebimento de mensagens.";
export const TEXTO_RESPOSTA_AUTOMATICA =
  "Este número só envia avisos da Plataforma Método Intenção e não recebe conversa. Para falar com o seu mentor, use o canal combinado com ele.";

/** Só SAIR, PARAR, STOP ou CANCELAR (com ou sem acento, maiúscula ou pontuação). "sair da reunião" NÃO é um pedido de sair. */
export function ehPedidoDeSair(texto: string | null): boolean {
  const t = (texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  return ["sair", "parar", "stop", "cancelar"].includes(t);
}

export type MensagemRecebida = {
  id: string; telefone: string; remetente: "pessoa" | "equipe" | "desconhecido" | "ambiguo";
  personId: string | null; nome: string | null; candidatos: { id: string; nome: string }[] | null;
  tipo: string; texto: string | null; recebidaEm: string;
};

const DESCRICAO_DO_TIPO: Record<string, string> = {
  audio: "um áudio", imagem: "uma imagem", video: "um vídeo", documento: "um documento", sticker: "uma figurinha",
  localizacao: "uma localização", contato: "um contato", botao: "uma resposta de botão", lista: "uma escolha de lista", formulario: "um formulário",
};

function trecho(t: string | null, max: number): string | null {
  const s = (t ?? "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

async function contarEnviosHoje(admin: SupabaseClient, filtro: { person_id?: string; destino_mascarado?: string }, tipo: { igual?: string; diferente?: string }) {
  let q = admin.from("envios_mensagens").select("id", { count: "exact", head: true })
    .eq("canal", "whatsapp").gte("criado_em", inicioDoDiaEmBrasilia(new Date()));
  if (filtro.person_id) q = q.eq("person_id", filtro.person_id);
  if (filtro.destino_mascarado) q = q.eq("destino_mascarado", filtro.destino_mascarado);
  if (tipo.igual) q = q.eq("tipo", tipo.igual);
  if (tipo.diferente) q = q.neq("tipo", tipo.diferente).eq("status", "enviado");
  const { count } = await q;
  return count ?? 0;
}

/** Desliga o WhatsApp de cada cadastro (consentimento vigente vira revogado, motivo "pediu_sair") e cancela códigos pendentes. */
async function desligarPorPedido(admin: SupabaseClient, personIds: string[]): Promise<number> {
  if (personIds.length === 0) return 0;
  const agora = new Date().toISOString();
  await admin.from("whatsapp_codigos").update({ invalidado_em: agora }).in("person_id", personIds).is("consumido_em", null).is("invalidado_em", null);
  const { data, error } = await admin.from("whatsapp_consentimentos")
    .update({ revogado_em: agora, revogado_motivo: "pediu_sair" }).in("person_id", personIds).is("revogado_em", null).select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

/** Quem deve saber: o dono e os mentores dos grupos do aluno — como pessoas (com telefone) e como logins (para o sino). */
async function responsaveis(admin: SupabaseClient, contaId: string, alunoId: string) {
  const { data: gm } = await admin.from("group_members").select("group_id").eq("person_id", alunoId);
  const grupos = (gm ?? []).map((g: { group_id: string }) => g.group_id);
  const ids = new Set<string>();
  const { data: donoPessoa } = await admin.from("people").select("id").eq("mentor_id", contaId).eq("user_id", contaId);
  for (const p of donoPessoa ?? []) ids.add((p as { id: string }).id);
  if (grupos.length > 0) {
    const { data: tmg } = await admin.from("team_member_groups").select("team_member_id").in("group_id", grupos);
    const tmIds = [...new Set((tmg ?? []).map((x: { team_member_id: string }) => x.team_member_id))];
    if (tmIds.length > 0) {
      const { data: tm } = await admin.from("team_members").select("person_id").in("id", tmIds).eq("owner_id", contaId).eq("status", "ativo").not("person_id", "is", null);
      for (const t of tm ?? []) ids.add((t as { person_id: string }).person_id);
    }
  }
  ids.delete(alunoId);
  return { grupos, pessoasDeContato: [...ids] };
}

/** Sino + WhatsApp para os responsáveis. Devolve o que fez. */
async function avisarMentores(admin: SupabaseClient, a: {
  contaId: string; aluno: { id: string; nome: string }; tipoSino: string; tituloSino: string; textoWhatsapp: string; agora: Date; coalescer: boolean;
}): Promise<string[]> {
  const link = `/pessoas/${a.aluno.id}`;
  if (a.coalescer) {
    const desde = new Date(Date.now() - COALESCER_MIN * 60_000).toISOString();
    const { count } = await admin.from("notificacoes").select("id", { count: "exact", head: true }).eq("tipo", a.tipoSino).eq("link", link).gte("created_at", desde);
    if ((count ?? 0) > 0) return ["mentor_ja_avisado"];
  }
  const feitos: string[] = [];
  const { grupos, pessoasDeContato } = await responsaveis(admin, a.contaId, a.aluno.id);

  const { notificar } = await import("@/lib/notificacoes.functions");
  await notificar(admin as never, { conta: a.contaId, tipo: a.tipoSino, titulo: a.tituloSino, link, grupos: grupos.length > 0 ? grupos : null });
  feitos.push("sino");

  if (!janelaDoWhatsappAberta(a.agora) || pessoasDeContato.length === 0) return feitos;
  const { data: gente } = await admin.from("people").select("id, phone").in("id", pessoasDeContato);
  let algum = false;
  for (const p of (gente ?? []) as { id: string; phone: string | null }[]) {
    const pode = await podeEnviarWhatsapp(admin, p.id, TIPO_AVISO_AO_MENTOR);
    if (!pode.pode) continue;
    if ((await contarEnviosHoje(admin, { person_id: p.id }, { diferente: "codigo_confirmacao" })) >= LIMITE_AVISOS_POR_DIA) continue;
    const r = await enviarMensagem(admin, {
      contaId: a.contaId, criadoPor: null, canal: "whatsapp", tipo: TIPO_AVISO_AO_MENTOR, destino: p.phone ?? "", texto: a.textoWhatsapp, personId: p.id,
    });
    if (r.status === "enviado") algum = true;
  }
  if (algum) feitos.push("mentor_whatsapp");
  return feitos;
}

/** O ponto de entrada. Devolve a lista do que foi feito (vai para `mensagens_recebidas.tratamento`). */
export async function tratarMensagemRecebida(admin: SupabaseClient, args: { contaId: string; msg: MensagemRecebida; agora?: Date }): Promise<string[]> {
  const { contaId, msg } = args;
  const agora = args.agora ?? new Date();
  if (msg.remetente === "desconhecido" || msg.remetente === "equipe") return [];
  // Reenvio tardio: só registra.
  if (Date.now() - new Date(msg.recebidaEm).getTime() > IDADE_MAXIMA_MIN * 60_000) return ["antiga_so_registrada"];

  const pessoas = msg.remetente === "pessoa" && msg.personId ? [{ id: msg.personId, nome: msg.nome ?? "O aluno" }] : (msg.candidatos ?? []).map((c) => ({ id: c.id, nome: c.nome }));
  if (pessoas.length === 0) return [];
  const unico = pessoas.length === 1 ? pessoas[0] : null;
  const feitos: string[] = [];

  // ---- 1. SAIR
  if (msg.tipo === "texto" && ehPedidoDeSair(msg.texto)) {
    await desligarPorPedido(admin, pessoas.map((p) => p.id));
    feitos.push("sair");
    const mascara = mascararTelefone(msg.telefone);
    if ((await contarEnviosHoje(admin, { destino_mascarado: mascara }, { igual: TIPO_CONFIRMACAO_SAIR })) < 2) {
      const r = await enviarMensagem(admin, {
        contaId, criadoPor: null, canal: "whatsapp", tipo: TIPO_CONFIRMACAO_SAIR, destino: msg.telefone, texto: TEXTO_CONFIRMACAO_SAIR, personId: unico?.id ?? null,
      });
      if (r.status === "enviado") feitos.push("confirmacao_enviada");
    }
    if (unico) {
      const avisos = await avisarMentores(admin, {
        contaId, aluno: unico, tipoSino: "whatsapp_saiu", coalescer: false, agora,
        tituloSino: `${unico.nome} pediu para sair do WhatsApp. O WhatsApp dessa pessoa foi desligado; os avisos seguem por e-mail.`,
        textoWhatsapp: `${unico.nome} pediu para sair dos avisos por WhatsApp da plataforma. O WhatsApp dessa pessoa foi desligado; os avisos seguem por e-mail.`,
      });
      if (avisos.length > 0) feitos.push("mentor_avisado");
    }
    return feitos;
  }

  // ---- demais mensagens: só de ALUNO identificado (número em dois cadastros não recebe resposta nem aviso)
  if (!unico) return [];

  // ---- 2. resposta automática
  if (janelaDoWhatsappAberta(agora) && (await contarEnviosHoje(admin, { person_id: unico.id }, { igual: TIPO_RESPOSTA_AUTOMATICA })) === 0) {
    const r = await enviarMensagem(admin, {
      contaId, criadoPor: null, canal: "whatsapp", tipo: TIPO_RESPOSTA_AUTOMATICA, destino: msg.telefone, texto: TEXTO_RESPOSTA_AUTOMATICA, personId: unico.id,
    });
    if (r.status === "enviado") feitos.push("resposta_automatica");
  }

  // ---- 3. mentor avisado
  const t = trecho(msg.texto, 200);
  const oQue = t ? `respondeu no WhatsApp da plataforma: “${t}”` : `enviou ${DESCRICAO_DO_TIPO[msg.tipo] ?? "uma mensagem"} no WhatsApp da plataforma`;
  const tSino = trecho(msg.texto, 80);
  const avisos = await avisarMentores(admin, {
    contaId, aluno: unico, tipoSino: "whatsapp_resposta", coalescer: true, agora,
    tituloSino: tSino ? `${unico.nome} respondeu no WhatsApp: “${tSino}”` : `${unico.nome} enviou ${DESCRICAO_DO_TIPO[msg.tipo] ?? "uma mensagem"} no WhatsApp`,
    textoWhatsapp: `${unico.nome} ${oQue}. Veja em Configurações → WhatsApp → Mensagens recebidas e responda pelo seu celular.`,
  });
  if (avisos.some((x) => x === "sino" || x === "mentor_whatsapp")) feitos.push("mentor_avisado");
  return feitos;
}
