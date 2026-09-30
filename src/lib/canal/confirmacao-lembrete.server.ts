/**
 * Menu Mensagens — M1c: a resposta ao lembrete de mentoria. O lembrete (F1c) vai com os botões [OK] e [Remarcar]; aqui a
 * plataforma entende o clique ("OK" ou "Remarcar") e também um "ok" digitado.
 *
 * Ordem de prioridade ao tratar uma mensagem: SAIR → (isto aqui) → fluxo normal da M1b. Quem chama já tratou o SAIR.
 *
 * A pessoa é identificada pelo LEMBRETE a que responde (o id do botão aponta para o envio do lembrete) ou pelo telefone que o
 * recebeu — MESMO que esse número seja da equipe (o dono também é aluno de si mesmo). A plataforma nunca inventa uma
 * confirmação: só vale para sessão FUTURA, não cancelada, de um lembrete que ela mesma enviou.
 *
 *  A) OK, primeira vez: registra (quem, quando, por onde), agradece ao aluno e avisa o mentor (WhatsApp + sino).
 *  B) OK de novo para a mesma sessão: não registra nem avisa; responde UMA vez "já está confirmada".
 *  C) Remarcar: manda o link (sem botão de link), avisa o mentor, NÃO mexe na sessão.
 *  D) Clique de sessão cancelada/passada/inexistente: "não está mais ativa", nada confirmado, ninguém avisado.
 *
 * Todas as respostas saem a qualquer hora e NÃO entram na conta da resposta automática (1 por dia) da M1b.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarMensagem } from "./enviar.server";
import { quandoPorExtenso } from "./lembrete-whatsapp.server";
import { avisarMentores, type MensagemRecebida } from "./resposta-whatsapp.server";
import { chaveDoTelefone, formatarTelefoneBR } from "./telefone";

export const TIPO_CONFIRMACAO = "confirmacao_mentoria";
export const TIPO_REMARCAR = "remarcar_link";
export const TIPO_JA_CONFIRMADA = "mentoria_ja_confirmada";
export const TIPO_INATIVA = "mentoria_inativa";
export const JANELA_DO_OK_HORAS = 48;

export const TEXTO_JA_CONFIRMADA = "Sua mentoria já está confirmada. 👍";
export const TEXTO_INATIVA = "Essa mentoria não está mais ativa. Se precisar, fale com o seu mentor.";

/** "ok", "okay", "ok!", "OK." (maiúscula/pontuação à vontade) ou 👍 (com ou sem tom de pele). Qualquer outra frase NÃO é confirmação. */
export function ehOk(texto: string | null): boolean {
  const cru = (texto ?? "").trim();
  if (/^\u{1F44D}[\u{1F3FB}-\u{1F3FF}]?️?$/u.test(cru)) return true;
  const t = cru.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  return t === "ok" || t === "okay";
}

/** O id que a plataforma põe no botão: "lembrete:<id do envio>:ok" ou ":remarcar". */
export function lerIdDoBotao(id: string | null | undefined): { envioId: string; acao: "ok" | "remarcar" } | null {
  const m = /^lembrete:([0-9a-f-]{36}):(ok|remarcar)$/.exec(id ?? "");
  return m ? { envioId: m[1], acao: m[2] as "ok" | "remarcar" } : null;
}

function rotuloDoBotao(r: string | null | undefined): "ok" | "remarcar" | null {
  const t = (r ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  return t === "ok" ? "ok" : t === "remarcar" ? "remarcar" : null;
}

type Sessao = { id: string; mentor_id: string; quando: string; status: string | null; confirmada_pelo_aluno_em: string | null };
type Pessoa = { id: string; full_name: string | null; phone: string | null };

async function sessaoDoEnvio(admin: SupabaseClient, envioId: string, contaId: string): Promise<{ pessoa: Pessoa | null; sessao: Sessao | null; existe: boolean }> {
  const { data: e } = await admin.from("envios_mensagens").select("id, conta_id, person_id, sessao_id, tipo, canal").eq("id", envioId).maybeSingle();
  if (!e || e.conta_id !== contaId || e.tipo !== "lembrete_mentoria" || e.canal !== "whatsapp") return { pessoa: null, sessao: null, existe: false };
  const { data: p } = e.person_id ? await admin.from("people").select("id, full_name, phone").eq("id", e.person_id).maybeSingle() : { data: null };
  const { data: s } = e.sessao_id ? await admin.from("mentoria_sessoes").select("id, mentor_id, quando, status, confirmada_pelo_aluno_em").eq("id", e.sessao_id).maybeSingle() : { data: null };
  return { pessoa: (p as Pessoa | null) ?? null, sessao: (s as Sessao | null) ?? null, existe: true };
}

/** O lembrete MAIS RECENTE (últimas 48 h) daquelas pessoas cuja sessão é futura e não está cancelada. */
async function lembreteRecente(admin: SupabaseClient, personIds: string[]): Promise<{ pessoa: Pessoa; sessao: Sessao } | null> {
  if (personIds.length === 0) return null;
  const desde = new Date(Date.now() - JANELA_DO_OK_HORAS * 3_600_000).toISOString();
  const { data: envios } = await admin.from("envios_mensagens").select("person_id, sessao_id, criado_em")
    .in("person_id", personIds).eq("tipo", "lembrete_mentoria").eq("canal", "whatsapp").eq("status", "enviado")
    .not("sessao_id", "is", null).gte("criado_em", desde).order("criado_em", { ascending: false }).limit(10);
  for (const e of (envios ?? []) as { person_id: string; sessao_id: string }[]) {
    const { data: s } = await admin.from("mentoria_sessoes").select("id, mentor_id, quando, status, confirmada_pelo_aluno_em").eq("id", e.sessao_id).maybeSingle();
    if (!s || s.status !== "agendada" || new Date(s.quando).getTime() <= Date.now()) continue;
    const { data: p } = await admin.from("people").select("id, full_name, phone").eq("id", e.person_id).maybeSingle();
    if (p) return { pessoa: p as Pessoa, sessao: s as Sessao };
  }
  return null;
}

/**
 * Trata o clique em [OK]/[Remarcar] ou o "ok" digitado. Devolve o que fez (vai para `tratamento`), ou `null` quando a
 * mensagem NÃO é uma resposta a lembrete — aí quem chama segue o fluxo normal da M1b.
 */
export async function tratarLembrete(admin: SupabaseClient, args: { contaId: string; msg: MensagemRecebida }): Promise<string[] | null> {
  const { contaId, msg } = args;

  // ---- o que a pessoa fez
  let acao: "ok" | "remarcar" | null = null;
  let origem: "botao" | "texto" = "texto";
  let envioId: string | null = null;
  if (msg.tipo === "botao") {
    origem = "botao";
    const lido = lerIdDoBotao(msg.botaoId);
    if (lido) { acao = lido.acao; envioId = lido.envioId; }
    else { acao = rotuloDoBotao(msg.botaoRotulo); }   // a Zapster não devolveu o nosso id: vale o rótulo + o telefone
  } else if (msg.tipo === "texto" && ehOk(msg.texto)) {
    acao = "ok";
  }
  if (!acao) return null;

  const responder = async (tipo: string, texto: string, pessoa: Pessoa | null, sessaoId: string | null) => {
    const r = await enviarMensagem(admin, { contaId, criadoPor: null, canal: "whatsapp", tipo, destino: msg.telefone, texto, personId: pessoa?.id ?? null, sessaoId });
    return r.status === "enviado";
  };
  const ligarASessao = async (sessaoId: string) => { await admin.from("mensagens_recebidas").update({ sessao_id: sessaoId }).eq("id", msg.id); };

  // ---- de qual lembrete/sessão se trata
  let pessoa: Pessoa | null = null;
  let sessao: Sessao | null = null;
  if (envioId) {
    const r = await sessaoDoEnvio(admin, envioId, contaId);
    if (!r.existe) return null;                       // id que não é nosso: não é uma resposta a lembrete
    pessoa = r.pessoa; sessao = r.sessao;
    // Só vale se quem clicou é o telefone que RECEBEU o lembrete (um botão encaminhado a outro número não confirma nada).
    if (!pessoa || chaveDoTelefone(pessoa.phone) !== chaveDoTelefone(msg.telefone)) return null;
  } else {
    const ids = msg.personId ? [msg.personId] : (msg.candidatos ?? []).map((c) => c.id);
    const achado = await lembreteRecente(admin, ids);
    if (!achado) {
      // "ok" digitado sem lembrete pendente: fluxo normal. Clique sem achar lembrete nenhum: não está mais ativa.
      if (origem === "texto") return null;
      await responder(TIPO_INATIVA, TEXTO_INATIVA, null, null);
      return ["lembrete_inativo"];
    }
    pessoa = achado.pessoa; sessao = achado.sessao;
  }
  const feitos: string[] = [];

  // ---- D) sessão cancelada, passada ou apagada
  if (!sessao || sessao.status !== "agendada" || new Date(sessao.quando).getTime() <= Date.now()) {
    if (sessao) await ligarASessao(sessao.id);
    await responder(TIPO_INATIVA, TEXTO_INATIVA, pessoa, sessao?.id ?? null);
    return ["lembrete_inativo"];
  }
  await ligarASessao(sessao.id);
  const primeiro = (pessoa!.full_name ?? "").trim().split(/\s+/)[0];
  const quando = quandoPorExtenso(new Date(sessao.quando));
  const nome = pessoa!.full_name ?? "O aluno";

  if (acao === "ok") {
    // A trava: só UMA confirmação vence (se duas chegarem juntas, a segunda cai no caso B).
    const { data: gravou } = await admin.from("mentoria_sessoes")
      .update({ confirmada_pelo_aluno_em: new Date().toISOString(), confirmada_via: origem, confirmada_por_person_id: pessoa!.id })
      .eq("id", sessao.id).is("confirmada_pelo_aluno_em", null).select("id").maybeSingle();
    if (gravou) {
      // ---- A) primeira confirmação
      await responder(TIPO_CONFIRMACAO, `Obrigado${primeiro ? `, ${primeiro}` : ""}! Sua mentoria de ${quando} está confirmada. Até lá! — Método Intenção`, pessoa, sessao.id);
      const titulo = `✅ ${nome} confirmou a mentoria de ${quando}.`;
      await avisarMentores(admin, { contaId, alunoId: pessoa!.id, chaveDeAgrupamento: sessao.id, tipoSino: "whatsapp_confirmou", tituloSino: titulo, textoWhatsapp: titulo, coalescer: false, incluirOProprio: true });
      return [...feitos, "confirmou", origem === "botao" ? "via_botao" : "via_texto"];
    }
    // ---- B) já estava confirmada: responde UMA vez
    const { count } = await admin.from("mensagens_recebidas").select("id", { count: "exact", head: true }).eq("sessao_id", sessao.id).like("tratamento", "%ja_confirmada%");
    if ((count ?? 0) === 0) { await responder(TIPO_JA_CONFIRMADA, TEXTO_JA_CONFIRMADA, pessoa, sessao.id); return ["ja_confirmada"]; }
    return ["ja_confirmada_sem_resposta"];
  }

  // ---- C) Remarcar: o link, sem botão de link, e o mentor sabe; a sessão NÃO muda
  const { siteUrl } = await import("@/lib/site-url.server");
  await responder(TIPO_REMARCAR, `Sem problemas${primeiro ? `, ${primeiro}` : ""}! Para escolher outro horário, é por aqui: ${siteUrl()}/sessao/${sessao.id}`, pessoa, sessao.id);
  const titulo = `🔁 ${nome} pediu para remarcar a mentoria de ${quando}.`;
  await avisarMentores(admin, { contaId, alunoId: pessoa!.id, chaveDeAgrupamento: sessao.id, tipoSino: "whatsapp_remarcar", tituloSino: titulo, textoWhatsapp: titulo, coalescer: true, incluirOProprio: true });
  void formatarTelefoneBR;
  return ["remarcar_pedido"];
}
