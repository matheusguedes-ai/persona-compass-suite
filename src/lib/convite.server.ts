/**
 * #300 — o que o link aberto faz depois de saber QUEM está respondendo.
 *
 * Antes isto vivia inteiro dentro do endpoint público e só servia para
 * cadastro novo. Agora dois caminhos chegam aqui: o cadastro novo (endpoint
 * `/api/public/invite/$id`) e quem já tinha cadastro e entrou na própria
 * conta (`convite.functions.ts`). Os dois precisam do mesmo resultado: as
 * respostas do link criadas para a pessoa — ou, se ela já tinha começado este
 * mesmo teste, a resposta que já existe, retomada em vez de duplicada.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export type LinkAberto = {
  id: string;
  mentor_id: string;
  version_ids: string[];
  group_id: string | null;
  starts_at?: string | null;
  expires_at: string | null;
  is_active: boolean;
  max_responses: number | null;
  response_count: number;
};

export type DestinoDoConvite = { kind: "assessment" | "response"; id: string };

export type MotivoBloqueio = "not_found" | "inactive" | "not_started" | "expired" | "full";

export const MENSAGENS_BLOQUEIO: Record<MotivoBloqueio, string> = {
  not_found: "Link não encontrado.",
  inactive: "Este link foi desativado pelo mentor.",
  // #301 — campanha com período de início: começa a aceitar só na data.
  not_started: "Esta campanha ainda não começou.",
  expired: "Este link expirou. Peça um novo ao seu mentor.",
  full: "Este link já atingiu o número máximo de respostas.",
};

/** Motivo pelo qual o link não aceita mais respostas NOVAS — null quando está aberto. */
export function motivoBloqueio(link: Pick<LinkAberto, "is_active" | "starts_at" | "expires_at" | "max_responses" | "response_count">): MotivoBloqueio | null {
  if (!link.is_active) return "inactive";
  if (link.starts_at && new Date(link.starts_at).getTime() > Date.now()) return "not_started";
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) return "expired";
  if (link.max_responses != null && link.response_count >= link.max_responses) return "full";
  return null;
}

/**
 * O grupo do link, quando o mentor escolheu um ao criar o link. É decisão
 * dele (a tela de criar link oferece o grupo) — o link só repete para quem
 * entra por aqui o que o mentor configurou. Sem grupo no link, nada muda: a
 * pessoa fica sem grupo e sem acesso a nada além deste teste (#297).
 */
export async function colocarNoGrupoDoLink(supabase: Admin, link: LinkAberto, personId: string) {
  if (!link.group_id) return;
  const { error } = await supabase
    .from("group_members")
    .upsert({ group_id: link.group_id, person_id: personId }, { onConflict: "group_id,person_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

/**
 * A resposta deste link que a pessoa já abriu e ainda não entregou, se houver.
 *
 * Sem isto, cada clique no link criava uma bateria nova: na aula de 22/09 há
 * cadastros com duas baterias iguais abertas, uma de cada tentativa.
 * "Deste link" = mesmo conjunto de testes, não o id do link — a resposta não
 * guarda de qual link veio, e uma bateria igual mandada pelo mentor também é
 * a mesma coisa a responder.
 */
export async function respostaAbertaDoConvite(
  supabase: Admin,
  link: LinkAberto,
  personId: string,
): Promise<DestinoDoConvite | null> {
  const agora = new Date().toISOString();
  const valida = (expira: string | null) => !expira || expira > agora;

  if (link.version_ids.length > 1) {
    const { data, error } = await supabase
      .from("assessment_responses")
      .select("id, expires_at, test_responses(version_id)")
      .eq("person_id", personId)
      .eq("mentor_id", link.mentor_id)
      .is("submitted_at", null)
      .is("canceled_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const alvo = [...new Set(link.version_ids)].sort().join(",");
    const achada = (data ?? []).find((a) => {
      if (!valida(a.expires_at)) return false;
      const testes = [...new Set((a.test_responses ?? []).map((t) => t.version_id))].sort().join(",");
      return testes === alvo;
    });
    return achada ? { kind: "assessment", id: achada.id } : null;
  }

  const { data, error } = await supabase
    .from("test_responses")
    .select("id, expires_at")
    .eq("person_id", personId)
    .eq("version_id", link.version_ids[0])
    .eq("kind", "self")
    .is("assessment_response_id", null)
    .is("submitted_at", null)
    .is("canceled_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const achada = (data ?? []).find((r) => valida(r.expires_at));
  return achada ? { kind: "response", id: achada.id } : null;
}

/** Cria as respostas do link para a pessoa: bateria se forem vários testes, avulsa se for um. */
export async function criarRespostasDoConvite(
  supabase: Admin,
  link: LinkAberto,
  personId: string,
): Promise<DestinoDoConvite> {
  const versionIds = link.version_ids;
  // #212 item 5a — mesmo pelo link aberto, teste anônimo não grava quem
  // respondeu. A pessoa se identifica pra ENTRAR (nome/email viram um
  // cadastro), mas o vínculo com a resposta em si não nasce se a versão for
  // anônima.
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
    invite_link_id: link.id,
  };

  if (versionIds.length > 1) {
    const { data: assessment, error: aErr } = await supabase
      .from("assessment_responses")
      .insert({
        mentor_id: link.mentor_id,
        person_id: personId,
        group_id: link.group_id ?? null,
        status: "pending",
        expires_at: link.expires_at,
        invite_link_id: link.id,
      })
      .select("id")
      .single();
    if (aErr) throw new Error(aErr.message);
    const { error: rErr } = await supabase.from("test_responses").insert(
      versionIds.map((version_id, idx) => ({
        ...common,
        version_id,
        person_id: anonimaPorId.get(version_id) ? null : personId,
        assessment_response_id: assessment.id,
        assessment_sort: idx,
      })),
    );
    if (rErr) throw new Error(rErr.message);
    return { kind: "assessment", id: assessment.id };
  }

  const { data: response, error: rErr } = await supabase
    .from("test_responses")
    .insert({ ...common, version_id: versionIds[0], person_id: anonimaPorId.get(versionIds[0]) ? null : personId })
    .select("id")
    .single();
  if (rErr) throw new Error(rErr.message);
  return { kind: "response", id: response.id };
}
