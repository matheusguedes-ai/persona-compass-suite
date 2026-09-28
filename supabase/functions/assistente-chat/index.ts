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
//
// #307 — DUAS ASSISTENTES, DOIS PORTÕES. O corpo pode trazer `escopo: "mentor"` (a assistente do
// painel do mentor); então o portão é `assistente_mentor_liberada()` (dono da conta, com alunos) em vez
// de `assistente_liberada()`. Sem o campo, é a do aluno — exatamente como sempre. Um aluno que mande
// "mentor" cai no portão do mentor e é recusado; um mentor que mande "aluno", no do aluno.
//
// #317 — TRÊS NÍVEIS (Básica, Smart, Pro). O corpo pode trazer `categoria`. O MAPA nível → modelo mora
// SÓ AQUI (`NIVEIS`): é o único lugar que chama a Anthropic, e o app registra o modelo que ESTA função
// devolve — nunca uma cópia do mapa. O teto é conferido aqui de novo, com o token de quem pergunta
// (`assistente_categorias()`), não só no servidor do app: um aluno que chamasse esta função direto
// com "pro" sem ter a Pro liberada é recusado. O mentor (portão do mentor) tem as três. Sem
// `categoria` no corpo = o nível mais baixo que a pessoa tem — com os tetos de hoje, a Básica, que é
// exatamente a configuração de sempre (o app publicado antes da #317 continua funcionando igual).

import { createClient } from "npm:@supabase/supabase-js@2";

const TENTATIVAS = 3;

type Categoria = "basica" | "smart" | "pro";
const ORDEM: Categoria[] = ["basica", "smart", "pro"];

type Nivel = {
  modelo: string;
  esforco: "low" | "medium" | "high";
  maxTokens: number;
  // Opus 5: os classificadores de segurança podem recusar um pedido; com `fallbacks: "default"` a
  // própria API refaz o pedido no modelo recomendado para aquela categoria de recusa, na mesma chamada.
  fallback: boolean;
};

const NIVEIS: Record<Categoria, Nivel> = {
  // A assistente de sempre — nada muda para quem já usa (mesmo modelo, esforço e teto de saída).
  basica: { modelo: "claude-sonnet-5", esforco: "low", maxTokens: 8000, fallback: false },
  smart: { modelo: "claude-sonnet-5", esforco: "high", maxTokens: 16000, fallback: false },
  pro: { modelo: "claude-opus-5", esforco: "high", maxTokens: 16000, fallback: true },
};

type Mensagem = { role: "user" | "assistant"; content: string };
type Corpo = { instrucoes?: string; contexto?: string; historico?: Mensagem[]; escopo?: string; categoria?: string };

function erro(mensagem: string, status: number, extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ error: mensagem, ...extra }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function corpoValido(c: unknown): c is Required<Omit<Corpo, "categoria" | "escopo">> & Corpo {
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
    ) &&
    (o.categoria === undefined || ORDEM.includes(o.categoria as Categoria))
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

  // O corpo antes do portão: é ele que diz QUAL assistente está chamando (e, com isso, qual portão).
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return erro("corpo inválido", 400);
  }
  if (!corpoValido(corpo)) return erro("corpo inválido", 400);

  const doMentor = corpo.escopo === "mentor";
  const { data: liberada, error: liberadaErro } = await supabase.rpc(
    doMentor ? "assistente_mentor_liberada" : "assistente_liberada",
  );
  if (liberadaErro || liberada !== true) {
    return erro(doMentor ? "assistente do mentor não liberada para este login" : "assistente não liberada para este login", 403);
  }

  // #317 — o teto de quem pergunta. Mentor: as três. Aluno: a soma das liberações dele, pelo banco.
  let permitidas: Categoria[] = ORDEM;
  if (!doMentor) {
    const { data: teto, error: tetoErro } = await supabase.rpc("assistente_categorias");
    if (tetoErro) {
      console.error("[assistente-chat] teto de níveis:", tetoErro.message);
      return erro("não foi possível conferir o nível liberado", 500);
    }
    permitidas = ORDEM.filter((c) => ((teto ?? []) as string[]).includes(c));
    if (!permitidas.length) return erro("nenhum nível liberado para este login", 403);
  }
  const categoria: Categoria = (corpo.categoria as Categoria | undefined) ?? permitidas[0];
  if (!permitidas.includes(categoria)) return erro("nível não liberado para este login", 403, { categoria });
  const nivel = NIVEIS[categoria];

  const chave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chave) {
    // Sem a chave, a função existe mas não pode responder — a mensagem NÃO diz "sem chave" para
    // quem chama; só o log do lado de dentro sabe o motivo exato.
    console.error("[assistente-chat] ANTHROPIC_API_KEY não configurada nos secrets desta função");
    return erro("modelo indisponível", 503, { categoria, modelo: nivel.modelo });
  }

  const corpoAnthropic = JSON.stringify({
    model: nivel.modelo,
    max_tokens: nivel.maxTokens,
    thinking: { type: "adaptive" },
    output_config: { effort: nivel.esforco },
    ...(nivel.fallback ? { fallbacks: "default" } : {}),
    cache_control: { type: "ephemeral" },
    system: [
      { type: "text", text: corpo.instrucoes, cache_control: { type: "ephemeral" } },
      { type: "text", text: corpo.contexto, cache_control: { type: "ephemeral" } },
    ],
    messages: corpo.historico,
  });
  const cabecalhos: Record<string, string> = {
    "x-api-key": chave,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
    ...(nivel.fallback ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}),
  };

  const inicio = Date.now();
  let resposta: globalThis.Response | null = null;
  let falhaDeRede: unknown = null;
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    falhaDeRede = null;
    try {
      resposta = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: cabecalhos,
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
    return erro("modelo indisponível", 502, { categoria, modelo: nivel.modelo });
  }

  if (!resposta.ok) {
    // O corpo do erro do provedor NÃO é repassado ao chamador — só o `type`, que é seguro (não
    // carrega segredo nenhum), fica no log daqui, para eu conseguir diagnosticar depois.
    const corpoErro = await resposta.json().catch(() => null);
    console.error(`[assistente-chat] Anthropic respondeu ${resposta.status} (${nivel.modelo}):`, corpoErro?.error?.type ?? "sem detalhe");
    return erro("modelo indisponível", 502, { categoria, modelo: nivel.modelo });
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
      // O modelo que DE FATO respondeu (com fallback, pode não ser o pedido) e o nível usado.
      modelo: typeof dados.model === "string" ? dados.model : nivel.modelo,
      categoria,
    }),
    { headers: { "content-type": "application/json" } },
  );
});
