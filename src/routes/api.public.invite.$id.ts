import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { loadBrandAndSettings } from "@/lib/brand.server";

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const joinSchema = z.object({
  full_name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(160),
  // Formato livre de propósito: aceita (11) 99999-0000, +55…, com ou sem
  // pontuação. Só garante que não é um punhado de caracteres solto.
  phone: z.string().trim().min(8).max(40),
});

type Reason = "not_found" | "inactive" | "expired" | "full";

/** Motivo pelo qual o link não aceita mais respostas — null quando está aberto. */
function blockedReason(link: {
  is_active: boolean;
  expires_at: string | null;
  max_responses: number | null;
  response_count: number;
}): Reason | null {
  if (!link.is_active) return "inactive";
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) return "expired";
  if (link.max_responses != null && link.response_count >= link.max_responses) return "full";
  return null;
}

const MESSAGES: Record<Reason, string> = {
  not_found: "Link não encontrado.",
  inactive: "Este link foi desativado pelo mentor.",
  expired: "Este link expirou. Peça um novo ao seu mentor.",
  full: "Este link já atingiu o número máximo de respostas.",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export const Route = createFileRoute("/api/public/invite/$id")({
  server: {
    handlers: {
      // Estado do link + o que a pessoa vai responder.
      GET: async ({ params }) => {
        try {
          const supabase = await getAdmin();
          const { data: link } = await supabase
            .from("invite_links")
            .select("id, title, version_ids, expires_at, max_responses, response_count, is_active, mentor_id")
            .eq("id", params.id)
            .maybeSingle();
          if (!link) return json({ error: "not_found", message: MESSAGES.not_found }, 404);

          const reason = blockedReason(link);
          const { data: versions } = await supabase
            .from("test_versions")
            .select("id, title")
            .in("id", link.version_ids);
          // Preserva a ordem definida pelo mentor.
          const titles = link.version_ids
            .map((vid) => versions?.find((v) => v.id === vid)?.title)
            .filter((t): t is string => !!t);

          const { brand } = await loadBrandAndSettings(link.mentor_id);
          return json({
            id: link.id,
            brand,
            title: link.title,
            tests: titles,
            expires_at: link.expires_at,
            remaining: link.max_responses == null ? null : Math.max(0, link.max_responses - link.response_count),
            blocked: reason,
            message: reason ? MESSAGES[reason] : null,
          });
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "erro" }, 500);
        }
      },

      // A pessoa se identifica e ganha as respostas para preencher.
      POST: async ({ request, params }) => {
        try {
          const body = joinSchema.parse(await request.json());
          const supabase = await getAdmin();

          const { data: link } = await supabase
            .from("invite_links")
            .select("*")
            .eq("id", params.id)
            .maybeSingle();
          if (!link) return json({ error: "not_found", message: MESSAGES.not_found }, 404);

          // Checagem antecipada só para dar mensagem melhor; quem decide é o claim.
          const early = blockedReason(link);
          if (early) return json({ error: early, message: MESSAGES[early] }, 410);

          // Reserva a vaga de forma atômica: cliques simultâneos não furam o limite.
          const { data: claimed, error: claimErr } = await supabase.rpc("claim_invite_link", {
            link_id: params.id,
          });
          if (claimErr) throw new Error(claimErr.message);
          if (!claimed || claimed.length === 0) {
            return json({ error: "full", message: MESSAGES.full }, 410);
          }

          const { data: person, error: pErr } = await supabase
            .from("people")
            .insert({
              mentor_id: link.mentor_id,
              full_name: body.full_name,
              email: body.email,
              phone: body.phone,
              role: "aluno",
              invite_link_id: link.id,
            })
            .select("id")
            .single();
          if (pErr) throw new Error(pErr.message);

          if (link.group_id) {
            await supabase.from("group_members").insert({ group_id: link.group_id, person_id: person.id });
          }

          const versionIds: string[] = link.version_ids;
          // #212 item 5a — mesmo pelo link aberto, teste anônimo não grava
          // quem respondeu. A pessoa se identifica pra ENTRAR (nome/email
          // viram um cadastro), mas o vínculo com a resposta em si não nasce
          // se a versão for anônima.
          const { data: versoes, error: vErr } = await supabase
            .from("test_versions").select("id, is_anonymous").in("id", versionIds);
          if (vErr) throw new Error(vErr.message);
          const anonimaPorId = new Map((versoes ?? []).map((v) => [v.id, v.is_anonymous]));
          const common = {
            mentor_id: link.mentor_id,
            group_id: link.group_id ?? null,
            status: "pending",
            kind: "self",
            expires_at: link.expires_at,
          };

          // Vários testes = bateria (link único em etapas). Um só = resposta avulsa.
          if (versionIds.length > 1) {
            const { data: assessment, error: aErr } = await supabase
              .from("assessment_responses")
              .insert({
                mentor_id: link.mentor_id,
                person_id: person.id,
                group_id: link.group_id ?? null,
                status: "pending",
                expires_at: link.expires_at,
              })
              .select("id")
              .single();
            if (aErr) throw new Error(aErr.message);
            const { error: rErr } = await supabase.from("test_responses").insert(
              versionIds.map((version_id, idx) => ({
                ...common,
                version_id,
                person_id: anonimaPorId.get(version_id) ? null : person.id,
                assessment_response_id: assessment.id,
                assessment_sort: idx,
              })),
            );
            if (rErr) throw new Error(rErr.message);
            return json({ kind: "assessment", id: assessment.id });
          }

          const { data: response, error: rErr } = await supabase
            .from("test_responses")
            .insert({ ...common, version_id: versionIds[0], person_id: anonimaPorId.get(versionIds[0]) ? null : person.id })
            .select("id")
            .single();
          if (rErr) throw new Error(rErr.message);
          return json({ kind: "response", id: response.id });
        } catch (e) {
          if (e instanceof z.ZodError) {
            return json({ error: "Dados inválidos. Confira nome, email e telefone." }, 400);
          }
          return json({ error: e instanceof Error ? e.message : "erro" }, 500);
        }
      },
    },
  },
});
