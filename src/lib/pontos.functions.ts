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

/** As ações que dependem só de mexer no celular, sem sair do lugar. */
const ACOES_DA_COMUNIDADE: Acao[] = ["publicar", "comentar", "curtir"];

/**
 * Teto do que a comunidade rende por dia, somando publicar, comentar e curtir.
 *
 * Os tetos por ação, sozinhos, deixavam um dia de comunidade valer mais que ir
 * à aula: 3 publicações são 24 pontos, contra 20 de atravessar a cidade para um
 * encontro presencial. O ranking dizia, na única tela que a turma inteira vê,
 * que postar vale mais que aparecer — e "fui a todas as aulas e estou em
 * último" é uma reclamação legítima.
 *
 * 16 é escolhido para caber DUAS publicações no dia (8 + 8) e ainda ficar
 * abaixo de um encontro presencial. Cortar em 15 faria a segunda publicação do
 * dia valer zero — punição estranha para quem publica duas vezes, e a pessoa não
 * teria como entender por quê. Os pesos de cada ação continuam como o Matheus
 * definiu; o que entra é a ordem entre os dois mundos.
 */
export const TETO_COMUNIDADE_DIA = 16;

/**
 * Meia-noite de Brasília, e não a do servidor.
 *
 * `setHours(0,0,0,0)` num servidor em UTC faz o "dia" do teto virar às 21h no
 * Brasil: quem publica às 21h30 recomeça a cota, e quem publica às 20h perde
 * a dele mais cedo.
 */
function inicioDoDiaBr(): string {
  const agora = new Date();
  const hojeBr = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(agora);
  // -03:00 é o horário do Brasil o ano todo desde o fim do horário de verão.
  return new Date(`${hojeBr}T00:00:00-03:00`).toISOString();
}

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
    const desde = inicioDoDiaBr();
    if (cfg.tetoDiario) {
      const { count } = await supabase
        .from("pontos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("acao", acao)
        .gte("created_at", desde);
      if ((count ?? 0) >= cfg.tetoDiario) return;
    }
    // Teto somado da comunidade, por cima dos tetos de cada ação.
    if (ACOES_DA_COMUNIDADE.includes(acao)) {
      const { data: hoje } = await supabase
        .from("pontos")
        .select("pontos, acao")
        .eq("user_id", userId)
        .gte("created_at", desde);
      const soma = (hoje ?? [])
        .filter((p) => ACOES_DA_COMUNIDADE.includes(p.acao as Acao))
        .reduce((s, p) => s + p.pontos, 0);
      if (soma + cfg.pontos > TETO_COMUNIDADE_DIA) return;
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

/**
 * A conta sob a qual a pessoa age — o ranking vive dentro dela.
 *
 * A ordem importa, e estava invertida: `acting_account()` é
 * `COALESCE(team_members.owner_id, auth.uid())` e **nunca devolve nulo**, então
 * o desvio para `people` era código morto. Para o ALUNO, que não está em
 * `team_members`, ela devolvia o id do próprio aluno — e o ponto nascia com
 * `mentor_id` apontando para ele mesmo.
 *
 * O efeito seria invisível até doer: o ranking do grupo e o extrato filtram por
 * `mentor_id = acting_account()`, então o mentor abriria a tela e veria zero
 * enquanto o aluno via os pontos dele. Dois números para o mesmo fato.
 *
 * Agora `people` vem primeiro: a conta de alguém é a que tem o cadastro dele.
 * Quem não tem cadastro de pessoa (colaborador puro) cai em `acting_account()`,
 * que é a resposta certa para esse caso.
 */
export async function contaDaPessoa(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  // Ordenado por `created_at`: quem está cadastrado em duas contas cairia num
  // ranking ou noutro conforme o humor do planejador de consultas.
  const { data: p } = await supabase
    .from("people")
    .select("mentor_id, created_at")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (p?.mentor_id) return p.mentor_id;

  const { data } = await supabase.rpc("acting_account");
  return (data as string) ?? null;
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

    // A conta dona do grupo. O ranking é DELA: quem está cadastrado em duas
    // contas não pode trazer para cá os pontos que ganhou na outra.
    const { data: grupo } = await supabase
      .from("groups").select("mentor_id").eq("id", data.group_id).maybeSingle();

    const comConta = (membros ?? []).filter((m) => m.people?.user_id);
    const ids = comConta.map((m) => m.people!.user_id!) as string[];
    // Sem o dono do grupo em mãos, não filtra por conta em vez de filtrar por
    // string vazia — um uuid inválido derrubaria a tela inteira do ranking.
    const { data: pts } = ids.length
      ? await (grupo?.mentor_id
          ? supabase.from("pontos").select("user_id, pontos, acao")
              .in("user_id", ids).eq("mentor_id", grupo.mentor_id)
          : supabase.from("pontos").select("user_id, pontos, acao").in("user_id", ids))
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
    const comPosicao = linhas.map((l, i) => ({ ...l, posicao: i + 1 }));

    const { assinarUrls, TTL_AVATAR_SEGUNDOS } = await import("@/lib/storage-assinado.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const avatares = await assinarUrls(supabaseAdmin, comPosicao.map((l) => l.avatar_url), TTL_AVATAR_SEGUNDOS);
    return { ranking: comPosicao.map((l, i) => ({ ...l, avatar_url: avatares[i] })) };
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

    // Escopado na mesma conta do ranking: o extrato tem de fechar com a posição
    // que a pessoa vê no grupo. Sem isto, quem está em duas contas somaria aqui
    // pontos que não contam lá, e os dois números discordariam na mesma tela.
    const conta = await contaDaPessoa(supabase, userId);
    let q = supabase.from("pontos").select("acao, pontos").eq("user_id", userId);
    if (conta) q = q.eq("mentor_id", conta);
    const { data: pts } = await q;
    const porAcao = (Object.keys(ACOES) as Acao[]).map((a) => ({
      acao: a,
      rotulo: ACOES[a].rotulo,
      vezes: (pts ?? []).filter((p) => p.acao === a).length,
      total: (pts ?? []).filter((p) => p.acao === a).reduce((s, p) => s + p.pontos, 0),
    })).filter((x) => x.vezes > 0);

    return { total: (pts ?? []).reduce((s, p) => s + p.pontos, 0), porAcao };
  });
