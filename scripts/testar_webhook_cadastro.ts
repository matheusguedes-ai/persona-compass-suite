/** Testa o cadastro/verificação do webhook na Zapster SEM rede (fetch falso). npx tsx scripts/testar_webhook_cadastro.ts */
process.env.ZAPSTER_API_TOKEN = "token-de-mentira-wh";
process.env.ZAPSTER_INSTANCE_ID = "instancia-de-mentira-wh";
import { cadastrarWebhookZapster, verificarWebhookZapster } from "../src/lib/canal/zapster.server";
let falhas = 0;
const confere = (n: string, c: boolean, e = "") => { if (!c) falhas++; console.log(`${c ? "ok   " : "FALHA"} ${n}${c ? "" : ` ${e}`}`); };
const URL_ = "https://assessment.exemplo.invalido/api/webhook/zapster/SEGREDO-DE-MENTIRA-1234567890";
const chamadas: { url: string; metodo: string; corpo: unknown }[] = [];
let aceitaNoFormato = 3; // 1-based: qual tentativa a Zapster "aceita"
let lista: unknown = { total: 0, webhooks: [] };
globalThis.fetch = (async (url: string, init: RequestInit) => {
  chamadas.push({ url, metodo: String(init.method), corpo: init.body ? JSON.parse(String(init.body)) : null });
  if (init.method === "GET") return new Response(JSON.stringify(lista), { status: 200 });
  const n = chamadas.filter((c) => c.metodo === "POST").length;
  if (n === aceitaNoFormato) return new Response(JSON.stringify({ id: "wh1" }), { status: 201 });
  // erro que ECOA o endereço (com o segredo) e o token — não pode vazar
  return new Response(JSON.stringify({ code: "invalid", message: `campo inválido em ${URL_} com token-de-mentira-wh` }), { status: 422 });
}) as typeof fetch;

let r = await cadastrarWebhookZapster({ url: URL_, nome: "Plataforma", eventos: ["message.received"] });
confere("para no primeiro formato aceito (3º)", r.criado && r.tentativas.length === 3);
confere("os 2 primeiros viraram erro resumido", r.tentativas[0].resultado.startsWith("422") && r.tentativas[2].resultado.startsWith("aceito"));
confere("o resumo do erro NÃO traz o endereço, o segredo nem o token", !JSON.stringify(r.tentativas).includes("SEGREDO-DE-MENTIRA") && !JSON.stringify(r.tentativas).includes("token-de-mentira") && JSON.stringify(r.tentativas).includes("[oculto]"));
confere("manda nome, url, eventos e ativado; o 1º formato leva o id da instância", (chamadas[0].corpo as Record<string, unknown>).instance_id === "instancia-de-mentira-wh" && (chamadas[0].corpo as Record<string, unknown>).enabled === true && (chamadas[0].corpo as Record<string, unknown>).url === URL_);
chamadas.length = 0; aceitaNoFormato = 99;
r = await cadastrarWebhookZapster({ url: URL_, nome: "P", eventos: ["x"] });
confere("se nenhum formato for aceito: criado=false, 5 tentativas registradas", !r.criado && r.tentativas.length === 5);

chamadas.length = 0;
lista = { total: 2, webhooks: [{ id: "a", url: "https://outro.invalido/x", enabled: true }, { id: "b", url: URL_, enabled: false, instances: ["i1", "i2"], name: "n" }] };
const v = await verificarWebhookZapster(URL_);
confere("verificação acha o NOSSO entre os webhooks da conta", v.ok && v.nossos.length === 1 && v.nossos[0].doNossoEndereco && v.nossos[0].enabled === false && v.nossos[0].instancias === "2 instância(s)");
confere("a verificação NUNCA devolve o endereço", !JSON.stringify(v).includes("SEGREDO-DE-MENTIRA") && !JSON.stringify(v).includes("assessment.exemplo"));
lista = { total: 0, webhooks: [] };
const v2 = await verificarWebhookZapster(URL_);
confere("lista vazia: 'nenhum nosso'", v2.ok && v2.nossos.length === 0);
console.log(falhas === 0 ? "\nTUDO CERTO" : `\n${falhas} FALHA(S)`); process.exit(falhas === 0 ? 0 : 1);
