/**
 * Menu Mensagens — M1c / M1c-3: a resposta ao lembrete de mentoria. O lembrete (F1c) pede para o aluno RESPONDER OK, REMARCAR ou
 * CANCELAR (os botões, quando ligados, valem igual); aqui a plataforma entende as três palavras e o clique de botão.
 * M1c-3: se o aluno usou "Responder" no WhatsApp, a resposta vale para a SESSÃO DAQUELE LEMBRETE; sem citação, vale o lembrete
 * pendente mais recente. CANCELAR NÃO cancela a sessão: manda o link (ou manda falar com o mentor) e avisa o mentor.
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
export const TIPO_CANCELAR = "cancelar_link";
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

/** M1c-2: a palavra REMARCAR sozinha (maiúscula, acento e pontuação à vontade) vale como o antigo botão [Remarcar]. */
export function ehRemarcar(texto: string | null): boolean {
  const t = (texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  return t === "remarcar";
}

/** M1c-3: a palavra CANCELAR sozinha (maiúscula, acento e pontuação à vontade). */
export function ehCancelar(texto: string | null): boolean {
  const t = (texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  return t === "cancelar";
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

type Sessao = { id: string; mentor_id: string; quando: string; status: string | null; confirmada_pelo_aluno_em: string | null; link_id?: string | null };
type Pessoa = { id: string; full_name: string | null; phone: string | null };

async function sessaoDoEnvio(admin: SupabaseClient, envioId: string, contaId: string): Promise<{ pessoa: Pessoa | null; sessao: Sessao | null; existe: boolean }> {
  const { data: e } = await admin.from("envios_mensagens").select("id, conta_id, person_id, sessao_id, tipo, canal").eq("id", envioId).maybeSingle();
  if (!e || e.conta_id !== contaId || e.tipo !== "lembrete_mentoria" || e.canal !== "whatsapp") return { pessoa: null, sessao: null, existe: false };
  const { data: p } = e.person_id ? await admin.from("people").select("id, full_name, phone").eq("id", e.person_id).maybeSingle() : { data: null };
  const { data: s } = e.sessao_id ? await admin.from("mentoria_sessoes").select("id, mentor_id, quando, status, confirmada_pelo_aluno_em, link_id").eq("id", e.sessao_id).maybeSingle() : { data: null };
  return { pessoa: (p as Pessoa | null) ?? null, sessao: (s as Sessao | null) ?? null, existe: true };
}

const SEL_SESSAO = "id, mentor_id, quando, status, confirmada_pelo_aluno_em, link_id";

async function pessoaPorId(admin: SupabaseClient, id: string): Promise<Pessoa | null> {
  const { data } = await admin.from("people").select("id, full_name, phone").eq("id", id).maybeSingle();
  return (data as Pessoa | null) ?? null;
}

/** Os lembretes de WhatsApp (últimas 48 h) enviados a essas pessoas, do mais novo para o mais antigo — com a sessão de cada um. */
async function lembretesDasPessoas(admin: SupabaseClient, personIds: string[]): Promise<{ envio: { id: string; person_id: string; sessao_id: string; fornecedor_msg_id: string | null }; sessao: Sessao }[]> {
  if (personIds.length === 0) return [];
  const desde = new Date(Date.now() - JANELA_DO_OK_HORAS * 3_600_000).toISOString();
  const { data: envios } = await admin.from("envios_mensagens").select("id, person_id, sessao_id, fornecedor_msg_id, criado_em")
    .in("person_id", personIds).eq("tipo", "lembrete_mentoria").eq("canal", "whatsapp").eq("status", "enviado")
    .not("sessao_id", "is", null).gte("criado_em", desde).order("criado_em", { ascending: false }).limit(20);
  const lista = (envios ?? []) as { id: string; person_id: string; sessao_id: string; fornecedor_msg_id: string | null }[];
  if (lista.length === 0) return [];
  const { data: sessoes } = await admin.from("mentoria_sessoes").select(SEL_SESSAO).in("id", [...new Set(lista.map((e) => e.sessao_id))]);
  const porId = new Map(((sessoes ?? []) as Sessao[]).map((s) => [s.id, s]));
  return lista.filter((e) => porId.has(e.sessao_id)).map((e) => ({ envio: e, sessao: porId.get(e.sessao_id)! }));
}

const ativa = (s: Sessao) => s.status === "agendada" && new Date(s.quando).getTime() > Date.now();

/** O lembrete MAIS RECENTE (últimas 48 h) daquelas pessoas cuja sessão é futura e não está cancelada. */
async function lembreteRecente(admin: SupabaseClient, personIds: string[]): Promise<{ pessoa: Pessoa; sessao: Sessao } | null> {
  for (const l of await lembretesDasPessoas(admin, personIds)) {
    if (!ativa(l.sessao)) continue;
    const p = await pessoaPorId(admin, l.envio.person_id);
    if (p) return { pessoa: p, sessao: l.sessao };
  }
  return null;
}

/**
 * M1c-3: a sessão do lembrete que o aluno CITOU ("Responder"). Primeiro pelo identificador da mensagem citada (casa com o id
 * que a Zapster nos devolveu no envio); depois pelo TEXTO citado (o dia e a hora escritos no lembrete). Vale mesmo quando a
 * sessão já não está ativa — aí a resposta é "não está mais ativa", e não a confirmação de OUTRA sessão.
 */
async function lembreteCitado(admin: SupabaseClient, personIds: string[], citada: { id?: string | null; texto?: string | null }): Promise<{ pessoa: Pessoa; sessao: Sessao } | null> {
  if (!citada.id && !citada.texto) return null;
  const lista = await lembretesDasPessoas(admin, personIds);
  let achado = citada.id ? lista.find((l) => l.envio.fornecedor_msg_id === citada.id) : undefined;
  if (!achado && citada.texto && /mentoria/i.test(citada.texto)) {
    const m = /(\d{2})\/(\d{2}),\s*às\s*(\d{2}:\d{2})/.exec(citada.texto);
    if (m) {
      const alvo = `${m[1]}/${m[2]}, às ${m[3]}`;
      achado = lista.find((l) => quandoPorExtenso(new Date(l.sessao.quando)).endsWith(alvo));
    }
  }
  if (!achado) return null;
  const p = await pessoaPorId(admin, achado.envio.person_id);
  return p ? { pessoa: p, sessao: achado.sessao } : null;
}


/**
 * Trata o clique em [OK]/[Remarcar]/[Cancelar] ou a palavra digitada. Devolve o que fez (vai para `tratamento`), ou `null` quando
 * a mensagem NÃO é uma resposta a lembrete — aí quem chama segue o fluxo normal da M1b.
 */
export async function tratarLembrete(admin: SupabaseClient, args: { contaId: string; msg: MensagemRecebida }): Promise<string[] | null> {
  const { contaId, msg } = args;

  // ---- o que a pessoa fez
  let acao: "ok" | "remarcar" | "cancelar" | null = null;
  let origem: "botao" | "texto" = "texto";
  let envioId: string | null = null;
  if (msg.tipo === "botao") {
    origem = "botao";
    const lido = lerIdDoBotao(msg.botaoId);
    if (lido) { acao = lido.acao; envioId = lido.envioId; }
    else { acao = rotuloDoBotao(msg.botaoRotulo); }   // a Zapster não devolveu o nosso id: vale o rótulo + o telefone
  } else if (msg.tipo === "texto" && ehOk(msg.texto)) {
    acao = "ok";
  } else if (msg.tipo === "texto" && ehRemarcar(msg.texto)) {
    acao = "remarcar";
  } else if (msg.tipo === "texto" && ehCancelar(msg.texto)) {
    acao = "cancelar";
  }
  if (!acao) return null;

  // Numa retomada (a 1ª passada foi cortada), o que já saiu desde a chegada da mensagem não sai de novo.
  const desde = msg.retomada ? new Date(new Date(msg.recebidaEm).getTime() - 60_000).toISOString() : undefined;

  const responder = async (tipo: string, texto: string, pessoa: Pessoa | null, sessaoId: string | null) => {
    if (desde && pessoa) {
      let q = admin.from("envios_mensagens").select("id", { count: "exact", head: true })
        .eq("person_id", pessoa.id).eq("tipo", tipo).eq("canal", "whatsapp").gte("criado_em", desde);
      if (sessaoId) q = q.eq("sessao_id", sessaoId);
      const { count } = await q;
      if ((count ?? 0) > 0) return true;
    }
    const r = await enviarMensagem(admin, { contaId, criadoPor: null, canal: "whatsapp", tipo, destino: msg.telefone, texto, personId: pessoa?.id ?? null, sessaoId });
    return r.status === "enviado";
  };
  const ligarASessao = async (sessaoId: string) => { await admin.from("mensagens_recebidas").update({ sessao_id: sessaoId }).eq("id", msg.id); };

  // ---- de qual lembrete/sessão se trata: botão → citação ("Responder") → o lembrete pendente mais recente
  let pessoa: Pessoa | null = null;
  let sessao: Sessao | null = null;
  let viaCitacao = false;
  if (envioId) {
    const r = await sessaoDoEnvio(admin, envioId, contaId);
    if (!r.existe) return null;                       // id que não é nosso: não é uma resposta a lembrete
    pessoa = r.pessoa; sessao = r.sessao;
    // Só vale se quem clicou é o telefone que RECEBEU o lembrete (um botão encaminhado a outro número não confirma nada).
    if (!pessoa || chaveDoTelefone(pessoa.phone) !== chaveDoTelefone(msg.telefone)) return null;
  } else {
    const ids = msg.personId ? [msg.personId] : (msg.candidatos ?? []).map((c) => c.id);
    const citado = await lembreteCitado(admin, ids, { id: msg.citadaId, texto: msg.citadaTexto });
    const achado = citado ?? await lembreteRecente(admin, ids);
    viaCitacao = !!citado;
    if (!achado) {
      // texto digitado sem lembrete pendente: fluxo normal. Clique sem achar lembrete nenhum: não está mais ativa.
      if (origem === "texto") return null;
      await responder(TIPO_INATIVA, TEXTO_INATIVA, null, null);
      return ["lembrete_inativo"];
    }
    pessoa = achado.pessoa; sessao = achado.sessao;
    // REMARCAR digitado só vale se o link da sessão permite remarcar (o lembrete nem oferecia a palavra senão).
    if (acao === "remarcar" && origem === "texto" && ativa(sessao)) {
      const { data: lk } = sessao.link_id ? await admin.from("mentoria_links").select("permite_remarcar").eq("id", sessao.link_id).maybeSingle() : { data: null };
      if (!lk?.permite_remarcar) return null;
    }
  }
  const marca = viaCitacao ? ["via_citacao"] : [];

  // ---- D) sessão cancelada, passada ou apagada
  if (!sessao || !ativa(sessao)) {
    if (sessao) await ligarASessao(sessao.id);
    await responder(TIPO_INATIVA, TEXTO_INATIVA, pessoa, sessao?.id ?? null);
    return ["lembrete_inativo", ...marca];
  }
  await ligarASessao(sessao.id);
  const primeiro = (pessoa!.full_name ?? "").trim().split(/\s+/)[0];
  const quando = quandoPorExtenso(new Date(sessao.quando));
  const nome = pessoa!.full_name ?? "O aluno";
  const avisar = (o: { tipoSino: string; tipoEnvio: string; titulo: string; coalescer: boolean }) => avisarMentores(admin, {
    contaId, alunoId: pessoa!.id, chaveDeAgrupamento: sessao!.id, tipoSino: o.tipoSino, tipoEnvio: o.tipoEnvio, tituloSino: o.titulo, textoWhatsapp: o.titulo,
    coalescer: o.coalescer, incluirOProprio: true, sessaoId: sessao!.id, linkDoSino: `/pessoas/${pessoa!.id}?sessao=${sessao!.id}`, jaFeitoDesde: desde,
  });

  if (acao === "ok") {
    // A trava: só UMA confirmação vence (se duas chegarem juntas, a segunda cai no caso B).
    const { data: gravou } = await admin.from("mentoria_sessoes")
      .update({ confirmada_pelo_aluno_em: new Date().toISOString(), confirmada_via: origem, confirmada_por_person_id: pessoa!.id })
      .eq("id", sessao.id).is("confirmada_pelo_aluno_em", null).select("id").maybeSingle();
    // Numa retomada, "já confirmada" por ESTA mensagem (a 1ª passada gravou e foi cortada) é a primeira confirmação, a completar.
    const foiEstaMensagem = !gravou && !!desde && (await confirmadaDepoisDe(admin, sessao.id, pessoa!.id, desde));
    if (gravou || foiEstaMensagem) {
      // ---- A) primeira confirmação — a resposta ao aluno e o aviso ao mentor saem JUNTOS
      const titulo = `✅ ${nome} confirmou a mentoria de ${quando}.`;
      await Promise.all([
        responder(TIPO_CONFIRMACAO, `Obrigado${primeiro ? `, ${primeiro}` : ""}! Sua mentoria de ${quando} está confirmada. Até lá! — Método Intenção`, pessoa, sessao.id),
        avisar({ tipoSino: "whatsapp_confirmou", tipoEnvio: "mentor_confirmou", titulo, coalescer: false }),
      ]);
      return ["confirmou", origem === "botao" ? "via_botao" : "via_texto", ...marca];
    }
    // ---- B) já estava confirmada: responde UMA vez
    if (desde) return ["ja_confirmada_sem_resposta"];
    const { count } = await admin.from("mensagens_recebidas").select("id", { count: "exact", head: true }).eq("sessao_id", sessao.id).like("tratamento", "%ja_confirmada%");
    if ((count ?? 0) === 0) { await responder(TIPO_JA_CONFIRMADA, TEXTO_JA_CONFIRMADA, pessoa, sessao.id); return ["ja_confirmada", ...marca]; }
    return ["ja_confirmada_sem_resposta"];
  }

  const { siteUrl } = await import("@/lib/site-url.server");
  const linkDaSessao = `${siteUrl()}/sessao/${sessao.id}`;

  if (acao === "remarcar") {
    // ---- C) Remarcar: o link, sem botão de link, e o mentor sabe; a sessão NÃO muda
    const titulo = `🔁 ${nome} pediu para remarcar a mentoria de ${quando}.`;
    await Promise.all([
      responder(TIPO_REMARCAR, `Sem problemas${primeiro ? `, ${primeiro}` : ""}! Para escolher outro horário, é por aqui: ${linkDaSessao}`, pessoa, sessao.id),
      avisar({ tipoSino: "whatsapp_remarcar", tipoEnvio: "mentor_remarcar", titulo, coalescer: true }),
    ]);
    return ["remarcar_pedido", ...marca];
  }

  // ---- E) Cancelar: NUNCA cancela sozinho. Manda o link (se o link permite cancelar) ou manda falar com o mentor; o mentor é avisado.
  const { data: lkc } = sessao.link_id ? await admin.from("mentoria_links").select("permite_cancelar").eq("id", sessao.link_id).maybeSingle() : { data: null };
  const resposta = lkc?.permite_cancelar
    ? `Tudo bem${primeiro ? `, ${primeiro}` : ""}. Para cancelar sua mentoria de ${quando}, é por aqui: ${linkDaSessao}`
    : "Para cancelar, fale com o seu mentor.";
  const titulo = `❌ ${nome} quer cancelar a mentoria de ${quando}.`;
  await Promise.all([
    responder(TIPO_CANCELAR, resposta, pessoa, sessao.id),
    avisar({ tipoSino: "whatsapp_cancelar", tipoEnvio: "mentor_cancelar", titulo, coalescer: true }),
  ]);
  return [lkc?.permite_cancelar ? "cancelar_pedido" : "cancelar_sem_link", ...marca];
}

async function confirmadaDepoisDe(admin: SupabaseClient, sessaoId: string, personId: string, desde: string): Promise<boolean> {
  const { data } = await admin.from("mentoria_sessoes").select("confirmada_pelo_aluno_em, confirmada_por_person_id").eq("id", sessaoId).maybeSingle();
  return !!data?.confirmada_pelo_aluno_em && data.confirmada_por_person_id === personId && new Date(data.confirmada_pelo_aluno_em as string).getTime() >= new Date(desde).getTime();
}
