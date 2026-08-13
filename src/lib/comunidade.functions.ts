/**
 * Comunidade do grupo.
 *
 * Um feed por grupo, não da plataforma. Quem lê e quem escreve são as pessoas
 * daquele grupo — avaliados, mentores afiliados atribuídos a ele e o dono da
 * conta. É o que torna a comunidade utilizável numa empresa cliente: o grupo do
 * RH da Empresa A não se mistura com o da Empresa B.
 *
 * Quem enxerga o quê é decidido pela RLS (`posso_ver_grupo`, na migração
 * `20260729180000_comunidade.sql`). Aqui só monta o que a tela precisa.
 *
 * Por decisão do Matheus, resultado de teste NÃO entra: texto, imagem, PDF e
 * link. Publicar perfil comportamental entre colegas tem risco próprio e ficou
 * para depois.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissao, exigirPermissaoOuVisitante } from "@/lib/permissao.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { darPonto, contaDaPessoa } from "@/lib/pontos.functions";
import { notificar } from "@/lib/notificacoes.functions";
import { extrairMencoes, textoSemMarcacao } from "@/lib/mencoes";

/**
 * Grupos do lado da EQUIPE — os grupos da conta. Usado pelo menu Comunidades
 * do dono, que enxerga todos e escolhe o destino ao publicar.
 */
export const meusGrupos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPermissao(context.supabase, context.userId, "grupos");
    const { data, error } = await context.supabase.from("groups").select("id, name").order("name");
    if (error) throw new Error(error.message);
    return { grupos: data ?? [] };
  });

/**
 * Grupos do lado do AVALIADO — só aqueles em que ele é membro.
 *
 * Precisa ser separado do de cima. Na prévia "Ver como aluno" quem está
 * autenticado continua sendo o DONO, e a busca por `groups` devolveria os
 * grupos da conta inteira — a tela do aluno mostrava uma comunidade que ele
 * não tem, com o campo de publicar aberto. `preview_person_id` resolve: em
 * prévia, valem os grupos daquela pessoa.
 */
export const gruposDoAvaliado = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ preview_person_id: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    let ids: string[];
    if (data.preview_person_id) {
      // A RLS de `group_members` já barra pessoa de fora da conta.
      const { data: v, error } = await supabase
        .from("group_members").select("group_id").eq("person_id", data.preview_person_id);
      if (error) throw new Error(error.message);
      ids = (v ?? []).map((x) => x.group_id);
    } else {
      const { data: v, error } = await supabase.rpc("meus_grupos_como_avaliado");
      if (error) throw new Error(error.message);
      ids = (v ?? []) as unknown as string[];
    }
    if (ids.length === 0) return { grupos: [] };
    const { data: gs } = await supabase.from("groups").select("id, name").in("id", ids).order("name");
    return { grupos: gs ?? [] };
  });

export const listarFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ group_ids: z.array(z.string().uuid()).optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    // Compartilhada com aluno e mentor (o feed deles). Só falta barrar o
    // colaborador sem 'grupos', que hoje entra pela mesma porta da equipe —
    // `posso_ver_grupo()` libera qualquer colaborador da conta, sem checar
    // permissão nenhuma.
    await exigirPermissaoOuVisitante(supabase, context.userId, "grupos");

    // Sem filtro, vem tudo que a pessoa pode ver — que é o feed integrado: quem
    // está em três grupos vê os três juntos, quem está em um vê só o dele. A
    // RLS já faz esse recorte, então aqui não há regra de visibilidade nenhuma.
    let q = supabase
      .from("community_post_groups")
      .select("post_id, group_id, groups(name)");
    if (data.group_ids?.length) q = q.in("group_id", data.group_ids);
    const { data: vinculos, error: eV } = await q;
    if (eV) throw new Error(eV.message);

    const ids = [...new Set((vinculos ?? []).map((v) => v.post_id))];
    if (ids.length === 0) return { eu: context.userId, posts: [] };

    const [{ data: posts, error }, { data: comentarios }, { data: reacoes }, { data: opcoes }, { data: votos }] = await Promise.all([
      supabase.from("community_posts")
        .select("id, author_id, author_name, body, file_url, file_kind, link_url, created_at")
        .in("id", ids).order("created_at", { ascending: false }).limit(80),
      supabase.from("community_comments")
        .select("id, post_id, author_id, author_name, body, created_at")
        .in("post_id", ids).order("created_at"),
      supabase.from("community_reactions").select("post_id, user_id").in("post_id", ids),
      // Enquete (#54): as opções aparecem para todo mundo que vê o post; o
      // RESULTADO (linha abaixo) só é lido de verdade se eu já votei — a RLS
      // de community_poll_votes barra o resto, então nem tentar filtrar aqui.
      supabase.from("community_poll_options")
        .select("id, post_id, texto").in("post_id", ids).order("ordem"),
      supabase.from("community_poll_votes")
        .select("post_id, option_id, voter_id, voter_name").in("post_id", ids),
    ]);
    // Quem modera o quê é decidido no banco, não aqui — a tela só pergunta.
    const podeModerar = new Set<string>();
    await Promise.all(ids.map(async (id) => {
      const { data: ok } = await (supabase.rpc as never as (n: string, a: unknown) => Promise<{ data: boolean | null }>)("posso_moderar_post", { p_post: id });
      if (ok) podeModerar.add(id);
    }));
    if (error) throw new Error(error.message);

    const listaPosts = posts ?? [];
    const { assinarUrls, TTL_ARQUIVO_SEGUNDOS } = await import("@/lib/storage-assinado.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const arquivosAssinados = await assinarUrls(
      supabaseAdmin, listaPosts.map((p) => p.file_url), TTL_ARQUIVO_SEGUNDOS,
    );

    const eu = context.userId;
    return {
      eu,
      posts: listaPosts.map((p, i) => {
        // Enquete (#54): opções e votos deste post, se houver.
        const opcoesDoPost = (opcoes ?? []).filter((o) => o.post_id === p.id);
        const votosDoPost = (votos ?? []).filter((v) => v.post_id === p.id);
        const meuVoto = votosDoPost.find((v) => v.voter_id === eu)?.option_id ?? null;
        const enquete = opcoesDoPost.length === 0 ? null : {
          opcoes: opcoesDoPost.map((o) => ({ id: o.id, texto: o.texto })),
          totalVotos: votosDoPost.length,
          meuVoto,
          // Regra de honestidade (#54): sem meu voto, nem contagem nem quem
          // votou saem daqui — a RLS já barra a leitura das linhas alheias,
          // isto só evita montar um objeto de resultado vazio/enganoso.
          resultado: !meuVoto ? null : opcoesDoPost.map((o) => {
            const doOpcao = votosDoPost.filter((v) => v.option_id === o.id);
            return {
              id: o.id,
              contagem: doOpcao.length,
              porcentagem: votosDoPost.length === 0
                ? 0 : Math.round((doOpcao.length / votosDoPost.length) * 100),
              votantes: doOpcao.map((v) => v.voter_name),
            };
          }),
        };
        return {
          ...p,
          file_url: arquivosAssinados[i],
          meu: p.author_id === eu,
          // Só aparece lixeira em post alheio para quem realmente pode moderar.
          modero: podeModerar.has(p.id),
          // Em qual grupo aparece — só faz diferença para quem enxerga vários.
          grupos: (vinculos ?? []).filter((v) => v.post_id === p.id)
            .map((v) => v.groups?.name).filter((n): n is string => !!n),
          // Os ids dos mesmos grupos — de onde a menção com @ no comentário
          // busca quem pode ser marcado (#55).
          group_ids: (vinculos ?? []).filter((v) => v.post_id === p.id).map((v) => v.group_id),
          comentarios: (comentarios ?? []).filter((c) => c.post_id === p.id)
            .map((c) => ({ ...c, meu: c.author_id === eu })),
          curtidas: (reacoes ?? []).filter((r) => r.post_id === p.id).length,
          curti: (reacoes ?? []).some((r) => r.post_id === p.id && r.user_id === eu),
          enquete,
        };
      }),
    };
  });

/**
 * Nome que aparece no post, congelado na publicação — ver a migração.
 *
 * Procura primeiro no perfil (dono e equipe) e depois no cadastro de avaliado.
 * A mesma pessoa pode ser as duas coisas; o perfil ganha por ser o que ela
 * mesma editou.
 */
async function meuNome(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  // 1. O perfil, que é o nome que a própria pessoa editou.
  const { data: perfil } = await supabase.from("profiles").select("full_name").eq("user_id", userId).maybeSingle();
  if (perfil?.full_name?.trim()) return perfil.full_name.trim();

  // 2. O nome da conta de acesso — vem do Google ou do cadastro. É o mesmo que
  //    a barra lateral mostra, então bate com o que a pessoa espera ver.
  const { data: sessao } = await supabase.auth.getUser();
  const meta = sessao.user?.user_metadata as { full_name?: string; name?: string } | undefined;
  const doLogin = meta?.full_name?.trim() || meta?.name?.trim();
  if (doLogin) return doLogin;

  // 3. Só então o cadastro de avaliado. Vem por último de propósito: o dono da
  //    conta pode estar cadastrado como avaliado para testar, e aí publicava
  //    com o nome do cadastro de teste em vez do nome dele.
  const { data: pessoa } = await supabase.from("people").select("full_name").eq("user_id", userId).limit(1).maybeSingle();
  return pessoa?.full_name?.trim() || "Participante";
}

/**
 * Avisa quem foi marcado com @ num post ou comentário — uma notificação por
 * pessoa, mesmo que ela apareça duas vezes no texto (Set) e nunca para quem
 * se marcou (auto-menção não notifica, por pedido da #55).
 *
 * Não confia na marcação do texto por si só: confere no banco que a pessoa
 * marcada REALMENTE está num dos grupos do post/comentário antes de avisar.
 * Sem isto, um texto malicioso poderia forjar `@[Nome](id-de-qualquer-um)` e
 * usar a notificação como sonda — "essa pessoa existe? recebeu algo?" — para
 * gente de fora do grupo. A listinha (cliente) já só mostra quem é do grupo;
 * isto é o mesmo corte, mas no servidor, que é o que vale de verdade.
 */
async function notificarMencoes(
  supabase: SupabaseClient<Database>,
  args: {
    conta: string;
    autorUserId: string;
    autorNome: string;
    texto: string;
    groupIds: string[];
    postId: string;
    origem: "post" | "comentario";
  },
): Promise<void> {
  const mencoes = extrairMencoes(args.texto);
  if (mencoes.length === 0 || args.groupIds.length === 0) return;
  const idsMencionados = [...new Set(mencoes.map((m) => m.personId))];

  const { data: validos } = await supabase
    .from("group_members")
    .select("person_id, people(user_id)")
    .in("group_id", args.groupIds)
    .in("person_id", idsMencionados);

  const alvos = new Set<string>();
  for (const v of validos ?? []) {
    const uid = v.people?.user_id;
    if (uid && uid !== args.autorUserId) alvos.add(uid);
  }
  if (alvos.size === 0) return;

  const corpo = textoSemMarcacao(args.texto).trim().slice(0, 140);
  const titulo = args.origem === "post"
    ? `${args.autorNome} marcou você numa publicação`
    : `${args.autorNome} marcou você num comentário`;

  await Promise.all([...alvos].map((uid) =>
    notificar(supabase, {
      conta: args.conta,
      tipo: "comunidade_mencao",
      titulo,
      corpo,
      // Aponta para o post específico — /comunidades já sabe abrir nele (#55).
      link: `/comunidades?post=${args.postId}`,
      ator: args.autorUserId,
      atorNome: args.autorNome,
      grupos: args.groupIds,
      pessoaUser: uid,
      // false de propósito: só quem foi marcado recebe, não o grupo inteiro
      // (isso já é o que a notificação de "fulano publicou" faz).
      paraAlunos: false,
    }),
  ));
}

export const publicarPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      group_ids: z.array(z.string().uuid()).min(1),
      body: z.string().min(1).max(4000),
      file_url: z.string().url().nullable().optional(),
      file_kind: z.enum(["imagem", "pdf"]).nullable().optional(),
      link_url: z.string().url().max(600).nullable().optional(),
      // Enquete (#54): a pergunta é o próprio `body` — 2 a 6 opções de texto.
      // Sem enquete, o campo nem vem no payload.
      poll_options: z.array(z.string().trim().min(1).max(200)).min(2).max(6).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;

    // Resolvida antes do INSERT porque agora também é o dono do post
    // (conta_id) — além de continuar servindo pontuação e notificação, como
    // já fazia. Mesma função, mesmo resultado; só passa a valer mais cedo.
    const conta = await contaDaPessoa(supabase, context.userId);

    // O id vem daqui, e o INSERT não pede a linha de volta.
    //
    // Com `.select()`, o PostgREST relê a linha recém-criada, e essa releitura
    // passa pela policy de LEITURA — que exige que o post já esteja ligado a um
    // grupo visível. Só que o vínculo é criado no passo seguinte: no instante
    // do INSERT ele ainda não existe, a leitura falha e o erro chega como
    // "new row violates row-level security policy", apontando para o lugar
    // errado. Mesma armadilha que já apareceu em learning_tracks e em groups.
    const postId = crypto.randomUUID();
    const { error } = await supabase.from("community_posts").insert({
      id: postId,
      author_id: context.userId,
      author_name: await meuNome(supabase, context.userId),
      body: data.body.trim(),
      file_url: data.file_url ?? null,
      file_kind: data.file_kind ?? null,
      link_url: data.link_url ?? null,
      // Sem conta resolvida (não deveria acontecer — acting_account() sempre
      // cai no próprio usuário), omite e deixa o valor-padrão do banco
      // preencher sozinho.
      ...(conta ? { conta_id: conta } : {}),
    });
    if (error) throw new Error(error.message);

    // Uma publicação, vários destinos. A RLS do vínculo barra grupo que a
    // pessoa não pode ver, então mandar um id alheio não cola.
    const { error: eV } = await supabase.from("community_post_groups")
      .insert(data.group_ids.map((g) => ({ post_id: postId, group_id: g })));
    if (eV) {
      // Post sem destino não aparece para ninguém e vira lixo: desfaz.
      await supabase.from("community_posts").delete().eq("id", postId);
      throw new Error("Não consegui publicar nestes grupos.");
    }

    // Enquete (#54): as opções nascem junto, na ordem em que foram digitadas.
    // `sou_autor_do_post` (RLS de INSERT) lê community_posts direto, sem
    // depender do vínculo de grupo acima já existir — mesma saída que a #55
    // já usou para o mesmo tipo de corrida.
    if (data.poll_options?.length) {
      const { error: eO } = await supabase.from("community_poll_options").insert(
        data.poll_options.map((texto, i) => ({
          post_id: postId,
          texto: texto.trim(),
          ordem: i,
          ...(conta ? { conta_id: conta } : {}),
        })),
      );
      if (eO) {
        // Enquete malformada não pode ficar pela metade — mesmo desfazimento
        // do vínculo de grupo, e a cascata leva o post_groups junto.
        await supabase.from("community_posts").delete().eq("id", postId);
        throw new Error("Não consegui criar a enquete.");
      }
    }

    if (conta) {
      await darPonto(supabase, context.userId, conta, "publicar", postId);
      const autor = await meuNome(supabase, context.userId);
      await notificar(supabase, {
        conta,
        tipo: "comunidade_post",
        titulo: `${autor} publicou na comunidade`,
        // Sem a marcação crua: quem tem @ no texto não pode aparecer como
        // "@[Nome](uuid-enorme)" na pré-visualização da notificação.
        corpo: textoSemMarcacao(data.body.trim()).slice(0, 140),
        link: "/comunidades",
        ator: context.userId,
        atorNome: autor,
        grupos: data.group_ids,
        // Comunidade é o caso em que o aluno TAMBÉM é avisado: é o feed dele.
        paraAlunos: true,
      });
      await notificarMencoes(supabase, {
        conta, autorUserId: context.userId, autorNome: autor, texto: data.body,
        groupIds: data.group_ids, postId, origem: "post",
      });
    }
    return { ok: true };
  });

export const comentar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ post_id: z.string().uuid(), body: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const { error } = await supabase.from("community_comments").insert({
      post_id: data.post_id,
      author_id: context.userId,
      author_name: await meuNome(supabase, context.userId),
      body: data.body.trim(),
    });
    if (error) throw new Error(error.message);
    const conta = await contaDaPessoa(supabase, context.userId);
    // Referência é o POST: comentar dez vezes no mesmo não vira dez pontos.
    if (conta) {
      await darPonto(supabase, context.userId, conta, "comentar", data.post_id);
      const autor = await meuNome(supabase, context.userId);
      // O comentário vale para os mesmos grupos do post — é lá que ele aparece.
      const { data: vinc } = await supabase
        .from("community_post_groups").select("group_id").eq("post_id", data.post_id);
      const groupIds = (vinc ?? []).map((v) => v.group_id);
      await notificar(supabase, {
        conta,
        tipo: "comunidade_comentario",
        titulo: `${autor} comentou numa publicação`,
        corpo: textoSemMarcacao(data.body.trim()).slice(0, 140),
        link: "/comunidades",
        ator: context.userId,
        atorNome: autor,
        grupos: groupIds,
        paraAlunos: true,
      });
      await notificarMencoes(supabase, {
        conta, autorUserId: context.userId, autorNome: autor, texto: data.body,
        groupIds, postId: data.post_id, origem: "comentario",
      });
    }
    return { ok: true };
  });

export const alternarCurtida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ post_id: z.string().uuid(), curtir: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    if (data.curtir) {
      const { error } = await supabase.from("community_reactions")
        .insert({ post_id: data.post_id, user_id: context.userId });
      // Curtir duas vezes não é erro para quem clicou; a chave primária barra.
      if (error && error.code !== "23505") throw new Error(error.message);
      const conta = await contaDaPessoa(supabase, context.userId);
      // Descurtir e curtir de novo não repontua: o índice único barra.
      if (conta) await darPonto(supabase, context.userId, conta, "curtir", data.post_id);
    } else {
      const { error } = await supabase.from("community_reactions")
        .delete().eq("post_id", data.post_id).eq("user_id", context.userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/**
 * Vota (ou troca o voto) numa enquete (#54).
 *
 * Uma linha por (post, pessoa) — trocar de opção é UPDATE nesta mesma linha,
 * não uma segunda linha (chave única `post_id, voter_id` na migração). O
 * nome é recalculado a cada voto, igual ao author_name em post/comentário:
 * congela quem votou, não some se a pessoa sair do grupo depois.
 *
 * Não confia que `option_id` pertence a `post_id` só porque o cliente mandou
 * os dois juntos — confere no banco antes. A RLS também confere isso (e
 * quem pode ver o post), mas o erro aqui sai com uma mensagem legível em vez
 * do texto cru de "row-level security policy".
 */
export const votarEnquete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ post_id: z.string().uuid(), option_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const { data: opcao, error: eO } = await supabase
      .from("community_poll_options")
      .select("id").eq("id", data.option_id).eq("post_id", data.post_id).maybeSingle();
    if (eO) throw new Error(eO.message);
    if (!opcao) throw new Error("Esta opção não existe mais.");

    const conta = await contaDaPessoa(supabase, context.userId);
    // Sem `.select()` depois do upsert de propósito: a policy de leitura do
    // voto depende de "eu já votei nesta enquete", que só passa a ser
    // verdade DEPOIS desta escrita — mesma armadilha de RLS circular que já
    // apareceu em community_post_groups (ver a migração da #54).
    const { error } = await supabase.from("community_poll_votes").upsert(
      {
        post_id: data.post_id,
        option_id: data.option_id,
        voter_id: context.userId,
        voter_name: await meuNome(supabase, context.userId),
        ...(conta ? { conta_id: conta } : {}),
      },
      { onConflict: "post_id,voter_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const apagarPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    // A RLS deixa apagar o próprio post ou, para o dono da conta, qualquer um
    // do grupo dele — é a moderação.
    const { error } = await context.supabase.from("community_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const apagarComentario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("community_comments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Quem está nos grupos — para a aba Membros.
 *
 * ⚠️ CAMPOS DELIBERADAMENTE POBRES: foto, nome e cargo. Nada de e-mail,
 * telefone ou resultado.
 *
 * O perfil completo existe para o MENTOR, que precisa dele para trabalhar. Aqui
 * quem olha é o colega de turma, e colega não tem por que ter o telefone e o
 * perfil comportamental de todo mundo do grupo a um clique. Se um dia isso
 * mudar, tem de ser decisão explícita — não pode vazar por eu ter escrito
 * `select("*")` sem pensar.
 */
export const membrosDosGrupos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ group_ids: z.array(z.string().uuid()).min(1) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    // Mesmo motivo de `listarFeed`: a aba Membros é a mesma tela do aluno.
    await exigirPermissaoOuVisitante(supabase, context.userId, "grupos");

    // A RLS de `group_members` já barra grupo que a pessoa não pode ver, então
    // não há como pedir a lista de um grupo alheio passando o id.
    const { data: vinculos, error } = await supabase
      .from("group_members")
      .select("group_id, person_id, people(id, full_name, avatar_url, role_at_company), groups(name)")
      .in("group_id", data.group_ids);
    if (error) throw new Error(error.message);

    // Quem está em dois grupos do mesmo feed aparece uma vez só.
    const vistos = new Set<string>();
    const membros = (vinculos ?? [])
      .filter((v) => v.people && !vistos.has(v.person_id) && vistos.add(v.person_id))
      .map((v) => ({
        person_id: v.person_id,
        nome: v.people!.full_name,
        avatar_url: v.people!.avatar_url ?? null,
        cargo: v.people!.role_at_company ?? null,
        grupo: v.groups?.name ?? null,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));

    const { assinarUrls, TTL_AVATAR_SEGUNDOS } = await import("@/lib/storage-assinado.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const avatares = await assinarUrls(supabaseAdmin, membros.map((m) => m.avatar_url), TTL_AVATAR_SEGUNDOS);
    return { membros: membros.map((m, i) => ({ ...m, avatar_url: avatares[i] })) };
  });

/** A chave que a pessoa controla: os colegas veem meus dados ou não. */
export const definirPerfilVisivel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ visivel: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    // Só o próprio cadastro. A RLS de `people` já barra mexer no de outro, mas
    // o `eq` deixa explícito que isto nunca é ação sobre terceiro.
    const { error } = await context.supabase
      .from("people").update({ perfil_visivel: data.visivel }).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Como está a minha chave hoje. */
export const meuPerfilVisivel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("people").select("perfil_visivel").eq("user_id", context.userId).limit(1).maybeSingle();
    return { visivel: data?.perfil_visivel ?? false };
  });

/**
 * O perfil de um colega de grupo, com o que ele autorizou.
 *
 * O corte é no banco (`perfil_do_colega`): quando a pessoa não autorizou, o
 * e-mail nem sai do servidor. Esconder na tela deixaria o dado chegar ao
 * navegador — e escondido no HTML não é escondido.
 */
export const perfilDoColega = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ person_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    type PerfilColega = {
      id: string;
      full_name: string;
      avatar_url: string | null;
      role_at_company: string | null;
      company_name: string | null;
      banner_url: string | null;
      profession: string | null;
      email: string | null;
      phone: string | null;
      linkedin_url: string | null;
      instagram_url: string | null;
      site_url: string | null;
      autorizou: boolean;
    };
    const { data: r, error } = await (context.supabase.rpc as never as (
      n: string, a: unknown,
    ) => Promise<{ data: PerfilColega[] | null; error: { message: string } | null }>)(
      "perfil_do_colega", { p_person: data.person_id },
    );
    if (error) throw new Error(error.message);
    const perfil = (r ?? [])[0] ?? null;
    if (!perfil) return { perfil: null };
    const { assinarUrl, TTL_AVATAR_SEGUNDOS } = await import("@/lib/storage-assinado.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    perfil.avatar_url = await assinarUrl(supabaseAdmin, perfil.avatar_url, TTL_AVATAR_SEGUNDOS);
    perfil.banner_url = await assinarUrl(supabaseAdmin, perfil.banner_url, TTL_AVATAR_SEGUNDOS);
    return { perfil };
  });
