/**
 * dono-central — prova com LOGINS DE VERDADE (fictícios, @exemplo.invalido) rodando o código real contra o banco real:
 *   npx tsx scripts/provar_dono_central.ts
 * Cria: um dono novo (sem nenhum aluno), um colaborador, um aluno e um aluno "esperto" (que cadastra uma
 * pessoa para si mesmo). Imprime os ids ANTES de apagar. Nunca toca a conta do dono real.
 * Entra nas contas por link mágico; o token fica só na memória e nunca é impresso.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { exigirDono, membershipDoUsuario } from "../src/lib/team.functions";

const env: Record<string, string> = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const URL_ = env.SUPABASE_URL.replace(/\/$/, "");
const anon = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

let falhas = 0;
const confere = (nome: string, cond: boolean, extra = "") => { if (!cond) falhas++; console.log(`${cond ? "ok   " : "FALHA"} ${nome}${cond ? "" : ` ${extra}`}`); };

const rodada = randomBytes(3).toString("hex");
const criados: { users: string[]; people: string[]; team: string[] } = { users: [], people: [], team: [] };

async function novoLogin(rotulo: string): Promise<{ id: string; email: string }> {
  const email = `teste-dono-central-${rotulo}-${rodada}@exemplo.invalido`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw new Error(`login ${rotulo}: ${error?.message}`);
  criados.users.push(data.user.id);
  console.log(`criado login ${rotulo}: ${data.user.id}`);
  return { id: data.user.id, email };
}

async function entrar(email: string): Promise<SupabaseClient> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw new Error(`link ${email}: ${error?.message}`);
  const c = createClient(URL_, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: e2 } = await c.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (e2) throw new Error(`sessão ${email}: ${e2.message}`);
  return c;
}

async function passa(c: SupabaseClient): Promise<boolean> {
  try { await exigirDono(c as never); return true; } catch { return false; }
}
async function rpcBool(c: SupabaseClient, nome: string): Promise<unknown> {
  const { data, error } = await c.rpc(nome as never);
  return error ? `erro:${error.message}` : data;
}

try {
  // ---------- montagem ----------
  const dono = await novoLogin("dono");          // dono NOVO: conta criada pelo admin, nenhum aluno
  const { error: eC } = await admin.rpc("registrar_conta_dona", { p_user: dono.id, p_origem: "prova dono-central" });
  if (eC) throw new Error(eC.message);
  const cDono = await entrar(dono.email);
  // ---------- (c) dono NOVO, sem nenhum aluno ----------
  console.log("\n== (c) dono novo, sem nenhum aluno cadastrado");
  confere("exigirDono passa", await passa(cDono));
  let m = await membershipDoUsuario(cDono as never, dono.id);
  confere("membership = owner", m.kind === "owner" && m.permissions.length > 0);
  confere("whatsapp_dono = true (antes exigia aluno cadastrado)", (await rpcBool(cDono, "whatsapp_dono")) === true);
  confere("assistente do mentor = false enquanto não tem alunos (regra de produto mantida)", (await rpcBool(cDono, "assistente_mentor_liberada")) === false);

  // agora o dono ganha alunos: a assistente do mentor passa a valer para ele
  const colab = await novoLogin("colab");
  const aluno = await novoLogin("aluno");
  const esperto = await novoLogin("esperto");

  const { data: tm, error: eT } = await admin.from("team_members").insert({ owner_id: dono.id, kind: "colaborador", name: "ZZ Colab", email: colab.email, user_id: colab.id, status: "ativo", permissions: ["pessoas"] }).select("id").single();
  if (eT) throw new Error(eT.message); criados.team.push(tm!.id); console.log(`criado team_member: ${tm!.id}`);
  for (const a of [aluno, esperto]) {
    const { data: p, error } = await admin.from("people").insert({ mentor_id: dono.id, full_name: `ZZ ${a.email.split("-")[3]}`, email: a.email, user_id: a.id }).select("id").single();
    if (error) throw new Error(error.message); criados.people.push(p!.id); console.log(`criada pessoa (avaliado): ${p!.id}`);
  }

  const cColab = await entrar(colab.email), cAluno = await entrar(aluno.email), cEsperto = await entrar(esperto.email);

  confere("com alunos cadastrados, a assistente do mentor = true para o dono", (await rpcBool(cDono, "assistente_mentor_liberada")) === true);

  // ---------- (a) colaborador: exatamente o que tinha ----------
  console.log("\n== (a) colaborador");
  confere("exigirDono recusa", !(await passa(cColab)));
  m = await membershipDoUsuario(cColab as never, colab.id);
  confere("membership = colaborador, permissões 'pessoas', conta do dono", m.kind === "colaborador" && m.permissions.join() === "pessoas" && m.account_id === dono.id);
  confere("whatsapp_dono = false", (await rpcBool(cColab, "whatsapp_dono")) === false);
  confere("assistente_mentor_liberada = false", (await rpcBool(cColab, "assistente_mentor_liberada")) === false);

  // ---------- (a) aluno ----------
  console.log("\n== (a) aluno");
  confere("exigirDono recusa", !(await passa(cAluno)));
  m = await membershipDoUsuario(cAluno as never, aluno.id);
  confere("membership = aluno, sem permissões", m.kind === "aluno" && m.permissions.length === 0);
  confere("(contraste) member_kind ANTIGO ainda diz 'owner' para ele", (await rpcBool(cAluno, "member_kind")) === "owner");
  confere("whatsapp_dono = false", (await rpcBool(cAluno, "whatsapp_dono")) === false);

  // ---------- o ataque: aluno cadastra uma pessoa para si ----------
  console.log("\n== aluno 'esperto': cadastra uma pessoa para si mesmo e tenta virar dono");
  const { data: propria, error: eP } = await cEsperto.from("people").insert({ mentor_id: esperto.id, full_name: "ZZ auto-cadastro", email: `auto-${rodada}@exemplo.invalido` }).select("id").single();
  if (eP) console.log("  (o banco barrou o auto-cadastro:", eP.message, ")"); else { criados.people.push(propria!.id); console.log(`  criada pessoa própria: ${propria!.id}`); }
  confere("tem pessoa sob gestão própria", !eP);
  confere("exigirDono AINDA recusa", !(await passa(cEsperto)));
  m = await membershipDoUsuario(cEsperto as never, esperto.id);
  confere("membership AINDA = aluno (não abre o painel)", m.kind === "aluno" && m.permissions.length === 0);
  confere("whatsapp_dono AINDA false", (await rpcBool(cEsperto, "whatsapp_dono")) === false);
  confere("assistente_mentor_liberada AINDA false", (await rpcBool(cEsperto, "assistente_mentor_liberada")) === false);
  const { error: eCoroa } = await cEsperto.from("contas").insert({ dono_id: esperto.id });
  confere("inserir a própria linha em 'contas' é barrado", !!eCoroa);
  const { error: eReg } = await cEsperto.rpc("registrar_conta_dona", { p_user: esperto.id });
  confere("chamar registrar_conta_dona é barrado", !!eReg);
} finally {
  console.log("\n== limpeza (ids já impressos acima)");
  for (const id of criados.people) await admin.from("people").delete().eq("id", id);
  for (const id of criados.team) await admin.from("team_members").delete().eq("id", id);
  for (const id of criados.users) await admin.auth.admin.deleteUser(id);
  const { count: cp } = await admin.from("people").select("id", { count: "exact", head: true }).ilike("email", `%-${rodada}@exemplo.invalido`);
  const { count: cc } = await admin.from("contas").select("dono_id", { count: "exact", head: true }).in("dono_id", criados.users);
  const { count: ct } = await admin.from("team_members").select("id", { count: "exact", head: true }).ilike("email", `%-${rodada}@exemplo.invalido`);
  console.log(`sobras: pessoas=${cp} contas=${cc} equipe=${ct}`);
  confere("nada sobrou", cp === 0 && cc === 0 && ct === 0);
}
console.log(falhas === 0 ? "\nTUDO CERTO" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
