import { mensagemDeErro } from "@/lib/erro-legivel";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { loadBrandAndSettings } from "@/lib/brand.server";
import { motivoDeSuspeita, normalizarEmail, type MotivoSuspeita } from "@/lib/duplicidade";
import {
  colocarNoGrupoDoLink, criarRespostasDoConvite, MENSAGENS_BLOQUEIO, motivoBloqueio, type LinkAberto,
} from "@/lib/convite.server";

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
  // #300 — a pessoa respondeu "não, é meu primeiro cadastro" à pergunta de
  // identidade. Só pula a PERGUNTA: o servidor refaz a busca de qualquer
  // jeito e registra a suspeita para o mentor.
  confirmacao: z.literal("sou_novo").optional(),
});

const JOIN_FIELD_LABELS = { full_name: "Nome", email: "Email", phone: "Telefone" };

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
            .select("id, title, version_ids, starts_at, expires_at, max_responses, response_count, is_active, mentor_id")
            .eq("id", params.id)
            .maybeSingle();
          if (!link) return json({ error: "not_found", message: MENSAGENS_BLOQUEIO.not_found }, 404);

          const reason = motivoBloqueio(link);
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
            message: reason ? MENSAGENS_BLOQUEIO[reason] : null,
          });
        } catch (e) {
          return json({ error: mensagemDeErro(e) }, 500);
        }
      },

      /**
       * A pessoa se identifica e ganha as respostas para preencher.
       *
       * #300 — antes de criar QUALQUER coisa, e antes de gastar vaga, este
       * handler descobre quem está chegando. Na aula de 22/09 a turma inteira
       * já tinha cadastro, e o link falhava de duas formas:
       *
       *   A. mesmo e-mail → o INSERT batia no e-mail único da conta e a pessoa
       *      recebia o erro cru do banco, sem caminho nenhum. Agora a resposta
       *      é `ja_cadastrado`, e a tela oferece entrar na conta.
       *   B. outro e-mail → virava cadastro NOVO, com as respostas penduradas
       *      numa pessoa paralela. Agora, se o telefone ou o nome batem com
       *      alguém da mesma conta, a resposta é `confirmar_identidade` e a
       *      tela pergunta à própria pessoa.
       *
       * ⚠️ Nenhuma das duas respostas diz QUEM foi encontrado: nem nome, nem
       * e-mail, nem quantos. A tela fala com quem está ali, não revela
       * terceiros.
       */
      POST: async ({ request, params }) => {
        try {
          const body = joinSchema.parse(await request.json());
          const supabase = await getAdmin();

          const { data: link } = await supabase
            .from("invite_links")
            .select("*")
            .eq("id", params.id)
            .maybeSingle();
          if (!link) return json({ error: "not_found", message: MENSAGENS_BLOQUEIO.not_found }, 404);

          // Checagem antecipada só para dar mensagem melhor; quem decide é o claim.
          const early = motivoBloqueio(link);
          if (early) return json({ error: early, message: MENSAGENS_BLOQUEIO[early] }, 410);

          const { data: daConta, error: dcErr } = await supabase
            .from("people")
            .select("id, full_name, email, phone")
            .eq("mentor_id", link.mentor_id);
          if (dcErr) throw new Error(dcErr.message);

          // Falha A: o e-mail já é de alguém desta conta.
          const email = normalizarEmail(body.email);
          if ((daConta ?? []).some((p) => normalizarEmail(p.email) === email)) {
            return json({ situacao: "ja_cadastrado" });
          }

          // Falha B: e-mail novo, mas telefone ou nome de quem já existe.
          const suspeitos = (daConta ?? [])
            .map((p) => ({ id: p.id, motivo: motivoDeSuspeita(body, p) }))
            .filter((s): s is { id: string; motivo: MotivoSuspeita } => s.motivo !== null);
          if (suspeitos.length > 0 && body.confirmacao !== "sou_novo") {
            return json({ situacao: "confirmar_identidade" });
          }

          // Só agora reserva a vaga — de forma atômica: cliques simultâneos
          // não furam o limite. Antes a reserva vinha primeiro, e cada
          // tentativa que dava erro gastava uma vaga à toa.
          const { data: claimed, error: claimErr } = await supabase.rpc("claim_invite_link", {
            link_id: params.id,
          });
          if (claimErr) throw new Error(claimErr.message);
          if (!claimed || claimed.length === 0) {
            return json({ error: "full", message: MENSAGENS_BLOQUEIO.full }, 410);
          }

          const devolverVaga = async () => {
            const { error } = await supabase.rpc("release_invite_link", { link_id: params.id });
            if (error) console.error("[convite] não consegui devolver a vaga:", error.message);
          };

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
          if (pErr) {
            await devolverVaga();
            // Corrida: o mesmo e-mail foi cadastrado entre a checagem e o INSERT.
            if (pErr.code === "23505") return json({ situacao: "ja_cadastrado" });
            throw new Error(pErr.message);
          }

          if (suspeitos.length > 0) {
            // Informação para o mentor, não condição para responder: se a
            // suspeita não gravar, a pessoa segue, e o erro vai para o log.
            // Derrubar aqui deixaria um cadastro criado sem resposta nenhuma.
            const { error: sErr } = await supabase.from("suspeitas_duplicidade").insert(
              suspeitos.map((s) => ({
                mentor_id: link.mentor_id,
                pessoa_nova_id: person.id,
                pessoa_existente_id: s.id,
                motivo: s.motivo,
                invite_link_id: link.id,
              })),
            );
            if (sErr) console.error("[convite] suspeita de duplicidade não gravou:", sErr.message);
          }

          try {
            await colocarNoGrupoDoLink(supabase, link as LinkAberto, person.id);
            return json(await criarRespostasDoConvite(supabase, link as LinkAberto, person.id));
          } catch (e) {
            await devolverVaga();
            throw e;
          }
        } catch (e) {
          if (e instanceof z.ZodError) {
            return json({ error: mensagemDeErro(e, JOIN_FIELD_LABELS) }, 400);
          }
          // Endpoint público: erro inesperado nunca vira texto cru do banco na
          // tela de quem está respondendo (era o sintoma da falha A). O
          // detalhe fica no log.
          console.error("[convite] falha inesperada:", e);
          return json({ error: "Não foi possível continuar agora. Tente de novo em instantes." }, 500);
        }
      },
    },
  },
});
