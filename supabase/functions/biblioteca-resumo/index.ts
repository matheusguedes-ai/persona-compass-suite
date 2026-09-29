// #320 — o único lugar que gera RESUMO de livro da Biblioteca, e o único (fora `assistente-chat`) que
// guarda a chave da Anthropic. Chamada só pelo SERVIDOR (upload do material e o script de backfill),
// nunca pelo navegador: aqui não existe aluno perguntando, é o texto inteiro do livro indo pro modelo
// uma vez para virar resumo — bem mais caro que uma pergunta normal, e sem sentido gastar por sessão
// de usuário.
//
// AUTENTICAÇÃO: diferente de `assistente-chat` (que confere sessão de um ALUNO/MENTOR de verdade),
// aqui quem chama é sempre código do servidor com a CHAVE DE SERVIÇO — não existe usuário para checar
// `assistente_liberada()`. Como a função confere que é mesmo a chave de serviço: ver o ajuste abaixo
// (a versão 1 lia o papel de dentro de um JWT, e a chave deste projeto não é JWT).
//
// A chave da Anthropic é a MESMA guardada nos secrets deste projeto (secrets de Edge Function são do
// PROJETO, não de uma função isolada) — nada de duplicar segredo.
//
// AJUSTE AO TERMINAR A #320 (29/09/2026, a versão 1 nunca tinha sido chamada de verdade): este projeto
// usa as chaves NOVAS do Supabase — a de serviço é `sb_secret_…`, que NÃO é um JWT. A versão 1 só
// aceitava o JWT antigo com role=service_role e respondia "sem sessão" a TODA chamada do servidor
// (backfill e upload). A prova de que quem chama é o servidor agora é pedir ao Auth algo que só a chave
// de serviço pode fazer (listar usuários): vale para a chave antiga e para a nova, e recusa a
// publicável, a anônima e a sessão de qualquer aluno ou mentor. A chave nova pode chegar como Bearer ou
// só no cabeçalho `apikey`. E a resposta passa a dizer `stop_reason`: resumo que bateu no limite de
// tamanho sai CORTADO, e quem chama não pode gravá-lo como pronto.

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

/** Só a chave de serviço deste projeto (antiga ou nova) consegue listar os usuários do Auth. */
async function eChaveDeServico(supabaseUrl: string, chave: string): Promise<boolean> {
  if (!chave || chave.startsWith("sb_publishable_")) return false;
  const papel = papelDoToken(chave);
  if (papel !== null && papel !== "service_role") return false; // sessão de usuário ou chave anônima
  const admin = createClient(supabaseUrl, chave, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  return !error;
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
// O pensamento adaptativo conta dentro deste teto. Com 2.200 (versão 1), um resumo final de até 700
// palavras podia ser cortado no meio; a margem não custa nada se não for usada.
const MAX_TOKENS = 8000;

Deno.serve(async (req) => {
  if (req.method !== "POST") return erro("método não permitido", 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    console.error("[biblioteca-resumo] SUPABASE_URL ausente no ambiente da função");
    return erro("configuração ausente", 500);
  }
  const auth = req.headers.get("authorization") ?? "";
  const candidatas = [auth.startsWith("Bearer ") ? auth.slice(7).trim() : "", (req.headers.get("apikey") ?? "").trim()];
  let autorizado = false;
  for (const chave of candidatas) {
    if (chave && (await eChaveDeServico(supabaseUrl, chave))) {
      autorizado = true;
      break;
    }
  }
  // Nunca diz "sua chave não é de serviço" — a mesma mensagem genérica de sempre para quem não devia
  // estar aqui.
  if (!autorizado) return erro("sem sessão", 401);

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
      stop_reason: typeof dados.stop_reason === "string" ? dados.stop_reason : null,
    }),
    { headers: { "content-type": "application/json" } },
  );
});
