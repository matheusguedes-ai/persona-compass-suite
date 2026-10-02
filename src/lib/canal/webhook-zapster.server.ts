/**
 * O que fazer com um evento que a Zapster manda ao webhook (Menu Mensagens — M1a). A plataforma só OUVE: não responde,
 * não avisa mentor por WhatsApp, não trata SAIR (isso é a M1b), nenhuma ação decorre de botão (M1c).
 *
 * Conferido na documentação oficial (developer.zapsterapi.com) em 30/09/2026:
 *   - corpo: { created_at, id?, type, data }; `message.received` traz data.{id, sender, recipient, sent_at, type, content}
 *   - o webhook só aceita { url, events, name, enabled }: NÃO há assinatura, segredo nem cabeçalho próprio — a prova de
 *     origem é um segredo longo no endereço (ver a rota)
 *   - clique em botão chega como `message.received` com content.button_reply { id, label } e content.quoted
 *   - `message.delivered` / `message.read` trazem data.id = o id que a Zapster devolveu no envio
 *   - `instance.disconnected` traz data.id = o número da instância
 *   - a política de reenvio NÃO está documentada: tudo aqui é idempotente (o mesmo evento 2× nunca duplica)
 *
 * Nunca grava nem loga o corpo bruto, o segredo ou o token. Telefone completo só na tabela (é o endereço da conversa).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { chaveDoTelefone } from "./telefone";

export type EventoZapster = { id?: string; type?: string; created_at?: string; data?: Record<string, unknown> };

export type ContextoDoWebhook = {
  contaId: string;
  /** O número da NOSSA linha (só dígitos, com o 55). Sem ele nenhum evento é aceito (a rota barra antes). */
  numero: string;
  /** Relógio injetável (testes). */
  agora?: Date;
};

export type Acao =
  | "gravada" | "duplicada" | "status" | "status_sem_envio" | "desconexao" | "ignorada" | "outra_instancia" | "invalido";

const soDigitos = (v: unknown): string => String(v ?? "").replace(/\D/g, "");
const txt = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});

// ------------------------------------------------------------------------------------------ tipo da mensagem
export type Conteudo = { tipo: string; texto: string | null; botaoId: string | null; botaoRotulo: string | null; citadaTexto: string | null; citadaId: string | null };

/**
 * M1c-3: a mensagem que o aluno CITOU ("Responder" no WhatsApp). A Zapster documenta `content.quoted` (visto no clique de botão);
 * como a forma exata para uma resposta de texto não está documentada, procuramos nos lugares prováveis e aceitamos os nomes
 * de campo mais comuns. O que não for achado fica nulo — e quem usa sabe seguir sem citação.
 */
export function citacaoDaMensagem(data: Obj): { id: string | null; texto: string | null } {
  const content = obj(data.content);
  const candidatos = [content.quoted, content.quoted_message, content.reply_to, content.context, data.quoted, data.reply_to, data.context];
  for (const c of candidatos) {
    const q = obj(c);
    if (Object.keys(q).length === 0) continue;
    const dentro = obj(q.content);
    const id = txt(q.id) ?? txt(q.message_id) ?? txt(q.stanza_id) ?? txt(q.quoted_id) ?? txt(dentro.id);
    const texto = txt(dentro.text) ?? txt(q.text) ?? txt(q.body) ?? txt(q.caption) ?? txt(dentro.caption);
    if (id || texto) return { id, texto };
  }
  return { id: txt(content.quoted_id) ?? txt(content.reply_to_id) ?? txt(data.quoted_id) ?? null, texto: null };
}

/** Tira da mensagem só o que importa. Mídia: só o TIPO (e a legenda, se houver) — o arquivo não é baixado nem guardado. */
export function conteudoDaMensagem(data: Obj): Conteudo {
  const content = obj(data.content);
  const tipoBruto = String(data.type ?? "");
  const vazio = { texto: null, botaoId: null, botaoRotulo: null, citadaTexto: null, citadaId: null };
  const cit = citacaoDaMensagem(data);

  const botao = obj(content.button_reply);
  if (botao.id !== undefined || botao.label !== undefined) {
    return {
      tipo: "botao", texto: txt(content.text), botaoId: txt(botao.id), botaoRotulo: txt(botao.label),
      citadaTexto: cit.texto, citadaId: cit.id,
    };
  }
  const lista = obj(content.list_reply);
  if (lista.id !== undefined || lista.title !== undefined) {
    return { tipo: "lista", texto: txt(lista.title) ?? txt(content.text), botaoId: txt(lista.id), botaoRotulo: txt(lista.title), citadaTexto: null, citadaId: null };
  }
  const porTipo: Record<string, string> = {
    text: "texto", audio: "audio", image: "imagem", video: "video", sticker: "sticker",
    location: "localizacao", vcard: "contato", document: "documento", flow_reply: "formulario",
  };
  const tipo = porTipo[tipoBruto] ?? (tipoBruto ? "outro" : "texto");
  // Texto de mensagem de texto; legenda de imagem/vídeo/documento. Áudio, figurinha, localização e contato: sem texto.
  const comTexto = tipo === "texto" || tipo === "imagem" || tipo === "video" || tipo === "documento";
  return { ...vazio, tipo, texto: comTexto ? txt(content.text) : null, citadaTexto: cit.texto, citadaId: cit.id };
}

// ------------------------------------------------------------------------------------------ quem mandou
export type Remetente =
  | { remetente: "desconhecido"; personId: null; nome: null; candidatos: null }
  | { remetente: "pessoa" | "equipe"; personId: string; nome: string; candidatos: null }
  | { remetente: "ambiguo"; personId: null; nome: null; candidatos: { id: string; nome: string }[] };

/**
 * Casa o telefone do remetente com o cadastro de pessoas DA CONTA (mesma padronização da F1a: sem símbolos, com ou sem
 * 55, DDD + número). Número em mais de um cadastro = "ambíguo", com TODOS os candidatos — nunca se escolhe no escuro.
 * "Equipe" = a pessoa é o próprio dono ou está ligada a um mentor/colaborador ativo.
 */
export async function identificarRemetente(admin: SupabaseClient, contaId: string, telefone: string): Promise<Remetente> {
  const chave = chaveDoTelefone(telefone);
  const desconhecido: Remetente = { remetente: "desconhecido", personId: null, nome: null, candidatos: null };
  if (!chave) return desconhecido;

  const { data: gente, error } = await admin.from("people").select("id, full_name, phone, user_id").eq("mentor_id", contaId).not("phone", "is", null);
  if (error) throw new Error(error.message);
  const achados = (gente ?? []).filter((p: { phone: string | null }) => chaveDoTelefone(p.phone) === chave) as
    { id: string; full_name: string; user_id: string | null }[];
  if (achados.length === 0) return desconhecido;
  if (achados.length > 1) {
    return { remetente: "ambiguo", personId: null, nome: null, candidatos: achados.map((p) => ({ id: p.id, nome: p.full_name })) };
  }
  const p = achados[0];
  const { data: equipe } = await admin.from("team_members").select("person_id").eq("owner_id", contaId).eq("status", "ativo").eq("person_id", p.id);
  const ehEquipe = p.user_id === contaId || (equipe ?? []).length > 0;
  return { remetente: ehEquipe ? "equipe" : "pessoa", personId: p.id, nome: p.full_name, candidatos: null };
}

// ------------------------------------------------------------------------------------------ o processador
const TEXTO_DESCONECTADO = "O WhatsApp da plataforma está desconectado. Os lembretes estão saindo só por e-mail.";

/** No máximo 1 aviso por dia no sino do dono — a MESMA trava e o MESMO texto da F1c (mesmo tipo, mesma janela de 24 h). */
async function avisarDonoDesconectado(admin: SupabaseClient, contaId: string) {
  const desde = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { count } = await admin.from("notificacoes").select("id", { count: "exact", head: true })
    .eq("user_id", contaId).eq("tipo", "whatsapp_desconectado").gte("created_at", desde);
  if ((count ?? 0) > 0) return;
  const { error } = await admin.from("notificacoes").insert({
    user_id: contaId, conta_id: contaId, tipo: "whatsapp_desconectado", titulo: TEXTO_DESCONECTADO, link: "/configuracoes",
  });
  if (error) console.error("[webhook-zapster] aviso de desconexão não gravado:", error.message);
}

const RETOMADA_MAX_MIN = 20;

async function retomarSeFoiCortada(
  admin: SupabaseClient, ctx: ContextoDoWebhook,
  a: { zapsterId: string; telefone: string; quem: Awaited<ReturnType<typeof identificarRemetente>>; c: Conteudo; de: Obj },
) {
  try {
    const { data: linha } = await admin.from("mensagens_recebidas").select("id, tratamento, recebida_em, criado_em, sessao_id")
      .eq("conta_id", ctx.contaId).eq("zapster_id", a.zapsterId).maybeSingle();
    if (!linha || (linha.tratamento ?? "") !== "") return; // já tratada (ou nada a fazer): nada de repetir
    if (Date.now() - new Date(linha.recebida_em as string).getTime() > RETOMADA_MAX_MIN * 60_000) return;
    const { tratarMensagemRecebida } = await import("./resposta-whatsapp.server");
    const feitos = await tratarMensagemRecebida(admin, {
      contaId: ctx.contaId, agora: ctx.agora,
      msg: {
        id: linha.id as string, telefone: a.telefone, remetente: a.quem.remetente, personId: a.quem.personId, nome: a.quem.nome,
        nomeDoPerfil: txt(a.de.name), candidatos: a.quem.candidatos, tipo: a.c.tipo, texto: a.c.texto, recebidaEm: linha.recebida_em as string,
        botaoId: a.c.botaoId, botaoRotulo: a.c.botaoRotulo, citadaId: a.c.citadaId, citadaTexto: a.c.citadaTexto, retomada: true,
      },
    });
    if (feitos.length > 0) await admin.from("mensagens_recebidas").update({ tratamento: `${feitos.join(",")},retomada` }).eq("id", linha.id);
  } catch (e) {
    console.error("[webhook-zapster] retomada falhou:", e instanceof Error ? e.message : "erro");
  }
}

export async function processarEventoZapster(admin: SupabaseClient, evento: EventoZapster, ctx: ContextoDoWebhook): Promise<Acao> {
  const tipo = String(evento.type ?? "");
  const data = obj(evento.data);
  const quando = (evento.created_at && !Number.isNaN(Date.parse(evento.created_at)) ? new Date(evento.created_at) : (ctx.agora ?? new Date())).toISOString();

  // ---- mensagem recebida (inclui clique em botão)
  if (tipo === "message.received") {
    const de = obj(data.sender), para = obj(data.recipient);
    const zapsterId = txt(data.id);
    const telefone = soDigitos(de.id);
    if (!zapsterId || !telefone) return "invalido";
    // ⚠️ Conferido em produção (30/09/2026): neste aviso a Zapster põe em `recipient.id` o PRÓPRIO interlocutor (o mesmo
    // número de `sender.id`), e NÃO a linha da plataforma — o exemplo da documentação, com os dois iguais, já insinuava
    // isso. Por isso a linha não é conferida aqui. A prova de origem é o segredo no endereço + o webhook estar ligado a
    // UMA só instância (a nossa), o que a própria Zapster mostra ("Usado por 1 instância").
    if (telefone === ctx.numero) return "ignorada";                      // eco da nossa própria linha
    if (para.type === "group" || de.type === "group") return "ignorada"; // só conversa 1 a 1

    const c = conteudoDaMensagem(data);
    const quem = await identificarRemetente(admin, ctx.contaId, telefone);
    const enviadaEm = txt(data.sent_at) && !Number.isNaN(Date.parse(String(data.sent_at))) ? new Date(String(data.sent_at)).toISOString() : quando;
    const { data: linha, error } = await admin.from("mensagens_recebidas").insert({
      conta_id: ctx.contaId, zapster_id: zapsterId, telefone, remetente: quem.remetente, person_id: quem.personId,
      remetente_nome: quem.nome ?? txt(de.name), candidatos: quem.candidatos, tipo: c.tipo, texto: c.texto,
      botao_id: c.botaoId, botao_rotulo: c.botaoRotulo, citada_texto: c.citadaTexto, citada_id: c.citadaId, recebida_em: enviadaEm,
    }).select("id").single();
    if (error) {
      if (error.code === "23505") {
        // O mesmo evento de novo (a Zapster reenvia quando a nossa resposta não chegou a tempo). Se a primeira passada foi
        // CORTADA no meio — a mensagem está guardada e o tratamento nunca foi gravado —, refaz SÓ o que é resposta a
        // lembrete de mentoria, pulando o que já saiu (M1c-3: o ✅ do mentor se perdeu assim em 02/10/2026).
        await retomarSeFoiCortada(admin, ctx, { zapsterId, telefone, quem, c, de });
        return "duplicada";
      }
      throw new Error(error.message);
    }
    // M1b: o que a plataforma FAZ com a mensagem (SAIR, resposta automática, aviso ao mentor). Só para mensagem nova:
    // o reenvio é "duplicada" e nunca chega aqui. Uma falha aqui NÃO derruba o webhook (a mensagem já está guardada).
    try {
      const { tratarMensagemRecebida } = await import("./resposta-whatsapp.server");
      const feitos = await tratarMensagemRecebida(admin, {
        contaId: ctx.contaId, agora: ctx.agora,
        msg: { id: linha!.id as string, telefone, remetente: quem.remetente, personId: quem.personId, nome: quem.nome, nomeDoPerfil: txt(de.name), candidatos: quem.candidatos, tipo: c.tipo, texto: c.texto, recebidaEm: enviadaEm, botaoId: c.botaoId, botaoRotulo: c.botaoRotulo, citadaId: c.citadaId, citadaTexto: c.citadaTexto },
      });
      if (feitos.length > 0) await admin.from("mensagens_recebidas").update({ tratamento: feitos.join(",") }).eq("id", linha!.id);
    } catch (e) {
      console.error("[webhook-zapster] tratamento da mensagem falhou:", e instanceof Error ? e.message : "erro");
    }
    return "gravada";
  }

  // ---- entregue / lido: atualiza o NOSSO envio, casando pelo id que a Zapster devolveu no envio. Nunca volta atrás.
  if (tipo === "message.delivered" || tipo === "message.read") {
    const zapsterId = txt(data.id);
    if (!zapsterId) return "invalido";
    const { data: envio, error } = await admin.from("envios_mensagens").select("id, entregue_em, lido_em")
      .eq("conta_id", ctx.contaId).eq("fornecedor", "zapster").eq("fornecedor_msg_id", zapsterId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!envio) return "status_sem_envio"; // não é uma mensagem nossa (ex.: escrita à mão no celular)
    const patch: Record<string, string> = {};
    if (tipo === "message.delivered" && !envio.entregue_em) patch.entregue_em = quando;
    if (tipo === "message.read") {
      if (!envio.lido_em) patch.lido_em = quando;
      if (!envio.entregue_em) patch.entregue_em = quando; // lido implica entregue
    }
    if (Object.keys(patch).length > 0) {
      const { error: uErr } = await admin.from("envios_mensagens").update(patch).eq("id", envio.id);
      if (uErr) throw new Error(uErr.message);
    }
    return "status";
  }

  // ---- a instância caiu
  if (tipo === "instance.disconnected") {
    if (soDigitos(data.id) !== ctx.numero) return "outra_instancia";
    await avisarDonoDesconectado(admin, ctx.contaId);
    return "desconexao";
  }

  return "ignorada"; // qualquer outro evento (enviada, reação, grupo…): recebido e descartado
}

/** A conta dona da linha de WhatsApp. Hoje só existe uma conta dona; se houver várias, vale a que enviou por último. */
export async function contaDaInstancia(admin: SupabaseClient): Promise<string | null> {
  const { data: contas } = await admin.from("contas").select("dono_id");
  if ((contas ?? []).length === 1) return contas![0].dono_id as string;
  const { data: ult } = await admin.from("envios_mensagens").select("conta_id").eq("fornecedor", "zapster")
    .order("criado_em", { ascending: false }).limit(1).maybeSingle();
  return (ult?.conta_id as string | undefined) ?? null;
}

const fim = (v: unknown) => { const d = soDigitos(v); return d ? `…${d.slice(-4)}` : "?"; };

/**
 * Diagnóstico: uma linha por chamada válida da Zapster — tipo, resultado e o FIM de números (4 dígitos), nunca o corpo.
 * Quando o evento é de outra linha, guarda o fim do número do evento e o fim do número esperado, para achar erro de
 * cadastro (ex.: a Zapster manda o número num formato diferente do que está em ZAPSTER_NUMERO). Guarda só as 200 últimas.
 */
export async function registrarEventoDoWebhook(
  admin: SupabaseClient, contaId: string, evento: EventoZapster, acao: Acao | "erro", numero: string, erro?: string,
) {
  const d = obj(evento.data);
  // Só NOMES de campos (nunca valores): mostra se a Zapster manda algo que identifique a instância.
  const c = obj(d.content);
  // M1c-3: também os NOMES dos campos de `content` e do que vier citado (nunca os valores) — é assim que se descobre a forma
  // exata de uma resposta com "Responder" sem guardar a conversa de ninguém.
  const citado = [c.quoted, c.quoted_message, c.reply_to, c.context].map(obj).find((q) => Object.keys(q).length > 0);
  const forma = `campos: ${Object.keys(evento).join(",")} | data: ${Object.keys(d).join(",")} | sender: ${Object.keys(obj(d.sender)).join(",")} | recipient: ${Object.keys(obj(d.recipient)).join(",")}`.slice(0, 280)
    + (String(evento.type) === "message.received" ? ` | content: ${Object.keys(c).join(",")}${citado ? ` | citado: ${Object.keys(citado).join(",")}${Object.keys(obj(citado.content)).length ? ` (content: ${Object.keys(obj(citado.content)).join(",")})` : ""}` : ""}`.slice(0, 250) : "");
  const detalhe = acao === "outra_instancia"
    ? `número do evento ${fim(obj(d.recipient).id ?? d.id)}; remetente ${fim(obj(d.sender).id)}; linha esperada ${fim(numero)}`
    : acao === "erro" ? `falha: ${(erro ?? "erro").slice(0, 120)}`
    : acao === "invalido" ? "faltou o identificador da mensagem ou o remetente"
    : forma;
  await admin.from("webhook_eventos").insert({ conta_id: contaId, tipo: String(evento.type ?? "?").slice(0, 60), acao, detalhe });
  const { data: velhos } = await admin.from("webhook_eventos").select("id").eq("conta_id", contaId)
    .order("recebido_em", { ascending: false }).range(200, 400);
  if ((velhos ?? []).length > 0) await admin.from("webhook_eventos").delete().in("id", velhos!.map((v: { id: string }) => v.id));
}
