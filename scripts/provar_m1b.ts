/**
 * Menu Mensagens M1b (+ ajustes M1b-2) — PROVA de SAIR, respostas automáticas e aviso ao mentor, com dados FICTÍCIOS no
 * banco de verdade e a Zapster SIMULADA (nenhuma mensagem real sai). A hora da plataforma é injetada.
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
import { ehPedidoDeSair, textoRespostaAoAluno, TEXTO_BOAS_VINDAS_DESCONHECIDO, TEXTO_CONFIRMACAO_SAIR } from "../src/lib/canal/resposta-whatsapp.server";
import { podeEnviarWhatsapp } from "../src/lib/canal/consentimento.server";
import { formatarTelefoneBR, mascararTelefone } from "../src/lib/canal/telefone";
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
  async function login(rotulo: string) {
    const { data: u } = await admin.auth.admin.createUser({ email: `teste-m1b-${rotulo}-${rodada}@exemplo.invalido`, email_confirm: true });
    criados.users.push(u.user!.id); console.log(`criado login ${rotulo}: ${u.user!.id}`); return u.user!.id;
  }
  const dono = await login("dono");
  await admin.rpc("registrar_conta_dona", { p_user: dono, p_origem: "prova M1b-2" });
  const mentorLogin = await login("mentor"), colabLogin = await login("colab");

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
  const Pmentor = await pessoa("Mentora Um", "essencial"), Psem = await pessoa("Mentor SemConsentimento", "nenhum"), Pcolab = await pessoa("Colaboradora Dois", "completo");
  const Ana = await pessoa("Ana Aluna", "completo"), Cris = await pessoa("Cris Aluna", "completo"), Duda = await pessoa("Duda Aluna", "completo"), Edu = await pessoa("Edu Aluno", "completo"), Fabi = await pessoa("Fabi Aluna", "completo");
  const Semturma = await pessoa("Gabi SemTurma", "completo"), Semturma2 = await pessoa("Hugo SemTurma", "completo");
  const Dup1 = await pessoa("Dupla Um", "completo", { phone: "(11) 94444-5555" }), Dup2 = await pessoa("Dupla Dois", "completo", { phone: "11 94444 5555" });

  const grupo = await ins("groups", { mentor_id: dono, name: "Turma M1b" }, "groups");
  for (const p of [Ana, Cris, Duda, Edu, Fabi]) await admin.from("group_members").insert({ group_id: grupo, person_id: p.id });
  const tmMentor = await ins("team_members", { owner_id: dono, kind: "mentor", name: "Mentora Um", email: `mentora-${rodada}@exemplo.invalido`, person_id: Pmentor.id, user_id: mentorLogin, status: "ativo" }, "team");
  await admin.from("team_member_groups").insert({ team_member_id: tmMentor, group_id: grupo });
  const tmSem = await ins("team_members", { owner_id: dono, kind: "mentor", name: "Mentor Sem", email: `mentorsem-${rodada}@exemplo.invalido`, person_id: Psem.id, status: "ativo" }, "team");
  await admin.from("team_member_groups").insert({ team_member_id: tmSem, group_id: grupo });
  // uma colaboradora da equipe que NÃO é da turma (para provar que aluno sem turma não a alcança)
  await ins("team_members", { owner_id: dono, kind: "colaborador", name: "Colab Dois", email: `colab-${rodada}@exemplo.invalido`, person_id: Pcolab.id, user_id: colabLogin, status: "ativo", permissions: ["pessoas"] }, "team");

  const ctxBase = { contaId: dono, numero: NUMERO };
  let n = 0;
  const msg = async (de: string, texto: string | null, hm: string, opcoes: { tipo?: string; nome?: string | null; idFixo?: string; content?: Record<string, unknown> } = {}) => {
    const id = opcoes.idFixo ?? `M1B-${rodada}-${++n}`;
    const agora = new Date().toISOString();
    const r = await processarEventoZapster(admin as never, { type: "message.received", created_at: agora, data: { id, sender: { id: soDig(de), name: opcoes.nome === undefined ? "Nome" : opcoes.nome }, recipient: { id: soDig(de), type: "chat" }, sent_at: agora, type: opcoes.tipo ?? "text", content: opcoes.content ?? { text: texto } } } as never, { ...ctxBase, agora: brt(hm) });
    const { data: linha } = await admin.from("mensagens_recebidas").select("tratamento, remetente").eq("zapster_id", id).maybeSingle();
    return { r, id, tratamento: linha?.tratamento ?? null, remetente: linha?.remetente };
  };
  const para = (p: { phone: string }) => enviados.filter((e) => e.recipient === soDig(p.phone));
  const sinos = async (tipo: string) => (await admin.from("notificacoes").select("titulo, user_id").eq("conta_id", dono).eq("tipo", tipo)).data ?? [];
  const tel = (p: { phone: string }) => formatarTelefoneBR(soDig(p.phone));

  console.log("== o que conta como pedido de sair");
  confere("SAIR, sair., Parar, STOP!, cancelar, ' Sair ' contam", ["SAIR", "sair.", "Parar", "STOP!", "cancelar", "  Sair  "].every(ehPedidoDeSair));
  confere("'sair da reunião', 'não quero sair', 'parar de tocar', 'oi', '' NÃO contam", !["sair da reunião", "não quero sair", "parar de tocar", "oi", "", "sair agora por favor"].some(ehPedidoDeSair));
  confere("telefone completo legível para o mentor", formatarTelefoneBR("5518999991234") === "(18) 99999-1234" && formatarTelefoneBR("(18) 3222-1234") === "(18) 3222-1234" && formatarTelefoneBR("551832221234") === "(18) 3222-1234");

  // ---------- (a) aluno cadastrado ----------
  console.log("\n== (a) aluno cadastrado escreve: texto novo + aviso ao mentor com telefone completo");
  let r = await msg(Ana.phone, "Oi, tudo bem? Posso remarcar?", "14:00");
  confere("gravada, identificada como a aluna", r.r === "gravada" && r.remetente === "pessoa");
  const respAna = para(Ana);
  confere("a aluna recebe o texto NOVO, com o primeiro nome", respAna.length === 1 && respAna[0].text === "Olá, Ana! Recebemos sua mensagem. Em breve seu mentor vai falar com você.\n— Método Intenção" && respAna[0].text === textoRespostaAoAluno("Ana Aluna"), JSON.stringify(respAna));
  const avisoDono = para(Pdono), avisoMentor = para(Pmentor), avisoSem = para(Psem);
  const esperado = `Ana Aluna (${tel(Ana)}) mandou mensagem no número do Método Intenção: "Oi, tudo bem? Posso remarcar?"`;
  confere("o DONO recebe o aviso no formato pedido: nome, telefone COMPLETO e o texto entre aspas", avisoDono.length === 1 && avisoDono[0].text === esperado, JSON.stringify(avisoDono));
  confere("a MENTORA da turma (com consentimento) também recebe", avisoMentor.length === 1 && avisoMentor[0].text === esperado);
  confere("o mentor SEM consentimento não recebe", avisoSem.length === 0);
  const sn = await sinos("whatsapp_resposta");
  confere("sino: 'Ana Aluna respondeu no WhatsApp: “…”' (sem telefone completo)", sn.some((x) => x.titulo === "Ana Aluna respondeu no WhatsApp: “Oi, tudo bem? Posso remarcar?”") && !sn.some((x) => x.titulo.includes("9")) === false || sn.every((x) => !x.titulo.includes(soDig(Ana.phone))));
  confere("a turma tem login de mentor: o sino chega ao dono e à mentora, NÃO à colaboradora de fora da turma", sn.some((x) => x.user_id === dono) && sn.some((x) => x.user_id === mentorLogin) && !sn.some((x) => x.user_id === colabLogin), JSON.stringify(sn.map((x) => x.user_id === dono ? "dono" : x.user_id === mentorLogin ? "mentora" : x.user_id === colabLogin ? "colab" : "?")));
  confere("a mensagem registra o que foi feito", (r.tratamento ?? "").includes("resposta_automatica") && (r.tratamento ?? "").includes("mentor_avisado"), String(r.tratamento));

  // ---------- (c) mesmo número de novo ----------
  console.log("\n== (c) o mesmo número escreve de novo no mesmo dia");
  const antes = enviados.length;
  r = await msg(Ana.phone, "outra coisa", "14:05");
  confere("nenhuma 2ª resposta automática no mesmo dia", para(Ana).length === 1);
  confere("dentro de 15 min não avisa o mentor de novo (nem WhatsApp, nem sino)", enviados.length === antes && (await sinos("whatsapp_resposta")).filter((x) => x.user_id === dono).length === 1, String(enviados.length - antes));
  // passados 15 minutos: avisa de novo (simula a passagem do tempo envelhecendo o aviso)
  await admin.from("notificacoes").update({ created_at: new Date(Date.now() - 16 * 60_000).toISOString() }).eq("conta_id", dono).eq("tipo", "whatsapp_resposta");
  const antes2 = enviados.length;
  await msg(Ana.phone, "terceira", "14:30");
  confere("depois de 15 minutos: avisa o mentor de novo; a resposta automática continua sendo só 1 no dia", para(Ana).length === 1 && enviados.length === antes2 + 2 /* dono + mentora */, String(enviados.length - antes2));

  // ---------- (e) 22h: tudo sai na hora ----------
  console.log("\n== (e) às 22h: a resposta automática e o aviso ao mentor saem na hora");
  const antes22 = enviados.length;
  await msg(Cris.phone, "boa noite!", "22:00");
  confere("às 22h: a aluna recebe a resposta automática", para(Cris).length === 1 && para(Cris)[0].text.startsWith("Olá, Cris!"));
  confere("às 22h: o mentor recebe o aviso por WhatsApp", enviados.length === antes22 + 3 /* resposta + dono + mentora */ && para(Pdono).some((e) => e.text.startsWith("Cris Aluna (")), String(enviados.length - antes22));
  await msg(Duda.phone, "bom dia", "03:00");
  confere("às 3h da manhã: também (sem janela)", para(Duda).length === 1 && para(Pdono).some((e) => e.text.startsWith("Duda Aluna (")));

  // ---------- (d) sem limite diário ----------
  console.log("\n== (d) 5 alunos diferentes no mesmo dia: os 5 avisos chegam (sem limite de 3)");
  await msg(Edu.phone, "oi", "15:00"); await msg(Fabi.phone, "oi", "15:00");
  const nomesAvisados = para(Pdono).map((e) => e.text.split(" (")[0]);
  confere("o dono recebeu o aviso dos 5 alunos (Ana, Cris, Duda, Edu, Fabi)", ["Ana Aluna", "Cris Aluna", "Duda Aluna", "Edu Aluno", "Fabi Aluna"].every((nome) => nomesAvisados.includes(nome)), nomesAvisados.join(","));
  const enviosDono = (await admin.from("envios_mensagens").select("id", { count: "exact", head: true }).eq("person_id", Pdono.id).eq("tipo", "mentor_resposta_aluno")).count;
  confere("e nada deixou de chegar por 'limite diário' (5+ avisos registrados ao dono)", (enviosDono ?? 0) >= 5, String(enviosDono));

  // ---------- (b) desconhecido ----------
  console.log("\n== (b) número desconhecido: boas-vindas + aviso ao dono");
  const DESC = { phone: fone(97) };
  const antesD = enviados.length;
  r = await msg(DESC.phone, "Olá", "16:00", { nome: "Laila Perfil" });
  const bemVindo = para(DESC);
  confere("o desconhecido recebe as boas-vindas, no texto pedido", bemVindo.length === 1 && bemVindo[0].text === TEXTO_BOAS_VINDAS_DESCONHECIDO && TEXTO_BOAS_VINDAS_DESCONHECIDO === "Olá! Seja bem-vindo(a) ao Método Intenção. Este é o canal exclusivo de agendamentos e informativos para alunos, clientes, mentores e parceiros do Método Intenção. Recebemos sua mensagem e em breve um mentor vai falar com você.", JSON.stringify(bemVindo));
  const avD = para(Pdono).find((e) => e.text.startsWith("Novo contato"));
  confere("o DONO recebe o aviso: nome do perfil, telefone completo e o texto", !!avD && avD.text === `Novo contato no número do Método Intenção: Laila Perfil (${tel(DESC)}): "Olá"`, JSON.stringify(avD));
  confere("desconhecido NÃO gera aviso à mentora da turma (não tem mentor responsável): só o dono", !para(Pmentor).some((e) => e.text.startsWith("Novo contato")) && !para(Pcolab).some((e) => e.text.startsWith("Novo contato")));
  const snD = (await sinos("whatsapp_novo_contato"));
  confere("o sino do dono avisa (com telefone MASCARADO); ninguém mais da equipe recebe", snD.length === 1 && snD[0].user_id === dono && snD[0].titulo === "Novo contato no WhatsApp: Laila Perfil: “Olá”" && !snD[0].titulo.includes(soDig(DESC.phone)), JSON.stringify(snD));
  const antesD2 = enviados.length;
  await msg(DESC.phone, "tem alguém aí?", "16:02", { nome: "Laila Perfil" });
  confere("o mesmo desconhecido de novo: nenhuma 2ª boas-vindas e nenhum novo aviso em 15 min", enviados.length === antesD2);
  const DESC2 = { phone: fone(96) };
  await msg(DESC2.phone, "Oi", "16:03", { nome: null });
  const avD2 = para(Pdono).find((e) => e.text.includes(`(${tel(DESC2)})`));
  confere("sem nome de perfil: o aviso mostra só o telefone", !!avD2 && avD2.text === `Novo contato no número do Método Intenção: (${tel(DESC2)}): "Oi"`, JSON.stringify(avD2));

  // ---------- mídia ----------
  console.log("\n== mídia: o mentor lê '[enviou um áudio]' etc.");
  const M1 = await pessoa("Iara Midia", "completo"); await admin.from("group_members").insert({ group_id: grupo, person_id: M1.id });
  await msg(M1.phone, null, "17:00", { tipo: "audio", content: { media: { url: "https://x.invalido/a.ogg" }, text: "" } });
  confere("áudio: o aviso traz '[enviou um áudio]' e nada do arquivo", para(Pdono).some((e) => e.text === `Iara Midia (${tel(M1)}) mandou mensagem no número do Método Intenção: "[enviou um áudio]"`) && !enviados.some((e) => e.text.includes("x.invalido")));
  const M2 = await pessoa("Joana Midia", "completo"); await admin.from("group_members").insert({ group_id: grupo, person_id: M2.id });
  await msg(M2.phone, null, "17:00", { tipo: "image", content: { media: { url: "https://x.invalido/i.jpg" }, text: "uma legenda qualquer" } });
  confere("imagem: '[enviou uma imagem]'", para(Pdono).some((e) => e.text.endsWith(`"[enviou uma imagem]"`)));
  const longo = "x".repeat(450);
  const M3 = await pessoa("Kaka Longo", "completo"); await admin.from("group_members").insert({ group_id: grupo, person_id: M3.id });
  await msg(M3.phone, longo, "17:00");
  const avL = para(Pdono).find((e) => e.text.startsWith("Kaka Longo"));
  confere("texto longo: no máximo 300 caracteres (cortado com reticências)", !!avL && avL.text.includes("x".repeat(299) + "…") && !avL.text.includes("x".repeat(301)));

  // ---------- (f) aluno sem turma ----------
  console.log("\n== (f) aluno SEM turma: só o dono");
  const antesF = enviados.length;
  await msg(Semturma.phone, "preciso de ajuda", "14:00");
  const snF = (await admin.from("notificacoes").select("user_id, titulo").eq("conta_id", dono).eq("tipo", "whatsapp_resposta").like("titulo", "Gabi SemTurma%")).data ?? [];
  confere("o sino vai SÓ para o dono (nem mentora, nem colaboradora)", snF.length === 1 && snF[0].user_id === dono, JSON.stringify(snF.map((x) => x.user_id === dono ? "dono" : "outro")));
  const wF = enviados.slice(antesF);
  confere("o WhatsApp vai SÓ para o dono (a mentora da turma e a colaboradora não recebem)", wF.filter((e) => e.text.startsWith("Gabi SemTurma (")).map((e) => e.recipient).join() === soDig(Pdono.phone), JSON.stringify(wF.map((e) => e.recipient)));
  confere("e a aluna recebe a resposta automática normalmente", para(Semturma).length === 1);

  // ---------- (g) quem NÃO recebe resposta ----------
  console.log("\n== (g) equipe, número da plataforma e ambíguo: nenhuma resposta automática");
  const antesG = enviados.length;
  await msg(Pdono.phone, "teste do dono", "14:10");
  await msg(Pmentor.phone, "oi, sou a mentora", "14:10");
  const rEco = await msg(NUMERO.slice(2), "eco", "14:10");
  await msg("(11) 94444-5555", "sou eu", "14:10");
  confere("equipe (dono e mentora), o número da própria plataforma e o número em dois cadastros: nada enviado", enviados.length === antesG, String(enviados.length - antesG));
  confere("o eco do número da plataforma nem é registrado como mensagem", rEco.r === "ignorada");

  // ---------- SAIR (inalterado) ----------
  console.log("\n== SAIR continua igual");
  const antesS = enviados.length;
  r = await msg(Semturma2.phone, "SAIR", "22:30");
  const cons = (await admin.from("whatsapp_consentimentos").select("revogado_em, revogado_motivo").eq("person_id", Semturma2.id)).data ?? [];
  confere("SAIR desliga na hora, motivo 'pediu_sair', e a F1c não pode mais mandar lembrete", cons.length === 1 && cons[0].revogado_motivo === "pediu_sair" && (await podeEnviarWhatsapp(admin, Semturma2.id, "lembrete_mentoria")).pode === false);
  confere("UMA confirmação (mesmo às 22h30), sem a resposta automática comum", para(Semturma2).length === 1 && para(Semturma2)[0].text === TEXTO_CONFIRMACAO_SAIR);
  confere("o dono é avisado (sino + WhatsApp com o telefone)", (await sinos("whatsapp_saiu")).length === 1 && enviados.slice(antesS).some((e) => e.recipient === soDig(Pdono.phone) && e.text.startsWith(`Hugo SemTurma (${tel(Semturma2)}) pediu para sair`)));
  const antesS2 = enviados.length;
  await msg(Cris.phone, "sair da reunião", "14:00"); await msg(Cris.phone, "não quero sair", "14:00");
  confere("frases com 'sair' NÃO desligam", (await podeEnviarWhatsapp(admin, Cris.id, "lembrete_mentoria")).pode === true);
  const idRetry = `M1B-${rodada}-RETRY`;
  const antesR = enviados.length;
  const a1 = await msg(Fabi.phone, "STOP", "14:00", { idFixo: idRetry });
  const a2 = await msg(Fabi.phone, "STOP", "14:00", { idFixo: idRetry });
  confere("o mesmo SAIR reenviado: 1 só confirmação", a1.r === "gravada" && a2.r === "duplicada" && enviados.slice(antesR).filter((e) => e.recipient === soDig(Fabi.phone) && e.text === TEXTO_CONFIRMACAO_SAIR).length === 1);
  await msg("(11) 94444-5555", "SAIR", "14:00");
  confere("número em dois cadastros: SAIR desliga os dois", (await podeEnviarWhatsapp(admin, Dup1.id, "lembrete_mentoria")).pode === false && (await podeEnviarWhatsapp(admin, Dup2.id, "lembrete_mentoria")).pode === false);
  const antesU = enviados.length;
  await msg(fone(95), "SAIR", "14:00");
  confere("SAIR de desconhecido: nada desligado, nada enviado, nenhum aviso", enviados.length === antesU);

  // ---------- mensagem antiga ----------
  console.log("\n== reenvio tardio (mensagem com mais de 30 minutos)");
  const velha = new Date(Date.now() - 2 * 3_600_000).toISOString(), antesV = enviados.length;
  const rv = await processarEventoZapster(admin as never, { type: "message.received", created_at: velha, data: { id: `M1B-${rodada}-VELHA`, sender: { id: soDig(fone(94)) }, recipient: { id: soDig(fone(94)), type: "chat" }, sent_at: velha, type: "text", content: { text: "oi tarde" } } } as never, { ...ctxBase, agora: brt("14:00") });
  confere("mensagem antiga: só registrada (nem desconhecido recebe resposta)", rv === "gravada" && enviados.length === antesV);

  // ---------- nada vaza ----------
  console.log("\n== nada de telefone ou texto em log");
  const numeros = [Ana, Cris, Duda, Edu, Pdono, Pmentor, DESC, DESC2].map((p) => p.phone.replace(/\D/g, ""));
  confere("nenhum telefone completo nem trecho de mensagem nos logs", !numeros.some((t) => saida.some((s) => s.includes(t) && !s.startsWith("criada") && !s.startsWith("ok") && !s.startsWith("FALHA"))) && !saida.some((s) => s.includes("Posso remarcar") && !s.startsWith("ok") && !s.startsWith("FALHA")));
} finally {
  console.log("\n== limpeza (ids já impressos; só dados FICTÍCIOS desta execução)");
  await admin.from("notificacoes").delete().in("conta_id", criados.users);
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
