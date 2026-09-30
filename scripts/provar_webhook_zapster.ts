/**
 * Menu Mensagens M1a — PROVA do webhook da Zapster com dados FICTÍCIOS no banco de verdade.
 *   npx tsx scripts/provar_webhook_zapster.ts
 * Os eventos seguem o formato da documentação oficial. Imprime os ids ANTES de apagar. Só apaga o que criou
 * (conta, pessoas e mensagens FICTÍCIAS): nunca toca registro de mensagem real.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const env: Record<string, string> = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const saida: string[] = [];
for (const k of ["log", "error", "warn"] as const) { const o = console[k].bind(console); console[k] = (...a: unknown[]) => { saida.push(a.map(String).join(" ")); o(...a); }; }

import { processarEventoZapster, identificarRemetente, conteudoDaMensagem } from "../src/lib/canal/webhook-zapster.server";
import { chaveDoTelefone, mascararTelefone } from "../src/lib/canal/telefone";

const URL_ = env.SUPABASE_URL.replace(/\/$/, "");
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
let falhas = 0;
const confere = (nome: string, cond: boolean, extra = "") => { if (!cond) falhas++; console.log(`${cond ? "ok   " : "FALHA"} ${nome}${cond ? "" : ` ${extra}`}`); };
const rodada = randomBytes(3).toString("hex");
const NUMERO = "5511955500001";                       // a "linha da plataforma" do teste
const criados = { users: [] as string[], people: [] as string[], team: [] as string[] };

async function login(rotulo: string) {
  const email = `teste-m1a-${rotulo}-${rodada}@exemplo.invalido`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw new Error(error?.message);
  criados.users.push(data.user.id); console.log(`criado login ${rotulo}: ${data.user.id}`);
  return { id: data.user.id, email };
}
async function entrar(email: string) {
  const { data } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const c = createClient(URL_, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  await c.auth.verifyOtp({ token_hash: data!.properties!.hashed_token, type: "magiclink" });
  return c;
}
async function pessoa(dono: string, nome: string, phone: string | null, userId: string | null = null) {
  const { data, error } = await admin.from("people").insert({ mentor_id: dono, full_name: nome, email: `${nome.replace(/\W/g, "").toLowerCase()}-${rodada}@exemplo.invalido`, phone, user_id: userId }).select("id").single();
  if (error) throw new Error(error.message);
  criados.people.push(data!.id); console.log(`criada pessoa ${nome}: ${data!.id}`); return data!.id as string;
}
const recebida = (id: string, de: string, data: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  type: "message.received", created_at: "2026-10-01T15:00:00.000Z",
  data: { id, sender: { id: de, name: "Nome Do Celular" }, recipient: { id: NUMERO, type: "chat", name: "Plataforma" }, sent_at: "2026-10-01T15:00:00.000Z", ...data, ...extra },
});
const texto = (t: string) => ({ type: "text", content: { text: t } });

try {
  const dono = await login("dono");
  await admin.rpc("registrar_conta_dona", { p_user: dono.id, p_origem: "prova M1a" });
  const aluno = await login("aluno"), col = await login("colab");
  const { data: tm } = await admin.from("team_members").insert({ owner_id: dono.id, kind: "colaborador", name: "ZZ Colab", email: col.email, user_id: col.id, status: "ativo", permissions: ["pessoas"] }).select("id").single();
  criados.team.push(tm!.id);
  const ctx = { contaId: dono.id, numero: NUMERO };

  const Pana = await pessoa(dono.id, "Ana Aluna", "(11) 91111-2222", aluno.id);
  const Pdono = await pessoa(dono.id, "Dono Pessoa", "(11) 92222-3333", dono.id);       // o próprio dono (equipe)
  const Pdup1 = await pessoa(dono.id, "Dupla Um", "(11) 93333-4444"), Pdup2 = await pessoa(dono.id, "Dupla Dois", "11 93333 4444");
  const Pvelho = await pessoa(dono.id, "Numero Antigo", "(11) 4444-5555");               // 10 dígitos (formato antigo)
  const linhas = async () => (await admin.from("mensagens_recebidas").select("*").eq("conta_id", dono.id)).data ?? [];

  console.log("\n== padronização do telefone (chave)");
  confere("chave ignora o 55 e os símbolos", chaveDoTelefone("5511911112222") === chaveDoTelefone("(11) 91111-2222") && chaveDoTelefone("11 9 1111 2222") === chaveDoTelefone("+55 11 91111-2222"));
  confere("chave diferencia números diferentes e recusa lixo", chaveDoTelefone("5511911112222") !== chaveDoTelefone("5511911112223") && chaveDoTelefone("123") === null && chaveDoTelefone("") === null);
  confere("o número antigo (10 dígitos) casa com o novo (com o 9)", chaveDoTelefone("(11) 4444-5555") === chaveDoTelefone("551144445555") && chaveDoTelefone("5511944445555") === chaveDoTelefone("(11) 4444-5555"));

  // ---------- (a) remetente conhecido ----------
  console.log("\n== (a) mensagem de quem está cadastrado");
  let r = await processarEventoZapster(admin as never, recebida("MSG-A1", "5511911112222", texto("teste")), ctx);
  let l = await linhas();
  confere("gravada, identificada como a pessoa (com o nome), com o texto", r === "gravada" && l[0]?.remetente === "pessoa" && l[0]?.remetente_nome === "Ana Aluna" && l[0]?.person_id === Pana && l[0]?.texto === "teste", JSON.stringify(l[0]));
  confere("guardou o dono, o telefone (endereço da conversa), o tipo e a hora do envio", l[0].conta_id === dono.id && l[0].telefone === "5511911112222" && l[0].tipo === "texto" && new Date(l[0].recebida_em).toISOString() === "2026-10-01T15:00:00.000Z");
  r = await processarEventoZapster(admin as never, recebida("MSG-A2", "5511922223333", texto("oi equipe")), ctx);
  l = await linhas();
  confere("o próprio dono (equipe) é identificado como 'equipe', com o nome", r === "gravada" && l.find((x) => x.zapster_id === "MSG-A2")?.remetente === "equipe" && l.find((x) => x.zapster_id === "MSG-A2")?.remetente_nome === "Dono Pessoa");
  r = await processarEventoZapster(admin as never, recebida("MSG-A3", "551144445555", texto("numero antigo")), ctx);
  confere("número antigo (sem o 9) casa com o cadastro", l && (await linhas()).find((x) => x.zapster_id === "MSG-A3")?.person_id === Pvelho);

  // ---------- (b) desconhecido ----------
  console.log("\n== (b) número que não é de ninguém");
  r = await processarEventoZapster(admin as never, recebida("MSG-B1", "5511977778888", texto("quem é você?")), ctx);
  const b1 = (await linhas()).find((x) => x.zapster_id === "MSG-B1")!;
  confere("'desconhecido', sem pessoa, sem nome cadastrado", r === "gravada" && b1.remetente === "desconhecido" && b1.person_id === null);
  confere("o telefone mascarado que a tela mostra não revela o número", mascararTelefone(b1.telefone) === "(11) 9****-**88" && !mascararTelefone(b1.telefone).includes("7777"));

  // ---------- (g) ambíguo ----------
  console.log("\n== (g) mesmo número em dois cadastros");
  r = await processarEventoZapster(admin as never, recebida("MSG-G1", "5511933334444", texto("sou eu")), ctx);
  const g1 = (await linhas()).find((x) => x.zapster_id === "MSG-G1")!;
  confere("marcado como 'ambiguo', sem escolher ninguém", r === "gravada" && g1.remetente === "ambiguo" && g1.person_id === null);
  confere("guarda os DOIS candidatos", Array.isArray(g1.candidatos) && (g1.candidatos as { id: string }[]).map((c) => c.id).sort().join() === [Pdup1, Pdup2].sort().join());

  // ---------- botão e mídia ----------
  console.log("\n== clique em botão (só registra) e mídia (só o tipo)");
  r = await processarEventoZapster(admin as never, recebida("MSG-BT1", "5511911112222", { type: "text", content: { text: "Sim", button_reply: { label: "Sim", type: "reply", id: "btn-1" }, quoted: { content: { text: "Você confirma a mentoria?", buttons: [{ label: "Sim", type: "reply", id: "btn-1" }, { label: "Não", type: "reply", id: "btn-2" }] } } } }), ctx);
  const bt = (await linhas()).find((x) => x.zapster_id === "MSG-BT1")!;
  confere("botão: tipo 'botao', qual botão, em resposta a qual mensagem nossa, de quem", r === "gravada" && bt.tipo === "botao" && bt.botao_rotulo === "Sim" && bt.botao_id === "btn-1" && bt.citada_texto === "Você confirma a mentoria?" && bt.person_id === Pana);
  r = await processarEventoZapster(admin as never, recebida("MSG-D1", "5511911112222", { type: "audio", content: { media: { url: "https://zapsterapi.s3.amazonaws.com/segredo-do-arquivo.ogg" }, text: "" } }), ctx);
  const d1 = (await linhas()).find((x) => x.zapster_id === "MSG-D1")!;
  confere("(d) áudio: registra 'audio recebido', sem texto", r === "gravada" && d1.tipo === "audio" && d1.texto === null);
  confere("(d) NÃO guarda o endereço nem o arquivo da mídia", !JSON.stringify(d1).includes("http") && !JSON.stringify(d1).includes("zapsterapi") && !JSON.stringify(d1).includes("segredo-do-arquivo"));
  for (const [id, tipo, esperado] of [["MSG-I1", "image", "imagem"], ["MSG-V1", "video", "video"], ["MSG-S1", "sticker", "sticker"], ["MSG-L1", "location", "localizacao"], ["MSG-C1", "vcard", "contato"]] as const) {
    await processarEventoZapster(admin as never, recebida(id, "5511911112222", { type: tipo, content: { media: { url: "https://x.invalido/m" }, text: tipo === "image" ? "legenda" : undefined } }), ctx);
  }
  const tipos = Object.fromEntries((await linhas()).filter((x) => x.zapster_id.match(/^MSG-[IVSLC]1$/)).map((x) => [x.zapster_id, x.tipo]));
  confere("imagem/vídeo/figurinha/localização/contato viram só o tipo", tipos["MSG-I1"] === "imagem" && tipos["MSG-V1"] === "video" && tipos["MSG-S1"] === "sticker" && tipos["MSG-L1"] === "localizacao" && tipos["MSG-C1"] === "contato", JSON.stringify(tipos));
  confere("a legenda da imagem é o texto; nenhuma mídia guardada", (await linhas()).find((x) => x.zapster_id === "MSG-I1")?.texto === "legenda" && !JSON.stringify(await linhas()).includes("x.invalido"));

  // ---------- (f) o mesmo evento 2× ----------
  console.log("\n== (f) reenvio do mesmo evento");
  const ev = recebida("MSG-F1", "5511911112222", texto("duplicada?"));
  const antes = (await linhas()).length;
  const r1 = await processarEventoZapster(admin as never, ev, ctx), r2 = await processarEventoZapster(admin as never, ev, ctx);
  confere("o 2º é reconhecido como duplicado, sem erro", r1 === "gravada" && r2 === "duplicada");
  const ev2 = recebida("MSG-F2", "5511911112222", texto("ao mesmo tempo"));
  const [p1, p2] = await Promise.all([processarEventoZapster(admin as never, ev2, ctx), processarEventoZapster(admin as never, ev2, ctx)]);
  confere("dois iguais AO MESMO TEMPO: 1 gravada + 1 duplicada", [p1, p2].sort().join() === "duplicada,gravada", [p1, p2].join());
  confere("no total, só +2 linhas (uma por mensagem)", (await linhas()).length === antes + 2);

  // ---------- (e) o que a porta recusa ----------
  console.log("\n== (e) outra instância / eventos que não interessam");
  const antes2 = (await linhas()).length;
  r = await processarEventoZapster(admin as never, { ...recebida("MSG-E1", "5511911112222", texto("x")), data: { ...recebida("MSG-E1", "5511911112222", texto("x")).data, recipient: { id: "5511000000000", type: "chat" } } }, ctx);
  confere("mensagem para OUTRA linha: recusada, nada gravado", r === "outra_instancia" && (await linhas()).length === antes2);
  r = await processarEventoZapster(admin as never, recebida("MSG-E2", "5511911112222", texto("grupo"), { recipient: { id: "120363000000000", type: "group" } }), ctx);
  confere("mensagem de grupo: ignorada", r === "outra_instancia" || r === "ignorada");
  r = await processarEventoZapster(admin as never, { type: "message.received", data: { sender: { id: "5511911112222" }, recipient: { id: NUMERO } } }, ctx);
  confere("evento sem identificador: inválido, nada gravado", r === "invalido" && (await linhas()).length === antes2);
  r = await processarEventoZapster(admin as never, { type: "group.created", data: { id: "x" } }, ctx);
  confere("evento de outro tipo: recebido e descartado", r === "ignorada");

  // ---------- (c) entregue / lido ----------
  console.log("\n== (c) status dos nossos envios");
  const { data: env1 } = await admin.from("envios_mensagens").insert({ conta_id: dono.id, person_id: Pana, canal: "whatsapp", tipo: "teste_conexao", status: "enviado", fornecedor: "zapster", fornecedor_msg_id: "OUT-1", enviado_em: new Date().toISOString() }).select("id").single();
  const { data: env2 } = await admin.from("envios_mensagens").insert({ conta_id: dono.id, person_id: Pana, canal: "whatsapp", tipo: "teste_conexao", status: "enviado", fornecedor: "zapster", fornecedor_msg_id: "OUT-2", enviado_em: new Date().toISOString() }).select("id").single();
  const est = async (id: string) => (await admin.from("envios_mensagens").select("entregue_em, lido_em").eq("id", id).single()).data!;
  r = await processarEventoZapster(admin as never, { type: "message.delivered", created_at: "2026-10-01T15:01:00.000Z", data: { id: "OUT-1" } }, ctx);
  let e1 = await est(env1!.id);
  confere("entregue: preenche entregue_em, lido_em continua vazio", r === "status" && e1.entregue_em !== null && e1.lido_em === null);
  r = await processarEventoZapster(admin as never, { type: "message.read", created_at: "2026-10-01T15:05:00.000Z", data: { id: "OUT-1" } }, ctx);
  e1 = await est(env1!.id);
  confere("lido: preenche lido_em (a hora do aviso)", e1.lido_em !== null && new Date(e1.lido_em).toISOString() === "2026-10-01T15:05:00.000Z");
  await processarEventoZapster(admin as never, { type: "message.delivered", created_at: "2026-10-01T16:00:00.000Z", data: { id: "OUT-1" } }, ctx);
  await processarEventoZapster(admin as never, { type: "message.read", created_at: "2026-10-01T17:00:00.000Z", data: { id: "OUT-1" } }, ctx);
  const e1b = await est(env1!.id);
  confere("o aviso repetido (mais tarde) não muda nada: nunca volta atrás nem se move", e1b.entregue_em === e1.entregue_em && e1b.lido_em === e1.lido_em);
  const { error: zera } = await admin.from("envios_mensagens").update({ entregue_em: null, lido_em: null }).eq("id", env1!.id);
  const e1c = await est(env1!.id);
  confere("nem um UPDATE direto consegue zerar (o banco impede)", !zera && e1c.entregue_em === e1.entregue_em && e1c.lido_em === e1.lido_em);
  await processarEventoZapster(admin as never, { type: "message.read", created_at: "2026-10-01T15:10:00.000Z", data: { id: "OUT-2" } }, ctx);
  const e2 = await est(env2!.id);
  confere("lido sem ter chegado o 'entregue' antes: lido implica entregue", e2.lido_em !== null && e2.entregue_em !== null);
  r = await processarEventoZapster(admin as never, { type: "message.read", data: { id: "NAO-E-NOSSA" } }, ctx);
  confere("aviso de mensagem que não é nossa: ignorado", r === "status_sem_envio");

  // ---------- (i) desconexão ----------
  console.log("\n== (i) instância desconectada");
  const sinos = async () => (await admin.from("notificacoes").select("titulo, user_id").eq("user_id", dono.id).eq("tipo", "whatsapp_desconectado")).data ?? [];
  r = await processarEventoZapster(admin as never, { type: "instance.disconnected", data: { id: NUMERO, reason: { code: "logout" } } }, ctx);
  confere("desconexão: 1 aviso no sino do dono, com o texto da F1c", r === "desconexao" && (await sinos()).length === 1 && (await sinos())[0].titulo === "O WhatsApp da plataforma está desconectado. Os lembretes estão saindo só por e-mail.");
  await processarEventoZapster(admin as never, { type: "instance.disconnected", data: { id: NUMERO } }, ctx);
  confere("de novo no mesmo dia: continua 1 só", (await sinos()).length === 1);
  r = await processarEventoZapster(admin as never, { type: "instance.disconnected", data: { id: "5511000000000" } }, ctx);
  confere("desconexão de OUTRA linha: recusada", r === "outra_instancia");

  // ---------- (h) quem lê ----------
  console.log("\n== (h) quem pode ler as mensagens");
  const cDono = await entrar(dono.email), cAluno = await entrar(aluno.email), cCol = await entrar(col.email);
  const vDono = await cDono.from("mensagens_recebidas").select("id");
  confere("o dono lê as da conta dele", (vDono.data ?? []).length === (await linhas()).length && (vDono.data ?? []).length > 10);
  confere("o ALUNO não lê nenhuma (nem a dele)", ((await cAluno.from("mensagens_recebidas").select("id")).data ?? []).length === 0);
  confere("o COLABORADOR não lê nenhuma", ((await cCol.from("mensagens_recebidas").select("id")).data ?? []).length === 0);
  const grava = await cDono.from("mensagens_recebidas").insert({ conta_id: dono.id, zapster_id: "PELA-TELA", telefone: "5511", remetente: "desconhecido", tipo: "texto", recebida_em: new Date().toISOString() });
  confere("ninguém grava pela tela (nem o dono)", !!grava.error);
  confere("e o dono não consegue apagar nem editar o comprovante pela tela", !!(await cDono.from("mensagens_recebidas").delete().eq("zapster_id", "MSG-A1")).error || ((await linhas()).some((x) => x.zapster_id === "MSG-A1")));

  // ---------- fusão ----------
  console.log("\n== a fusão de cadastros leva as mensagens junto");
  const Pk = await pessoa(dono.id, "Fusao Mantida", "(11) 96666-7777"), Px = await pessoa(dono.id, "Fusao Absorvida", null);
  await admin.from("mensagens_recebidas").insert({ conta_id: dono.id, zapster_id: "MSG-X1", telefone: "5511966667777", remetente: "pessoa", person_id: Px, remetente_nome: "Fusao Absorvida", tipo: "texto", texto: "oi", recebida_em: new Date().toISOString() });
  const fus = await admin.rpc("fundir_pessoas", { p_manter: Pk, p_absorver: Px, p_por: dono.id });
  confere("a fusão não é recusada", !fus.error, fus.error?.message);
  confere("a mensagem do absorvido agora é do cadastro que sobrevive", (await linhas()).find((x) => x.zapster_id === "MSG-X1")?.person_id === Pk);
  await admin.from("fusoes_pessoas").delete().eq("pessoa_mantida_id", Pk);

  // ---------- (j) nada vaza ----------
  console.log("\n== (j) nenhum telefone completo nem segredo no que foi escrito em log");
  const telefones = ["5511911112222", "5511977778888", "5511933334444", "11911112222", "911112222", "977778888"];
  confere("nenhum telefone completo apareceu em log", !telefones.some((t) => saida.some((s) => s.includes(t) && !s.includes("criada pessoa") && !s.startsWith("ok") && !s.startsWith("FALHA"))));
  confere("nenhum segredo nem token apareceu em log", !saida.some((s) => /ZAPSTER_WEBHOOK_SEGREDO|zapster_webhook_secret|token-de|eyJ[A-Za-z0-9_-]{20,}/.test(s)));
} finally {
  console.log("\n== limpeza (ids já impressos acima; só dados FICTÍCIOS desta execução)");
  await admin.from("notificacoes").delete().in("user_id", criados.users);
  await admin.from("mensagens_recebidas").delete().in("conta_id", criados.users);
  await admin.from("envios_mensagens").delete().in("conta_id", criados.users);
  for (const id of criados.people) await admin.from("people").delete().eq("id", id);
  for (const id of criados.team) await admin.from("team_members").delete().eq("id", id);
  for (const id of criados.users) await admin.auth.admin.deleteUser(id);
  const c = async (t: string, col: string, ids: string[]) => (await admin.from(t).select("*", { count: "exact", head: true }).in(col, ids)).count;
  const sobras = [await c("mensagens_recebidas", "conta_id", criados.users), await c("envios_mensagens", "conta_id", criados.users), await c("people", "id", criados.people), await c("notificacoes", "user_id", criados.users)];
  console.log(`sobras: ${sobras.join(", ")}`);
  confere("nada sobrou", sobras.every((n) => n === 0));
}
console.log(falhas === 0 ? "\nTUDO CERTO" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
