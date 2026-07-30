/**
 * Pontuação e ranking.
 *
 * Peso por esforço, como o Matheus definiu. Responder teste NÃO pontua, por
 * decisão dele — e é a decisão certa: um ranking que sobe quando você responde
 * paga a pessoa para clicar rápido, exatamente o comportamento contra o qual os
 * testes foram reescritos.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const ACOES = {
  aula: { pontos: 20, rotulo: "Concluir uma aula", tetoDiario: null },
  // Encontro presencial do Classroom. Separado de `aula` para o extrato do aluno
  // não misturar "assistiu um vídeo" com "esteve na sala".
  presenca: { pontos: 20, rotulo: "Participar de um encontro presencial", tetoDiario: null },
  devolutiva: { pontos: 15, rotulo: "Participar de uma devolutiva", tetoDiario: null },
  publicar: { pontos: 8, rotulo: "Publicar na comunidade", tetoDiario: 3 },
  perfil: { pontos: 5, rotulo: "Completar o perfil", tetoDiario: null },
  comentar: { pontos: 2, rotulo: "Comentar numa publicação", tetoDiario: 10 },
  curtir: { pontos: 1, rotulo: "Curtir uma publicação", tetoDiario: 20 },
} as const;
export type Acao = keyof typeof ACOES;

/**
 * Dá o ponto, se couber.
 *
 * Silenciosa de propósito: pontuação nunca pode derrubar a ação que a gerou.
 * Se algo falhar aqui, a pessoa publicou do mesmo jeito — só não pontuou.
 *
 * Duas travas: a `referencia` com índice único impede a mesma aula ou a mesma
 * curtida contarem duas vezes (descurtir e curtir de novo não repontua), e o
 * teto diário impede que curtir cem posts vire estratégia de ranking.
 */
export async function darPonto(
  supabase: SupabaseClient<Database>,
  userId: string,
  mentorId: string,
  acao: Acao,
  referencia?: string | null,
): Promise<void> {
  try {
    const cfg = ACOES[acao];
    if (cfg.tetoDiario) {
      const inicioDoDia = new Date();
      inicioDoDia.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("pontos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("acao", acao)
        .gte("created_at", inicioDoDia.toISOString());
      if ((count ?? 0) >= cfg.tetoDiario) return;
    }
    const { error } = await supabase.from("pontos").insert({
      user_id: userId,
      mentor_id: mentorId,
      acao,
      pontos: cfg.pontos,
      referencia: referencia ?? null,
    });
    // Silenciosa NÃO quer dizer cega. 23505 é a trava de repetição funcionando —
    // esperado. Qualquer outro erro precisa aparecer no log: uma ação inteira já
    // passou meses sem pontuar ninguém porque a falha era engolida aqui, e
    // ninguém tinha como descobrir.
    if (error && error.code !== "23505") {
      console.error(`[pontos] ${acao} não gravou para ${userId}: ${error.message}`);
    }
  } catch (e) {
    console.error("[pontos] falha inesperada:", e);
  }
}

/**
 * Tira o ponto de uma ação que deixou de valer.
 *
 * Existe por causa da presença: quem escaneou o QR e foi embora pode ser marcado
 * ausente pelo professor, e se os pontos ficassem, o ranking premiaria
 * exatamente o comportamento que o QR rotativo não consegue impedir. Silenciosa
 * pela mesma razão de `darPonto`.
 */
export async function tirarPonto(
  supabase: SupabaseClient<Database>,
  userId: string,
  acao: Acao,
  referencia: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("pontos")
      .delete()
      .eq("user_id", userId)
      .eq("acao", acao)
      .eq("referencia", referencia);
    if (error) console.error(`[pontos] não deu para tirar ${acao} de ${userId}: ${error.message}`);
  } catch (e) {
    console.error("[pontos] falha inesperada ao tirar ponto:", e);
  }
}

/** A conta sob a qual a pessoa age — o ranking vive dentro dela. */
export async function contaDaPessoa(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase.rpc("acting_account");
  if (data) return data as string;
  const { data: p } = await supabase.from("people").select("mentor_id").eq("user_id", userId).limit(1).maybeSingle();
  return p?.mentor_id ?? null;
}

/**
 * Ranking de um grupo.
 *
 * Visível para o grupo todo, por decisão do Matheus. Só entram os membros do
 * grupo — o dono e os mentores não disputam com os avaliados.
 */
export const rankingDoGrupo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ group_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const { data: membros, error } = await supabase
      .from("group_members")
      .select("person_id, people(full_name, user_id, avatar_url)")
      .eq("group_id", data.group_id);
    if (error) throw new Error(error.message);

    const comConta = (membros ?? []).filter((m) => m.people?.user_id);
    const ids = comConta.map((m) => m.people!.user_id!) as string[];
    const { data: pts } = ids.length
      ? await supabase.from("pontos").select("user_id, pontos, acao").in("user_id", ids)
      : { data: [] as Array<{ user_id: string; pontos: number; acao: string }> };

    const linhas = comConta.map((m) => {
      const meus = (pts ?? []).filter((p) => p.user_id === m.people!.user_id);
      return {
        person_id: m.person_id,
        nome: m.people?.full_name ?? "—",
        avatar_url: m.people?.avatar_url ?? null,
        eu: m.people?.user_id === context.userId,
        total: meus.reduce((a, b) => a + b.pontos, 0),
        acoes: meus.length,
      };
    });

    // Quem ainda não pontuou aparece no fim, não some: o ranking também serve
    // para o mentor ver quem não está engajando.
    linhas.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
    return { ranking: linhas.map((l, i) => ({ ...l, posicao: i + 1 })) };
  });

/** Meus pontos, com o detalhe por ação — o aluno quer saber de onde vieram. */
export const meusPontos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ preview_person_id: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    let userId: string | null = context.userId;
    if (data.preview_person_id) {
      const { data: p } = await supabase
        .from("people").select("user_id").eq("id", data.preview_person_id).maybeSingle();
      userId = p?.user_id ?? null;
    }
    if (!userId) return { total: 0, porAcao: [] };

    const { data: pts } = await supabase.from("pontos").select("acao, pontos").eq("user_id", userId);
    const porAcao = (Object.keys(ACOES) as Acao[]).map((a) => ({
      acao: a,
      rotulo: ACOES[a].rotulo,
      vezes: (pts ?? []).filter((p) => p.acao === a).length,
      total: (pts ?? []).filter((p) => p.acao === a).reduce((s, p) => s + p.pontos, 0),
    })).filter((x) => x.vezes > 0);

    return { total: (pts ?? []).reduce((s, p) => s + p.pontos, 0), porAcao };
  });
