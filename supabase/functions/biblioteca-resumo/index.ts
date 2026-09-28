// #320 — o único lugar que gera RESUMO de livro da Biblioteca, e o único (fora `assistente-chat`) que
// guarda a chave da Anthropic. Chamada só pelo SERVIDOR (upload do material e o script de backfill),
// nunca pelo navegador: aqui não existe aluno perguntando, é o texto inteiro do livro indo pro modelo
// uma vez para virar resumo — bem mais caro que uma pergunta normal, e sem sentido gastar por sessão
// de usuário.
//
// AUTENTICAÇÃO: diferente de `assistente-chat` (que confere sessão de um ALUNO/MENTOR de verdade),
// aqui quem chama é sempre código do servidor com a CHAVE DE SERVIÇO — não existe usuário para checar
// `assistente_liberada()`. A chave de serviço já É um JWT assinado pelo Supabase com `role:
// "service_role"`; com `verify_jwt = true` no `config.toml`, a borda já confere a ASSINATURA antes de
// a função rodar — aqui só falta conferir que o PAPEL do token é `service_role`, não um usuário comum
// (um aluno logado nunca teria isso no próprio token). Índice [1] do JWT decodificado, sem verificar
// assinatura de novo (a borda já fez isso) — é só ler o que já foi validado.
//
// A chave da Anthropic é a MESMA guardada nos secrets deste projeto (secrets de Edge Function são do
// PROJETO, não de uma função isolada) — nada de duplicar segredo.

import { createClient } from "npm:@supabase/supabase-js@2";

function erro(mensagem: string, status: number): Response {
  return new Response(JSON.stringify({ error: mensagem }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function papelDoToken(token: string): string | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.role === "string" ? json.role : null;
  } catch {
    return null;
  }
}

type Corpo = { instrucoes?: string; texto?: string; esforco?: string };

function corpoValido(c: unknown): c is Required<Corpo> {
  const o = c as Corpo;
  return (
    !!o &&
    typeof o.instrucoes === "string" &&
    o.instrucoes.length > 0 &&
    typeof o.texto === "string" &&
    o.texto.length > 0 &&
    (o.esforco === undefined || o.esforco === "low" || o.esforco === "medium")
  );
}

const MODELO = "claude-sonnet-5";
const MAX_TOKENS = 2200;

Deno.serve(async (req) => {
  if (req.method !== "POST") return erro("método não permitido", 405);

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || papelDoToken(token) !== "service_role") {
    // Nunca diz "seu token não é de serviço" — a mesma mensagem genérica de sempre para quem não devia
    // estar aqui.
    return erro("sem sessão", 401);
  }

  // Confirma que o token realmente veio DESTE projeto (não é só um JWT qualquer com role=service_role
  // fabricado por quem já tivesse o segredo de outro projeto) — criar um cliente com ele e pedir algo
  // trivial ao banco confere a assinatura contra o segredo de verdade.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    console.error("[biblioteca-resumo] SUPABASE_URL ausente no ambiente da função");
    return erro("configuração ausente", 500);
  }
  const admin = createClient(supabaseUrl, token, { auth: { persistSession: false } });
  const { error: pingErro } = await admin.from("biblioteca_materiais").select("id").limit(1);
  if (pingErro) return erro("sem sessão", 401);

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return erro("corpo inválido", 400);
  }
  if (!corpoValido(corpo)) return erro("corpo inválido", 400);

  const chave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chave) {
    console.error("[biblioteca-resumo] ANTHROPIC_API_KEY não configurada nos secrets deste projeto");
    return erro("modelo indisponível", 503);
  }

  const esforco = corpo.esforco === "medium" ? "medium" : "low";
  const corpoAnthropic = JSON.stringify({
    model: MODELO,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    output_config: { effort: esforco },
    system: [{ type: "text", text: corpo.instrucoes }],
    messages: [{ role: "user", content: corpo.texto }],
  });

  let resposta: globalThis.Response;
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
    console.error("[biblioteca-resumo] falha de rede ao chamar a Anthropic:", String(e).slice(0, 200));
    return erro("modelo indisponível", 502);
  }

  if (!resposta.ok) {
    const corpoErro = await resposta.json().catch(() => null);
    console.error(
      `[biblioteca-resumo] Anthropic respondeu ${resposta.status}:`,
      corpoErro?.error?.type ?? "sem detalhe",
    );
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
      usage: {
        input_tokens: dados.usage?.input_tokens ?? 0,
        output_tokens: dados.usage?.output_tokens ?? 0,
        cache_creation_input_tokens: dados.usage?.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: dados.usage?.cache_read_input_tokens ?? 0,
      },
      modelo: typeof dados.model === "string" ? dados.model : MODELO,
    }),
    { headers: { "content-type": "application/json" } },
  );
});
