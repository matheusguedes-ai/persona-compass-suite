// #289 — o único lugar que guarda a chave da Anthropic e fala com a API dela.
//
// A chave nunca aparece numa resposta nem num log: só é usada no cabeçalho da chamada de SAÍDA
// (para api.anthropic.com). Toda mensagem de erro devolvida ao chamador é escrita à mão — nunca o
// corpo cru de uma resposta de erro de terceiro é repassado, mesmo sabendo que ele não contém a
// chave: é o mesmo cuidado, por hábito.
//
// Quem chama isto é sempre o SERVIDOR do app (`src/lib/assistente/modelo.server.ts`), nunca o
// navegador direto, com o token da PRÓPRIA sessão do aluno no cabeçalho Authorization. Duas travas
// antes de gastar a chave, além da verificação de JWT que a plataforma já faz na borda:
//   1) o token precisa decodificar para um usuário autenticado de verdade (getClaims);
//   2) esse usuário precisa estar com assistente_liberada() = true no banco — a MESMA função que a
//      tela usa para decidir se mostra o item de menu.
// Nada aqui lê relatório, decide quem vê o quê, nem grava conversa — isso continua no servidor do
// app, exatamente como antes desta mudança. Só o "falar com a Anthropic" mudou de endereço.

import { createClient } from "npm:@supabase/supabase-js@2";

const MODELO = "claude-sonnet-5";
const TENTATIVAS = 3;

type Mensagem = { role: "user" | "assistant"; content: string };
type Corpo = { instrucoes?: string; contexto?: string; historico?: Mensagem[] };

function erro(mensagem: string, status: number): Response {
  return new Response(JSON.stringify({ error: mensagem }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function corpoValido(c: unknown): c is Required<Corpo> {
  const o = c as Corpo;
  return (
    !!o &&
    typeof o.instrucoes === "string" &&
    o.instrucoes.length > 0 &&
    typeof o.contexto === "string" &&
    o.contexto.length > 0 &&
    Array.isArray(o.historico) &&
    o.historico.length > 0 &&
    o.historico.every(
      (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.length > 0,
    )
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return erro("método não permitido", 405);

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return erro("sem sessão", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    console.error("[assistente-chat] SUPABASE_URL/SUPABASE_ANON_KEY ausentes no ambiente da função");
    return erro("configuração ausente", 500);
  }

  // Cliente com o TOKEN DO ALUNO, não a chave de serviço: getClaims confere a assinatura, e o RPC
  // roda sob a RLS dele — a mesma trava que qualquer outra leitura da assistente já usa.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: claims, error: claimsErro } = await supabase.auth.getClaims(token);
  if (claimsErro || !claims?.claims?.sub) return erro("sessão inválida", 401);

  const { data: liberada, error: liberadaErro } = await supabase.rpc("assistente_liberada");
  if (liberadaErro || liberada !== true) return erro("assistente não liberada para este login", 403);

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return erro("corpo inválido", 400);
  }
  if (!corpoValido(corpo)) return erro("corpo inválido", 400);

  const chave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chave) {
    // Sem a chave, a função existe mas não pode responder — a mensagem NÃO diz "sem chave" para
    // quem chama; só o log do lado de dentro sabe o motivo exato.
    console.error("[assistente-chat] ANTHROPIC_API_KEY não configurada nos secrets desta função");
    return erro("modelo indisponível", 503);
  }

  const corpoAnthropic = JSON.stringify({
    model: MODELO,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    cache_control: { type: "ephemeral" },
    system: [
      { type: "text", text: corpo.instrucoes, cache_control: { type: "ephemeral" } },
      { type: "text", text: corpo.contexto, cache_control: { type: "ephemeral" } },
    ],
    messages: corpo.historico,
  });

  const inicio = Date.now();
  let resposta: globalThis.Response | null = null;
  let falhaDeRede: unknown = null;
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    falhaDeRede = null;
    try {
      resposta = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": chave,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: corpoAnthropic,
      });
    } catch (e) {
      falhaDeRede = e;
    }
    // Só repete em erro de rede, 429 (limite) ou 5xx (instabilidade do provedor) — nunca em 4xx de
    // requisição (isso não muda tentando de novo).
    const repetir = falhaDeRede || (resposta && (resposta.status === 429 || resposta.status >= 500));
    if (!repetir) break;
    if (tentativa < TENTATIVAS) await new Promise((r) => setTimeout(r, 400 * tentativa));
  }

  if (falhaDeRede || !resposta) {
    console.error("[assistente-chat] falha de rede ao chamar a Anthropic:", String(falhaDeRede).slice(0, 200));
    return erro("modelo indisponível", 502);
  }

  if (!resposta.ok) {
    // O corpo do erro do provedor NÃO é repassado ao chamador — só o `type`, que é seguro (não
    // carrega segredo nenhum), fica no log daqui, para eu conseguir diagnosticar depois.
    const corpoErro = await resposta.json().catch(() => null);
    console.error(`[assistente-chat] Anthropic respondeu ${resposta.status}:`, corpoErro?.error?.type ?? "sem detalhe");
    return erro("modelo indisponível", 502);
  }

  const dados = await resposta.json();
  const texto = (dados.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("")
    .trim();

  return new Response(
    JSON.stringify({
      texto,
      stopReason: dados.stop_reason ?? null,
      usage: {
        input_tokens: dados.usage?.input_tokens ?? 0,
        output_tokens: dados.usage?.output_tokens ?? 0,
        cache_creation_input_tokens: dados.usage?.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: dados.usage?.cache_read_input_tokens ?? 0,
      },
      ms: Date.now() - inicio,
    }),
    { headers: { "content-type": "application/json" } },
  );
});
