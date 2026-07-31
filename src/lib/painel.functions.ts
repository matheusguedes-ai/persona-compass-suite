/**
 * O panorama do Dashboard: um indicador de cada menu, num lugar só.
 *
 * A ideia do Matheus é abrir o Dashboard e saber o que está acontecendo sem
 * passar menu por menu. Então cada bloco aqui responde a UMA pergunta prática
 * — "a comunidade está viva?" — e não despeja número por despejar.
 *
 * O bloco de mentorias mostrava a fila de devolutiva (quem respondeu teste e
 * ainda não teve conversa) — conceito que não existe mais: mentoria é
 * independente de teste respondido (Fecha #213). Ficam só as contagens
 * diretas (agendadas/realizadas); uma visão mais rica (NPS, duração média)
 * é a Fatia 3, ainda não construída — não é para inventar aqui.
 *
 * Nada aqui inventa: onde não há dado, o número é zero e a tela diz que está
 * zerado. É a mesma regra de honestidade dos relatórios.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function diasDesde(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export const getPanoramaGeral = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;

    // Tudo em paralelo: são consultas independentes e a RLS já recorta cada uma
    // para a conta de quem está pedindo.
    const [
      pessoas, grupos, membros, equipe,
      sessoesMentoria,
      trilhas, aulas, progresso,
      posts, comentarios, pontos,
    ] = await Promise.all([
      supabase.from("people").select("id, full_name, user_id, avatar_url"),
      supabase.from("groups").select("id, name"),
      supabase.from("group_members").select("person_id, group_id"),
      supabase.from("team_members").select("id, kind, status"),
      supabase.from("mentoria_sessoes").select("id, status, quando"),
      supabase.from("learning_tracks").select("id"),
      supabase.from("learning_lessons").select("id"),
      supabase.from("learning_progress").select("user_id, lesson_id, completed_at"),
      supabase.from("community_posts").select("id, created_at"),
      supabase.from("community_comments").select("id, created_at"),
      supabase.from("pontos").select("user_id, pontos, acao"),
    ]);

    // Um erro silenciado aqui viraria "0" na tela, e "0" é uma afirmação —
    // "não tem ninguém esperando" quando na verdade a consulta falhou.
    for (const r of [pessoas, grupos, membros, equipe, sessoesMentoria,
                     trilhas, aulas, progresso, posts, comentarios, pontos]) {
      if (r.error) throw new Error(r.error.message);
    }

    const listaPessoas = pessoas.data ?? [];
    const listaMembros = membros.data ?? [];
    const idsEmGrupo = new Set(listaMembros.map((m) => m.person_id));

    const agora = Date.now();
    const agendadas = (sessoesMentoria.data ?? []).filter(
      (s) => s.status === "agendada" && new Date(s.quando).getTime() >= agora,
    ).length;
    const realizadas = (sessoesMentoria.data ?? []).filter((s) => s.status === "concluida").length;

    // --- Comunidade: movimento recente vale mais que o total -------------
    const seteDias = agora - 7 * 86_400_000;
    const recentes = (as: Array<{ created_at: string }>) =>
      as.filter((x) => new Date(x.created_at).getTime() >= seteDias).length;

    // --- Ranking geral, sem separar por grupo ---------------------------
    // O Matheus pediu explicitamente "independente de grupos": aqui entra todo
    // avaliado com login, mesmo quem não está em grupo nenhum.
    const porUsuario = new Map<string, { total: number; acoes: number }>();
    for (const p of pontos.data ?? []) {
      const at = porUsuario.get(p.user_id) ?? { total: 0, acoes: 0 };
      at.total += p.pontos;
      at.acoes += 1;
      porUsuario.set(p.user_id, at);
    }
    const ranking = listaPessoas
      .filter((p) => p.user_id)
      .map((p) => ({
        person_id: p.id,
        nome: p.full_name,
        avatar_url: p.avatar_url ?? null,
        total: porUsuario.get(p.user_id!)?.total ?? 0,
        acoes: porUsuario.get(p.user_id!)?.acoes ?? 0,
      }))
      // Quem não pontuou fica no fim, mas não some: o ranking também serve
      // para ver quem não está engajando.
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome))
      .slice(0, 10)
      .map((l, i) => ({ ...l, posicao: i + 1 }));

    const { assinarUrls, TTL_AVATAR_SEGUNDOS } = await import("@/lib/storage-assinado.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const avataresRanking = await assinarUrls(supabaseAdmin, ranking.map((l) => l.avatar_url), TTL_AVATAR_SEGUNDOS);
    const rankingAssinado = ranking.map((l, i) => ({ ...l, avatar_url: avataresRanking[i] }));

    const concluidas = (progresso.data ?? []).filter((p) => p.completed_at);

    return {
      pessoas: {
        total: listaPessoas.length,
        comLogin: listaPessoas.filter((p) => p.user_id).length,
        semGrupo: listaPessoas.filter((p) => !idsEmGrupo.has(p.id)).length,
      },
      grupos: {
        total: (grupos.data ?? []).length,
        pessoasEmGrupo: idsEmGrupo.size,
        vazios: (grupos.data ?? []).filter(
          (g) => !listaMembros.some((m) => m.group_id === g.id),
        ).length,
      },
      equipe: {
        ativos: (equipe.data ?? []).filter((t) => t.status === "ativo").length,
        mentores: (equipe.data ?? []).filter((t) => t.status === "ativo" && t.kind === "mentor").length,
      },
      mentorias: {
        agendadas,
        realizadas,
      },
      educacao: {
        trilhas: (trilhas.data ?? []).length,
        aulas: (aulas.data ?? []).length,
        conclusoes: concluidas.length,
        alunosEstudando: new Set((progresso.data ?? []).map((p) => p.user_id)).size,
      },
      comunidade: {
        posts: (posts.data ?? []).length,
        comentarios: (comentarios.data ?? []).length,
        posts7: recentes(posts.data ?? []),
        comentarios7: recentes(comentarios.data ?? []),
      },
      ranking: rankingAssinado,
      // Serve para a tela dizer "ninguém pontuou ainda" em vez de desenhar um
      // ranking em que todo mundo tem zero e a ordem é só alfabética.
      alguemPontuou: (pontos.data ?? []).length > 0,
    };
  });
