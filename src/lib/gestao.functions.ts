/**
 * Menu Gestão — o que sobrou dele depois do menu Mentorias.
 *
 * O Kanban de devolutivas (`quadroDeGestao`/`QuadroGestao`) saiu inteiro: a
 * coluna "sem devolutiva" vinha de `calcularFila`, que depende de teste
 * respondido — e mentoria é justamente independente disso (não existe fila
 * equivalente). O que sobrava era uma visão geral entre pessoas, que é
 * exatamente o território da Fatia 3 (painel do professor, ainda não
 * construída) — não algo para adaptar aqui. Ver Fecha #213.
 *
 * O que fica: a agenda unificada (`agendaDoMes`) e os eventos do master.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissao } from "@/lib/permissao.server";
import { exigirDono } from "@/lib/team.functions";
import { notificar, quandoBr } from "@/lib/notificacoes.functions";

/** Um compromisso na agenda. */
export type Compromisso = {
  id: string;
  person_id: string;
  person_name: string;
  /** ISO completo; pode ter hora ou ser só data. */
  quando: string;
  status: "agendada" | "realizada";
  atrasada: boolean;
  /** Mentoria é sessão com uma pessoa; evento é o que o master publicou. */
  tipo: "mentoria" | "evento";
  descricao?: string | null;
  termina_em?: string | null;
  imagem_url?: string | null;
  link_url?: string | null;
  /** Evento gerado por uma aula do Classroom — a aula é a fonte dele. */
  de_aula?: boolean;
};

/**
 * A agenda de um período.
 *
 * ⚠️ O PERÍODO VEM PRONTO DO NAVEGADOR, em ISO. Não recebe "ano e mês" para o
 * servidor converter: o servidor roda em **UTC**, então `new Date(2026, 6, 1)`
 * ali é 1º de julho 00:00 UTC — que no Brasil ainda é 30 de junho, 21h. Uma
 * sessão marcada para o último dia do mês às 22h cairia fora do intervalo e
 * sumiria da agenda.
 *
 * Quem sabe onde o mês começa para o usuário é o navegador dele. É a mesma
 * armadilha que já fez `next_at` aparecer um dia antes.
 *
 * Sem filtro de papel: a RLS já entrega ao mentor só a gente dos grupos dele, e
 * ao dono a conta inteira.
 */
export const agendaDoMes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      de: z.string().datetime({ offset: true }),
      ate: z.string().datetime({ offset: true }),
      /** Painel do aluno: só as sessões dele, não as da conta. */
      somenteMinhas: z.boolean().optional(),
      /** "Ver como aluno": de quem são "as sessões dele", acima. */
      preview_person_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { de, ate } = data;

    // `somenteMinhas=false` é a Agenda da EQUIPE, exige 'mentorias' de quem é
    // colaborador. Com `somenteMinhas=true` (painel do aluno, inclusive
    // mentor vendo a própria agenda) não checa nada aqui: RLS já recorta
    // para o que é da pessoa, e nem aluno nem mentor têm — nem deveriam
    // ter — essa permissão.
    if (!data.somenteMinhas) {
      await exigirPermissao(context.supabase, context.userId, "mentorias");
    }

    // No painel do aluno o recorte da RLS não basta.
    //
    // Para o AVALIADO a RLS já entrega só o que é dele. Mas na prévia "Ver como
    // aluno" quem está autenticado é o DONO — e para ele a RLS entrega a conta
    // inteira. Sem este filtro, a agenda da prévia mostraria todos os
    // compromissos da conta como se fossem daquela pessoa. Foi exatamente o que
    // aconteceu com a comunidade antes de `gruposDoAvaliado` existir — e foi o
    // que de fato aconteceu aqui, achado na demanda #243.
    let meus: string[] | null = null;
    if (data.somenteMinhas) {
      if (data.preview_person_id) {
        meus = [data.preview_person_id];
      } else {
        const { data: eu, error: eE } = await context.supabase
          .from("people").select("id").eq("user_id", context.userId);
        if (eE) throw new Error(eE.message);
        meus = (eu ?? []).map((p) => p.id);
      }
      if (meus.length === 0) return { compromissos: [] };
    }

    const { data: sess, error } = await context.supabase
      .from("mentoria_sessoes")
      .select("id, quando, termina_em, status, mentorias(person_id, people(full_name))")
      .neq("status", "cancelada")
      .gte("quando", de)
      .lt("quando", ate)
      .order("quando")
      .then((r) => (meus
        ? { ...r, data: (r.data ?? []).filter((s) => meus!.includes((s.mentorias as unknown as { person_id: string }).person_id)) }
        : r));
    if (error) throw new Error(error.message);

    const agora = Date.now();
    const compromissos: Compromisso[] = (sess ?? []).map((s) => {
      const m = s.mentorias as unknown as { person_id: string; people: { full_name: string } | null };
      return {
        id: s.id,
        person_id: m.person_id,
        person_name: m.people?.full_name ?? "—",
        quando: s.quando,
        status: s.status === "concluida" ? ("realizada" as const) : ("agendada" as const),
        atrasada: s.status === "agendada" && new Date(s.quando).getTime() < agora,
        tipo: "mentoria" as const,
        // #92: a grade de semana precisa da duração para a altura proporcional
        // do compromisso — a visão de mês nunca precisou disso.
        termina_em: s.termina_em,
      };
    });

    // Os eventos do master entram na mesma agenda.
    //
    // Aqui NÃO se aplica `somenteMinhas`: o recorte do evento é o destino dele,
    // e `posso_ver_evento` já resolveu isso na RLS. Filtrar de novo por
    // `person_id` esconderia do aluno justamente os eventos de grupo — que são
    // o caso mais comum.
    const { data: evs, error: eE2 } = await context.supabase
      .from("eventos")
      .select("id, titulo, descricao, quando, termina_em, imagem_url, link_url, aula_id")
      .gte("quando", de)
      .lt("quando", ate)
      .order("quando");
    if (eE2) throw new Error(eE2.message);

    let listaEventos = evs ?? [];

    // MESMO problema das mentorias, versão evento: `posso_ver_evento` também
    // libera o dono da conta para QUALQUER evento dela (é dono, publicou ou
    // não). Na prévia, quem está autenticado é sempre o dono — então, sem este
    // recorte, a prévia mostraria todo evento da conta como se fosse desta
    // pessoa, o mesmo jeito que a mentoria mentia antes do conserto acima.
    if (data.somenteMinhas && data.preview_person_id && listaEventos.length > 0) {
      const alvo = data.preview_person_id;
      const idsEventos = listaEventos.map((e) => e.id);
      const { data: gruposDaPessoa, error: eG } = await context.supabase
        .from("group_members").select("group_id").eq("person_id", alvo);
      if (eG) throw new Error(eG.message);
      const groupIds = (gruposDaPessoa ?? []).map((g) => g.group_id);

      const [porPessoa, porGrupo] = await Promise.all([
        context.supabase
          .from("evento_destinos").select("evento_id")
          .eq("person_id", alvo).in("evento_id", idsEventos),
        groupIds.length
          ? context.supabase
              .from("evento_destinos").select("evento_id")
              .in("group_id", groupIds).in("evento_id", idsEventos)
          : Promise.resolve({ data: [] as Array<{ evento_id: string }>, error: null }),
      ]);
      if (porPessoa.error) throw new Error(porPessoa.error.message);
      if (porGrupo.error) throw new Error(porGrupo.error.message);

      const permitidos = new Set([
        ...(porPessoa.data ?? []).map((d) => d.evento_id),
        ...(porGrupo.data ?? []).map((d) => d.evento_id),
      ]);
      listaEventos = listaEventos.filter((e) => permitidos.has(e.id));
    }

    const { assinarUrls, TTL_ARQUIVO_SEGUNDOS } = await import("@/lib/storage-assinado.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const imagensAssinadas = await assinarUrls(
      supabaseAdmin, listaEventos.map((e) => e.imagem_url), TTL_ARQUIVO_SEGUNDOS,
    );

    listaEventos.forEach((e, i) => {
      compromissos.push({
        id: e.id,
        person_id: "",
        person_name: e.titulo,
        quando: e.quando,
        status: "agendada",
        atrasada: false,
        tipo: "evento",
        descricao: e.descricao,
        termina_em: e.termina_em,
        imagem_url: imagensAssinadas[i],
        link_url: e.link_url,
        // Evento que nasceu de uma aula do Classroom. A tela diz isso porque,
        // sem o aviso, apagá-lo aqui pareceria não funcionar: ele volta no
        // próximo salvamento da aula, que é a fonte dele.
        de_aula: !!e.aula_id,
      });
    });
    compromissos.sort((a, b) => a.quando.localeCompare(b.quando));

    return { compromissos };
  });

/**
 * Cria um evento e escolhe quem vê.
 *
 * Só o master. O mentor não cria evento para os grupos dele: quem publica
 * novidade na conta é o master, por decisão do Matheus. A policy `eventos_write`
 * é quem barra de verdade; aqui a checagem existe para devolver mensagem legível
 * em vez de um erro de RLS na cara.
 */
export const criarEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      titulo: z.string().trim().min(1).max(200),
      descricao: z.string().trim().max(2000).optional(),
      quando: z.string().datetime({ offset: true }),
      duracao_min: z.number().int().min(5).max(600).nullable().optional(),
      termina_em: z.string().datetime({ offset: true }).nullable().optional(),
      imagem_url: z.string().url().nullable().optional(),
      link_url: z.string().url().max(600).nullable().optional(),
      group_ids: z.array(z.string().uuid()).default([]),
      person_ids: z.array(z.string().uuid()).default([]),
    })
     // Evento sem destino não aparece para ninguém — nem para quem o criou na
     // agenda dos outros. Barra aqui em vez de gravar lixo invisível.
     .refine((v) => v.group_ids.length + v.person_ids.length > 0, {
       message: "Escolha ao menos um grupo ou uma pessoa.",
     })
     .parse(d),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    // "Só o master" (comentário acima) nunca foi de fato checado aqui — a
    // policy `eventos_write` exige `conta_id = auth.uid()`, mas o INSERT
    // sempre grava `conta_id: context.userId`, então um colaborador passava
    // pela RLS gravando o próprio id como conta. Achado no caminho do #226,
    // fora do pedido original.
    await exigirDono(supabase);

    const { data: criado, error } = await supabase
      .from("eventos")
      .insert({
        conta_id: context.userId,
        titulo: data.titulo,
        descricao: data.descricao?.trim() || null,
        quando: data.quando,
        termina_em: data.termina_em ?? null,
        imagem_url: data.imagem_url ?? null,
        link_url: data.link_url ?? null,
        duracao_min: data.duracao_min ?? null,
        criado_por: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const destinos = [
      ...data.group_ids.map((g) => ({ evento_id: criado.id, group_id: g, person_id: null })),
      ...data.person_ids.map((p) => ({ evento_id: criado.id, group_id: null, person_id: p })),
    ];
    const { error: eD } = await supabase.from("evento_destinos").insert(destinos);
    if (eD) {
      // Evento sem destino é invisível e vira lixo: desfaz, como no post da
      // comunidade.
      await supabase.from("eventos").delete().eq("id", criado.id);
      throw new Error("Não consegui direcionar o evento a esses destinos.");
    }

    // Avisa quem vai vê-lo. O leque das notificações já sabe a regra por grupo;
    // para destino por pessoa, `pessoaUser` entrega direto a ela.
    const { data: pessoas } = data.person_ids.length
      ? await supabase.from("people").select("user_id").in("id", data.person_ids)
      : { data: [] as Array<{ user_id: string | null }> };

    const texto = quandoBr(data.quando);
    if (data.group_ids.length) {
      await notificar(supabase, {
        conta: context.userId,
        tipo: "evento_novo",
        titulo: `Novo na agenda: ${data.titulo}`,
        corpo: texto,
        link: "/agenda",
        ator: context.userId,
        grupos: data.group_ids,
        paraAlunos: true,
      });
    }
    for (const p of pessoas ?? []) {
      if (!p.user_id) continue;
      await notificar(supabase, {
        conta: context.userId,
        tipo: "evento_novo",
        titulo: `Novo na agenda: ${data.titulo}`,
        corpo: texto,
        link: "/agenda",
        ator: context.userId,
        pessoaUser: p.user_id,
      });
    }

    const { sincronizar } = await import("@/lib/google.server");
    await sincronizar(context.userId, "evento", criado.id, {
      titulo: data.titulo,
      descricao: data.descricao ?? null,
      quando: data.quando,
      // Fim de verdade quando houver; senão a duração fixa de antes.
      terminaEm: data.termina_em ?? null,
      duracaoMin: data.duracao_min ?? null,
    });
    return { id: criado.id };
  });

export const excluirEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    // Mesma regra de criarEvento: só o master apaga.
    await exigirDono(context.supabase);
    // Os destinos caem por CASCADE.
    const { error } = await context.supabase.from("eventos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    const { sincronizar } = await import("@/lib/google.server");
    // `null` = deixou de existir: apaga lá também.
    await sincronizar(context.userId, "evento", data.id, null);
    return { ok: true };
  });
