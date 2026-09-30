/**
 * #291 F1c — PROVA do lembrete de mentoria pelo WhatsApp, com dados FICTÍCIOS de verdade no banco de verdade.
 *   npx tsx scripts/provar_lembrete_whatsapp.ts
 * A Zapster e o Resend são SIMULADOS (nenhuma mensagem nem e-mail real sai). O relógio é o de verdade
 * (`enviarLembretesDevidos`), com a hora injetada e restrito às sessões do teste. Imprime os ids ANTES de apagar.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const env: Record<string, string> = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
process.env.ZAPSTER_API_TOKEN = "token-de-mentira-f1c";
process.env.ZAPSTER_INSTANCE_ID = "instancia-de-mentira-f1c";
process.env.RESEND_API_KEY = "re_chave_de_mentira_f1c";
process.env.SITE_URL = "https://assessment.metodointencao.com.br";

// ---- simulados ----
type Zap = { recipient: string; text: string };
type Mail = { to: string; subject: string; html: string };
const zapEnviados: Zap[] = [], emails: Mail[] = [];
let zapModo: "ok" | "falha" = "ok";
let zapInstancia: "connected" | "disconnected" | "offline" = "connected";
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  const u = String(url);
  if (u.includes("api.zapsterapi.com") && u.includes("/wa/instances/")) return new Response(JSON.stringify({ status: zapInstancia }), { status: 200 });
  if (u.includes("api.zapsterapi.com") && u.endsWith("/wa/messages")) {
    if (zapModo === "falha") return new Response(JSON.stringify({ code: "erro_simulado", message: "Falha simulada da Zapster" }), { status: 500 });
    zapEnviados.push(JSON.parse(String(init?.body)) as Zap);
    return new Response(JSON.stringify({ message_id: `SIM${zapEnviados.length}` }), { status: 200 });
  }
  if (u.includes("api.resend.com")) {
    const b = JSON.parse(String(init?.body)) as { to: string[]; subject: string; html: string };
    emails.push({ to: b.to[0], subject: b.subject, html: b.html });
    return new Response(JSON.stringify({ id: "EMAILSIM" }), { status: 200 });
  }
  return realFetch(url as never, init);
}) as typeof fetch;

import { enviarLembretesDevidos } from "../src/lib/agendamento.functions";
import { janelaDoWhatsappAberta, textoDoLembrete, inicioDoDiaEmBrasilia } from "../src/lib/canal/lembrete-whatsapp.server";
import { mascararTelefone } from "../src/lib/canal/telefone";
import { TERMO_TEXTO, TERMO_VERSAO } from "../src/lib/canal/consentimento";

const admin = createClient(env.SUPABASE_URL.replace(/\/$/, ""), env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let falhas = 0;
const confere = (nome: string, cond: boolean, extra = "") => { if (!cond) falhas++; console.log(`${cond ? "ok   " : "FALHA"} ${nome}${cond ? "" : ` ${extra}`}`); };
const rodada = randomBytes(3).toString("hex");
const brt = (dia: string, hm: string) => new Date(`${dia}T${hm}:00-03:00`);
const D1 = "2026-10-20", D2 = "2026-10-21";

// ---------- o texto e a janela, sem banco ----------
console.log("== texto e janela (puros)");
const base = { nomeAluno: "Ana Souza", nomeMentor: "Dra. Teste", modalidade: "online", local: null, linkUrl: "https://meet.exemplo.invalido/x", linkDaSessao: "https://assessment.metodointencao.com.br/sessao/ABC" };
const t1 = textoDoLembrete({ ...base, quando: brt(D2, "14:30"), agora: brt(D1, "14:00") });
confere("texto 'amanhã', dia da semana, dd/mm, hora, link da sala e link para remarcar", t1 === "Olá, Ana! Passando para lembrar da sua mentoria com Dra. Teste amanhã, quarta-feira, 21/10, às 14:30.\nLink: https://meet.exemplo.invalido/x\nSe precisar remarcar, é por aqui: https://assessment.metodointencao.com.br/sessao/ABC\nAté lá! — Método Intenção", JSON.stringify(t1));
const t2 = textoDoLembrete({ ...base, modalidade: "presencial", local: "Rua das Flores, 100", linkUrl: null, linkDaSessao: null, quando: brt(D1, "17:00"), agora: brt(D1, "14:00") });
confere("texto 'hoje', presencial com 'Local:', sem a linha de remarcar quando a sessão não é gerenciável", t2.includes("com Dra. Teste hoje, terça-feira, 20/10, às 17:00.") && t2.includes("Local: Rua das Flores, 100") && !t2.includes("remarcar"), t2);
confere("janela: 7h59 fechada, 8h00 aberta, 19h59 aberta, 20h00 fechada", !janelaDoWhatsappAberta(brt(D1, "07:59")) && janelaDoWhatsappAberta(brt(D1, "08:00")) && janelaDoWhatsappAberta(brt(D1, "19:59")) && !janelaDoWhatsappAberta(brt(D1, "20:00")));
confere("início do dia em Brasília", inicioDoDiaEmBrasilia(brt(D1, "22:00")) === "2026-10-20T03:00:00.000Z");

const norm = (h: string, nome: string) => h.replace(new RegExp(nome, "g"), "NOME").replace(/\/sessao\/[0-9a-f-]+/g, "/sessao/ID").replace(/\d/g, "#"); // sem nome, id e números (hora da sessão)
const criados = { users: [] as string[], people: [] as string[], links: [] as string[], mentorias: [] as string[], sessoes: [] as string[] };
async function nova<T>(tabela: string, linha: Record<string, unknown>, guarda: (keyof typeof criados)[], cols = "id") {
  const { data, error } = await admin.from(tabela).insert(linha).select(cols).single();
  if (error) throw new Error(`${tabela}: ${error.message}`);
  for (const g of guarda) criados[g].push((data as unknown as { id: string }).id);
  return data as unknown as { id: string };
}

try {
  // ---------- montagem ----------
  const { data: u, error: eu } = await admin.auth.admin.createUser({ email: `teste-f1c-dono-${rodada}@exemplo.invalido`, email_confirm: true });
  if (eu || !u.user) throw new Error(eu?.message);
  const dono = u.user.id; criados.users.push(dono); console.log(`criado login dono: ${dono}`);
  await admin.rpc("registrar_conta_dona", { p_user: dono, p_origem: "prova F1c" });
  await admin.from("profiles").insert({ user_id: dono, full_name: "Dra. Teste" });

  const mkLink = async (horas: number) => (await nova("mentoria_links", { mentor_id: dono, slug: `f1c-${horas}-${rodada}`, titulo: `Sessão F1c ${horas}h`, duracao_min: 60, modalidade: "online", link_url: "https://meet.exemplo.invalido/sala", permite_remarcar: true, permite_cancelar: true, lembrete_horas: [horas] }, ["links"])).id;
  const L24 = await mkLink(24), L16 = await mkLink(16), L8 = await mkLink(8);

  let seq = 0;
  async function pessoa(nome: string, consentimento: "completo" | "essencial" | "desligado" | "nenhum") {
    seq++;
    const phone = `(11) 9${String(1000 + seq).padStart(4, "0")}-${String(2000 + seq)}`;
    const p = await nova("people", { mentor_id: dono, full_name: nome, email: `${nome.replace(/\W/g, "").toLowerCase()}-${rodada}@exemplo.invalido`, phone }, ["people"]);
    if (consentimento !== "nenhum") {
      await admin.from("whatsapp_consentimentos").insert({
        person_id: p.id, nivel: consentimento === "desligado" ? "completo" : consentimento, termo_versao: TERMO_VERSAO, texto_aceito: TERMO_TEXTO,
        destino_mascarado: mascararTelefone(phone), ...(consentimento === "desligado" ? { revogado_em: new Date().toISOString(), revogado_motivo: "desligou" } : {}),
      });
    }
    console.log(`criada pessoa ${nome}: ${p.id}`);
    return { id: p.id, email: `${nome.replace(/\W/g, "").toLowerCase()}-${rodada}@exemplo.invalido`, phone };
  }
  async function sessao(p: { id: string }, link: string, quando: Date) {
    const men = await nova("mentorias", { mentor_id: dono, person_id: p.id, titulo: "Pacote F1c", sessoes_contratadas: 4, status: "ativa", link_id: link }, ["mentorias"]);
    return (await nova("mentoria_sessoes", { mentoria_id: men.id, mentor_id: dono, quando: quando.toISOString(), termina_em: new Date(quando.getTime() + 60_000).toISOString(), modalidade: "online", link_url: "https://meet.exemplo.invalido/sala", status: "agendada", link_id: link }, ["sessoes"])).id;
  }
  const reset = () => { zapEnviados.length = 0; emails.length = 0; zapModo = "ok"; zapInstancia = "connected"; };
  const rodar = (agora: Date, ids: string[]) => enviarLembretesDevidos(admin as never, { agora, somenteSessoes: ids });
  const enviosDe = async (pid: string) => (await admin.from("envios_mensagens").select("tipo, status, motivo_falha, person_id, conta_id, destino_mascarado, fornecedor_msg_id").eq("person_id", pid)).data ?? [];
  const emailsPara = (p: { email: string }) => emails.filter((e) => e.to === p.email);
  const emailMentor = `teste-f1c-dono-${rodada}@exemplo.invalido`;

  const Pa = await pessoa("Ana Completo", "completo"), Pb = await pessoa("Bia SemConsentimento", "nenhum"), Pc = await pessoa("Caio SoEmail", "desligado");
  const Pd = await pessoa("Duda NoLimite", "essencial"), Pe = await pessoa("Edu ZapFalha", "completo"), Pf = await pessoa("Fabi Desconectada", "completo");
  const Pg = await pessoa("Gabi Noite", "completo"), Ph = await pessoa("Hugo Madrugada", "completo"), Pi = await pessoa("Iara Essencial", "essencial");

  // ---------- (a)(b)(c)(h): dentro da janela ----------
  console.log("\n== (a)(b)(c) dentro da janela: quem autorizou recebe WhatsApp; ninguém recebe duas vezes");
  const quando1 = brt(D2, "14:00"); // lembrete 24h → vence D1 14:00
  const Sa = await sessao(Pa, L24, quando1), Sb = await sessao(Pb, L24, brt(D2, "14:02")), Sc = await sessao(Pc, L24, brt(D2, "14:04")), Si = await sessao(Pi, L24, brt(D2, "14:06"));
  const agora1 = brt(D1, "14:10");
  reset();
  const r1 = await rodar(agora1, [Sa, Sb, Sc, Si]);
  const zapA = zapEnviados.filter((z) => z.recipient === `55${Pa.phone.replace(/\D/g, "")}`);
  confere("(a) o aluno com consentimento Completo recebeu 1 WhatsApp, no número certo (55+DDD+9…)", zapA.length === 1 && zapEnviados.length === 2 /* Ana (completo) + Iara (essencial cobre lembrete) */);
  confere("(a) a mensagem tem o texto certo", zapA[0]?.text === "Olá, Ana! Passando para lembrar da sua mentoria com Dra. Teste amanhã, quarta-feira, 21/10, às 14:00.\nLink: https://meet.exemplo.invalido/sala\nSe precisar remarcar, é por aqui: https://assessment.metodointencao.com.br/sessao/" + Sa + "\nAté lá! — Método Intenção", JSON.stringify(zapA[0]?.text));
  const enA = await enviosDe(Pa.id);
  confere("(a) registrado em envios_mensagens: lembrete_mentoria, enviado, com dono, pessoa e id do fornecedor, número mascarado", enA.length === 1 && enA[0].tipo === "lembrete_mentoria" && enA[0].status === "enviado" && enA[0].conta_id === dono && !!enA[0].fornecedor_msg_id && enA[0].destino_mascarado === mascararTelefone(Pa.phone));
  confere("(c) sem consentimento: nenhum WhatsApp e nenhum registro", (await enviosDe(Pb.id)).length === 0 && !zapEnviados.some((z) => z.recipient === `55${Pb.phone.replace(/\D/g, "")}`));
  confere("(c) em 'Só e-mail' (desligado): nenhum WhatsApp e nenhum registro", (await enviosDe(Pc.id)).length === 0 && !zapEnviados.some((z) => z.recipient === `55${Pc.phone.replace(/\D/g, "")}`));
  confere("(h) o e-mail saiu para TODOS os alunos (inclusive sem consentimento), 1 cada", [Pa, Pb, Pc, Pi].every((p) => emailsPara(p).length === 1), emails.map((e) => e.to).join());
  confere("(h) e para o mentor: 1 por sessão (4)", emails.filter((e) => e.to === emailMentor).length === 4);
  confere("(h) e-mail do aluno com o assunto de sempre", emailsPara(Pa)[0].subject === 'Lembrete: sua sessão "Sessão F1c 24h" é em breve' && emailsPara(Pb)[0].subject === emailsPara(Pa)[0].subject);
  confere("(h) o e-mail de quem tem WhatsApp é igual ao de quem não tem (mesmo texto, trocando só nome e link da sessão)", norm(emailsPara(Pa)[0].html, "Ana") === norm(emailsPara(Pb)[0].html, "Bia"));
  confere("o relógio conta o e-mail como sempre (8 e-mails)", r1.enviados === 8, String(r1.enviados));

  reset();
  const r2 = await rodar(brt(D1, "14:25"), [Sa, Sb, Sc, Si]);
  confere("(b) rodar o relógio de novo: nenhum WhatsApp a mais", zapEnviados.length === 0 && (await enviosDe(Pa.id)).length === 1, JSON.stringify(r2.whatsapp));
  confere("(b) nem e-mail a mais (como sempre)", emails.length === 0);
  // duas chamadas AO MESMO TEMPO para um lembrete novo
  const Sdup = await sessao(Pa, L24, brt(D2, "16:00"));
  reset();
  await Promise.all([rodar(brt(D1, "16:05"), [Sdup]), rodar(brt(D1, "16:05"), [Sdup])]);
  confere("(b) a rota chamada DUAS VEZES AO MESMO TEMPO: só 1 WhatsApp", zapEnviados.length === 1, String(zapEnviados.length));
  const { data: trava } = await admin.from("lembretes_enviados").select("destinatario").eq("sessao_id", Sdup);
  confere("a trava: 1 linha 'aluno_whatsapp' + as do e-mail (aluno, mentor)", (trava ?? []).filter((x) => x.destinatario === "aluno_whatsapp").length === 1 && (trava ?? []).length === 3);

  // ---------- (d) a janela ----------
  console.log("\n== (d) janela das 8h às 20h");
  const Sg = await sessao(Pg, L16, brt(D2, "13:00"));                  // lembrete 16h → vence D1 21:00 (fora da janela às 22h)
  reset();
  await rodar(brt(D1, "22:05"), [Sg]);
  confere("(d) lembrete vencido às 22h: o E-MAIL sai, o WhatsApp NÃO (fora da janela)", emailsPara(Pg).length === 1 && zapEnviados.length === 0 && (await enviosDe(Pg.id)).length === 0);
  reset();
  await rodar(brt(D1, "23:50"), [Sg]);
  confere("(d) de madrugada continua sem WhatsApp", zapEnviados.length === 0);
  reset();
  await rodar(brt(D2, "07:45"), [Sg]);
  confere("(d) às 7h45 ainda não", zapEnviados.length === 0);
  reset();
  await rodar(brt(D2, "08:00"), [Sg]);
  confere("(d) às 8h o WhatsApp sai (e o e-mail não repete)", zapEnviados.length === 1 && emails.length === 0 && (await enviosDe(Pg.id)).length === 1);

  const Sh = await sessao(Ph, L8, brt(D2, "07:30"));                   // lembrete 8h → vence D1 23:30
  reset();
  await rodar(brt(D1, "23:35"), [Sh]);
  confere("(d) sessão às 7h30, lembrete vencendo às 23h30: só e-mail", emailsPara(Ph).length === 1 && zapEnviados.length === 0);
  reset();
  await rodar(brt(D2, "08:00"), [Sh]);
  confere("(d) às 8h a sessão das 7h30 já começou: NUNCA manda WhatsApp", zapEnviados.length === 0 && (await enviosDe(Ph.id)).length === 0);

  // ---------- (e) limite de 3 por dia ----------
  console.log("\n== (e) 4º WhatsApp do dia para a mesma pessoa");
  const inicio = inicioDoDiaEmBrasilia(brt(D1, "18:00"));
  for (let i = 0; i < 3; i++) await admin.from("envios_mensagens").insert({ conta_id: dono, person_id: Pd.id, canal: "whatsapp", tipo: "lembrete_mentoria", status: "enviado", criado_em: new Date(new Date(inicio).getTime() + (i + 1) * 3_600_000).toISOString() });
  await admin.from("envios_mensagens").insert({ conta_id: dono, person_id: Pd.id, canal: "whatsapp", tipo: "codigo_confirmacao", status: "enviado", criado_em: new Date(new Date(inicio).getTime() + 5 * 3_600_000).toISOString() }); // código NÃO conta
  const Sd = await sessao(Pd, L24, brt(D2, "18:00"));
  reset();
  const rd = await rodar(brt(D1, "18:10"), [Sd]);
  const enD = await enviosDe(Pd.id);
  confere("(e) com 3 já enviados no dia (e 1 código, que não conta): o 4º NÃO sai", zapEnviados.length === 0 && rd.whatsapp.limite === 1, JSON.stringify(rd.whatsapp));
  confere("(e) fica registrado o motivo", enD.some((e) => e.status === "falhou" && (e.motivo_falha ?? "").includes("limite diário")));
  confere("(e) o e-mail saiu normal", emailsPara(Pd).length === 1);
  reset();
  await rodar(brt(D1, "18:25"), [Sd]);
  confere("(e) e não tenta de novo a cada rodada (1 só registro de limite)", (await enviosDe(Pd.id)).filter((e) => (e.motivo_falha ?? "").includes("limite")).length === 1);

  // ---------- (f) falha da Zapster ----------
  console.log("\n== (f) falha simulada da Zapster");
  const Se = await sessao(Pe, L24, brt(D2, "15:00"));
  reset(); zapModo = "falha";
  const re = await rodar(brt(D1, "15:10"), [Se]);
  const enE = await enviosDe(Pe.id);
  confere("(f) registro 'falhou' com o motivo", re.whatsapp.falhou === 1 && enE.length === 1 && enE[0].status === "falhou" && !!enE[0].motivo_falha, JSON.stringify(enE));
  confere("(f) o e-mail sai normal", emailsPara(Pe).length === 1);
  const { data: sino } = await admin.from("notificacoes").select("user_id, titulo, tipo").eq("tipo", "whatsapp_falha_lembrete").ilike("titulo", "%Edu ZapFalha%");
  confere("(f) UM aviso no sino do mentor, com o texto pedido", (sino ?? []).length === 1 && sino![0].user_id === dono && sino![0].titulo.startsWith("Não consegui avisar Edu ZapFalha pelo WhatsApp sobre a mentoria de 21/10 às 15:00: ") && sino![0].titulo.endsWith(". O e-mail foi enviado normalmente."), JSON.stringify(sino));
  reset(); zapModo = "falha";
  await rodar(brt(D1, "15:25"), [Se]);
  confere("(f) não tenta de novo nem repete o aviso", (await enviosDe(Pe.id)).length === 1 && ((await admin.from("notificacoes").select("id").eq("tipo", "whatsapp_falha_lembrete").ilike("titulo", "%Edu ZapFalha%")).data ?? []).length === 1);

  // ---------- (g) instância desconectada ----------
  console.log("\n== (g) instância desconectada");
  const Sf = await sessao(Pf, L24, brt(D2, "15:30"));
  reset(); zapInstancia = "disconnected";
  await rodar(brt(D1, "15:35"), [Sf]);
  confere("(g) não tenta enviar (nenhuma chamada de envio à Zapster)", zapEnviados.length === 0 && (await enviosDe(Pf.id)).length === 0);
  confere("(g) o e-mail sai normal", emailsPara(Pf).length === 1);
  const avisos1 = (await admin.from("notificacoes").select("user_id, titulo").eq("user_id", dono).eq("tipo", "whatsapp_desconectado")).data ?? [];
  confere("(g) 1 aviso no sino do DONO, com o texto pedido", avisos1.length === 1 && avisos1[0].titulo === "O WhatsApp da plataforma está desconectado. Os lembretes estão saindo só por e-mail.", JSON.stringify(avisos1));
  reset(); zapInstancia = "disconnected";
  await rodar(brt(D1, "15:50"), [Sf]);
  const avisos2 = (await admin.from("notificacoes").select("id").eq("user_id", dono).eq("tipo", "whatsapp_desconectado")).data ?? [];
  confere("(g) no máximo 1 aviso por dia (2ª rodada não repete)", avisos2.length === 1);
  reset(); zapInstancia = "connected";
  await rodar(brt(D1, "16:05"), [Sf]);
  confere("(g) reconectou: o lembrete ainda sai (a trava não foi gasta)", zapEnviados.length === 1 && (await enviosDe(Pf.id)).length === 1);

  // ---------- e o mentor nunca recebe WhatsApp ----------
  confere("só o ALUNO recebe WhatsApp (nenhum destino é do mentor)", (await admin.from("envios_mensagens").select("person_id").eq("conta_id", dono).eq("tipo", "lembrete_mentoria")).data!.every((e) => e.person_id !== null));
} finally {
  console.log("\n== limpeza (ids já impressos acima)");
  await admin.from("notificacoes").delete().in("user_id", criados.users);
  await admin.from("envios_mensagens").delete().in("conta_id", criados.users);
  for (const id of criados.sessoes) await admin.from("mentoria_sessoes").delete().eq("id", id);
  for (const id of criados.mentorias) await admin.from("mentorias").delete().eq("id", id);
  for (const id of criados.links) await admin.from("mentoria_links").delete().eq("id", id);
  for (const id of criados.people) await admin.from("people").delete().eq("id", id);
  await admin.from("profiles").delete().in("user_id", criados.users);
  for (const id of criados.users) await admin.auth.admin.deleteUser(id);
  const c = async (t: string, col: string, ids: string[]) => (await admin.from(t).select("*", { count: "exact", head: true }).in(col, ids)).count;
  const sobras = [await c("people", "id", criados.people), await c("mentoria_sessoes", "id", criados.sessoes), await c("mentorias", "id", criados.mentorias), await c("mentoria_links", "id", criados.links), await c("lembretes_enviados", "sessao_id", criados.sessoes), await c("envios_mensagens", "conta_id", criados.users), await c("whatsapp_consentimentos", "person_id", criados.people), await c("notificacoes", "user_id", criados.users)];
  console.log(`sobras: ${sobras.join(", ")}`);
  confere("nada sobrou", sobras.every((n) => n === 0));
}
console.log(falhas === 0 ? "\nTUDO CERTO" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
