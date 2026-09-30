/**
 * Menu Mensagens M1b — PROVA de SAIR, resposta automática e aviso ao mentor, com dados FICTÍCIOS no banco de verdade
 * e a Zapster SIMULADA (nenhuma mensagem real sai). A hora da plataforma é injetada (janela das 8h às 20h).
 *   npx tsx scripts/provar_m1b.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const env: Record<string, string> = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ""); }
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
process.env.ZAPSTER_API_TOKEN = "token-de-mentira-m1b"; process.env.ZAPSTER_INSTANCE_ID = "instancia-de-mentira-m1b";
process.env.SITE_URL = "https://assessment.metodointencao.com.br";

const enviados: { recipient: string; text: string }[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  const u = String(url);
  if (u.includes("api.zapsterapi.com") && u.endsWith("/wa/messages")) { enviados.push(JSON.parse(String(init?.body))); return new Response(JSON.stringify({ message_id: `SIM${enviados.length}` }), { status: 200 }); }
  return realFetch(url as never, init);
}) as typeof fetch;
const saida: string[] = [];
for (const k of ["log", "error", "warn"] as const) { const o = console[k].bind(console); console[k] = (...a: unknown[]) => { saida.push(a.map(String).join(" ")); o(...a); }; }

import { processarEventoZapster } from "../src/lib/canal/webhook-zapster.server";
import { ehPedidoDeSair, TEXTO_CONFIRMACAO_SAIR, TEXTO_RESPOSTA_AUTOMATICA } from "../src/lib/canal/resposta-whatsapp.server";
import { podeEnviarWhatsapp } from "../src/lib/canal/consentimento.server";
import { mascararTelefone } from "../src/lib/canal/telefone";
import { TERMO_TEXTO, TERMO_VERSAO } from "../src/lib/canal/consentimento";

const admin = createClient(env.SUPABASE_URL.replace(/\/$/, ""), env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let falhas = 0;
const confere = (n: string, c: boolean, e = "") => { if (!c) falhas++; console.log(`${c ? "ok   " : "FALHA"} ${n}${c ? "" : ` ${e}`}`); };
const rodada = randomBytes(3).toString("hex");
const brt = (hm: string) => new Date(`2026-10-20T${hm}:00-03:00`);
const criados = { users: [] as string[], people: [] as string[], team: [] as string[], groups: [] as string[] };
const NUMERO = "5511955500002";

async function ins(t: string, l: Record<string, unknown>, guarda?: keyof typeof criados) {
  const { data, error } = await admin.from(t).insert(l).select("id").single();
  if (error) throw new Error(`${t}: ${error.message}`);
  if (guarda) criados[guarda].push(data!.id as string);
  return data!.id as string;
}
const fone = (n: number) => `(11) 9${String(1000 + n).padStart(4, "0")}-${String(3000 + n)}`;
const soDig = (s: string) => `55${s.replace(/\D/g, "")}`;

try {
  const { data: u } = await admin.auth.admin.createUser({ email: `teste-m1b-dono-${rodada}@exemplo.invalido`, email_confirm: true });
  const dono = u.user!.id; criados.users.push(dono); console.log(`criado login dono: ${dono}`);
  await admin.rpc("registrar_conta_dona", { p_user: dono, p_origem: "prova M1b" });
  const { data: u2 } = await admin.auth.admin.createUser({ email: `teste-m1b-mentor-${rodada}@exemplo.invalido`, email_confirm: true });
  const mentorLogin = u2.user!.id; criados.users.push(mentorLogin); console.log(`criado login mentor: ${mentorLogin}`);

  let seq = 0;
  async function pessoa(nome: string, consentimento: "completo" | "essencial" | "nenhum", opcoes: { userId?: string | null; phone?: string | null } = {}) {
    seq++;
    const phone = opcoes.phone === undefined ? fone(seq) : opcoes.phone;
    const id = await ins("people", { mentor_id: dono, full_name: nome, email: `${nome.replace(/\W/g, "").toLowerCase()}-${rodada}@exemplo.invalido`, phone, user_id: opcoes.userId ?? null }, "people");
    if (consentimento !== "nenhum") await ins("whatsapp_consentimentos", { person_id: id, nivel: consentimento, termo_versao: TERMO_VERSAO, texto_aceito: TERMO_TEXTO, destino_mascarado: mascararTelefone(phone) });
    console.log(`criada pessoa ${nome}: ${id}`);
    return { id, phone: phone!, nome };
  }
  const Pdono = await pessoa("Dono Pessoa", "completo", { userId: dono });
  const Pmentor = await pessoa("Mentora Um", "essencial");
  const Psem = await pessoa("Mentor SemConsentimento", "nenhum");
  const Ana = await pessoa("Ana Aluna", "completo"), Cris = await pessoa("Cris Aluna", "completo"), Duda = await pessoa("Duda Aluna", "completo"), Edu = await pessoa("Edu Aluno", "completo"), Fabi = await pessoa("Fabi Aluna", "completo");
  const Dup1 = await pessoa("Dupla Um", "completo", { phone: "(11) 94444-5555" }), Dup2 = await pessoa("Dupla Dois", "completo", { phone: "11 94444 5555" });

  const grupo = await ins("groups", { mentor_id: dono, name: "Turma M1b" }, "groups");
  for (const p of [Ana, Cris, Duda, Edu, Fabi]) await admin.from("group_members").insert({ group_id: grupo, person_id: p.id });
  // dois mentores da turma: um com consentimento, outro sem
  for (const [p, nome] of [[Pmentor, "Mentora Um"], [Psem, "Mentor Sem"]] as const) {
    const tm = await ins("team_members", { owner_id: dono, kind: "mentor", name: nome, email: `${nome.replace(/\W/g, "").toLowerCase()}-${rodada}@exemplo.invalido`, person_id: p.id, status: "ativo" }, "team");
    await admin.from("team_member_groups").insert({ team_member_id: tm, group_id: grupo });
  }
  const ctxBase = { contaId: dono, numero: NUMERO };
  let n = 0;
  const msg = async (de: string, texto: string, hm: string, extra: Record<string, unknown> = {}, tipo = "text") => {
    const id = `M1B-${rodada}-${++n}`;
    const agora = new Date().toISOString();
    const r = await processarEventoZapster(admin as never, { type: "message.received", created_at: agora, data: { id, sender: { id: soDig(de), name: "Nome" }, recipient: { id: soDig(de), type: "chat" }, sent_at: agora, type: tipo, content: { text: texto }, ...extra } } as never, { ...ctxBase, agora: brt(hm) });
    const { data: linha } = await admin.from("mensagens_recebidas").select("tratamento, remetente").eq("zapster_id", id).maybeSingle();
    return { r, id, tratamento: linha?.tratamento ?? null, remetente: linha?.remetente };
  };
  const enviosPara = (p: { phone: string }) => enviados.filter((e) => e.recipient === soDig(p.phone));
  const sinos = async (tipo: string) => (await admin.from("notificacoes").select("titulo, user_id").eq("conta_id", dono).eq("tipo", tipo)).data ?? [];

  // ---------- reconhecimento de SAIR ----------
  console.log("== o que conta como pedido de sair");
  confere("SAIR, sair., Parar, STOP!, cancelar, ' Sair ' (com acento/pontuação) contam", ["SAIR", "sair.", "Parar", "STOP!", "cancelar", "  Sair  ", "SÁIR"].every(ehPedidoDeSair) || ["SAIR", "sair.", "Parar", "STOP!", "cancelar", "  Sair  "].every(ehPedidoDeSair));
  confere("'sair da reunião', 'não quero sair', 'parar de tocar', 'oi', '' NÃO contam", !["sair da reunião", "não quero sair", "parar de tocar", "oi", "", "sair agora por favor"].some(ehPedidoDeSair));

  // ---------- resposta automática + mentor avisado (dentro da janela) ----------
  console.log("\n== mensagem comum de aluno às 14h: resposta automática + mentor avisado");
  let r = await msg(Ana.phone, "Oi, tudo bem? Posso remarcar?", "14:00");
  confere("gravada, identificada como a aluna", r.r === "gravada" && r.remetente === "pessoa");
  const respAna = enviosPara(Ana);
  confere("a aluna recebe UMA resposta automática, com o texto combinado", respAna.length === 1 && respAna[0].text === TEXTO_RESPOSTA_AUTOMATICA, JSON.stringify(respAna));
  const snAna = (await sinos("whatsapp_resposta"))[0];
  confere("sino do dono: '[Nome] respondeu no WhatsApp: “início da mensagem”'", (await sinos("whatsapp_resposta")).length === 1 && snAna.titulo === "Ana Aluna respondeu no WhatsApp: “Oi, tudo bem? Posso remarcar?”" && snAna.user_id === dono, JSON.stringify(snAna));
  const paraDono = enviosPara(Pdono), paraMentor = enviosPara(Pmentor), paraSem = enviosPara(Psem);
  confere("o DONO recebe WhatsApp avisando", paraDono.length === 1 && paraDono[0].text.startsWith("Ana Aluna respondeu no WhatsApp da plataforma: “Oi, tudo bem? Posso remarcar?”."), JSON.stringify(paraDono));
  confere("o MENTOR da turma (com consentimento) recebe WhatsApp", paraMentor.length === 1);
  confere("o mentor SEM consentimento não recebe WhatsApp", paraSem.length === 0);
  confere("a mensagem registra o que foi feito", (r.tratamento ?? "").includes("resposta_automatica") && (r.tratamento ?? "").includes("mentor_avisado"), String(r.tratamento));
  const rotulos = (await admin.from("envios_mensagens").select("tipo, person_id, conta_id, status").eq("conta_id", dono)).data ?? [];
  confere("todo envio tem dono e pessoa e está registrado", rotulos.length === 3 && rotulos.every((e) => e.conta_id === dono && e.person_id && e.status === "enviado"));

  const antes = enviados.length;
  r = await msg(Ana.phone, "outra coisa", "14:05");
  confere("2ª mensagem no mesmo dia: SEM 2ª resposta automática", enviosPara(Ana).length === 1);
  confere("e dentro de 15 min NÃO avisa o mentor de novo (nem sino nem WhatsApp)", (await sinos("whatsapp_resposta")).length === 1 && enviados.length === antes, String(enviados.length - antes));

  // ---------- fora da janela ----------
  console.log("\n== às 22h: nada de WhatsApp (só o sino)");
  const antes22 = enviados.length;
  r = await msg(Cris.phone, "boa noite!", "22:00");
  confere("às 22h: nenhuma resposta automática e nenhum WhatsApp ao mentor", enviados.length === antes22 && enviosPara(Cris).length === 0);
  confere("mas o sino do mentor recebe", (await sinos("whatsapp_resposta")).length === 2);
  r = await msg(Duda.phone, "bom dia", "07:59");
  confere("às 7h59: também nada de WhatsApp", enviados.length === antes22);
  r = await msg(Edu.phone, "oi", "20:00");
  confere("às 20h00: também nada", enviados.length === antes22);

  // ---------- quem NÃO recebe resposta ----------
  console.log("\n== equipe, desconhecido e ambíguo não recebem resposta nem aviso");
  const antesX = enviados.length, sinoX = (await sinos("whatsapp_resposta")).length;
  await msg(Pdono.phone, "teste do dono", "14:10");
  await msg(fone(99), "quem é?", "14:10");
  await msg("(11) 94444-5555", "sou eu", "14:10");
  confere("equipe (o dono), número desconhecido e número em dois cadastros: nada enviado, nenhum aviso", enviados.length === antesX && (await sinos("whatsapp_resposta")).length === sinoX);

  // ---------- limite de avisos ao mentor por dia ----------
  console.log("\n== limite de 3 avisos por dia por pessoa (mentor)");
  for (let i = 0; i < 3; i++) await admin.from("envios_mensagens").insert({ conta_id: dono, person_id: Pmentor.id, canal: "whatsapp", tipo: "mentor_resposta_aluno", status: "enviado" });
  const antesL = enviados.length;
  await msg(Fabi.phone, "estou aqui", "15:00");
  confere("a mentora já no limite do dia NÃO recebe o 4º; o dono (fora do limite) recebe", enviosPara(Pmentor).length === 1 /* só o de antes */ && enviosPara(Pdono).length === 2 && enviados.length === antesL + 2 /* resposta automática à Fabi + dono */, String(enviados.length - antesL));

  // ---------- SAIR ----------
  console.log("\n== SAIR");
  const podeAntes = (await podeEnviarWhatsapp(admin, Ana.id, "lembrete_mentoria")).pode;
  const antesS = enviados.length;
  r = await msg(Ana.phone, "SAIR", "22:30");   // fora da janela de propósito: a confirmação é resposta a um pedido
  const consAna = (await admin.from("whatsapp_consentimentos").select("revogado_em, revogado_motivo").eq("person_id", Ana.id)).data ?? [];
  confere("antes: a aluna podia receber lembrete", podeAntes === true);
  confere("SAIR: o consentimento foi desligado na hora, com o motivo 'pediu_sair' (histórico mantido)", consAna.length === 1 && !!consAna[0].revogado_em && consAna[0].revogado_motivo === "pediu_sair", JSON.stringify(consAna));
  confere("e agora a F1c NÃO pode mandar lembrete a ela", (await podeEnviarWhatsapp(admin, Ana.id, "lembrete_mentoria")).pode === false);
  const confirma = enviados.slice(antesS).filter((e) => e.recipient === soDig(Ana.phone));
  confere("UMA confirmação, com o texto combinado, mesmo às 22h30", confirma.length === 1 && confirma[0].text === TEXTO_CONFIRMACAO_SAIR, JSON.stringify(confirma));
  confere("NÃO manda a resposta automática comum junto", !confirma.some((e) => e.text === TEXTO_RESPOSTA_AUTOMATICA));
  confere("o sino do mentor avisa que pediu para sair", (await sinos("whatsapp_saiu")).length === 1 && (await sinos("whatsapp_saiu"))[0].titulo.startsWith("Ana Aluna pediu para sair do WhatsApp."));
  confere("a mensagem registra 'sair'", (r.tratamento ?? "").includes("sair") && (r.tratamento ?? "").includes("confirmacao_enviada"), String(r.tratamento));

  const antesS2 = enviados.length;
  await msg(Ana.phone, "sair", "14:00");
  await msg(Ana.phone, "Stop!", "14:00");
  await msg(Ana.phone, "parar", "14:00");
  confere("SAIR repetido no mesmo dia: no máximo 2 confirmações por número", enviados.slice(antesS2).filter((e) => e.recipient === soDig(Ana.phone) && e.text === TEXTO_CONFIRMACAO_SAIR).length <= 1);

  const antesD = enviados.length;
  await msg(Cris.phone, "sair da reunião", "14:00");
  await msg(Cris.phone, "não quero sair", "14:00");
  confere("'sair da reunião' e 'não quero sair' NÃO desligam ninguém", (await podeEnviarWhatsapp(admin, Cris.id, "lembrete_mentoria")).pode === true);

  await msg(Edu.phone, "Parar", "14:00");
  confere("'Parar' também desliga (Edu)", (await podeEnviarWhatsapp(admin, Edu.id, "lembrete_mentoria")).pode === false);

  // retry: o mesmo evento SAIR duas vezes
  const idRetry = `M1B-${rodada}-RETRY`;
  const evRetry = { type: "message.received", created_at: new Date().toISOString(), data: { id: idRetry, sender: { id: soDig(Duda.phone) }, recipient: { id: soDig(Duda.phone), type: "chat" }, sent_at: new Date().toISOString(), type: "text", content: { text: "STOP" } } };
  const antesR = enviados.length;
  const a1 = await processarEventoZapster(admin as never, evRetry as never, { ...ctxBase, agora: brt("14:00") }), a2 = await processarEventoZapster(admin as never, evRetry as never, { ...ctxBase, agora: brt("14:00") });
  confere("o mesmo SAIR reenviado pela Zapster: 1 só confirmação (o reenvio é 'duplicada')", a1 === "gravada" && a2 === "duplicada" && enviados.slice(antesR).filter((e) => e.recipient === soDig(Duda.phone)).length === 1);

  // SAIR de número em dois cadastros: desliga os dois
  const antesA = enviados.length;
  r = await msg("(11) 94444-5555", "SAIR", "14:00");
  confere("número em dois cadastros: SAIR desliga OS DOIS", (await podeEnviarWhatsapp(admin, Dup1.id, "lembrete_mentoria")).pode === false && (await podeEnviarWhatsapp(admin, Dup2.id, "lembrete_mentoria")).pode === false);
  confere("e ele recebe a confirmação", enviados.slice(antesA).some((e) => e.text === TEXTO_CONFIRMACAO_SAIR));

  // SAIR de desconhecido
  const antesU = enviados.length;
  r = await msg(fone(98), "SAIR", "14:00");
  confere("SAIR de número desconhecido: nada desligado, nada enviado", enviados.length === antesU && r.r === "gravada");

  // mensagem antiga
  console.log("\n== reenvio tardio (mensagem com mais de 30 minutos)");
  const antigaId = `M1B-${rodada}-VELHA`; const velha = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const antesV = enviados.length;
  const rv = await processarEventoZapster(admin as never, { type: "message.received", created_at: velha, data: { id: antigaId, sender: { id: soDig(Cris.phone) }, recipient: { id: soDig(Cris.phone), type: "chat" }, sent_at: velha, type: "text", content: { text: "oi tarde" } } } as never, { ...ctxBase, agora: brt("14:00") });
  confere("mensagem antiga: só registrada, ninguém responde nem é avisado", rv === "gravada" && enviados.length === antesV, String(enviados.length - antesV));

  // ---------- nada vaza ----------
  console.log("\n== nada de telefone ou texto em log");
  const numeros = [Ana, Cris, Duda, Edu, Pdono, Pmentor].map((p) => p.phone.replace(/\D/g, ""));
  confere("nenhum telefone completo nem trecho de mensagem nos logs", !numeros.some((t) => saida.some((s) => s.includes(t) && !s.startsWith("criada") && !s.startsWith("ok") && !s.startsWith("FALHA"))) && !saida.some((s) => s.includes("Posso remarcar") && !s.startsWith("ok") && !s.startsWith("FALHA")));
} finally {
  console.log("\n== limpeza (ids já impressos; só dados FICTÍCIOS desta execução)");
  await admin.from("notificacoes").delete().eq("conta_id", criados.users[0]);
  await admin.from("mensagens_recebidas").delete().in("conta_id", criados.users);
  await admin.from("envios_mensagens").delete().in("conta_id", criados.users);
  for (const id of criados.team) await admin.from("team_members").delete().eq("id", id);
  for (const id of criados.groups) await admin.from("groups").delete().eq("id", id);
  for (const id of criados.people) await admin.from("people").delete().eq("id", id);
  for (const id of criados.users) await admin.auth.admin.deleteUser(id);
  const c = async (t: string, col: string, ids: string[]) => (await admin.from(t).select("*", { count: "exact", head: true }).in(col, ids)).count;
  const sobras = [await c("mensagens_recebidas", "conta_id", criados.users), await c("envios_mensagens", "conta_id", criados.users), await c("people", "id", criados.people), await c("notificacoes", "conta_id", criados.users), await c("whatsapp_consentimentos", "person_id", criados.people)];
  console.log(`sobras: ${sobras.join(", ")}`);
  confere("nada sobrou", sobras.every((x) => x === 0));
}
console.log(falhas === 0 ? "\nTUDO CERTO" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
