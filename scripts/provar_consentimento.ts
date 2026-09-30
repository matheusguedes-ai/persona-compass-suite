/**
 * #291 F1b — PROVA do consentimento com LOGINS DE VERDADE (fictícios, @exemplo.invalido) e o banco de verdade.
 *   npx tsx scripts/provar_consentimento.ts
 * A Zapster é SIMULADA (nenhuma mensagem real sai); o texto que "sairia" fica só na memória do teste, para
 * conferir depois que o código NÃO aparece em lugar nenhum. Imprime os ids ANTES de apagar. Nunca toca a conta real.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const env: Record<string, string> = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
process.env.ZAPSTER_API_TOKEN = "token-de-mentira-consentimento";
process.env.ZAPSTER_INSTANCE_ID = "instancia-de-mentira-consentimento";

// ---- Zapster simulada: guarda o que "sairia" só na memória ----
const realFetch = globalThis.fetch;
const enviados: { recipient: string; text: string }[] = [];
let zapsterFora = false;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  if (String(url).includes("api.zapsterapi.com")) {
    if (zapsterFora) return new Response("{}", { status: 500 });
    const corpo = JSON.parse(String(init?.body ?? "{}")) as { recipient: string; text: string };
    enviados.push(corpo);
    return new Response(JSON.stringify({ message_id: `SIM${enviados.length}` }), { status: 200 });
  }
  return realFetch(url as never, init);
}) as typeof fetch;

// ---- tudo o que o teste imprimir é vigiado: nenhum código pode aparecer ----
const saida: string[] = [];
for (const k of ["log", "error", "warn"] as const) {
  const orig = console[k].bind(console);
  console[k] = (...a: unknown[]) => { saida.push(a.map(String).join(" ")); orig(...a); };
}

import {
  avisarNumeroErrado, confirmarCodigo, consentimentoVigente, desligar, mudarNivel, pedirCodigo, pessoaDoLogin, podeEnviarWhatsapp,
  ErroDeConsentimento, type PessoaDoConsentimento,
} from "../src/lib/canal/consentimento.server";
import { TERMO_TEXTO, TERMO_VERSAO } from "../src/lib/canal/consentimento";
import { mascararTelefone } from "../src/lib/canal/telefone";

const URL_ = env.SUPABASE_URL.replace(/\/$/, "");
const anon = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

let falhas = 0;
const confere = (nome: string, cond: boolean, extra = "") => { if (!cond) falhas++; console.log(`${cond ? "ok   " : "FALHA"} ${nome}${cond ? "" : ` ${extra}`}`); };
const rodada = randomBytes(3).toString("hex");
const criados = { users: [] as string[], people: [] as string[], team: [] as string[] };
const codigosVistos: string[] = [];

async function novoLogin(rotulo: string) {
  const email = `teste-consent-${rotulo}-${rodada}@exemplo.invalido`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw new Error(`login ${rotulo}: ${error?.message}`);
  criados.users.push(data.user.id);
  console.log(`criado login ${rotulo}: ${data.user.id}`);
  return { id: data.user.id, email };
}
async function entrar(email: string): Promise<SupabaseClient> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw new Error(`link: ${error?.message}`);
  const c = createClient(URL_, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: e2 } = await c.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (e2) throw new Error(`sessão: ${e2.message}`);
  return c;
}
async function novaPessoa(donoId: string, nome: string, phone: string | null, userId: string | null) {
  const { data, error } = await admin.from("people")
    .insert({ mentor_id: donoId, full_name: nome, email: `${nome.replace(/\W/g, "").toLowerCase()}-${rodada}@exemplo.invalido`, phone, user_id: userId })
    .select("id, mentor_id, full_name, phone").single();
  if (error) throw new Error(error.message);
  criados.people.push(data!.id); console.log(`criada pessoa ${nome}: ${data!.id}`);
  return data as PessoaDoConsentimento;
}
async function erroDe(f: () => Promise<unknown>): Promise<string | null> {
  try { await f(); return null; } catch (e) { return e instanceof Error ? e.message : "erro"; }
}
/** Pede um código e devolve os 6 dígitos que a Zapster SIMULADA recebeu (só existe na memória do teste). */
async function pedirELer(p: PessoaDoConsentimento, userId: string, nivel: "essencial" | "completo") {
  const antes = enviados.length;
  await pedirCodigo(admin, { pessoa: p, userId, nivel });
  const texto = enviados[antes]?.text ?? "";
  const codigo = texto.match(/é: (\d{6})\./)?.[1] ?? "";
  if (codigo) codigosVistos.push(codigo);
  return { codigo, texto, recipient: enviados[antes]?.recipient };
}
const outroCodigo = (c: string) => String((Number(c) + 1) % 1_000_000).padStart(6, "0");

try {
  // ---------- montagem: uma conta de dono fictícia, dois alunos com login, um colaborador ----------
  const dono = await novoLogin("dono");
  await admin.rpc("registrar_conta_dona", { p_user: dono.id, p_origem: "prova consentimento" });
  const a = await novoLogin("alunoA"), b = await novoLogin("alunoB"), col = await novoLogin("colab"), limite = await novoLogin("limite");
  const PA = await novaPessoa(dono.id, "Aluna Alfa", "(11) 90000-0001", a.id);
  const PB = await novaPessoa(dono.id, "Aluno Beta", "(11) 90000-0002", b.id);
  const PL = await novaPessoa(dono.id, "Aluno Limite", "(11) 90000-0003", limite.id);
  const { data: tm } = await admin.from("team_members").insert({ owner_id: dono.id, kind: "colaborador", name: "ZZ Colab", email: col.email, user_id: col.id, status: "ativo", permissions: ["pessoas"] }).select("id").single();
  criados.team.push(tm!.id);
  const cDono = await entrar(dono.email), cA = await entrar(a.email), cB = await entrar(b.email), cCol = await entrar(col.email);

  // ---------- (a) aluno escolhe Essencial, recebe o código, confirma ----------
  console.log("\n== (a) Essencial: pede o código, confirma");
  const p1 = await pessoaDoLogin(cA, a.id);
  confere("o login do aluno acha o PRÓPRIO cadastro", p1.id === PA.id);
  const r1 = await pedirELer(p1, a.id, "essencial");
  confere("código de 6 dígitos saiu pela camada de canal, para o número 55+DDD+9…", /^\d{6}$/.test(r1.codigo) && r1.recipient === "5511900000001", r1.recipient ?? "");
  confere("texto da mensagem é o aprovado (com o prazo de 10 minutos)", r1.texto === `Seu código de confirmação da Plataforma Método Intenção é: ${r1.codigo}. Ele vale por 10 minutos. Se não foi você que pediu, ignore esta mensagem.`);
  const { data: envio } = await admin.from("envios_mensagens").select("tipo, status, person_id, conta_id, fornecedor_msg_id, destino_mascarado").eq("person_id", PA.id);
  confere("registrado em envios_mensagens como codigo_confirmacao, com dono e pessoa", envio?.length === 1 && envio[0].tipo === "codigo_confirmacao" && envio[0].status === "enviado" && envio[0].conta_id === dono.id && !!envio[0].fornecedor_msg_id);
  const { data: cod } = await admin.from("whatsapp_codigos").select("codigo_hash, sal, expira_em, enviado").eq("person_id", PA.id).single();
  confere("guardado só o resumo (64 hex), nunca o código", /^[0-9a-f]{64}$/.test(cod!.codigo_hash) && cod!.codigo_hash !== r1.codigo && cod!.enviado === true);
  const minutos = (new Date(cod!.expira_em).getTime() - Date.now()) / 60_000;
  confere("vale 10 minutos", minutos > 9.5 && minutos <= 10.05, String(minutos));

  const antesDeConfirmar = await consentimentoVigente(admin, PA);
  confere("ANTES do código confirmado não há consentimento", antesDeConfirmar.vigente === null);
  const ok = await confirmarCodigo(admin, { pessoa: p1, userId: a.id, codigo: r1.codigo });
  confere("código certo → aceite registrado", ok.nivel === "essencial");
  const { data: c1 } = await admin.from("whatsapp_consentimentos").select("*").eq("person_id", PA.id);
  const l1 = c1![0];
  confere("uma linha: nível, versão do termo, cópia do texto, número MASCARADO, conta e login", c1!.length === 1 && l1.nivel === "essencial" && l1.termo_versao === TERMO_VERSAO && l1.texto_aceito === TERMO_TEXTO && l1.destino_mascarado === "(11) 9****-**01" && l1.conta_id === dono.id && l1.user_id === a.id && l1.origem === "tela_aluno" && l1.revogado_em === null);
  confere("o telefone inteiro não está no registro", !JSON.stringify(l1).includes("90000-0001") && !JSON.stringify(l1).includes("900000001"));
  const reusa = await erroDe(() => confirmarCodigo(admin, { pessoa: p1, userId: a.id, codigo: r1.codigo }));
  confere("o mesmo código não serve duas vezes", !!reusa);

  // ---------- (f) o que cada nível cobre ----------
  console.log("\n== (f) posso mandar WhatsApp do tipo X para Y?");
  const pode = async (tipo: string, p = PA) => (await podeEnviarWhatsapp(admin, p.id, tipo)).pode;
  confere("Essencial: lembrete_mentoria SIM", await pode("lembrete_mentoria"));
  confere("Essencial: aula_cancelada SIM", await pode("aula_cancelada"));
  confere("Essencial: comunidade_post NÃO", !(await pode("comunidade_post")));
  confere("Essencial: teste_liberado NÃO", !(await pode("teste_liberado")));
  confere("tipo desconhecido NÃO (negado por padrão)", !(await pode("propaganda_qualquer")));
  confere("codigo_confirmacao não passa por aqui (caminho próprio)", !(await pode("codigo_confirmacao")));
  confere("pessoa SEM consentimento: NÃO", !(await pode("lembrete_mentoria", PB)));

  // ---------- (c) muda de nível, depois desliga: histórico fica ----------
  console.log("\n== (c) mudar de nível e desligar: o histórico continua");
  const mudou = await mudarNivel(admin, { pessoa: p1, userId: a.id, nivel: "completo" });
  confere("Essencial → Completo sem pedir código", mudou.mudou === true);
  confere("Completo: comunidade_post SIM", await pode("comunidade_post"));
  confere("Completo: teste_liberado SIM", await pode("teste_liberado"));
  confere("Completo: lembrete_mentoria continua SIM", await pode("lembrete_mentoria"));
  confere("Completo: tipo desconhecido continua NÃO", !(await pode("propaganda_qualquer")));
  const d = await desligar(admin, { pessoa: p1, userId: a.id });
  confere("desligar vale na hora (sem código)", d.desligou === true && !(await pode("lembrete_mentoria")));
  const { data: hist } = await admin.from("whatsapp_consentimentos").select("nivel, revogado_em, revogado_motivo, aceito_em").eq("person_id", PA.id).order("aceito_em");
  confere("o histórico continua: 2 linhas, as duas revogadas (mudou_nivel e desligou), nenhuma apagada", hist!.length === 2 && hist![0].revogado_motivo === "mudou_nivel" && hist![1].revogado_motivo === "desligou" && hist!.every((h) => h.revogado_em));
  const mexer = await erroDe(async () => { const { error } = await admin.from("whatsapp_consentimentos").update({ nivel: "completo" }).eq("person_id", PA.id); if (error) throw new Error(error.message); });
  confere("o registro do aceite não pode ser editado (nem pelo servidor)", !!mexer, String(mexer));
  const desfazer = await erroDe(async () => { const { error } = await admin.from("whatsapp_consentimentos").update({ revogado_em: null }).eq("person_id", PA.id); if (error) throw new Error(error.message); });
  confere("uma revogação não se desfaz", !!desfazer);

  // ---------- número trocado pelo mentor depois do aceite ----------
  console.log("\n== o mentor troca o telefone depois do aceite");
  const r2 = await pedirELer(p1, a.id, "essencial");
  await confirmarCodigo(admin, { pessoa: p1, userId: a.id, codigo: r2.codigo });
  confere("voltou a valer", await pode("lembrete_mentoria"));
  await admin.from("people").update({ phone: "(11) 90000-0099" }).eq("id", PA.id);
  confere("telefone trocado: o consentimento NÃO vale para o número novo", !(await pode("lembrete_mentoria")));
  await admin.from("people").update({ phone: "(11) 90000-0001" }).eq("id", PA.id);
  confere("telefone de volta: vale de novo", await pode("lembrete_mentoria"));
  await desligar(admin, { pessoa: p1, userId: a.id });

  // ---------- (b) código errado 5 vezes / expirado / 4º pedido ----------
  console.log("\n== (b) limites do código");
  const r3 = await pedirELer(p1, a.id, "essencial");
  const errado = outroCodigo(r3.codigo);
  const msgs: string[] = [];
  for (let i = 0; i < 5; i++) msgs.push((await erroDe(() => confirmarCodigo(admin, { pessoa: p1, userId: a.id, codigo: errado }))) ?? "PASSOU");
  confere("5 tentativas erradas são aceitas como tentativas", msgs.slice(0, 4).every((m) => m.startsWith("Código incorreto")) && msgs[4].includes("vezes demais"), msgs.join(" | "));
  const depois = await erroDe(() => confirmarCodigo(admin, { pessoa: p1, userId: a.id, codigo: r3.codigo }));
  confere("depois do bloqueio, até o código CERTO é recusado", !!depois && (await consentimentoVigente(admin, PA)).vigente === null, String(depois));

  // (a aluna A já usou os 3 pedidos da hora; a expiração se prova com o aluno B)
  const pB = await pessoaDoLogin(cB, b.id);
  const r4 = await pedirELer(pB, b.id, "essencial");
  await admin.from("whatsapp_codigos").update({ expira_em: new Date(Date.now() - 1000).toISOString() }).eq("person_id", PB.id).is("consumido_em", null).is("invalidado_em", null);
  const expirado = await erroDe(() => confirmarCodigo(admin, { pessoa: pB, userId: b.id, codigo: r4.codigo }));
  confere("código depois de 10 minutos: recusado", !!expirado && expirado.includes("expirou"), String(expirado));

  const pl = await pessoaDoLogin(await entrar(limite.email), limite.id);
  let aceitos = 0;
  for (let i = 0; i < 3; i++) { await pedirELer(pl, limite.id, "essencial"); aceitos++; }
  const quarto = await erroDe(() => pedirCodigo(admin, { pessoa: pl, userId: limite.id, nivel: "essencial" }));
  confere("3 pedidos na hora passam; o 4º é recusado", aceitos === 3 && !!quarto && quarto.includes("3 códigos"), String(quarto));

  zapsterFora = true;
  const semEnvio = await erroDe(() => pedirCodigo(admin, { pessoa: PB, userId: b.id, nivel: "essencial" }));
  zapsterFora = false;
  confere("se a Zapster falha, o aluno é avisado e o código não fica valendo", !!semEnvio);
  const { data: pend } = await admin.from("whatsapp_codigos").select("id").eq("person_id", PB.id).is("consumido_em", null).is("invalidado_em", null);
  confere("nenhum código pendente depois da falha de envio", (pend ?? []).length === 0);


  // ---------- item 6: "Meu número está errado" → sino do mentor ----------
  console.log("\n== item 6: 'Meu número está errado' avisa o mentor pelo sino");
  const av1 = await avisarNumeroErrado(admin, { pessoa: PA, userId: a.id });
  const { data: sino } = await admin.from("notificacoes").select("user_id, tipo, titulo, link").eq("tipo", "whatsapp_numero_errado").eq("link", `/pessoas/${PA.id}`);
  confere("o aviso nasce", av1.avisou && !av1.jaAvisado && (sino ?? []).length >= 1);
  confere("texto: '[Nome] informou que o telefone do cadastro está errado.'", (sino ?? []).every((n) => n.titulo === "Aluna Alfa informou que o telefone do cadastro está errado."));
  confere("chega ao dono da conta", (sino ?? []).some((n) => n.user_id === dono.id));
  confere("NÃO chega ao próprio aluno", !(sino ?? []).some((n) => n.user_id === a.id));
  const av2 = await avisarNumeroErrado(admin, { pessoa: PA, userId: a.id });
  confere("apertar de novo não duplica (um por pessoa a cada 24 h)", av2.jaAvisado === true);
  const sinoAluno = await cA.from("notificacoes").select("id").eq("tipo", "whatsapp_numero_errado");
  confere("o aluno não enxerga esse aviso no sino dele", (sinoAluno.data ?? []).length === 0);

  // ---------- (d) o dono NUNCA aceita em nome do aluno ----------
  console.log("\n== (d) dono no 'Ver como aluno' tenta ativar");
  const naPrevia = await erroDe(() => pessoaDoLogin(cDono, dono.id, PA.id));
  confere("com a marca de prévia: recusado ('Só o aluno pode ativar.')", naPrevia === "Só o aluno pode ativar.", String(naPrevia));
  const semCadastro = await erroDe(() => pessoaDoLogin(cDono, dono.id));
  confere("sem a marca, o dono (sem cadastro de aluno) também não tem o que ativar", !!semCadastro && semCadastro.includes("Só o aluno pode ativar"), String(semCadastro));
  const naPrevia2 = await erroDe(() => pessoaDoLogin(cCol, col.id, PA.id));
  confere("colaborador com a marca de prévia: recusado", naPrevia2 === "Só o aluno pode ativar.");
  const direto = await cDono.from("whatsapp_consentimentos").insert({ person_id: PA.id, nivel: "completo", termo_versao: TERMO_VERSAO, texto_aceito: TERMO_TEXTO, destino_mascarado: "(11) 9****-**01" });
  confere("o dono não consegue gravar consentimento nem direto na tabela", !!direto.error);
  const direto2 = await cA.from("whatsapp_consentimentos").insert({ person_id: PA.id, nivel: "completo", termo_versao: TERMO_VERSAO, texto_aceito: TERMO_TEXTO, destino_mascarado: "(11) 9****-**01" });
  confere("nem o próprio aluno grava direto na tabela (só o servidor, depois do código)", !!direto2.error);
  const lerCodigos = await cA.from("whatsapp_codigos").select("id");
  confere("ninguém lê a tabela de códigos pela tela", (lerCodigos.data ?? []).length === 0);

  // ---------- (e) quem vê o quê ----------
  console.log("\n== (e) quem vê o consentimento de quem");
  const r5 = await pedirELer(PB, b.id, "completo");
  await confirmarCodigo(admin, { pessoa: PB, userId: b.id, codigo: r5.codigo });
  const vistoPorA = await cA.from("whatsapp_consentimentos").select("person_id");
  const vistoPorB = await cB.from("whatsapp_consentimentos").select("person_id");
  confere("aluno A vê só os dele", (vistoPorA.data ?? []).length > 0 && (vistoPorA.data ?? []).every((x) => x.person_id === PA.id));
  confere("aluno B vê só os dele", (vistoPorB.data ?? []).length === 1 && vistoPorB.data![0].person_id === PB.id);
  const vistoDono = await cDono.from("whatsapp_consentimentos").select("person_id");
  confere("o dono vê os da conta dele (A e B)", new Set((vistoDono.data ?? []).map((x) => x.person_id)).size === 2);
  const pessoasDoColab = await cCol.from("people").select("id").in("id", [PA.id, PB.id]);
  const vistoColab = await cCol.from("whatsapp_consentimentos").select("person_id");
  const visiveis = new Set((pessoasDoColab.data ?? []).map((x) => x.id));
  confere("colaborador vê o consentimento exatamente das pessoas que já enxerga (nem mais, nem menos)",
    (vistoColab.data ?? []).every((x) => visiveis.has(x.person_id)) && new Set((vistoColab.data ?? []).map((x) => x.person_id)).size === visiveis.size,
    `pessoas=${visiveis.size} consentimentos=${new Set((vistoColab.data ?? []).map((x) => x.person_id)).size}`);

  // ---------- (g) fusão de cadastros ----------
  console.log("\n== (g) fusão simulada leva envios e consentimentos para o cadastro que sobrevive");
  await desligar(admin, { pessoa: PB, userId: b.id });
  const PK = await novaPessoa(dono.id, "Fusao Mantida", "(11) 90000-0010", null);
  const PX = await novaPessoa(dono.id, "Fusao Absorvida", null, null);
  const ins = (p: string, nivel: string, aceito: string) => admin.from("whatsapp_consentimentos").insert({ person_id: p, nivel, termo_versao: TERMO_VERSAO, texto_aceito: TERMO_TEXTO, destino_mascarado: "(11) 9****-**10", aceito_em: aceito }).select("id").single();
  const ck = await ins(PK.id, "essencial", new Date(Date.now() - 86_400_000).toISOString());   // vigente, mais antigo
  const cx = await ins(PX.id, "completo", new Date().toISOString());                              // vigente, mais recente
  await admin.from("envios_mensagens").insert([{ conta_id: dono.id, person_id: PX.id, canal: "whatsapp", tipo: "codigo_confirmacao", status: "enviado" }, { conta_id: dono.id, person_id: PK.id, canal: "whatsapp", tipo: "codigo_confirmacao", status: "enviado" }]);
  await admin.from("whatsapp_codigos").insert({ conta_id: dono.id, person_id: PX.id, user_id: dono.id, nivel: "essencial", telefone_mascarado: "x", codigo_hash: "0".repeat(64), sal: "s", expira_em: new Date(Date.now() + 600_000).toISOString() });
  const previa = await admin.rpc("previa_fusao", { p_manter: PK.id, p_absorver: PX.id });
  confere("a prévia da fusão conta os envios e os consentimentos", (previa.data as { mover: Record<string, number> })?.mover?.envios_mensagens === 1 && (previa.data as { mover: Record<string, number> })?.mover?.whatsapp_consentimentos === 1, JSON.stringify(previa.error ?? (previa.data as { mover: unknown })?.mover));
  const fus = await admin.rpc("fundir_pessoas", { p_manter: PK.id, p_absorver: PX.id, p_por: dono.id });
  confere("a fusão NÃO é recusada pela rede de segurança", !fus.error, fus.error?.message);
  const { data: cs } = await admin.from("whatsapp_consentimentos").select("id, person_id, revogado_em, revogado_motivo").in("id", [ck.data!.id, cx.data!.id]);
  confere("os dois consentimentos agora são do cadastro que sobrevive", cs!.length === 2 && cs!.every((x) => x.person_id === PK.id));
  const vig = cs!.filter((x) => !x.revogado_em);
  confere("só UM vigente: o mais recente; o outro revogado como 'fusao'", vig.length === 1 && vig[0].id === cx.data!.id && cs!.find((x) => x.id === ck.data!.id)!.revogado_motivo === "fusao");
  const { data: ev } = await admin.from("envios_mensagens").select("person_id").in("person_id", [PK.id, PX.id]);
  confere("os envios foram religados ao cadastro que sobrevive (nenhum ficou no absorvido)", ev!.length === 2 && ev!.every((x) => x.person_id === PK.id));
  const { count: sobra } = await admin.from("whatsapp_codigos").select("id", { count: "exact", head: true }).eq("person_id", PX.id);
  confere("o código pendente do absorvido foi descartado", sobra === 0);
  const { data: fusReg } = await admin.from("fusoes_pessoas").select("id, movidos").eq("pessoa_mantida_id", PK.id);
  confere("a fusão ficou registrada com os ids movidos (desfazível à mão)", (fusReg ?? []).length === 1 && Array.isArray((fusReg![0].movidos as Record<string, unknown[]>).whatsapp_consentimentos));
  await admin.from("fusoes_pessoas").delete().eq("pessoa_mantida_id", PK.id);

  // ---------- (h) o código não está em lugar nenhum ----------
  console.log("\n== (h) nenhum código em texto aberto");
  const tabelas = ["whatsapp_codigos", "envios_mensagens", "whatsapp_consentimentos", "notificacoes", "email_logs"];
  let achou = "";
  for (const t of tabelas) {
    const { data: linhas } = await admin.from(t).select("*").limit(2000);
    const texto = JSON.stringify(linhas ?? []);
    for (const c of codigosVistos) if (texto.includes(`"${c}"`) || texto.includes(`: ${c}`) || texto.includes(`é: ${c}`)) achou += `${t}:${c} `;
  }
  confere(`nenhum dos ${codigosVistos.length} códigos emitidos aparece em texto aberto no banco`, achou === "", achou);
  confere("nenhum código apareceu no que este teste (e o código testado) escreveu em log", !codigosVistos.some((c) => saida.some((s) => s.includes(c) && !s.startsWith("ok"))));
} finally {
  console.log("\n== limpeza (ids já impressos acima)");
  for (const id of criados.people) await admin.from("people").delete().eq("id", id);
  for (const id of criados.team) await admin.from("team_members").delete().eq("id", id);
  for (const id of criados.users) await admin.auth.admin.deleteUser(id);
  const cont = async (t: string, col: string, ids: string[]) => (await admin.from(t).select("id", { count: "exact", head: true }).in(col, ids)).count;
  const sobras = [
    await cont("whatsapp_consentimentos", "person_id", criados.people), await cont("whatsapp_codigos", "person_id", criados.people),
    await cont("envios_mensagens", "person_id", criados.people), await cont("whatsapp_consentimentos", "conta_id", criados.users),
    await cont("envios_mensagens", "conta_id", criados.users),
  ];
  console.log(`sobras: consentimentos=${sobras[0]}+${sobras[3]} codigos=${sobras[1]} envios=${sobras[2]}+${sobras[4]}`);
  confere("nada sobrou", sobras.every((n) => n === 0));
}
console.log(falhas === 0 ? "\nTUDO CERTO" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
