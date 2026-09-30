/**
 * Menu Mensagens — M1b (+ ajustes M1b-2): o que a plataforma FAZ quando chega uma mensagem (depois de registrá-la).
 *
 *  1. SAIR: se a mensagem for só SAIR, PARAR, STOP ou CANCELAR, o WhatsApp de quem escreveu é desligado na hora
 *     (consentimento revogado, motivo "pediu_sair") e a pessoa recebe UMA confirmação. Número em mais de um cadastro:
 *     todos os cadastros são desligados. Número desconhecido que escreve SAIR: nada a desligar, nada a responder.
 *  2. Resposta automática, a QUALQUER hora (é resposta a quem acabou de escrever), no máximo 1 por dia por número:
 *       - aluno cadastrado: "Olá, [primeiro nome]! Recebemos sua mensagem. Em breve seu mentor vai falar com você."
 *       - número desconhecido: boas-vindas ao canal do Método Intenção.
 *     Nunca para a equipe, nunca para o próprio número da plataforma (o webhook já ignora o eco), nunca para número
 *     ambíguo (em dois cadastros).
 *  3. Aviso ao mentor: sino + WhatsApp com o telefone COMPLETO (para ele poder retornar), a qualquer hora e sem limite
 *     diário — é o número do próprio mentor. Exige consentimento vigente e telefone válido de quem recebe. Nova mensagem
 *     da mesma pessoa em até 15 minutos não avisa de novo. Aluno de turma: dono + mentores da turma. Aluno SEM turma e
 *     desconhecido (que não tem mentor responsável): SÓ o dono.
 *
 * Mensagem antiga (reenvio tardio da Zapster, mais de 30 min) é só registrada: nunca se responde nem se avisa por ela.
 * Nunca lança para o webhook: quem chama protege com try/catch. O telefone completo só existe na tabela de mensagens e no
 * WhatsApp do mentor: nunca em log.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarMensagem } from "./enviar.server";
import { podeEnviarWhatsapp } from "./consentimento.server";
import { inicioDoDiaEmBrasilia } from "./lembrete-whatsapp.server";
import { createHash } from "node:crypto";
import { formatarTelefoneBR, mascararTelefone } from "./telefone";

export const TIPO_CONFIRMACAO_SAIR = "confirmacao_sair";
export const TIPO_RESPOSTA_AUTOMATICA = "resposta_automatica";
export const TIPO_AVISO_AO_MENTOR = "mentor_resposta_aluno";
export const IDADE_MAXIMA_MIN = 30;
export const COALESCER_MIN = 15;

export const TEXTO_CONFIRMACAO_SAIR =
  "Pronto: você não receberá mais mensagens da Plataforma Método Intenção pelo WhatsApp. Os avisos continuam chegando por e-mail. " +
  "Se quiser voltar, é só ativar de novo no seu perfil da plataforma, em Recebimento de mensagens.";
export const TEXTO_BOAS_VINDAS_DESCONHECIDO =
  "Olá! Seja bem-vindo(a) ao Método Intenção. Este é o canal exclusivo de agendamentos e informativos para alunos, clientes, " +
  "mentores e parceiros do Método Intenção. Recebemos sua mensagem e em breve um mentor vai falar com você.";

export function textoRespostaAoAluno(nome: string | null): string {
  const primeiro = (nome ?? "").trim().split(/\s+/)[0];
  return `${primeiro ? `Olá, ${primeiro}!` : "Olá!"} Recebemos sua mensagem. Em breve seu mentor vai falar com você.\n— Método Intenção`;
}

/** Só SAIR, PARAR, STOP ou CANCELAR (com ou sem acento, maiúscula ou pontuação). "sair da reunião" NÃO é um pedido de sair. */
export function ehPedidoDeSair(texto: string | null): boolean {
  const t = (texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  return ["sair", "parar", "stop", "cancelar"].includes(t);
}

export type MensagemRecebida = {
  id: string; telefone: string; remetente: "pessoa" | "equipe" | "desconhecido" | "ambiguo";
  personId: string | null; nome: string | null; nomeDoPerfil?: string | null; candidatos: { id: string; nome: string }[] | null;
  tipo: string; texto: string | null; recebidaEm: string;
};

const MIDIA_ENTRE_COLCHETES: Record<string, string> = {
  audio: "[enviou um áudio]", imagem: "[enviou uma imagem]", video: "[enviou um vídeo]", documento: "[enviou um documento]",
  sticker: "[enviou uma figurinha]", localizacao: "[enviou uma localização]", contato: "[enviou um contato]", formulario: "[enviou um formulário]",
};

/** O que o mentor lê: o texto (até 300 caracteres) ou, para mídia, "[enviou um áudio]" etc. */
export function conteudoParaOMentor(m: Pick<MensagemRecebida, "tipo" | "texto">): string {
  if (MIDIA_ENTRE_COLCHETES[m.tipo]) return MIDIA_ENTRE_COLCHETES[m.tipo];
  return trecho(m.texto, 300) ?? "[enviou uma resposta]";
}

function trecho(t: string | null, max: number): string | null {
  const s = (t ?? "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

async function contarEnviosHoje(admin: SupabaseClient, filtro: { destino_mascarado?: string }, tipo: { igual?: string }) {
  let q = admin.from("envios_mensagens").select("id", { count: "exact", head: true })
    .eq("canal", "whatsapp").gte("criado_em", inicioDoDiaEmBrasilia(new Date()));
  if (filtro.destino_mascarado) q = q.eq("destino_mascarado", filtro.destino_mascarado);
  if (tipo.igual) q = q.eq("tipo", tipo.igual);
  const { count } = await q;
  return count ?? 0;
}

/** Já respondemos automaticamente a ESTE número hoje? (pelo telefone completo da própria mensagem registrada — exato) */
async function jaRespondeuHoje(admin: SupabaseClient, telefone: string): Promise<boolean> {
  const { count } = await admin.from("mensagens_recebidas").select("id", { count: "exact", head: true })
    .eq("telefone", telefone).like("tratamento", "%resposta_automatica%").gte("criado_em", inicioDoDiaEmBrasilia(new Date()));
  return (count ?? 0) > 0;
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
async function responsaveis(admin: SupabaseClient, contaId: string, alunoId: string | null) {
  const { data: gm } = alunoId ? await admin.from("group_members").select("group_id").eq("person_id", alunoId) : { data: [] as { group_id: string }[] };
  const grupos = (gm ?? []).map((g: { group_id: string }) => g.group_id);
  const ids = new Set<string>();
  const { data: donoPessoa } = await admin.from("people").select("id").eq("mentor_id", contaId).eq("user_id", contaId);
  for (const p of donoPessoa ?? []) ids.add((p as { id: string }).id);
  if (alunoId && grupos.length > 0) {
    const { data: tmg } = await admin.from("team_member_groups").select("team_member_id").in("group_id", grupos);
    const tmIds = [...new Set((tmg ?? []).map((x: { team_member_id: string }) => x.team_member_id))];
    if (tmIds.length > 0) {
      const { data: tm } = await admin.from("team_members").select("person_id").in("id", tmIds).eq("owner_id", contaId).eq("status", "ativo").not("person_id", "is", null);
      for (const t of tm ?? []) ids.add((t as { person_id: string }).person_id);
    }
  }
  if (alunoId) ids.delete(alunoId);
  return { grupos, pessoasDeContato: [...ids] };
}

/**
 * Sino + WhatsApp para os responsáveis. Aluno de turma: dono + mentores da turma. SEM turma (ou desconhecido): SÓ o dono.
 * WhatsApp a qualquer hora e sem limite diário; exige consentimento vigente e telefone válido de quem recebe.
 */
async function avisarMentores(admin: SupabaseClient, a: {
  contaId: string; alunoId: string | null; chaveDeAgrupamento: string; tipoSino: string; tituloSino: string; textoWhatsapp: string; coalescer: boolean;
}): Promise<string[]> {
  const link = a.alunoId ? `/pessoas/${a.alunoId}` : `/configuracoes?contato=${a.chaveDeAgrupamento}`;
  if (a.coalescer) {
    const desde = new Date(Date.now() - COALESCER_MIN * 60_000).toISOString();
    const { count } = await admin.from("notificacoes").select("id", { count: "exact", head: true }).eq("tipo", a.tipoSino).eq("link", link).gte("created_at", desde);
    if ((count ?? 0) > 0) return ["mentor_ja_avisado"];
  }
  const feitos: string[] = [];
  const { grupos, pessoasDeContato } = a.alunoId ? await responsaveis(admin, a.contaId, a.alunoId) : await responsaveis(admin, a.contaId, null);

  if (grupos.length > 0) {
    const { notificar } = await import("@/lib/notificacoes.functions");
    await notificar(admin as never, { conta: a.contaId, tipo: a.tipoSino, titulo: a.tituloSino, link, grupos });
  } else {
    // Sem turma não há "mentor responsável": só o dono (e não a equipe inteira, que o aviso de conta inteira alcançaria).
    const { error } = await admin.from("notificacoes").insert({ user_id: a.contaId, conta_id: a.contaId, tipo: a.tipoSino, titulo: a.tituloSino, link });
    if (error) throw new Error(error.message);
  }
  feitos.push("sino");

  if (pessoasDeContato.length === 0) return feitos;
  const { data: gente } = await admin.from("people").select("id, phone").in("id", pessoasDeContato);
  let algum = false;
  for (const p of (gente ?? []) as { id: string; phone: string | null }[]) {
    const pode = await podeEnviarWhatsapp(admin, p.id, TIPO_AVISO_AO_MENTOR);
    if (!pode.pode) continue;
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
  if (msg.remetente === "equipe") return [];
  // Reenvio tardio: só registra.
  if (Date.now() - new Date(msg.recebidaEm).getTime() > IDADE_MAXIMA_MIN * 60_000) return ["antiga_so_registrada"];

  const pessoas = msg.remetente === "pessoa" && msg.personId ? [{ id: msg.personId, nome: msg.nome ?? "O aluno" }] : (msg.candidatos ?? []).map((c) => ({ id: c.id, nome: c.nome }));
  const unico = pessoas.length === 1 ? pessoas[0] : null;
  const feitos: string[] = [];
  const pedidoDeSair = msg.tipo === "texto" && ehPedidoDeSair(msg.texto);

  // ---- 1. SAIR (quem não está cadastrado não tem o que desligar nem o que confirmar)
  if (pedidoDeSair && pessoas.length > 0) {
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
        contaId, alunoId: unico.id, chaveDeAgrupamento: unico.id, tipoSino: "whatsapp_saiu", coalescer: false,
        tituloSino: `${unico.nome} pediu para sair do WhatsApp. O WhatsApp dessa pessoa foi desligado; os avisos seguem por e-mail.`,
        textoWhatsapp: `${unico.nome} (${formatarTelefoneBR(msg.telefone)}) pediu para sair dos avisos por WhatsApp da plataforma. O WhatsApp dessa pessoa foi desligado; os avisos seguem por e-mail.`,
      });
      if (avisos.length > 0) feitos.push("mentor_avisado");
    }
    return feitos;
  }
  if (pedidoDeSair) return []; // desconhecido escrevendo SAIR: nada

  // ---- número em dois cadastros: não responde, não avisa (não se escolhe no escuro)
  if (msg.remetente === "ambiguo") return [];

  const conteudo = conteudoParaOMentor(msg);
  const tel = formatarTelefoneBR(msg.telefone);

  // ---- 2. resposta automática (a qualquer hora, no máximo 1 por dia por número)
  if (!(await jaRespondeuHoje(admin, msg.telefone))) {
    const texto = msg.remetente === "pessoa" ? textoRespostaAoAluno(unico?.nome ?? null) : TEXTO_BOAS_VINDAS_DESCONHECIDO;
    const r = await enviarMensagem(admin, {
      contaId, criadoPor: null, canal: "whatsapp", tipo: TIPO_RESPOSTA_AUTOMATICA, destino: msg.telefone, texto, personId: unico?.id ?? null,
    });
    if (r.status === "enviado") feitos.push("resposta_automatica");
  }

  // ---- 3. mentor (ou só o dono, se o contato é desconhecido) avisado
  if (msg.remetente === "pessoa" && unico) {
    const tSino = trecho(msg.texto, 80);
    const avisos = await avisarMentores(admin, {
      contaId, alunoId: unico.id, chaveDeAgrupamento: unico.id, tipoSino: "whatsapp_resposta", coalescer: true,
      tituloSino: tSino && !MIDIA_ENTRE_COLCHETES[msg.tipo] ? `${unico.nome} respondeu no WhatsApp: “${tSino}”` : `${unico.nome} ${MIDIA_ENTRE_COLCHETES[msg.tipo]?.replace(/^\[|\]$/g, "") ?? "enviou uma mensagem"} no WhatsApp`,
      textoWhatsapp: `${unico.nome} (${tel}) mandou mensagem no número do Método Intenção: "${conteudo}"`,
    });
    if (avisos.some((x) => x === "sino" || x === "mentor_whatsapp")) feitos.push("mentor_avisado");
  } else if (msg.remetente === "desconhecido") {
    const quem = (msg.nomeDoPerfil ?? "").trim();
    const tSino = trecho(msg.texto, 80);
    const chave = createHash("sha256").update(msg.telefone).digest("hex").slice(0, 12);
    const avisos = await avisarMentores(admin, {
      contaId, alunoId: null, chaveDeAgrupamento: chave, tipoSino: "whatsapp_novo_contato", coalescer: true,
      tituloSino: `Novo contato no WhatsApp: ${quem || mascararTelefone(msg.telefone)}${tSino && !MIDIA_ENTRE_COLCHETES[msg.tipo] ? `: “${tSino}”` : ` ${MIDIA_ENTRE_COLCHETES[msg.tipo]?.replace(/^\[|\]$/g, "") ?? ""}`}`.trim(),
      textoWhatsapp: `Novo contato no número do Método Intenção: ${quem ? `${quem} ` : ""}(${tel}): "${conteudo}"`,
    });
    if (avisos.some((x) => x === "sino" || x === "mentor_whatsapp")) feitos.push("mentor_avisado");
  }
  return feitos;
}
