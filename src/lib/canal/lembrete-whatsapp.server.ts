/**
 * Lembrete de mentoria pelo WhatsApp (#291 F1c). O relógio (`/api/cron/lembretes` → `enviarLembretesDevidos`)
 * chama `lembreteWhatsapp` para cada lembrete devido, DEPOIS do e-mail e sem nunca atrapalhá-lo: o e-mail sai
 * exatamente como sempre, para todos; o WhatsApp é SOMADO, só para o aluno que autorizou.
 *
 * As regras, na ordem em que são conferidas:
 *   1. janela: só entre 8h e 20h (Brasília). Fora dela espera — e se a sessão já começou, não manda.
 *   2. consentimento: `podeEnviarWhatsapp(…, "lembrete_mentoria")` (F1b) — sem ele, nada é tentado nem registrado.
 *   3. limite: no máximo 3 WhatsApp por dia por pessoa (código de confirmação não conta); passou → não manda e registra.
 *   4. instância da Zapster desconectada: não tenta; 1 aviso por dia no sino do DONO. Não gasta a trava: quando
 *      reconectar, o lembrete ainda sai (se a sessão não tiver começado).
 *   5. trava contra repetição: a linha `aluno_whatsapp` em `lembretes_enviados` (a mesma tabela do e-mail). É gravada
 *      ANTES de enviar: duas rodadas ao mesmo tempo disputam a linha e só uma envia.
 *   6. envio pela camada de canal (registra em `envios_mensagens`, com dono e pessoa). Falhou → UM aviso no sino do
 *      mentor responsável; o e-mail já saiu.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { adaptadorDoCanal, enviarMensagem, registrarEnvioNaoFeito } from "./enviar.server";
import { podeEnviarWhatsapp } from "./consentimento.server";
import type { EstadoDaConexao } from "./tipos";

export const TIPO_LEMBRETE_MENTORIA = "lembrete_mentoria";
export const LIMITE_WHATSAPP_POR_DIA = 3;
export const JANELA_INICIO_H = 8;
export const JANELA_FIM_H = 20; // exclusivo: 19h59 ainda pode, 20h00 não
const FUSO = "America/Sao_Paulo";

// ------------------------------------------------------------------------------------------ tempo (puro)
function partes(d: Date) {
  const f = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric",
    weekday: "long", hour12: false,
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(d)) o[p.type] = p.value;
  return { hora: Number(o.hour) % 24, minuto: o.minute, dia: o.day, mes: o.month, ano: o.year, semana: o.weekday };
}

export function horaEmBrasilia(d: Date): number { return partes(d).hora; }

/** O WhatsApp só sai entre 8h e 20h, horário de Brasília. */
export function janelaDoWhatsappAberta(d: Date): boolean {
  const h = horaEmBrasilia(d);
  return h >= JANELA_INICIO_H && h < JANELA_FIM_H;
}

/** Início do dia de `d` em Brasília (UTC−3, sem horário de verão), em ISO. */
export function inicioDoDiaEmBrasilia(d: Date): string {
  const p = partes(d);
  return new Date(`${p.ano}-${p.mes}-${p.dia}T03:00:00.000Z`).toISOString();
}

function diasEntre(de: Date, ate: Date): number {
  const a = partes(de), b = partes(ate);
  return Math.round((Date.UTC(+b.ano, +b.mes - 1, +b.dia) - Date.UTC(+a.ano, +a.mes - 1, +a.dia)) / 86_400_000);
}

/** "quinta-feira, 02/10, às 14:30" — como a plataforma escreve o dia e a hora de uma sessão nas mensagens (M1c). */
export function quandoPorExtenso(d: Date): string {
  const p = partes(d);
  return `${p.semana}, ${p.dia}/${p.mes}, às ${String(p.hora).padStart(2, "0")}:${p.minuto}`;
}

// ------------------------------------------------------------------------------------------ texto (puro)
/** Os mesmos dados de local/link que o e-mail de lembrete usa (`ondeTexto`), no formato curto da mensagem. */
export function ondeParaWhatsapp(modalidade: string, local: string | null, linkUrl: string | null): string {
  if (modalidade === "presencial") return local ? `Local: ${local}` : "Local: a combinar com o seu mentor.";
  return linkUrl ? `Link: ${linkUrl}` : "Link: a combinar com o seu mentor.";
}

export function textoDoLembrete(a: {
  nomeAluno: string | null; nomeMentor: string; quando: Date; agora: Date;
  modalidade: string; local: string | null; linkUrl: string | null; linkDaSessao: string | null;
}): string {
  const primeiro = (a.nomeAluno ?? "").trim().split(/\s+/)[0];
  const p = partes(a.quando);
  const dias = diasEntre(a.agora, a.quando);
  const relativo = dias === 0 ? "hoje, " : dias === 1 ? "amanhã, " : "em ";
  const dia = `${p.semana}, ${p.dia}/${p.mes}`;
  const linhas = [
    `${primeiro ? `Olá, ${primeiro}!` : "Olá!"} Passando para lembrar da sua mentoria com ${a.nomeMentor} ${relativo}${dia}, às ${p.hora.toString().padStart(2, "0")}:${p.minuto}.`,
    ondeParaWhatsapp(a.modalidade, a.local, a.linkUrl),
  ];
  if (a.linkDaSessao) linhas.push(`Se precisar remarcar, é por aqui: ${a.linkDaSessao}`);
  linhas.push("Até lá! — Método Intenção");
  linhas.push("Toque em OK para confirmar (ou responda OK).");
  return linhas.join("\n");
}

// ------------------------------------------------------------------------------------------ a rodada
export type ResultadoWhatsapp =
  | "enviado" | "falhou" | "limite" | "espera_janela" | "sem_consentimento" | "desconectado"
  | "nao_configurado" | "ja_tratado" | "sem_pessoa";

export type RodadaWhatsapp = {
  admin: SupabaseClient;
  agora: Date;
  conexao?: EstadoDaConexao;
  avisados: Set<string>; // contas que já foram avisadas de "desconectado" nesta rodada
};

export function novaRodada(admin: SupabaseClient, agora: Date): RodadaWhatsapp {
  return { admin, agora, avisados: new Set() };
}

type Sessao = {
  id: string; mentor_id: string; mentoria_id: string; quando: string;
  modalidade: string; local: string | null; link_url: string | null;
};
type Link = { permite_cancelar: boolean; permite_remarcar: boolean };

async function conexaoDaRodada(r: RodadaWhatsapp): Promise<EstadoDaConexao> {
  r.conexao ??= await adaptadorDoCanal("whatsapp")!.estadoDaConexao();
  return r.conexao;
}

async function avisarDonoDesconectado(r: RodadaWhatsapp, contaId: string) {
  if (r.avisados.has(contaId)) return;
  r.avisados.add(contaId);
  // Hora REAL (não a da rodada): o aviso nasce com a hora real do banco, e é ela que define "nas últimas 24 h".
  const desde = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { count } = await r.admin.from("notificacoes").select("id", { count: "exact", head: true })
    .eq("user_id", contaId).eq("tipo", "whatsapp_desconectado").gte("created_at", desde);
  if ((count ?? 0) > 0) return; // no máximo 1 por dia
  const { error } = await r.admin.from("notificacoes").insert({
    user_id: contaId, conta_id: contaId, tipo: "whatsapp_desconectado",
    titulo: "O WhatsApp da plataforma está desconectado. Os lembretes estão saindo só por e-mail.",
    link: "/configuracoes",
  });
  if (error) console.error("[lembrete-whatsapp] aviso de desconexão não gravado:", error.message);
}

async function avisarMentorDaFalha(r: RodadaWhatsapp, s: Sessao, pessoa: { id: string; full_name: string }, motivo: string) {
  const { data: gm } = await r.admin.from("group_members").select("group_id").eq("person_id", pessoa.id);
  const grupos = (gm ?? []).map((g: { group_id: string }) => g.group_id);
  const p = partes(new Date(s.quando));
  const { notificar } = await import("@/lib/notificacoes.functions");
  await notificar(r.admin as never, {
    conta: s.mentor_id,
    tipo: "whatsapp_falha_lembrete",
    titulo: `Não consegui avisar ${pessoa.full_name} pelo WhatsApp sobre a mentoria de ${p.dia}/${p.mes} às ${String(p.hora).padStart(2, "0")}:${p.minuto}: ${motivo}. O e-mail foi enviado normalmente.`,
    link: `/pessoas/${pessoa.id}`,
    grupos: grupos.length > 0 ? grupos : null,
  });
}

/**
 * Trata UM lembrete devido (sessão + horas). Nunca lança: o WhatsApp é um extra e não pode derrubar o ciclo do relógio
 * (quem chama também protege com try/catch).
 */
export async function lembreteWhatsapp(
  r: RodadaWhatsapp, args: { sessao: Sessao; link: Link; horas: number },
): Promise<ResultadoWhatsapp> {
  const { sessao, link, horas } = args;
  const { admin, agora } = r;

  // 1. janela (e a sessão ainda precisa estar no futuro — o relógio já só lê sessões futuras)
  if (!janelaDoWhatsappAberta(agora)) return "espera_janela";
  if (new Date(sessao.quando) <= agora) return "espera_janela";

  // Quem é o aluno desta mentoria.
  const { data: m } = await admin.from("mentorias").select("person_id, people(id, full_name, phone)").eq("id", sessao.mentoria_id).maybeSingle();
  const pessoa = m?.people as unknown as { id: string; full_name: string | null; phone: string | null } | null;
  if (!pessoa) return "sem_pessoa";

  // Já tratado por uma rodada anterior? (barato: evita refazer as perguntas abaixo a cada 15 min)
  const { count: jaTem } = await admin.from("lembretes_enviados").select("id", { count: "exact", head: true })
    .eq("sessao_id", sessao.id).eq("horas", horas).eq("destinatario", "aluno_whatsapp");
  if ((jaTem ?? 0) > 0) return "ja_tratado";

  // 2. consentimento (nível, número confirmado, celular válido)
  const pode = await podeEnviarWhatsapp(admin, pessoa.id, TIPO_LEMBRETE_MENTORIA);
  if (!pode.pode) return "sem_consentimento";

  // 3. limite diário
  const { count: hoje } = await admin.from("envios_mensagens").select("id", { count: "exact", head: true })
    .eq("person_id", pessoa.id).eq("canal", "whatsapp").eq("status", "enviado").neq("tipo", "codigo_confirmacao")
    .gte("criado_em", inicioDoDiaEmBrasilia(agora));
  const limiteAtingido = (hoje ?? 0) >= LIMITE_WHATSAPP_POR_DIA;

  // 4. instância (só pergunta à Zapster se vai mesmo tentar enviar)
  if (!limiteAtingido) {
    const c = await conexaoDaRodada(r);
    if (c.estado === "nao_configurada") return "nao_configurado";
    if (c.estado === "desconectada" || c.estado === "desligada") {
      await avisarDonoDesconectado(r, sessao.mentor_id);
      return "desconectado"; // sem gastar a trava: quando reconectar, ainda sai
    }
  }

  // 5. a trava: quem gravar a linha primeiro é quem trata este lembrete
  const { error: travaErr } = await admin.from("lembretes_enviados").insert({ sessao_id: sessao.id, horas, destinatario: "aluno_whatsapp" });
  if (travaErr) return "ja_tratado"; // 23505 = outra rodada pegou primeiro

  if (limiteAtingido) {
    await registrarEnvioNaoFeito(admin, {
      contaId: sessao.mentor_id, personId: pessoa.id, tipo: TIPO_LEMBRETE_MENTORIA, destino: pessoa.phone ?? "",
      motivo: `limite diário de ${LIMITE_WHATSAPP_POR_DIA} WhatsApp por pessoa atingido`,
    });
    return "limite";
  }

  // 6. o envio
  const { data: prof } = await admin.from("profiles").select("full_name").eq("user_id", sessao.mentor_id).maybeSingle();
  const { siteUrl } = await import("@/lib/site-url.server");
  const gerenciavel = link.permite_cancelar || link.permite_remarcar;
  const texto = textoDoLembrete({
    nomeAluno: pessoa.full_name, nomeMentor: prof?.full_name?.trim() || "seu mentor", quando: new Date(sessao.quando), agora,
    modalidade: sessao.modalidade, local: sessao.local, linkUrl: sessao.link_url,
    linkDaSessao: gerenciavel ? `${siteUrl()}/sessao/${sessao.id}` : null, // o mesmo endereço do e-mail ("Gerenciar sessão")
  });
  const r6 = await enviarMensagem(admin, {
    contaId: sessao.mentor_id, criadoPor: null, canal: "whatsapp", tipo: TIPO_LEMBRETE_MENTORIA,
    destino: pessoa.phone ?? "", texto, personId: pessoa.id, sessaoId: sessao.id,
    // M1c: [OK] sempre; [Remarcar] só se o link de agendamento dessa sessão PERMITE remarcar. O id do botão aponta para
    // ESTE envio (o clique volta com ele). Nunca se mistura botão de resposta com botão de link.
    botoes: (registroId) => [
      { rotulo: "OK", id: `lembrete:${registroId}:ok` },
      ...(link.permite_remarcar ? [{ rotulo: "Remarcar", id: `lembrete:${registroId}:remarcar` }] : []),
    ],
  });
  if (r6.status === "enviado") return "enviado";
  await avisarMentorDaFalha(r, sessao, { id: pessoa.id, full_name: pessoa.full_name ?? "O aluno" }, r6.motivo);
  return "falhou";
}
