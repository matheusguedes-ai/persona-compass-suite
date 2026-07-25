import { createFileRoute } from "@tanstack/react-router";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const MAX_KEYS = 10;
const MAX_LEN = 2000;

function parseAnswers(input: unknown): { ok: true; answers: Record<string, string> } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "Formato inválido." };
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length > MAX_KEYS) return { ok: false, error: `O plano aceita no máximo ${MAX_KEYS} itens.` };
  const answers: Record<string, string> = {};
  for (const [k, v] of entries) {
    if (typeof k !== "string" || k.length > 64) return { ok: false, error: "Identificador de item inválido." };
    if (typeof v !== "string") return { ok: false, error: "Cada resposta deve ser um texto." };
    if (v.length > MAX_LEN) return { ok: false, error: `Cada resposta deve ter no máximo ${MAX_LEN} caracteres.` };
    answers[k] = v;
  }
  return { ok: true, answers };
}

export const Route = createFileRoute("/api/public/action-plan/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const supabase = await getAdmin();
          const { data, error } = await supabase
            .from("action_plans")
            .select("answers, updated_at")
            .eq("response_id", params.id)
            .maybeSingle();
          if (error) return json({ error: "Não foi possível carregar o plano." }, 500);
          return json({ answers: (data?.answers ?? {}) as Record<string, string>, updated_at: data?.updated_at ?? null });
        } catch {
          return json({ error: "Não foi possível carregar o plano." }, 500);
        }
      },
      POST: async ({ params, request }) => {
        try {
          const supabase = await getAdmin();
          const { data: response, error: respError } = await supabase
            .from("test_responses")
            .select("id, kind, submitted_at")
            .eq("id", params.id)
            .maybeSingle();
          if (respError) return json({ error: "Não foi possível salvar o plano." }, 500);
          if (!response || response.kind !== "self" || !response.submitted_at) {
            return json({ error: "Plano indisponível para esta resposta." }, 404);
          }

          const body = (await request.json().catch(() => null)) as { answers?: unknown } | null;
          const parsed = parseAnswers(body?.answers);
          if (!parsed.ok) return json({ error: parsed.error }, 400);

          const updated_at = new Date().toISOString();
          const { error } = await supabase
            .from("action_plans")
            .upsert({ response_id: params.id, answers: parsed.answers, updated_at }, { onConflict: "response_id" });
          if (error) return json({ error: "Não foi possível salvar o plano." }, 500);
          return json({ ok: true, updated_at });
        } catch {
          return json({ error: "Não foi possível salvar o plano." }, 500);
        }
      },
    },
  },
});
