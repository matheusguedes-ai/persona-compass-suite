/**
 * O panorama do Dashboard: um indicador de cada menu, num lugar só (#237).
 *
 * A ideia do Matheus é abrir o Dashboard e saber o que está acontecendo sem
 * passar menu por menu. Então cada bloco aqui responde a UMA pergunta prática
 * — "a comunidade está viva?" — e não despeja número por despejar.
 *
 * ⚠️ CADA UM VÊ SÓ O QUE PODE ABRIR — checado no SERVIDOR, não só escondido na
 * tela. `getPanoramaGeral` cobre pessoas/grupos/equipe/ranking, que sempre
 * foram gerais. Classroom, Academy, Comunidade e o bloco de engajamento viraram
 * funções PRÓPRIAS, cada uma com sua checagem de permissão — quem chamar
 * qualquer uma sem a permissão certa é recusado, não recebe um card vazio.
 * Sem esse recorte o Dashboard vira a porta dos fundos que mostra em número o
 * que as outras telas passaram 48 horas aprendendo a esconder.
 *
 * MENTORIAS FICOU DE FORA desta entrega (decisão do Matheus, 05/08): a Fatia 3
 * (#229) ainda vai construir satisfação média, duração média e quantas faltam
 * agendar — calcular aqui também faria um dos dois mentir no dia em que uma
 * conta mudasse. O card entra na #270, quando a #229 já tiver os números.
 *
 * Nada aqui inventa: onde não há dado, o número é zero e a tela diz que está
 * zerado. É a mesma regra de honestidade dos relatórios.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissao, exigirVisitante } from "@/lib/permissao.server";
import { contaComoPresenca, type Situacao } from "@/lib/presenca";

export const getPanoramaGeral = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;

    // Tudo em paralelo: são consultas independentes e a RLS já recorta cada uma
    // para a conta de quem está pedindo.
    const [
      pessoas, grupos, membros, equipe,
      posts, comentarios, pontos,
    ] = await Promise.all([
      supabase.from("people").select("id, full_name, user_id, avatar_url"),
      supabase.from("groups").select("id, name"),
      supabase.from("group_members").select("person_id, group_id"),
      supabase.from("team_members").select("id, kind, status"),
      supabase.from("community_posts").select("id, created_at"),
      supabase.from("community_comments").select("id, created_at"),
      supabase.from("pontos").select("user_id, pontos, acao"),
    ]);

    // Um erro silenciado aqui viraria "0" na tela, e "0" é uma afirmação —
    // "não tem ninguém esperando" quando na verdade a consulta falhou.
    for (const r of [pessoas, grupos, membros, equipe, posts, comentarios, pontos]) {
      if (r.error) throw new Error(r.error.message);
    }

    const listaPessoas = pessoas.data ?? [];
    const listaMembros = membros.data ?? [];
    const idsEmGrupo = new Set(listaMembros.map((m) => m.person_id));

    const agora = Date.now();

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

/**
 * Resumo do Classroom para o Dashboard.
 *
 * Presencial, "menu do master" (mesma decisão de app-sidebar.tsx: `soDono:
 * true`) — nenhum colaborador administra treinamento, com ou sem a permissão
 * `educacao` (essa é de Academy, coisa diferente). `exigirVisitante` barra
 * qualquer colaborador; dono sempre passa.
 */
export const getResumoClassroom = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirVisitante(context.supabase, context.userId);
    const supabase = context.supabase;
    const agora = new Date();

    const { data: aulas, error } = await supabase
      .from("treinamento_aulas")
      .select("id, titulo, comeca_em, cancelada, fechada_em")
      .eq("cancelada", false)
      .not("comeca_em", "is", null)
      .order("comeca_em", { ascending: true });
    if (error) throw new Error(error.message);

    const todas = aulas ?? [];
    const agoraIso = agora.toISOString();

    const proxima = todas.find((a) => a.comeca_em! >= agoraIso) ?? null;

    // Última aula já FECHADA (o professor confirmou a lista) — é a que tem
    // presença para mostrar; aula sem lista fechada ainda não tem resposta certa.
    const fechadas = todas.filter((a) => a.comeca_em! < agoraIso && a.fechada_em);
    const ultimaFechada = fechadas.length > 0 ? fechadas[fechadas.length - 1] : null;

    async function presencaDe(aulaIds: string[]): Promise<{ presentes: number; total: number }> {
      if (aulaIds.length === 0) return { presentes: 0, total: 0 };
      const { data: presencas, error: eP } = await supabase
        .from("treinamento_presencas")
        .select("situacao")
        .in("aula_id", aulaIds);
      if (eP) throw new Error(eP.message);
      const lista = presencas ?? [];
      return {
        total: lista.length,
        presentes: lista.filter((p) => contaComoPresenca((p.situacao ?? "ausente") as Situacao)).length,
      };
    }

    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
    const aulasDoMes = fechadas.filter((a) => a.comeca_em! >= inicioMes).map((a) => a.id);

    const [presencaUltima, frequenciaMes] = await Promise.all([
      ultimaFechada ? presencaDe([ultimaFechada.id]) : Promise.resolve(null),
      presencaDe(aulasDoMes),
    ]);

    return {
      proxima: proxima ? { titulo: proxima.titulo, comeca_em: proxima.comeca_em } : null,
      presencaUltima,
      frequenciaMes: aulasDoMes.length > 0 ? frequenciaMes : null,
    };
  });

/**
 * Resumo da Academy para o Dashboard. Permissão `educacao` — mesma tecla do
 * menu (app-sidebar.tsx).
 */
export const getResumoAcademy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPermissao(context.supabase, context.userId, "educacao");
    const supabase = context.supabase;

    const { data: progresso, error } = await supabase
      .from("learning_progress")
      .select("user_id, completed_at");
    if (error) throw new Error(error.message);

    const lista = progresso ?? [];
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const inicioMesIso = inicioMes.toISOString();

    return {
      // "Em andamento" = já concluiu ao menos uma aula — não distingue de quem
      // já terminou a trilha inteira (isso exigiria contar aula por trilha);
      // é a mesma definição que o painel já usava para "estudando".
      pessoasEmTrilha: new Set(lista.map((p) => p.user_id)).size,
      conclusoesNoMes: lista.filter((p) => p.completed_at >= inicioMesIso).length,
    };
  });

/**
 * Resumo da Comunidade para o Dashboard. Permissão `grupos` — mesma tecla do
 * menu lateral (Comunidades usa `perm: "grupos"` em app-sidebar.tsx).
 */
export const getResumoComunidade = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPermissao(context.supabase, context.userId, "grupos");
    const supabase = context.supabase;
    const seteDiasAtras = new Date(Date.now() - 7 * 86_400_000).toISOString();

    const [posts, comentarios] = await Promise.all([
      supabase.from("community_posts").select("author_id, created_at").gte("created_at", seteDiasAtras),
      supabase.from("community_comments").select("author_id, created_at").gte("created_at", seteDiasAtras),
    ]);
    if (posts.error) throw new Error(posts.error.message);
    if (comentarios.error) throw new Error(comentarios.error.message);

    const participantes = new Set([
      ...(posts.data ?? []).map((p) => p.author_id),
      ...(comentarios.data ?? []).map((c) => c.author_id),
    ]);

    return {
      postsNaSemana: (posts.data ?? []).length,
      participantes: participantes.size,
    };
  });

/** Uma pessoa sumindo, e o que ela tem pendente. */
export type PessoaSumindo = {
  person_id: string;
  nome: string;
  /** null = nenhum sinal de atividade encontrado (sempre esteve assim, não "há N dias"). */
  diasSemAtividade: number | null;
  temTestePendente: boolean;
};

/**
 * O bloco de engajamento (#220, absorvida aqui): quem está sumindo, antes de
 * virar perda.
 *
 * Critério: sem NENHUMA atividade há mais de 14 dias — login, resposta de
 * teste, presença em aula, progresso em trilha, mentoria concluída. Só dono
 * (`exigirVisitante`): a lista cruza dado de todo mundo, de todas as áreas —
 * nenhuma permissão de funcionalidade sozinha justificaria ver isto.
 *
 * ⚠️ Login entra via `auth.admin.getUserById`, uma chamada por pessoa COM
 * conta — aceitável sem cache na escala de hoje (poucas pessoas), pela mesma
 * razão que o resto do Dashboard não usa cache: reversível depois.
 */
export const getResumoEngajamento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirVisitante(context.supabase, context.userId);
    const supabase = context.supabase;

    const [pessoas, respostas, presencas, progresso, sessoes] = await Promise.all([
      supabase.from("people").select("id, full_name, user_id"),
      supabase.from("test_responses").select("person_id, submitted_at").eq("kind", "self"),
      supabase.from("treinamento_presencas").select("person_id, escaneado_em, registrado_em"),
      supabase.from("learning_progress").select("user_id, completed_at"),
      supabase.from("mentoria_sessoes")
        .select("status, quando, mentorias(person_id)")
        .eq("status", "concluida"),
    ]);
    for (const r of [pessoas, respostas, presencas, progresso, sessoes]) {
      if (r.error) throw new Error(r.error.message);
    }

    const listaPessoas = pessoas.data ?? [];
    if (listaPessoas.length === 0) return { pessoas: [] as PessoaSumindo[], totalPessoas: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ultimaAtividade = new Map<string, number>();
    const marcar = (personId: string | null | undefined, ms: number | null) => {
      if (!personId || ms === null || Number.isNaN(ms)) return;
      const atual = ultimaAtividade.get(personId) ?? -Infinity;
      if (ms > atual) ultimaAtividade.set(personId, ms);
    };

    // Login — só quem tem conta. Falha isolada (usuário removido, token
    // interno indisponível) não derruba o bloco inteiro: essa pessoa só fica
    // sem o sinal de login, os outros quatro continuam valendo.
    await Promise.all(
      listaPessoas.filter((p) => p.user_id).map(async (p) => {
        try {
          const { data } = await supabaseAdmin.auth.admin.getUserById(p.user_id!);
          const t = data?.user?.last_sign_in_at;
          if (t) marcar(p.id, new Date(t).getTime());
        } catch {
          // sem sinal de login para esta pessoa — os outros quatro decidem.
        }
      }),
    );

    for (const r of respostas.data ?? []) {
      if (r.submitted_at) marcar(r.person_id, new Date(r.submitted_at).getTime());
    }
    for (const p of presencas.data ?? []) {
      const t = p.escaneado_em ?? p.registrado_em;
      if (t) marcar(p.person_id, new Date(t).getTime());
    }
    const personIdPorUserId = new Map(
      listaPessoas.filter((p) => p.user_id).map((p) => [p.user_id!, p.id]),
    );
    for (const pr of progresso.data ?? []) {
      if (!pr.completed_at) continue;
      const personId = personIdPorUserId.get(pr.user_id);
      marcar(personId, new Date(pr.completed_at).getTime());
    }
    for (const s of sessoes.data ?? []) {
      const personId = (s.mentorias as unknown as { person_id: string } | null)?.person_id;
      marcar(personId, new Date(s.quando).getTime());
    }

    const pendentes = new Set(
      (respostas.data ?? []).filter((r) => !r.submitted_at).map((r) => r.person_id),
    );

    const agora = Date.now();
    const sumindo: PessoaSumindo[] = listaPessoas
      .map((p) => {
        const ultima = ultimaAtividade.get(p.id);
        return {
          person_id: p.id,
          nome: p.full_name,
          diasSemAtividade: ultima !== undefined ? Math.floor((agora - ultima) / 86_400_000) : null,
          temTestePendente: pendentes.has(p.id),
        };
      })
      .filter((p) => p.diasSemAtividade === null || p.diasSemAtividade >= 14)
      // Sem sinal nenhum (null) vai pro topo — "sumida" é mais forte que "sumindo há N dias".
      .sort((a, b) => (b.diasSemAtividade ?? Infinity) - (a.diasSemAtividade ?? Infinity));

    return { pessoas: sumindo, totalPessoas: listaPessoas.length };
  });
