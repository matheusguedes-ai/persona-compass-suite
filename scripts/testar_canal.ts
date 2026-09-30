/**
 * #291 F1a — testes da camada de canal SEM rede e SEM banco (fetch e cliente falsos).
 *   npx tsx scripts/testar_canal.ts
 * Não usa token nem telefone reais: os valores abaixo são inventados.
 */
import { normalizarTelefoneBR, mascararTelefone } from "../src/lib/canal/telefone";
import { adaptadorZapster } from "../src/lib/canal/zapster.server";
import { enviarMensagem } from "../src/lib/canal/enviar.server";

let falhas = 0;
function confere(nome: string, cond: boolean, extra = "") {
  if (!cond) falhas++;
  console.log(`${cond ? "ok   " : "FALHA"} ${nome}${cond ? "" : ` ${extra}`}`);
}

// ---- telefone ----
const casos: [string, boolean, string?][] = [
  ["(18) 99999-1234", true, "5518999991234"],
  ["18999991234", true, "5518999991234"],
  ["+55 18 99999-1234", true, "5518999991234"],
  ["5518999991234", true, "5518999991234"],
  ["1899991234", false],          // 10 dígitos
  ["551899991234", false],       // 55 + 10 dígitos
  ["(18) 3222-1234", false],     // fixo
  ["01899991234", false],        // zero na frente
  ["10999991234", false],        // DDD 10 não existe
  ["18899991234", false],        // sem o 9 do celular
  ["", false],
  ["abc", false],
  ["189999912345", false],       // 12 dígitos
];
for (const [entrada, ok, esperado] of casos) {
  const r = normalizarTelefoneBR(entrada);
  confere(`telefone ${JSON.stringify(entrada)} → ${ok ? "válido" : "inválido"}`, r.ok === ok && (!ok || (r.ok && r.internacional === esperado)));
  if (!r.ok) confere(`  motivo = "telefone inválido"`, r.motivo === "telefone inválido");
  confere(`  máscara nunca traz o número inteiro`, entrada.replace(/\D/g, "").length < 6 || !r.mascarado.replace(/\D/g, "").includes(entrada.replace(/\D/g, "").slice(2, 9)));
}
confere("máscara no estilo pedido", mascararTelefone("18999991234") === "(18) 9****-**34", mascararTelefone("18999991234"));

// ---- adaptador (fetch falso) ----
process.env.ZAPSTER_API_TOKEN = "token-de-mentira-123456";
process.env.ZAPSTER_INSTANCE_ID = "instancia-de-mentira-789";
const chamadas: { url: string; init: RequestInit }[] = [];
let resposta: () => Response = () => new Response(JSON.stringify({ message_id: "MSG123" }), { status: 200 });
globalThis.fetch = (async (url: string, init: RequestInit) => { chamadas.push({ url, init }); return resposta(); }) as typeof fetch;

let r = await adaptadorZapster.enviarTexto("5518999991234", "oi");
confere("envio ok devolve o id", r.ok && r.idNoFornecedor === "MSG123");
const c = chamadas[0];
const h = c.init.headers as Record<string, string>;
confere("URL certa", c.url === "https://api.zapsterapi.com/v1/wa/messages", c.url);
confere("Bearer no header", h.Authorization === "Bearer token-de-mentira-123456");
confere("instância no header", h["X-Instance-ID"] === "instancia-de-mentira-789");
confere("corpo = recipient + text", c.init.body === JSON.stringify({ recipient: "5518999991234", text: "oi" }));

resposta = () => new Response(JSON.stringify({ code: "x", message: "falhou com token-de-mentira-123456 e instancia-de-mentira-789" }), { status: 422 });
r = await adaptadorZapster.enviarTexto("5518999991234", "oi");
confere("422 vira falha", !r.ok);
confere("motivo não vaza token nem instância", !r.ok && !r.motivo.includes("token-de-mentira") && !r.motivo.includes("instancia-de-mentira"), !r.ok ? r.motivo : "");
resposta = () => new Response("{}", { status: 401 });
r = await adaptadorZapster.enviarTexto("5518999991234", "oi");
confere("401 → credenciais", !r.ok && r.motivo.includes("credenciais"));
resposta = () => new Response("{}", { status: 429 });
r = await adaptadorZapster.enviarTexto("5518999991234", "oi");
confere("429 → limite", !r.ok && r.motivo.includes("Limite"));
globalThis.fetch = (async () => { throw new Error("rede caiu"); }) as typeof fetch;
r = await adaptadorZapster.enviarTexto("5518999991234", "oi");
confere("rede caída vira falha, sem lançar", !r.ok && r.motivo.includes("conexão"));

globalThis.fetch = (async () => new Response(JSON.stringify({ status: "connected" }), { status: 200 })) as typeof fetch;
confere("estado conectada", (await adaptadorZapster.estadoDaConexao()).estado === "conectada");
globalThis.fetch = (async () => new Response(JSON.stringify({ status: "disconnected" }), { status: 200 })) as typeof fetch;
confere("estado desconectada", (await adaptadorZapster.estadoDaConexao()).estado === "desconectada");
globalThis.fetch = (async () => new Response(JSON.stringify({ status: "offline" }), { status: 200 })) as typeof fetch;
confere("estado desligada", (await adaptadorZapster.estadoDaConexao()).estado === "desligada");

// ---- enviarMensagem (banco falso) ----
type Linha = Record<string, unknown>;
function bancoFalso() {
  const linhas: Linha[] = [];
  const admin = {
    from: () => ({
      insert: (l: Linha) => { const nova = { id: `reg${linhas.length + 1}`, ...l }; linhas.push(nova); return { select: () => ({ single: async () => ({ data: { id: nova.id }, error: null }) }) }; },
      update: (patch: Linha) => ({ eq: async (_c: string, id: string) => { Object.assign(linhas.find((x) => x.id === id)!, patch); return { error: null }; } }),
    }),
  };
  return { admin: admin as never, linhas };
}
let chamou = 0;
globalThis.fetch = (async () => { chamou++; return new Response(JSON.stringify({ message_id: "MSGX" }), { status: 200 }); }) as typeof fetch;

let b = bancoFalso();
let e = await enviarMensagem(b.admin, { contaId: "c1", criadoPor: "u1", canal: "whatsapp", tipo: "teste_conexao", destino: "(18) 99999-1234", texto: "t" });
confere("válido → enviado", e.status === "enviado");
confere("registro enviado com id do fornecedor", b.linhas[0].status === "enviado" && b.linhas[0].fornecedor_msg_id === "MSGX" && !!b.linhas[0].enviado_em);
confere("registro com dono", b.linhas[0].conta_id === "c1" && b.linhas[0].fornecedor === "zapster");
confere("registro sem telefone completo", !JSON.stringify(b.linhas[0]).includes("99999") && !JSON.stringify(b.linhas[0]).includes("999991234"));

chamou = 0; b = bancoFalso();
e = await enviarMensagem(b.admin, { contaId: "c1", criadoPor: "u1", canal: "whatsapp", tipo: "teste_conexao", destino: "1899991234", texto: "t" });
confere("10 dígitos → falhou", e.status === "falhou" && (e as { motivo: string }).motivo === "telefone inválido");
confere("10 dígitos NÃO chama a Zapster", chamou === 0);
confere("registro falhou: telefone inválido", b.linhas[0].status === "falhou" && b.linhas[0].motivo_falha === "telefone inválido");
confere("inválido também mascarado", !JSON.stringify(b.linhas[0]).includes("1899991234"));

b = bancoFalso();
e = await enviarMensagem(b.admin, { contaId: "c1", criadoPor: "u1", canal: "email", tipo: "x", destino: "18999991234", texto: "t" });
confere("canal sem adaptador → falhou, sem lançar", e.status === "falhou");

console.log(falhas === 0 ? "\nTUDO CERTO" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
