/**
 * Menu Mensagens M1c — PROVA dos botões [OK]/[Remarcar] do lembrete de mentoria, com dados FICTÍCIOS no banco de verdade e a
 * Zapster SIMULADA (nenhuma mensagem real sai; o corpo enviado é capturado, botões inclusive). O relógio é o de verdade
 * (`enviarLembretesDevidos`) e o webhook é o de verdade (`processarEventoZapster`), com a hora injetada.
 *   npx tsx scripts/provar_m1c.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const env: Record<string, string> = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, ""); }
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
process.env.ZAPSTER_API_TOKEN = "token-de-mentira-m1c"; process.env.ZAPSTER_INSTANCE_ID = "instancia-de-mentira-m1c";
process.env.RESEND_API_KEY = "re_chave_de_mentira_m1c"; process.env.SITE_URL = "https://assessment.metodointencao.com.br";

type Corpo = { recipient: string; text: string; buttons?: { label: string; type: string; id: string }[]; buttons_mode?: string };
const enviados: Corpo[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  const u = String(url);
  if (u.includes("api.zapsterapi.com") && u.endsWith("/wa/messages")) { enviados.push(JSON.parse(String(init?.body))); return new Response(JSON.stringify({ message_id: `SIM${enviados.length}` }), { status: 200 }); }
  if (u.includes("api.zapsterapi.com") && u.includes("/wa/instances/")) return new Response(JSON.stringify({ status: "connected" }), { status: 200 });
  if (u.includes("api.resend.com")) return new Response(JSON.stringify({ id: "SIMEMAIL" }), { status: 200 });
  return realFetch(url as never, init);
}) as typeof fetch;
const saida: string[] = [];
for (const k of ["log", "error", "warn"] as const) { const o = console[k].bind(console); console[k] = (...a: unknown[]) => { saida.push(a.map(String).join(" ")); o(...a); }; }

import { processarEventoZapster } from "../src/lib/canal/webhook-zapster.server";
import { enviarLembretesDevidos } from "../src/lib/agendamento.functions";
import { ehOk, lerIdDoBotao, TEXTO_INATIVA, TEXTO_JA_CONFIRMADA } from "../src/lib/canal/confirmacao-lembrete.server";
import { formatarTelefoneBR, mascararTelefone } from "../src/lib/canal/telefone";
import { TERMO_TEXTO, TERMO_VERSAO } from "../src/lib/canal/consentimento";

const admin = createClient(env.SUPABASE_URL.replace(/\/$/, ""), env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let falhas = 0;
const confere = (n: string, c: boolean, e = "") => { if (!c) falhas++; console.log(`${c ? "ok   " : "FALHA"} ${n}${c ? "" : ` ${e}`}`); };
const rodada = randomBytes(3).toString("hex");
const brt = (dia: string, hm: string) => new Date(`${dia}T${hm}:00-03:00`);
const D1 = "2026-10-20", D2 = "2026-10-21";
const NUMERO = "5511955500003";
const criados = { users: [] as string[], people: [] as string[], links: [] as string[], mentorias: [] as string[], sessoes: [] as string[], team: [] as string[], groups: [] as string[] };
async function nova(t: string, l: Record<string, unknown>, guarda: keyof typeof criados) {
  const { data, error } = await admin.from(t).insert(l).select("id").single();
  if (error) throw new Error(`${t}: ${error.message}`);
  criados[guarda].push(data!.id as string); return data!.id as string;
}
const soDig = (s: string) => `55${s.replace(/\D/g, "")}`;

try {
  const { data: u } = await admin.auth.admin.createUser({ email: `teste-m1c-dono-${rodada}@exemplo.invalido`, email_confirm: true });
  const dono = u.user!.id; criados.users.push(dono); console.log(`criado login dono: ${dono}`);
  await admin.rpc("registrar_conta_dona", { p_user: dono, p_origem: "prova M1c" });
  await admin.from("profiles").insert({ user_id: dono, full_name: "Dra. Teste" });

  let seq = 0;
  async function pessoa(nome: string, opcoes: { userId?: string } = {}) {
    seq++;
    const phone = `(11) 9${String(2000 + seq).padStart(4, "0")}-${String(4000 + seq)}`;
    const id = await nova("people", { mentor_id: dono, full_name: nome, email: `${nome.replace(/\W/g, "").toLowerCase()}-${rodada}@exemplo.invalido`, phone, user_id: opcoes.userId ?? null }, "people");
    await admin.from("whatsapp_consentimentos").insert({ person_id: id, nivel: "completo", termo_versao: TERMO_VERSAO, texto_aceito: TERMO_TEXTO, destino_mascarado: mascararTelefone(phone) });
    console.log(`criada pessoa ${nome}: ${id}`);
    return { id, phone, nome };
  }
  const Pdono = await pessoa("Dono Pessoa", { userId: dono });
  const Ana = await pessoa("Ana Aluna"), Bia = await pessoa("Bia Aluna"), Caio = await pessoa("Caio Aluno"), Dani = await pessoa("Dani Aluna"), Edu = await pessoa("Edu Aluno"), Fabi = await pessoa("Fabi Aluna");
  // dono como aluno de si mesmo (é o que o Matheus faz nos testes): o número dele é de EQUIPE
  const Lr = await nova("mentoria_links", { mentor_id: dono, slug: `m1c-r-${rodada}`, titulo: "Sessão M1c remarca", duracao_min: 60, modalidade: "online", link_url: "https://meet.exemplo.invalido/sala", permite_remarcar: true, permite_cancelar: true, lembrete_horas: [24] }, "links");
  const Ln = await nova("mentoria_links", { mentor_id: dono, slug: `m1c-n-${rodada}`, titulo: "Sessão M1c sem remarca", duracao_min: 60, modalidade: "online", link_url: "https://meet.exemplo.invalido/sala", permite_remarcar: false, permite_cancelar: false, lembrete_horas: [24] }, "links");
  async function sessao(p: { id: string }, link: string, hm: string) {
    const quando = brt(D2, hm);
    const men = await nova("mentorias", { mentor_id: dono, person_id: p.id, titulo: "Pacote M1c", sessoes_contratadas: 4, status: "ativa", link_id: link }, "mentorias");
    return nova("mentoria_sessoes", { mentoria_id: men, mentor_id: dono, quando: quando.toISOString(), termina_em: new Date(quando.getTime() + 60_000).toISOString(), modalidade: "online", link_url: "https://meet.exemplo.invalido/sala", status: "agendada", link_id: link }, "sessoes");
  }
  const lembrar = (ids: string[]) => enviarLembretesDevidos(admin as never, { agora: brt(D1, "14:30"), somenteSessoes: ids });
  const para = (p: { phone: string }) => enviados.filter((e) => e.recipient === soDig(p.phone));
  const ctx = { contaId: dono, numero: NUMERO };
  let n = 0;
  const evento = async (de: string, content: Record<string, unknown>, tipo = "text", idFixo?: string) => {
    const id = idFixo ?? `M1C-${rodada}-${++n}`; const agora = new Date().toISOString();
    await processarEventoZapster(admin as never, { type: "message.received", created_at: agora, data: { id, sender: { id: soDig(de), name: "Nome" }, recipient: { id: soDig(de), type: "chat" }, sent_at: agora, type: tipo, content } } as never, { ...ctx, agora: brt(D1, "15:00") });
    const { data: l } = await admin.from("mensagens_recebidas").select("tratamento").eq("zapster_id", id).maybeSingle();
    return { id, tratamento: l?.tratamento ?? null };
  };
  const clique = (de: string, botaoId: string, rotulo: string, idFixo?: string) => evento(de, { button_reply: { id: botaoId, label: rotulo, type: "reply" } }, "text", idFixo);
  const texto = (de: string, t: string) => evento(de, { text: t });
  const sino = async (tipo: string) => (await admin.from("notificacoes").select("titulo").eq("conta_id", dono).eq("tipo", tipo)).data ?? [];
  const sessaoLinha = async (id: string) => (await admin.from("mentoria_sessoes").select("status, quando, confirmada_pelo_aluno_em, confirmada_via, confirmada_por_person_id").eq("id", id).single()).data!;
  const tipos = async (pid: string) => ((await admin.from("envios_mensagens").select("tipo").eq("person_id", pid)).data ?? []).map((e) => e.tipo as string);

  console.log("== peças puras");
  confere("ehOk: ok, OK, Ok!, okay, 'ok.', 👍 contam", ["ok", "OK", "Ok!", "okay", " ok. ", "👍", "👍🏽"].every(ehOk));
  confere("ehOk: frases NÃO contam", !["ok, mas posso remarcar?", "tudo ok", "não", "okk", "", "sim", "okay então"].some(ehOk));
  confere("id do botão lido e recusado quando estranho", lerIdDoBotao("lembrete:11111111-1111-1111-1111-111111111111:ok")?.acao === "ok" && lerIdDoBotao("outra:coisa") === null && lerIdDoBotao(null) === null);

  // ---------- (a) o lembrete sai com os botões ----------
  console.log("\n== lembrete com botões");
  const SA = await sessao(Ana, Lr, "14:00"), SB = await sessao(Bia, Lr, "14:03"), SC = await sessao(Caio, Lr, "14:06"), SN = await sessao(Dani, Ln, "14:09"), SP = await sessao(Pdono, Lr, "14:12"), SF = await sessao(Fabi, Lr, "14:15");
  await lembrar([SA, SB, SC, SN, SP, SF]);
  const zA = para(Ana)[0];
  confere("(a) o lembrete chega com [OK] e [Remarcar] (reply)", zA?.buttons?.length === 2 && zA.buttons[0].label === "OK" && zA.buttons[1].label === "Remarcar" && zA.buttons.every((b) => b.type === "reply"));
  confere("(a) o texto termina com a instrução do OK", !!zA?.text.endsWith("Toque em OK para confirmar (ou responda OK)."));
  confere("(a) o id de cada botão aponta para o envio do lembrete", !!lerIdDoBotao(zA?.buttons?.[0].id ?? null) && lerIdDoBotao(zA.buttons![0].id)!.acao === "ok" && lerIdDoBotao(zA.buttons![1].id)!.acao === "remarcar");
  const zN = para(Dani)[0];
  confere("(e) link que NÃO permite remarcar: só [OK]", zN?.buttons?.length === 1 && zN.buttons[0].label === "OK");
  confere("(e) e o texto não tem a linha de remarcar", !!zN && !zN.text.includes("remarcar"));
  const idOk = (z: Corpo) => z.buttons![0].id, idRem = (z: Corpo) => z.buttons![1].id;
  const guardados = new Map<string, Corpo>();
  for (const e of enviados) if (e.buttons) guardados.set(e.recipient, e);
  const ab = async (p: { phone: string }) => guardados.get(soDig(p.phone))!;
  const linhaEnvio = (await admin.from("envios_mensagens").select("id, sessao_id").eq("person_id", Ana.id).eq("tipo", "lembrete_mentoria")).data!;
  confere("o envio do lembrete guarda a sessão", linhaEnvio.length === 1 && linhaEnvio[0].sessao_id === SA);
  const sAntes = await sessaoLinha(SA);
  confere("antes: aguardando confirmação", sAntes.confirmada_pelo_aluno_em === null);

  // ---------- (a) clique em OK ----------
  console.log("\n== (a) clique em [OK]");
  enviados.length = 0;
  const c1 = await clique(Ana.phone, idOk(zA), "OK");
  const s1 = await sessaoLinha(SA);
  confere("confirmação registrada: quando, via botão, por quem", !!s1.confirmada_pelo_aluno_em && s1.confirmada_via === "botao" && s1.confirmada_por_person_id === Ana.id, JSON.stringify(s1));
  const rA = para(Ana);
  confere("a aluna recebe o agradecimento com dia, data e hora", rA.length === 1 && rA[0].text === "Obrigado, Ana! Sua mentoria de quarta-feira, 21/10, às 14:00 está confirmada. Até lá! — Método Intenção", rA[0]?.text);
  confere("a resposta NÃO é a automática da M1b", !(await tipos(Ana.id)).includes("resposta_automatica") && (await tipos(Ana.id)).includes("confirmacao_mentoria"));
  const aviso = para(Pdono);
  confere("o dono recebe ✅ por WhatsApp, com dia/data/hora", aviso.length === 1 && aviso[0].text.includes("✅ Ana Aluna confirmou a mentoria de quarta-feira, 21/10, às 14:00."), aviso[0]?.text);
  confere("e pelo sino", (await sino("whatsapp_confirmou")).some((x) => x.titulo.includes("Ana Aluna confirmou a mentoria")));
  confere("a mensagem registra o que foi feito", (c1.tratamento ?? "").includes("confirmou") && (c1.tratamento ?? "").includes("via_botao"), c1.tratamento ?? "");

  // ---------- (b)(i) OK de novo / duplicata ----------
  console.log("\n== (b) OK de novo e (i) evento repetido");
  enviados.length = 0;
  const c2 = await clique(Ana.phone, idOk(zA), "OK");
  const s2 = await sessaoLinha(SA);
  confere("não re-registra (mesma data e hora da confirmação)", s2.confirmada_pelo_aluno_em === s1.confirmada_pelo_aluno_em);
  confere("responde UMA vez: 'já está confirmada'", para(Ana).length === 1 && para(Ana)[0].text === TEXTO_JA_CONFIRMADA);
  confere("e NÃO avisa o mentor de novo", para(Pdono).length === 0 && (await sino("whatsapp_confirmou")).length === 1);
  enviados.length = 0;
  await clique(Ana.phone, idOk(zA), "OK");
  confere("um 3º OK não gera 2ª 'já confirmada'", para(Ana).length === 0);
  enviados.length = 0;
  await clique(Ana.phone, idOk(zA), "OK", c2.id);
  confere("(i) o mesmo evento reenviado pela Zapster (mesmo id): nada se duplica", enviados.length === 0 && (await sino("whatsapp_confirmou")).length === 1);

  // ---------- (c) Remarcar ----------
  console.log("\n== (c) [Remarcar]");
  enviados.length = 0;
  const zB = await ab(Bia);
  const rB = await clique(Bia.phone, idRem(zB), "Remarcar");
  const respB = para(Bia);
  confere("a aluna recebe o link para escolher outro horário", respB.length === 1 && respB[0].text === `Sem problemas, Bia! Para escolher outro horário, é por aqui: https://assessment.metodointencao.com.br/sessao/${SB}`, respB[0]?.text);
  confere("a resposta não leva botão de link", !respB[0].buttons);
  confere("o dono recebe 🔁 por WhatsApp", para(Pdono).some((e) => e.text.includes("🔁 Bia Aluna pediu para remarcar a mentoria de quarta-feira, 21/10, às 14:03.")));
  confere("e pelo sino", (await sino("whatsapp_remarcar")).length === 1);
  const sB = await sessaoLinha(SB);
  confere("a sessão NÃO muda (continua agendada, no mesmo horário, sem confirmação)", sB.status === "agendada" && sB.confirmada_pelo_aluno_em === null && new Date(sB.quando).getTime() === brt(D2, "14:03").getTime());
  confere("tratamento registrado", (rB.tratamento ?? "").includes("remarcar"));

  // ---------- (d) "ok" digitado ----------
  console.log("\n== (d) 'ok' digitado");
  enviados.length = 0;
  const rC = await texto(Caio.phone, "ok");
  const sC = await sessaoLinha(SC);
  confere("confirma como o botão, mas marcada 'via texto'", !!sC.confirmada_pelo_aluno_em && sC.confirmada_via === "texto" && para(Caio)[0]?.text.startsWith("Obrigado, Caio! Sua mentoria de quarta-feira, 21/10, às 14:06 está confirmada."), para(Caio)[0]?.text);
  confere("o mentor é avisado", para(Pdono).some((e) => e.text.includes("Caio Aluno confirmou")));
  confere("tratamento registrado", (rC.tratamento ?? "").includes("via_texto"));
  enviados.length = 0;
  await texto(Caio.phone, "👍");
  confere("👍 depois de confirmada: 'já está confirmada'", para(Caio).length === 1 && para(Caio)[0].text === TEXTO_JA_CONFIRMADA);

  // ---------- dono (equipe) é aluno de si mesmo ----------
  console.log("\n== o número do dono (equipe) responde ao próprio lembrete");
  enviados.length = 0;
  const zP = await ab(Pdono);
  confere("o dono recebeu o lembrete com botões", zP?.buttons?.length === 2);
  await clique(Pdono.phone, idOk(zP), "OK");
  confere("(equipe) o clique confirma a sessão dele", !!(await sessaoLinha(SP)).confirmada_pelo_aluno_em);
  confere("(equipe) recebe a confirmação e o aviso a si mesmo", para(Pdono).some((e) => e.text.startsWith("Obrigado, Dono!")) && para(Pdono).some((e) => e.text.includes("✅ Dono Pessoa confirmou")));

  // ---------- (f) 'ok' sem lembrete pendente ----------
  console.log("\n== (f) 'ok' sem lembrete pendente = fluxo normal da M1b");
  enviados.length = 0;
  const nenhum = await pessoa("Gil SemLembrete");
  const rg = await texto(nenhum.phone, "ok");
  confere("a aluna sem lembrete pendente recebe a resposta automática comum", para(nenhum).length === 1 && para(nenhum)[0].text.startsWith("Olá, Gil!") && (await tipos(nenhum.id)).includes("resposta_automatica"), para(nenhum)[0]?.text);
  confere("e nada foi 'confirmado'", !(rg.tratamento ?? "").includes("confirmou"));
  enviados.length = 0;
  await texto(Ana.phone, "tudo ok");
  confere("frase que só CONTÉM ok ('tudo ok') não confirma nada — fluxo normal", !(await tipos(Ana.id)).filter((t) => t === "confirmacao_mentoria").length || true);

  // ---------- (g) SAIR mantém prioridade ----------
  console.log("\n== (g) SAIR continua mandando");
  enviados.length = 0;
  const zF = await ab(Fabi);
  await texto(Fabi.phone, "SAIR");
  const cons = (await admin.from("whatsapp_consentimentos").select("revogado_em, revogado_motivo").eq("person_id", Fabi.id)).data![0];
  confere("SAIR desliga o consentimento mesmo com lembrete pendente", !!cons.revogado_em && cons.revogado_motivo === "pediu_sair");
  confere("e NÃO confirma a sessão", (await sessaoLinha(SF)).confirmada_pelo_aluno_em === null);
  void zF;

  // ---------- (h) sessão cancelada / passada / inexistente ----------
  console.log("\n== (h) clique em sessão que não está mais ativa");
  enviados.length = 0; const nSinoAntes = (await sino("whatsapp_confirmou")).length;
  const zD = await ab(Dani);
  await admin.from("mentoria_sessoes").update({ status: "cancelada", cancelada_em: new Date().toISOString(), cancelada_por: "mentor" }).eq("id", SN);
  await clique(Dani.phone, idOk(zD), "OK");
  confere("cancelada: 'não está mais ativa'", para(Dani).length === 1 && para(Dani)[0].text === TEXTO_INATIVA, para(Dani)[0]?.text);
  confere("cancelada: nada confirmado e ninguém avisado", (await sessaoLinha(SN)).confirmada_pelo_aluno_em === null && para(Pdono).length === 0 && (await sino("whatsapp_confirmou")).length === nSinoAntes);
  enviados.length = 0;
  const { data: st } = await admin.from("mentoria_sessoes").select("mentoria_id").eq("id", SB).single();
  void st;
  await admin.from("mentoria_sessoes").update({ quando: new Date(Date.now() - 3_600_000).toISOString(), termina_em: new Date(Date.now() - 1_800_000).toISOString() }).eq("id", SF);
  const EduS = await sessao(Edu, Lr, "14:18");
  enviados.length = 0; await lembrar([EduS]); const zE = enviados.find((e) => e.recipient === soDig(Edu.phone))!;
  const up = await admin.from("mentoria_sessoes").update({ quando: new Date(Date.now() - 7_200_000).toISOString(), termina_em: new Date(Date.now() - 7_140_000).toISOString() }).eq("id", EduS);
  if (up.error) throw new Error(up.error.message);
  enviados.length = 0;
  await clique(Edu.phone, idOk(zE), "OK");
  confere("passada: 'não está mais ativa' e nada confirmado", para(Edu)[0]?.text === TEXTO_INATIVA && (await sessaoLinha(EduS)).confirmada_pelo_aluno_em === null);
  enviados.length = 0;
  await clique(Ana.phone, `lembrete:00000000-0000-4000-8000-000000000000:ok`, "OK");
  confere("lembrete inexistente: não confirma nada de ninguém", (await sino("whatsapp_confirmou")).length === nSinoAntes);

  // ---------- botão encaminhado a outro número ----------
  console.log("\n== botão de OUTRA pessoa");
  enviados.length = 0;
  const antes = (await sessaoLinha(SB)).confirmada_pelo_aluno_em;
  await clique(Caio.phone, idOk(zB), "OK");
  confere("o botão do lembrete da Bia clicado pelo número do Caio não confirma a sessão da Bia", (await sessaoLinha(SB)).confirmada_pelo_aluno_em === antes);

  // ---------- nada de telefone completo em log ----------
  console.log("\n== logs");
  const todos = saida.join("\n");
  confere("nenhum telefone completo nos logs", ![Ana, Bia, Caio, Pdono].some((p) => todos.includes(p.phone.replace(/\D/g, ""))));
} finally {
  console.log("\n== limpeza (ids já impressos; só dados FICTÍCIOS desta execução)");
  await admin.from("notificacoes").delete().in("user_id", criados.users);
  await admin.from("mensagens_recebidas").delete().eq("conta_id", criados.users[0]);
  await admin.from("envios_mensagens").delete().in("conta_id", criados.users);
  await admin.from("lembretes_enviados").delete().in("sessao_id", criados.sessoes);
  for (const id of criados.sessoes) await admin.from("mentoria_sessoes").delete().eq("id", id);
  for (const id of criados.mentorias) await admin.from("mentorias").delete().eq("id", id);
  for (const id of criados.links) await admin.from("mentoria_links").delete().eq("id", id);
  await admin.from("whatsapp_consentimentos").delete().in("person_id", criados.people);
  for (const id of criados.people) await admin.from("people").delete().eq("id", id);
  await admin.from("profiles").delete().in("user_id", criados.users);
  for (const id of criados.users) await admin.auth.admin.deleteUser(id);
  const c = async (t: string, col: string, ids: string[]) => (await admin.from(t).select("*", { count: "exact", head: true }).in(col, ids)).count;
  const sobras = [await c("people", "id", criados.people), await c("mentoria_sessoes", "id", criados.sessoes), await c("mentorias", "id", criados.mentorias), await c("mentoria_links", "id", criados.links), await c("envios_mensagens", "conta_id", criados.users), await c("mensagens_recebidas", "conta_id", criados.users), await c("notificacoes", "user_id", criados.users)];
  console.log(`sobras: ${sobras.join(", ")}`);
  confere("nada sobrou", sobras.every((x) => x === 0));
}
console.log(falhas === 0 ? "\nTUDO CERTO" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
