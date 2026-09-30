/**
 * Consentimento de WhatsApp — a parte que fala com o banco (#291 F1b). Só roda no servidor, com a chave de serviço.
 *
 * O aceite só nasce depois do CÓDIGO confirmado; o código é guardado só como resumo (HMAC com sal); desligar vale
 * na hora e não pede código. O registro do aceite nunca é sobrescrito: revogar marca a linha antiga, mudar de nível
 * revoga e cria outra.
 *
 * ⚠️ Nenhum texto de mensagem (logo, nenhum código) é registrado em log ou no registro de envios.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { enviarMensagem } from "./enviar.server";
import { mascararTelefone, normalizarTelefoneBR } from "./telefone";
import {
  CODIGO_MAX_POR_HORA, CODIGO_MAX_TENTATIVAS, CODIGO_VALIDADE_MINUTOS, TERMO_TEXTO, TERMO_VERSAO, TIPO_CODIGO,
  codigoBemFormado, nivelCobre, textoDoCodigo, type NivelWhatsapp,
} from "./consentimento";

export type PessoaDoConsentimento = { id: string; mentor_id: string; full_name: string; phone: string | null };

export type Vigente = {
  id: string; nivel: NivelWhatsapp; aceito_em: string; destino_mascarado: string; termo_versao: string;
};

/** Erro que a tela pode mostrar como está (mensagem já escrita para o aluno). */
export class ErroDeConsentimento extends Error {}

export const SO_O_ALUNO = "Só o aluno pode ativar.";

/**
 * A pessoa (cadastro) do LOGIN de quem chama — nunca de outra. É aqui que "só o próprio aluno aceita" é decidido:
 * as ações não recebem id de pessoa, e qualquer chamada que traga `preview` ("Ver como aluno") é recusada, venha
 * da tela ou direto do servidor. O dono, mesmo vendo a tela do aluno, nunca aceita em nome dele.
 */
export async function pessoaDoLogin(
  supabase: SupabaseClient, userId: string, preview?: string | null,
): Promise<PessoaDoConsentimento> {
  if (preview) throw new ErroDeConsentimento(SO_O_ALUNO);
  const { data, error } = await supabase.from("people")
    .select("id, mentor_id, full_name, phone").eq("user_id", userId).order("created_at", { ascending: true }).limit(1);
  if (error) throw new Error(error.message);
  const p = (data ?? [])[0];
  if (!p) throw new ErroDeConsentimento("Este login não tem um cadastro de aluno. Só o aluno pode ativar.");
  return p as PessoaDoConsentimento;
}

function chaveDoResumo(): string {
  const k = process.env.APP_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("Falta a chave do servidor para proteger o código.");
  return `whatsapp-codigo-v1:${k}`;
}

export function resumoDoCodigo(codigo: string, sal: string): string {
  return createHmac("sha256", chaveDoResumo()).update(`${sal}:${codigo}`).digest("hex");
}

function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex"), y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

function gerarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// ------------------------------------------------------------------------------------------ leitura

/** O consentimento VIGENTE (linha não revogada) — e só se ainda vale para o número de hoje do cadastro. */
export async function consentimentoVigente(admin: SupabaseClient, pessoa: PessoaDoConsentimento): Promise<
  { vigente: Vigente | null; numeroMudou: boolean }
> {
  const { data, error } = await admin
    .from("whatsapp_consentimentos")
    .select("id, nivel, aceito_em, destino_mascarado, termo_versao")
    .eq("person_id", pessoa.id).is("revogado_em", null).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { vigente: null, numeroMudou: false };
  // O aceite vale para AQUELE número. Se o mentor trocou o telefone do cadastro, o consentimento não vale mais.
  const mudou = data.destino_mascarado !== mascararTelefone(pessoa.phone);
  return { vigente: data as Vigente, numeroMudou: mudou };
}

/**
 * "Posso mandar WhatsApp do tipo X para a pessoa Y?" — a pergunta que a F1c faz ANTES de cada aviso.
 * Sim só se: há consentimento vigente, o número do cadastro é o que foi confirmado e é um celular válido, e o
 * nível escolhido cobre o tipo. Qualquer dúvida é NÃO.
 */
export async function podeEnviarWhatsapp(admin: SupabaseClient, personId: string, tipo: string): Promise<
  { pode: true } | { pode: false; motivo: string }
> {
  const { data: p, error } = await admin.from("people").select("id, mentor_id, full_name, phone").eq("id", personId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!p) return { pode: false, motivo: "pessoa não encontrada" };
  const { vigente, numeroMudou } = await consentimentoVigente(admin, p as PessoaDoConsentimento);
  if (!vigente) return { pode: false, motivo: "sem consentimento vigente" };
  if (numeroMudou) return { pode: false, motivo: "o número do cadastro mudou depois do aceite" };
  if (!normalizarTelefoneBR(p.phone).ok) return { pode: false, motivo: "telefone inválido" };
  if (!nivelCobre(vigente.nivel, tipo)) return { pode: false, motivo: `o nível ${vigente.nivel} não cobre este aviso` };
  return { pode: true };
}

// ------------------------------------------------------------------------------------------ código

export async function pedirCodigo(admin: SupabaseClient, args: {
  pessoa: PessoaDoConsentimento; userId: string; nivel: NivelWhatsapp;
}): Promise<{ expiraEm: string }> {
  const { pessoa, userId, nivel } = args;
  const fone = normalizarTelefoneBR(pessoa.phone);
  if (!fone.ok) {
    throw new ErroDeConsentimento("O telefone do seu cadastro não parece um celular válido. Use “Meu número está errado” para avisar o seu mentor.");
  }

  // No máximo 3 códigos ENVIADOS por hora, por aluno.
  const umaHoraAtras = new Date(Date.now() - 3_600_000).toISOString();
  const { count, error: cErr } = await admin.from("whatsapp_codigos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("enviado", true).gte("criado_em", umaHoraAtras);
  if (cErr) throw new Error(cErr.message);
  if ((count ?? 0) >= CODIGO_MAX_POR_HORA) {
    throw new ErroDeConsentimento(`Você já pediu ${CODIGO_MAX_POR_HORA} códigos na última hora. Espere um pouco e tente de novo.`);
  }

  // Um código novo substitui o anterior: só o mais recente vale.
  await admin.from("whatsapp_codigos").update({ invalidado_em: new Date().toISOString() })
    .eq("user_id", userId).is("consumido_em", null).is("invalidado_em", null);

  const codigo = gerarCodigo();
  const sal = randomBytes(16).toString("hex");
  const expiraEm = new Date(Date.now() + CODIGO_VALIDADE_MINUTOS * 60_000).toISOString();
  const { data: linha, error: iErr } = await admin.from("whatsapp_codigos").insert({
    conta_id: pessoa.mentor_id, person_id: pessoa.id, user_id: userId, nivel,
    telefone_mascarado: mascararTelefone(pessoa.phone), codigo_hash: resumoDoCodigo(codigo, sal), sal, expira_em: expiraEm,
  }).select("id").single();
  if (iErr || !linha) throw new Error(iErr?.message ?? "Não consegui registrar o código.");

  const r = await enviarMensagem(admin, {
    contaId: pessoa.mentor_id, criadoPor: userId, canal: "whatsapp", tipo: TIPO_CODIGO,
    destino: pessoa.phone ?? "", texto: textoDoCodigo(codigo), personId: pessoa.id,
  });
  if (r.status !== "enviado") {
    await admin.from("whatsapp_codigos").update({ invalidado_em: new Date().toISOString() }).eq("id", linha.id);
    throw new ErroDeConsentimento("Não consegui enviar o código agora. Tente de novo em alguns minutos.");
  }
  await admin.from("whatsapp_codigos").update({ enviado: true }).eq("id", linha.id);
  return { expiraEm };
}

export async function confirmarCodigo(admin: SupabaseClient, args: {
  pessoa: PessoaDoConsentimento; userId: string; codigo: string;
}): Promise<{ nivel: NivelWhatsapp }> {
  const { pessoa, userId, codigo } = args;
  if (!codigoBemFormado(codigo)) throw new ErroDeConsentimento("O código tem 6 dígitos.");

  const { data: c, error } = await admin.from("whatsapp_codigos")
    .select("id, person_id, nivel, telefone_mascarado, codigo_hash, sal, expira_em, tentativas")
    .eq("user_id", userId).is("consumido_em", null).is("invalidado_em", null)
    .order("criado_em", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!c || c.person_id !== pessoa.id) throw new ErroDeConsentimento("Não há código esperando confirmação. Peça um novo.");

  const agora = new Date();
  const invalidar = () => admin.from("whatsapp_codigos").update({ invalidado_em: agora.toISOString() }).eq("id", c.id);
  if (new Date(c.expira_em) <= agora) {
    await invalidar();
    throw new ErroDeConsentimento("O código expirou. Peça um novo.");
  }
  if (c.telefone_mascarado !== mascararTelefone(pessoa.phone)) {
    await invalidar();
    throw new ErroDeConsentimento("O telefone do seu cadastro mudou depois que o código foi enviado. Peça um novo.");
  }

  // A tentativa conta ANTES da conferência, de forma atômica: dois palpites ao mesmo tempo não driblam o limite.
  const { data: contou } = await admin.from("whatsapp_codigos")
    .update({ tentativas: c.tentativas + 1 }).eq("id", c.id).eq("tentativas", c.tentativas).lt("tentativas", CODIGO_MAX_TENTATIVAS)
    .select("tentativas").maybeSingle();
  if (!contou) {
    // Não contou: ou o limite já foi atingido, ou outro palpite chegou junto. Só no primeiro caso o código morre.
    const { data: atual } = await admin.from("whatsapp_codigos").select("tentativas").eq("id", c.id).maybeSingle();
    if ((atual?.tentativas ?? CODIGO_MAX_TENTATIVAS) >= CODIGO_MAX_TENTATIVAS) {
      await invalidar();
      throw new ErroDeConsentimento("Você errou o código vezes demais. Peça um novo.");
    }
    throw new ErroDeConsentimento("Não consegui conferir agora. Tente de novo.");
  }

  if (!iguais(resumoDoCodigo(codigo, c.sal), c.codigo_hash)) {
    const restantes = CODIGO_MAX_TENTATIVAS - contou.tentativas;
    if (restantes <= 0) {
      await invalidar();
      throw new ErroDeConsentimento("Você errou o código vezes demais. Peça um novo.");
    }
    throw new ErroDeConsentimento(`Código incorreto. Você ainda tem ${restantes} ${restantes === 1 ? "tentativa" : "tentativas"}.`);
  }

  // Acertou: consome o código (uma vez só) e registra o aceite.
  const { data: usado } = await admin.from("whatsapp_codigos")
    .update({ consumido_em: agora.toISOString() }).eq("id", c.id).is("consumido_em", null).is("invalidado_em", null)
    .select("id").maybeSingle();
  if (!usado) throw new ErroDeConsentimento("Este código já foi usado. Peça um novo.");

  await registrarAceite(admin, { pessoa, userId, nivel: c.nivel as NivelWhatsapp });
  return { nivel: c.nivel as NivelWhatsapp };
}

// ------------------------------------------------------------------------------------------ decisões

/** Revoga o vigente (se houver) e cria a nova linha. Nunca sobrescreve o histórico. */
async function registrarAceite(admin: SupabaseClient, args: {
  pessoa: PessoaDoConsentimento; userId: string; nivel: NivelWhatsapp;
}) {
  const { pessoa, userId, nivel } = args;
  const agora = new Date().toISOString();
  const { error: rErr } = await admin.from("whatsapp_consentimentos")
    .update({ revogado_em: agora, revogado_motivo: "mudou_nivel" }).eq("person_id", pessoa.id).is("revogado_em", null);
  if (rErr) throw new Error(rErr.message);
  const { error: iErr } = await admin.from("whatsapp_consentimentos").insert({
    conta_id: pessoa.mentor_id, person_id: pessoa.id, user_id: userId, nivel,
    termo_versao: TERMO_VERSAO, texto_aceito: TERMO_TEXTO, destino_mascarado: mascararTelefone(pessoa.phone),
  });
  if (iErr) throw new Error(iErr.message);
}

/** Muda de Essencial para Completo (ou o contrário) sem novo código: o número já foi confirmado e não mudou. */
export async function mudarNivel(admin: SupabaseClient, args: {
  pessoa: PessoaDoConsentimento; userId: string; nivel: NivelWhatsapp;
}): Promise<{ mudou: boolean }> {
  const { vigente, numeroMudou } = await consentimentoVigente(admin, args.pessoa);
  if (!vigente) throw new ErroDeConsentimento("Para ligar o WhatsApp, confirme o seu número com o código.");
  if (numeroMudou) throw new ErroDeConsentimento("O telefone do seu cadastro mudou. Confirme o número com um novo código.");
  if (vigente.nivel === args.nivel) return { mudou: false };
  await registrarAceite(admin, args);
  return { mudou: true };
}

/** Desliga: vale na hora, sem código. Também cancela qualquer código que estivesse esperando. */
export async function desligar(admin: SupabaseClient, args: { pessoa: PessoaDoConsentimento; userId: string }): Promise<{ desligou: boolean }> {
  const agora = new Date().toISOString();
  await admin.from("whatsapp_codigos").update({ invalidado_em: agora })
    .eq("user_id", args.userId).is("consumido_em", null).is("invalidado_em", null);
  const { data, error } = await admin.from("whatsapp_consentimentos")
    .update({ revogado_em: agora, revogado_motivo: "desligou" }).eq("person_id", args.pessoa.id).is("revogado_em", null)
    .select("id");
  if (error) throw new Error(error.message);
  return { desligou: (data?.length ?? 0) > 0 };
}

/**
 * "Meu número está errado": um aviso no sino do mentor responsável (o dono da conta, e os mentores dos grupos da
 * pessoa). O aluno NÃO edita o telefone. Um aviso por pessoa a cada 24 h: apertar de novo não enche o sino.
 * É a única escrita no sino desta fatia.
 */
export async function avisarNumeroErrado(admin: SupabaseClient, args: { pessoa: PessoaDoConsentimento; userId: string }) {
  const { pessoa, userId } = args;
  const link = `/pessoas/${pessoa.id}`;
  const { count } = await admin.from("notificacoes").select("id", { count: "exact", head: true })
    .eq("tipo", "whatsapp_numero_errado").eq("link", link)
    .gte("created_at", new Date(Date.now() - 24 * 3_600_000).toISOString());
  if ((count ?? 0) > 0) return { avisou: true as const, jaAvisado: true as const };

  const { data: gm } = await admin.from("group_members").select("group_id").eq("person_id", pessoa.id);
  const grupos = (gm ?? []).map((g: { group_id: string }) => g.group_id);
  const { notificar } = await import("@/lib/notificacoes.functions");
  await notificar(admin as never, {
    conta: pessoa.mentor_id,
    tipo: "whatsapp_numero_errado",
    titulo: `${pessoa.full_name} informou que o telefone do cadastro está errado.`,
    link,
    ator: userId,
    atorNome: pessoa.full_name,
    grupos: grupos.length > 0 ? grupos : null,
  });
  return { avisou: true as const, jaAvisado: false as const };
}
