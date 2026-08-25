/**
 * Classroom: treinamentos PRESENCIAIS — treinamento → módulo → aula → material.
 *
 * Estrutura própria, separada da Academy, por decisão registrada em
 * docs/analise-classroom.md: o check-in não tem paralelo lá, e reaproveitar as
 * tabelas obrigaria toda consulta da Academy a filtrar o presencial.
 *
 * Quem enxerga é a RLS (`posso_ver_treinamento`, migração 20260730140000).
 * Quem EDITA é só o dono da conta — as policies de escrita exigem
 * `mentor_id = auth.uid()`, mesma regra dos eventos da agenda.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { urlOpcional } from "@/lib/url-segura";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { notificar } from "@/lib/notificacoes.functions";
import { exigirVisitante } from "@/lib/permissao.server";

/** Inclui `slide` e `roteiro`, que a Academy não tem: são o material de quem dá aula presencial. */
export const TIPOS_MATERIAL_TREINAMENTO = [
  "link", "pdf", "slide", "roteiro", "planilha", "video", "audio", "outro",
] as const;

// ============================================================
// Treinamentos
// ============================================================
export const listTreinamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ preview_person_id: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data: input }) => {
    // A RLS (`posso_ver_treinamento`) usa auth.uid() direto, não
    // acting_account() — então hoje um colaborador sem grupo atribuído já sai
    // sem linha nenhuma. Mas nada aqui checava isso explicitamente, e o menu
    // do dono é soDono (app-sidebar.tsx): não existe permissão de
    // funcionalidade para "Classroom" que um colaborador possa ter. Mesma
    // cirurgia do #226, adaptada: sem tecla para dar bypass, barra
    // colaborador sempre. Fecha #239.
    await exigirVisitante(context.supabase, context.userId);

    const { data, error } = await context.supabase
      .from("treinamentos")
      .select("*, treinamento_grupos(count), treinamento_modulos(treinamento_aulas(count))")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Na prévia "Ver como aluno" quem consulta é o dono, e `posso_ver_treinamento`
    // libera o dono para QUALQUER treinamento da conta — publicado ou não, de
    // QUALQUER grupo. O filtro de "publicado" que já existia na tela cobre só
    // metade do problema; sem este aqui, a prévia mostrava treinamento de um
    // grupo em que a pessoa nem está. Achado na varredura da demanda #243.
    let liberados: Set<string> | null = null;
    if (input.preview_person_id) {
      const { data: membros, error: eM } = await context.supabase
        .from("group_members").select("group_id").eq("person_id", input.preview_person_id);
      if (eM) throw new Error(eM.message);
      const groupIds = (membros ?? []).map((m) => m.group_id);
      const { data: tg, error: eT } = groupIds.length
        ? await context.supabase.from("treinamento_grupos").select("treinamento_id").in("group_id", groupIds)
        : { data: [] as Array<{ treinamento_id: string }>, error: null };
      if (eT) throw new Error(eT.message);
      liberados = new Set((tg ?? []).map((t) => t.treinamento_id));
    }

    return (data ?? []).filter((t) => !liberados || liberados.has(t.id)).map((t) => {
      const grupos = t.treinamento_grupos as unknown as Array<{ count: number }>;
      const modulos = t.treinamento_modulos as unknown as Array<{
        treinamento_aulas: Array<{ count: number }>;
      }>;
      return {
        ...t,
        treinamento_grupos: undefined,
        treinamento_modulos: undefined,
        grupos_count: grupos?.[0]?.count ?? 0,
        aulas_count: (modulos ?? []).reduce((s, m) => s + (m.treinamento_aulas?.[0]?.count ?? 0), 0),
      };
    });
  });

/** Treinamento inteiro com a árvore montada, para a tela do master. */
export const getTreinamento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      preview_person_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Mesmo motivo de listTreinamentos: sem permissão de funcionalidade
    // própria para Classroom, colaborador não entra por aqui de jeito nenhum.
    await exigirVisitante(supabase, userId);

    const { data: treinamento, error } = await supabase
      .from("treinamentos").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!treinamento) throw new Error("Treinamento não encontrado.");

    const [mods, grupos] = await Promise.all([
      supabase
        .from("treinamento_modulos")
        .select("*, treinamento_aulas(*, treinamento_materiais(*), treinamento_presencas(count))")
        .eq("treinamento_id", data.id),
      supabase.from("treinamento_grupos").select("group_id, groups(id, name)").eq("treinamento_id", data.id),
    ]);
    if (mods.error) throw new Error(mods.error.message);
    if (grupos.error) throw new Error(grupos.error.message);

    // As anotações moram em tabela própria com RLS só do dono (migração
    // 20260730150000): o aluno não recebe o roteiro do professor nem
    // consultando a API direto. Só vale buscar quando é o dono olhando.
    //
    // `!data.preview_person_id` importa: na prévia "Ver como aluno" quem
    // está autenticado é sempre o dono de verdade, então `mentor_id === userId`
    // dava true mesmo pré-visualizando — e as anotações do professor, que
    // NINGUÉM além dele deveria ver, viajavam até o navegador (o corte virava
    // só da tela, não do servidor). Achado na varredura da demanda #243.
    const dono = !data.preview_person_id && treinamento.mentor_id === userId;
    const anotPorAula = new Map<string, string>();
    if (dono) {
      const { data: anots, error: eAnots } = await supabase
        .from("treinamento_anotacoes").select("aula_id, texto");
      if (eAnots) throw new Error(eAnots.message);
      for (const a of anots ?? []) anotPorAula.set(a.aula_id, a.texto);
    }

    // Ordena aqui em vez de encadear `order` por tabela estrangeira: dois
    // níveis de aninhamento tornam a sintaxe frágil, e a lista é pequena.
    const porOrdem = <T extends { ordem: number; titulo: string }>(xs: T[]) =>
      [...xs].sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo));

    // As MINHAS presenças, para a aula aparecer com o certo verde no painel do
    // aluno. Filtra pela pessoa explicitamente em vez de confiar na policy para
    // recortar: para o professor, `pres_professor` entregaria a turma inteira, e
    // o certo verde apareceria em aula a que ele nunca foi.
    //
    // Na prévia "Ver como aluno" quem está autenticado é o dono, não a pessoa
    // pré-visualizada — filtrar por `people.user_id === userId` mostraria a
    // presença do PRÓPRIO DONO (se ele tiver alguma), não a dela. Mesmo
    // esquecimento achado em agendaDoMes, versão presença. Achado na
    // varredura da demanda #243.
    const idsDasAulas = (mods.data ?? []).flatMap((m) =>
      ((m.treinamento_aulas as unknown as Array<{ id: string }>) ?? []).map((a) => a.id),
    );
    const { data: minhas, error: eMinhas } = idsDasAulas.length
      ? await (data.preview_person_id
          ? supabase
              .from("treinamento_presencas")
              .select("aula_id, situacao, escaneado_em")
              .in("aula_id", idsDasAulas)
              .eq("person_id", data.preview_person_id)
          : supabase
              .from("treinamento_presencas")
              .select("aula_id, situacao, escaneado_em, people!inner(user_id)")
              .in("aula_id", idsDasAulas)
              .eq("people.user_id", userId))
      : { data: [], error: null };
    if (eMinhas) throw new Error(eMinhas.message);

    // A MESMA regra da tabela do professor decide o certo verde: falta
    // justificada não recebe certo, porque não conta como presença — e o aluno
    // acreditaria que aquele encontro entrou na frequência dele.
    const { situacaoDe, contaComoPresenca } = await import("@/lib/presenca");
    const dadosDaAula = new Map(
      (mods.data ?? []).flatMap((m) =>
        ((m.treinamento_aulas as unknown as Array<{
          id: string; comeca_em: string | null; termina_em: string | null;
          fechada_em: string | null; cancelada: boolean;
        }>) ?? []).map((a) => [a.id, a] as const),
      ),
    );
    const estive = new Set<string>();
    let encontrosContados = 0;
    for (const p of minhas ?? []) {
      const a = dadosDaAula.get(p.aula_id);
      if (!a) continue;
      const s = situacaoDe(
        {
          aula_id: p.aula_id, person_id: "", origem: "", grupo: null,
          escaneado_em: p.escaneado_em, registrado_em: "", situacao: p.situacao,
          observacao: null, marcado_por_nome: null,
        },
        { ...a, titulo: "", modulo: "", local: null },
      );
      if (contaComoPresenca(s)) {
        estive.add(p.aula_id);
        // Só conta encontro com a lista fechada: enquanto ela está aberta, nada
        // foi afirmado, e o aluno veria um número que ainda vai mudar.
        if (a.fechada_em && !a.cancelada) encontrosContados++;
      }
    }
    const encontrosFechados = [...dadosDaAula.values()].filter(
      (a) => a.fechada_em && !a.cancelada,
    ).length;

    // #231 — avaliação de aula. Mesma leitura para os dois lados: o aluno
    // recebe a PRÓPRIA linha (RLS entrega só a dele quando ele não é quem dá
    // a aula), o dono recebe TODAS (RLS libera por posso_dar_aula) — e é essa
    // mesma diferença de RLS que decide o que cada um pode calcular abaixo,
    // sem precisar de duas consultas.
    const { data: avaliacoesCru, error: eAval } = idsDasAulas.length
      ? await supabase
          .from("treinamento_avaliacoes")
          .select("aula_id, person_id, estrelas, comentario, avaliada_em, people(full_name)")
          .in("aula_id", idsDasAulas)
      : { data: [], error: null };
    if (eAval) throw new Error(eAval.message);

    type AvalRow = {
      aula_id: string; person_id: string; estrelas: number; comentario: string | null;
      avaliada_em: string; people: { full_name: string } | null;
    };
    const avaliacoesPorAula = new Map<string, AvalRow[]>();
    for (const av of (avaliacoesCru ?? []) as unknown as AvalRow[]) {
      const arr = avaliacoesPorAula.get(av.aula_id) ?? [];
      arr.push(av);
      avaliacoesPorAula.set(av.aula_id, arr);
    }
    // Na prévia "Ver como aluno" é o DONO quem está logado, então a linha dele
    // próprio não distingue "minha avaliação" de "avaliação de outro aluno" —
    // precisa apontar explicitamente para quem está sendo pré-visualizado.
    // Fora da prévia, a RLS já entregou só a linha do aluno de verdade.
    const minhaPessoaId = data.preview_person_id ?? null;
    const agoraMs = Date.now();

    // #256 — conclusão de aula gravada. Mesma leitura de dois lados que a
    // avaliação: aluno recebe só a própria linha (RLS), dono recebe todas
    // (para a contagem "N concluíram").
    const { data: conclusoesCru, error: eConcl } = idsDasAulas.length
      ? await supabase
          .from("treinamento_aula_conclusoes")
          .select("aula_id, person_id, concluida_em")
          .in("aula_id", idsDasAulas)
      : { data: [], error: null };
    if (eConcl) throw new Error(eConcl.message);

    type ConclRow = { aula_id: string; person_id: string; concluida_em: string };
    const conclusoesPorAula = new Map<string, ConclRow[]>();
    for (const c of (conclusoesCru ?? []) as unknown as ConclRow[]) {
      const arr = conclusoesPorAula.get(c.aula_id) ?? [];
      arr.push(c);
      conclusoesPorAula.set(c.aula_id, arr);
    }

    const modules = porOrdem(mods.data ?? []).map((m) => ({
      ...m,
      treinamento_aulas: undefined,
      aulas: porOrdem(
        ((m.treinamento_aulas as unknown as Array<Record<string, unknown>>) ?? []).map((a) => {
          const aula = a as { id: string; modulo_id: string; titulo: string; descricao: string | null; comeca_em: string | null; termina_em: string | null; local: string | null; ordem: number; cancelada: boolean; treinamento_presencas?: Array<{ count: number }> };
          const avaliacoesDaAula = avaliacoesPorAula.get(aula.id) ?? [];
          const minhaAvaliacao = minhaPessoaId
            ? avaliacoesDaAula.find((av) => av.person_id === minhaPessoaId)
            : avaliacoesDaAula[0];
          const aulaTerminou = !!aula.termina_em && new Date(aula.termina_em).getTime() <= agoraMs;
          const notasDaTurma = avaliacoesDaAula.map((av) => av.estrelas);
          // #256 — aula GRAVADA é a que nunca teve horário marcado. Aula com
          // horário continua exatamente na regra da #231, abaixo.
          const gravada = !aula.comeca_em;
          const conclusoesDaAula = conclusoesPorAula.get(aula.id) ?? [];
          const minhaConclusao = minhaPessoaId
            ? conclusoesDaAula.find((c) => c.person_id === minhaPessoaId)
            : conclusoesDaAula[0];
          return {
            ...aula,
            estive: estive.has(aula.id),
            anotacoes: anotPorAula.get(aula.id) ?? null,
            treinamento_materiais: undefined,
            treinamento_presencas: undefined,
            // Para o aviso ao mudar horário (o professor pode ter presença
            // gravada mesmo com a lista ainda aberta): quantas pessoas já têm
            // linha em treinamento_presencas para esta aula.
            presencas_count: aula.treinamento_presencas?.[0]?.count ?? 0,
            // A RLS já recorta: o aluno só recebe o que foi liberado para ele.
            // O `visivel_aluno` que vem junto serve para a tela do professor
            // mostrar de quem é cada material.
            materiais: porOrdem(
              (a.treinamento_materiais as Array<{
                id: string; titulo: string; url: string; kind: string; ordem: number;
                visivel_aluno: boolean;
              }>) ?? [],
            ),
            // #231/#256 — lado do aluno: a própria nota, se já enviou; senão,
            // se o convite "Avalie esta aula" deve aparecer. As MESMAS regras
            // da função avaliar_aula — repetidas aqui só para a TELA não
            // oferecer o que o banco recusaria, nunca como a trava de
            // verdade. Aula gravada libera por conclusão; aula com horário
            // continua exatamente como na #231 (presença + término).
            minha_avaliacao: minhaAvaliacao
              ? { estrelas: minhaAvaliacao.estrelas, comentario: minhaAvaliacao.comentario }
              : null,
            pode_avaliar: gravada
              ? !!minhaConclusao && !aula.cancelada && !minhaAvaliacao
              : estive.has(aula.id) && aulaTerminou && !aula.cancelada && !minhaAvaliacao,
            // #256 — lado do aluno, só em aula gravada: a própria conclusão,
            // e se o botão de marcar/desmarcar deve aparecer. Desmarcar só é
            // oferecido enquanto não avaliou — a MESMA trava que
            // desmarcar_conclusao_aula aplica no banco.
            minha_conclusao: minhaConclusao ? { concluida_em: minhaConclusao.concluida_em } : null,
            pode_concluir: gravada && !aula.cancelada && !minhaConclusao,
            pode_desmarcar: gravada && !!minhaConclusao && !minhaAvaliacao,
            // #256 — lado do mentor, só em aula gravada: contagem simples,
            // sem lista de nomes (não foi pedida tela de relatório).
            concluidos_count: dono && gravada ? conclusoesDaAula.length : null,
            // #231 — lado do mentor: média SEMPRE com contagem (nunca sozinha —
            // é o que a regra de honestidade pede), e os comentários
            // identificados. Só monta quando é o dono de verdade olhando (nunca
            // na prévia "Ver como aluno", que deve mostrar só o que o aluno vê).
            avaliacao: dono && notasDaTurma.length > 0
              ? { media: notasDaTurma.reduce((a2, b2) => a2 + b2, 0) / notasDaTurma.length, contagem: notasDaTurma.length }
              : null,
            comentarios: dono
              ? avaliacoesDaAula
                  .filter((av) => av.comentario)
                  .map((av) => ({
                    estrelas: av.estrelas,
                    comentario: av.comentario,
                    pessoa: av.people?.full_name ?? "—",
                  }))
              : [],
          };
        }),
      ),
    }));

    // O upload de material de aula usa o MESMO bucket 'biblioteca' (agora
    // privado) da biblioteca — ver o comentário em classroom-view.tsx. A RLS
    // de treinamento_materiais já decide quem VÊ a linha (comentário acima);
    // falta só decidir o link que ela abre. `null` só acontece se o arquivo
    // sumiu do bucket — melhor "sem link" do que um link morto.
    const todosOsMateriais = modules.flatMap((m) => m.aulas.flatMap((a) => a.materiais));
    const { assinarUrls, TTL_ARQUIVO_SEGUNDOS } = await import("@/lib/storage-assinado.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const urlsAssinadas = await assinarUrls(supabaseAdmin, todosOsMateriais.map((mat) => mat.url), TTL_ARQUIVO_SEGUNDOS);
    todosOsMateriais.forEach((mat, i) => {
      (mat as { url: string | null }).url = urlsAssinadas[i];
    });

    // #221 F2 — autocheck do certificado: só para o aluno de verdade vendo a
    // própria tela. NUNCA na prévia "Ver como aluno" (`preview_person_id`)
    // — ali quem está autenticado é o dono, e emitir em nome de quem está
    // sendo pré-visualizado gravaria um certificado que a pessoa real nunca
    // pediu nem ganhou. Mesma régua central de `listaDeConcluidosTreinamento`
    // — nunca uma segunda conta.
    let meuCertificado: { id: string; emitido_em: string } | null = null;
    if (!data.preview_person_id) {
      const { data: minhaPessoa } = await supabase
        .from("people")
        .select("id")
        .eq("user_id", userId)
        .eq("mentor_id", treinamento.mentor_id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (minhaPessoa) {
        const conclusao = await calcularConclusoesDoTreinamento(supabase, data.id);
        const minhaLinha = conclusao.pessoas.find((p) => p.person_id === minhaPessoa.id);
        if (minhaLinha?.concluido) {
          const { garantirCertificadosDoTreinamento } =
            await import("@/lib/certificados.functions");
          await garantirCertificadosDoTreinamento(
            conclusao.treinamento.mentor_id,
            conclusao.treinamento.id,
            conclusao.treinamento.titulo,
            [minhaLinha],
          );
        }
        // Busca incondicional: certificado já emitido é "foto, não espelho" —
        // continua valendo mesmo se um % exigido mais alto hoje tirar a
        // pessoa de "concluído".
        const { data: cert } = await supabase
          .from("certificados")
          .select("id, emitido_em")
          .eq("treinamento_id", data.id)
          .eq("person_id", minhaPessoa.id)
          .maybeSingle();
        meuCertificado = cert ?? null;
      }
    }

    return {
      treinamento,
      modules,
      grupos: (grupos.data ?? []).map((g) => ({
        id: g.group_id,
        name: (g.groups as unknown as { name: string } | null)?.name ?? "—",
      })),
      minha_frequencia: { estive: encontrosContados, de: encontrosFechados },
      can_edit: dono,
      meu_certificado: meuCertificado,
    };
  });

export const createTreinamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      titulo: z.string().trim().min(2).max(200),
      descricao: z.string().trim().max(2000).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // `mentor_id` é quem está logado — a RLS de escrita exige isso, então o
    // colaborador que chegar aqui por fora do menu é recusado pelo banco.
    const { data: row, error } = await context.supabase
      .from("treinamentos")
      .insert({ ...data, mentor_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateTreinamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      titulo: z.string().trim().min(2).max(200).optional(),
      descricao: z.string().trim().max(2000).optional().nullable(),
      capa_url: urlOpcional,
      publicado: z.boolean().optional(),
      // O mesmo intervalo do CHECK do banco. Validar aqui também dá mensagem
      // legível em vez de erro cru do Postgres.
      tolerancia_atraso_min: z.number().int().min(0).max(120).optional(),
      // #221 F1 — idem: mesmo intervalo do CHECK de percentual_minimo.
      percentual_minimo: z.number().int().min(1).max(100).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("treinamentos").update(rest).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTreinamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("treinamentos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Troca os grupos com acesso. Por DIFERENÇA, não por apagar-e-recriar: se a
 * inserção falhasse depois de um DELETE geral, o treinamento perderia todos os
 * grupos — e ninguém ligaria o sumiço ao clique de semanas atrás.
 */
export const setGruposDoTreinamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      treinamento_id: z.string().uuid(),
      group_ids: z.array(z.string().uuid()).max(200),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: atuais, error: eLer } = await supabase
      .from("treinamento_grupos").select("group_id").eq("treinamento_id", data.treinamento_id);
    if (eLer) throw new Error(eLer.message);

    const antes = new Set((atuais ?? []).map((g) => g.group_id));
    const alvo = new Set(data.group_ids);
    const tirar = [...antes].filter((g) => !alvo.has(g));
    const incluir = [...alvo].filter((g) => !antes.has(g));

    if (tirar.length > 0) {
      const { error } = await supabase
        .from("treinamento_grupos").delete()
        .eq("treinamento_id", data.treinamento_id).in("group_id", tirar);
      if (error) throw new Error(error.message);
    }
    if (incluir.length > 0) {
      const { error } = await supabase
        .from("treinamento_grupos")
        .insert(incluir.map((group_id) => ({ treinamento_id: data.treinamento_id, group_id })));
      if (error) throw new Error(error.message);
    }

    // Trocar a turma muda quem vê os encontros na agenda. Sem isto, tirar um
    // grupo do treinamento deixaria as aulas dele na agenda de quem já não
    // participa — e a turma nova não veria nada.
    if (tirar.length > 0 || incluir.length > 0) {
      const { data: mods } = await supabase
        .from("treinamento_modulos")
        .select("treinamento_aulas(id)")
        .eq("treinamento_id", data.treinamento_id);
      const aulaIds = (mods ?? []).flatMap(
        (m) => ((m.treinamento_aulas as unknown as Array<{ id: string }>) ?? []).map((a) => a.id),
      );
      for (const aulaId of aulaIds) {
        await sincronizarEventoDaAula(supabase, context.userId, aulaId);
      }
    }
    return { ok: true };
  });

// ============================================================
// Módulos
// ============================================================
export const saveModulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      treinamento_id: z.string().uuid(),
      titulo: z.string().trim().min(1).max(200),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...rest } = data;
    if (id) {
      const { data: row, error } = await supabase
        .from("treinamento_modulos").update({ titulo: rest.titulo }).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    // `ordem` = quantos já existem: o novo entra no fim, e a lista não depende
    // do acaso de todo mundo nascer com ordem 0.
    const { count, error: eCont } = await supabase
      .from("treinamento_modulos")
      .select("id", { count: "exact", head: true })
      .eq("treinamento_id", rest.treinamento_id);
    if (eCont) throw new Error(eCont.message);
    const { data: row, error } = await supabase
      .from("treinamento_modulos").insert({ ...rest, ordem: count ?? 0 }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteModulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("treinamento_modulos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Aulas
// ============================================================
const aulaSchema = z.object({
  id: z.string().uuid().optional(),
  modulo_id: z.string().uuid(),
  titulo: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(4000).optional().nullable(),
  anotacoes: z.string().trim().max(8000).optional().nullable(),
  comeca_em: z.string().datetime({ offset: true }).optional().nullable(),
  termina_em: z.string().datetime({ offset: true }).optional().nullable(),
  local: z.string().trim().max(300).optional().nullable(),
}).refine(
  (a) => !a.comeca_em || !a.termina_em || new Date(a.termina_em) > new Date(a.comeca_em),
  { message: "O fim precisa ser depois do início." },
);

/**
 * A aula com data vira evento na agenda — do professor e dos alunos do grupo.
 *
 * Uma função só, chamada de todo lugar que muda o que o evento mostra: salvar a
 * aula (título, horário), trocar os grupos do treinamento, apagar a aula. Se
 * cada caminho montasse o evento à sua maneira, um deles esqueceria de atualizar
 * e a agenda passaria a mentir sobre um encontro que mudou de hora.
 *
 * O evento é ligado pela coluna `aula_id`, com índice único: dois salvamentos
 * simultâneos não conseguem criar dois eventos para a mesma aula.
 *
 * Silenciosa como o e-mail e os pontos: a agenda nunca derruba o salvamento da
 * aula. O professor salvou a aula de qualquer forma.
 */
async function sincronizarEventoDaAula(
  supabase: SupabaseClient<Database>,
  userId: string,
  aulaId: string,
): Promise<void> {
  try {
    const { data: aula } = await supabase
      .from("treinamento_aulas")
      .select("id, titulo, comeca_em, termina_em, local, modulo_id, cancelada")
      .eq("id", aulaId)
      .maybeSingle();

    const { data: existente } = await supabase
      .from("eventos").select("id, quando").eq("aula_id", aulaId).maybeSingle();

    // Sem data não há o que marcar na agenda. Se a aula tinha horário e ele
    // apagou, o evento vai junto — deixá-lo lá anunciaria um encontro que já
    // não tem hora.
    //
    // Aula CANCELADA cai no mesmo caminho, e a checagem mora aqui de propósito:
    // esta função é chamada por `saveAula` e por `setGruposDoTreinamento`. Se o
    // cancelamento só apagasse o evento por fora, o próximo salvamento o
    // ressuscitaria — e, por não existir mais, dispararia "Novo encontro" para
    // a turma inteira, desmentindo o aviso de cancelamento.
    if (!aula?.comeca_em || aula.cancelada) {
      if (existente) {
        await supabase.from("eventos").delete().eq("id", existente.id);
        const { sincronizar } = await import("@/lib/google.server");
        await sincronizar(userId, "evento", existente.id, null);
      }
      return;
    }

    const { data: modulo } = await supabase
      .from("treinamento_modulos").select("treinamento_id").eq("id", aula.modulo_id).maybeSingle();
    if (!modulo) return;
    const { data: trein } = await supabase
      .from("treinamentos").select("titulo, mentor_id").eq("id", modulo.treinamento_id).maybeSingle();
    if (!trein) return;

    const descricao = [trein.titulo, aula.local ? `Local: ${aula.local}` : null]
      .filter(Boolean).join("\n");
    const campos = {
      titulo: aula.titulo,
      descricao,
      quando: aula.comeca_em,
      termina_em: aula.termina_em,
      link_url: null,
    };

    let eventoId = existente?.id ?? null;
    const mudouAHora = !!existente && existente.quando !== aula.comeca_em;

    if (eventoId) {
      const { error } = await supabase.from("eventos").update(campos).eq("id", eventoId);
      if (error) throw new Error(error.message);
    } else {
      const { data: novo, error } = await supabase
        .from("eventos")
        .insert({ ...campos, conta_id: trein.mentor_id, criado_por: userId, aula_id: aulaId })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      eventoId = novo.id;
    }

    // Os destinos seguem os grupos do treinamento, por diferença: apagar tudo e
    // recriar deixaria o evento invisível se a inserção falhasse no meio.
    const { data: tg } = await supabase
      .from("treinamento_grupos").select("group_id").eq("treinamento_id", modulo.treinamento_id);
    const alvo = new Set((tg ?? []).map((g) => g.group_id));
    const { data: destinos } = await supabase
      .from("evento_destinos").select("id, group_id").eq("evento_id", eventoId);
    const atuais = new Set((destinos ?? []).map((d) => d.group_id).filter(Boolean) as string[]);

    const tirar = (destinos ?? []).filter((d) => d.group_id && !alvo.has(d.group_id));
    if (tirar.length) {
      await supabase.from("evento_destinos").delete().in("id", tirar.map((d) => d.id));
    }
    const incluir = [...alvo].filter((g) => !atuais.has(g));
    if (incluir.length) {
      await supabase.from("evento_destinos")
        .insert(incluir.map((group_id) => ({ evento_id: eventoId!, group_id, person_id: null })));
    }

    // Avisa a turma quando o encontro NASCE ou quando MUDA DE HORA. Não a cada
    // salvamento: corrigir uma vírgula no título não pode disparar notificação
    // para vinte pessoas.
    const grupos = [...alvo];
    if (grupos.length && (!existente || mudouAHora)) {
      const { quandoBr } = await import("@/lib/notificacoes.functions");
      await notificar(supabase, {
        conta: trein.mentor_id,
        tipo: "evento_novo",
        titulo: existente
          ? `Mudou de horário: ${aula.titulo}`
          : `Novo encontro: ${aula.titulo}`,
        corpo: `${quandoBr(aula.comeca_em)}${aula.local ? ` · ${aula.local}` : ""}`,
        link: "/aluno/classroom",
        ator: userId,
        grupos,
        paraAlunos: true,
      });
    }

    const { sincronizar } = await import("@/lib/google.server");
    await sincronizar(userId, "evento", eventoId, {
      titulo: aula.titulo,
      descricao,
      quando: aula.comeca_em,
      terminaEm: aula.termina_em,
      duracaoMin: null,
    });
  } catch (e) {
    console.error("[classroom] não deu para sincronizar o evento da aula:", e);
  }
}

export const saveAula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => aulaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // A anotação vai para a tabela dela, não para a linha da aula — ver a
    // migração 20260730150000 e o comentário no getTreinamento.
    const { id, anotacoes, ...rest } = data;
    let row: { id: string };
    if (id) {
      const { data: r, error } = await supabase
        .from("treinamento_aulas").update(rest).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      row = r;
    } else {
      const { count, error: eCont } = await supabase
        .from("treinamento_aulas")
        .select("id", { count: "exact", head: true })
        .eq("modulo_id", rest.modulo_id);
      if (eCont) throw new Error(eCont.message);
      const { data: r, error } = await supabase
        .from("treinamento_aulas").insert({ ...rest, ordem: count ?? 0 }).select().single();
      if (error) throw new Error(error.message);
      row = r;
    }

    const texto = anotacoes?.trim() ?? "";
    if (texto) {
      const { error } = await supabase
        .from("treinamento_anotacoes")
        .upsert({ aula_id: row.id, texto, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
    } else {
      // Apagar o texto no formulário apaga a anotação — sem linha órfã.
      const { error } = await supabase
        .from("treinamento_anotacoes").delete().eq("aula_id", row.id);
      if (error) throw new Error(error.message);
    }

    // A aula com data marcada entra na agenda dele e na dos alunos do grupo.
    await sincronizarEventoDaAula(supabase, context.userId, row.id);
    return row;
  });

export const deleteAula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // O evento cai por CASCADE quando a aula some, mas o Google não sabe disso:
    // sem apagar antes, o encontro ficaria pendurado na agenda do Google dele
    // para sempre, sem nada na plataforma que o explique.
    const { data: evento } = await context.supabase
      .from("eventos").select("id").eq("aula_id", data.id).maybeSingle();

    const { error } = await context.supabase.from("treinamento_aulas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    if (evento) {
      const { sincronizar } = await import("@/lib/google.server");
      await sincronizar(context.userId, "evento", evento.id, null);
    }
    return { ok: true };
  });

// ============================================================
// Materiais
// ============================================================
export const saveMaterialAula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      aula_id: z.string().uuid(),
      titulo: z.string().trim().min(1).max(200),
      url: z.string().trim().url().max(1000),
      kind: z.enum(TIPOS_MATERIAL_TREINAMENTO).default("link"),
      // Quem vê o material. Sem valor explícito, fica com o professor: material
      // que vaza não volta, e liberar depois é um clique.
      visivel_aluno: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...rest } = data;
    if (id) {
      const { ehUrlAssinadaNossa } = await import("@/lib/storage-assinado.server");
      // Editar o material sem trocar o conteúdo reenvia a URL ASSINADA que a
      // aula mostrou (ver getTreinamento) — preserva o identificador já
      // gravado em vez de persistir um link que expira em minutos.
      if (ehUrlAssinadaNossa(rest.url)) {
        const { data: atual } = await supabase
          .from("treinamento_materiais").select("url").eq("id", id).maybeSingle();
        if (atual?.url) rest.url = atual.url;
      }
      const { data: row, error } = await supabase
        .from("treinamento_materiais").update(rest).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { count, error: eCont } = await supabase
      .from("treinamento_materiais")
      .select("id", { count: "exact", head: true })
      .eq("aula_id", rest.aula_id);
    if (eCont) throw new Error(eCont.message);
    const { data: row, error } = await supabase
      .from("treinamento_materiais").insert({ ...rest, ordem: count ?? 0 }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteMaterialAula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("treinamento_materiais").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Check-in (etapa 4)
// ============================================================

/**
 * A tela do professor: os códigos dos próximos minutos, a janela, quem já
 * confirmou e — o que de fato esvazia a fila na porta — quem vai travar.
 *
 * Manda um LOTE de códigos, não um por vez. A aba do professor fica horas num
 * projetor, e `setInterval` é estrangulado em aba de fundo: ao voltar, a tela
 * exibiria um código de minutos atrás com cara de válido, e a turma inteira
 * levaria "expirado" sem ter feito nada errado. Com o lote, a tela gira sozinha
 * e o wifi do professor deixa de ser parte da corrente.
 */
export const abrirCheckin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ aula_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: pode, error: ePode } = await supabase.rpc("posso_dar_aula", { p_aula: data.aula_id });
    if (ePode) throw new Error(ePode.message);
    if (pode !== true) throw new Error("Você não conduz esta aula.");

    const { data: aula, error } = await supabase
      .from("treinamento_aulas")
      .select("id, titulo, comeca_em, termina_em, local, modulo_id, cancelada, local_lat, local_lng, local_raio_m, local_travado_em")
      .eq("id", data.aula_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!aula) throw new Error("Aula não encontrada.");
    // Projetar o QR de um encontro cancelado só produz presença em aula que
    // não houve — e o aluno ainda receberia o e-mail de confirmação.
    if (aula.cancelada) throw new Error("Este encontro está cancelado. Reative-o para abrir o check-in.");

    const {
      codigoDaAula, bucketAgora, fimDoBucket, janelaDaAula, dentroDaJanela, BUCKET_SEGUNDOS,
    } = await import("@/lib/checkin.server");

    const janela = janelaDaAula(aula);
    const agora = Date.now();
    const b = bucketAgora(agora);
    // Quatro minutos de códigos: cobre uma aba adormecida por um tempo e ainda
    // vence antes de virar credencial guardada.
    const codigos = [0, 1, 2, 3].map((i) => ({
      codigo: codigoDaAula(aula.id, b + i),
      vale_ate: new Date(fimDoBucket(agora) + i * BUCKET_SEGUNDOS * 1000).toISOString(),
    }));

    // Presenças, com nome: é o que dá confirmação social à turma ("12 de 20").
    const { data: presencas, error: eP } = await supabase
      .from("treinamento_presencas")
      .select("id, person_id, origem, escaneado_em, registrado_em, situacao, observacao, distancia_m, people(full_name)")
      .eq("aula_id", aula.id)
      .order("registrado_em");
    if (eP) throw new Error(eP.message);

    // Quem tem acesso a esta aula, e o pré-voo: aluno sem login trava na porta,
    // e isso se resolve na véspera, não no minuto seis.
    const { data: modulo } = await supabase
      .from("treinamento_modulos").select("treinamento_id").eq("id", aula.modulo_id).maybeSingle();
    const { data: grupos } = modulo
      ? await supabase.from("treinamento_grupos").select("group_id").eq("treinamento_id", modulo.treinamento_id)
      : { data: [] as Array<{ group_id: string }> };
    const groupIds = (grupos ?? []).map((g) => g.group_id);
    const { data: membros } = groupIds.length
      ? await supabase
          .from("group_members")
          .select("person_id, group_id, people(full_name, email, user_id)")
          .in("group_id", groupIds)
      : { data: [] as never[] };

    const porPessoa = new Map<string, { nome: string; email: string | null; temLogin: boolean; group_id: string }>();
    for (const m of membros ?? []) {
      const p = m.people as unknown as { full_name: string; email: string | null; user_id: string | null } | null;
      if (!p || porPessoa.has(m.person_id)) continue;
      porPessoa.set(m.person_id, {
        nome: p.full_name, email: p.email, temLogin: !!p.user_id, group_id: m.group_id,
      });
    }

    return {
      aula: {
        id: aula.id, titulo: aula.titulo, local: aula.local,
        comeca_em: aula.comeca_em, termina_em: aula.termina_em,
      },
      // A trava de local, para a tela dizer se está ligada e desde quando.
      // Nunca `null` colapsado com "desligada": travada com raio de 300 m e
      // travada com raio de 2 km mudam quem entra.
      trava:
        aula.local_lat !== null && aula.local_lng !== null
          ? {
              raio_m: aula.local_raio_m ?? 300,
              travado_em: aula.local_travado_em,
            }
          : null,
      janela: janela
        ? { inicio: janela.inicio.toISOString(), fim: janela.fim.toISOString(), aberta: dentroDaJanela(janela, agora) }
        : null,
      codigos,
      presencas: (presencas ?? []).map((p) => ({
        id: p.id,
        person_id: p.person_id,
        nome: (p.people as unknown as { full_name: string } | null)?.full_name ?? "—",
        origem: p.origem,
        // Os dois separados, NUNCA colapsados: o atraso só existe com a hora do
        // scan. Colapsar em "quando" fazia uma presença lançada de manhã
        // aparecer como 934 minutos de atraso.
        escaneado_em: p.escaneado_em,
        registrado_em: p.registrado_em,
        situacao: p.situacao,
        observacao: p.observacao,
        distancia_m: p.distancia_m,
      })),
      turma: [...porPessoa.entries()].map(([person_id, v]) => ({ person_id, ...v }))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    };
  });

/**
 * Travar (ou soltar) a aula no lugar onde ela acontece.
 *
 * Separado de `abrirCheckin` de propósito: aquela é GET e a tela do professor a
 * chama de minuto em minuto para girar o QR. Gravar ali faria a coordenada ser
 * reescrita a cada giro — e um professor que abrisse a tela de casa na véspera
 * travaria a aula na sala dele.
 *
 * A coordenada vem do aparelho de quem está conduzindo, no momento em que ele
 * clica. É a única fonte confiável de "onde a aula é": o endereço digitado em
 * `local` é texto livre, e geocodificar texto livre exige um serviço externo
 * para acertar menos que o GPS na mão.
 */
export const travarLocalDaAula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        aula_id: z.string().uuid(),
        // Ausentes = soltar a trava.
        lat: z.number().min(-90).max(90).nullable().optional(),
        lng: z.number().min(-180).max(180).nullable().optional(),
        raio_m: z.number().int().min(50).max(5000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: pode, error: ePode } = await supabase.rpc("posso_dar_aula", { p_aula: data.aula_id });
    if (ePode) throw new Error(ePode.message);
    if (pode !== true) throw new Error("Você não conduz esta aula.");

    const soltando = data.lat === null || data.lat === undefined || data.lng === null || data.lng === undefined;
    const { error } = await supabase
      .from("treinamento_aulas")
      .update(
        soltando
          ? { local_lat: null, local_lng: null, local_travado_em: null }
          : {
              local_lat: data.lat,
              local_lng: data.lng,
              local_raio_m: data.raio_m ?? 300,
              local_travado_em: new Date().toISOString(),
            },
      )
      .eq("id", data.aula_id);
    if (error) throw new Error(error.message);
    return { ok: true as const, travada: !soltando };
  });

/**
 * O aluno confirma.
 *
 * Cinco checagens, e nenhuma delas é dispensável:
 * passe assinado e não vencido · a janela da aula DE NOVO (o passe vale 10 min e
 * a aula pode ter acabado nesse meio) · a pessoa resolvida pela conta DONA do
 * treinamento (o mesmo e-mail pode existir em duas contas, e `user_id` não é
 * único) · o vínculo de grupo explícito (com service role `auth.uid()` é nulo,
 * então `posso_ver_treinamento` não serve aqui) · e o nonce, que é o que faz o
 * passe valer por uma presença só.
 *
 * Grava com service role porque o aluno não tem — e não pode ter — permissão de
 * inserir presença: a RLS não sabe se o QR foi lido.
 */
export const confirmarPresenca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        aula_id: z.string().uuid(),
        // Onde o aparelho diz que está. Opcionais porque a aula pode não estar
        // travada — e porque o navegador pode simplesmente não devolver.
        lat: z.number().min(-90).max(90).nullable().optional(),
        lng: z.number().min(-180).max(180).nullable().optional(),
        precisao_m: z.number().nonnegative().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { lerPasse, nomeDoCookie, cookieDaRequisicao, janelaDaAula, dentroDaJanela } =
      await import("@/lib/checkin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const passe = lerPasse(
      data.aula_id,
      cookieDaRequisicao(getRequest()?.headers.get("cookie") ?? null, nomeDoCookie(data.aula_id)),
    );
    if (!passe) return { ok: false as const, motivo: "sem_passe" as const };

    const { data: aula, error: eA } = await supabaseAdmin
      .from("treinamento_aulas")
      .select("id, titulo, comeca_em, termina_em, modulo_id, fechada_em, cancelada, local_lat, local_lng, local_raio_m")
      .eq("id", data.aula_id)
      .maybeSingle();
    if (eA) throw new Error(eA.message);
    if (!aula) return { ok: false as const, motivo: "sem_aula" as const };
    // Quem já tinha o passe no bolso quando o professor cancelou para aqui.
    if (aula.cancelada) return { ok: false as const, motivo: "cancelada" as const };

    const janela = janelaDaAula(aula);
    if (!janela || !dentroDaJanela(janela)) {
      return { ok: false as const, motivo: "fora_da_janela" as const, fim: janela?.fim.toISOString() ?? null };
    }

    // ---- Onde. É o que o QR rotativo sozinho não prova ----
    //
    // Só entra em cena com a aula travada. Sem trava, `distancia` fica nula e
    // nada aqui reprova ninguém — o comportamento de antes, intacto.
    const travada = aula.local_lat !== null && aula.local_lng !== null;
    let distancia: number | null = null;
    if (travada) {
      if (typeof data.lat !== "number" || typeof data.lng !== "number") {
        // Recusa explícita, e não silenciosa: sem esta porta, negar a permissão
        // de localização viraria o jeito mais fácil de burlar a trava.
        return { ok: false as const, motivo: "sem_localizacao" as const };
      }
      const { distanciaEmMetros, folgaDaPrecisao } = await import("@/lib/geo");
      distancia = distanciaEmMetros(
        { lat: aula.local_lat as number, lng: aula.local_lng as number },
        { lat: data.lat, lng: data.lng },
      );
      const limite = (aula.local_raio_m ?? 300) + folgaDaPrecisao(data.precisao_m);
      if (distancia > limite) {
        return {
          ok: false as const,
          motivo: "longe" as const,
          distancia_m: distancia,
          raio_m: aula.local_raio_m ?? 300,
        };
      }
    }

    const { data: modulo, error: eM } = await supabaseAdmin
      .from("treinamento_modulos").select("treinamento_id").eq("id", aula.modulo_id).maybeSingle();
    if (eM) throw new Error(eM.message);
    const { data: trein, error: eT } = modulo
      ? await supabaseAdmin.from("treinamentos").select("id, titulo, mentor_id").eq("id", modulo.treinamento_id).maybeSingle()
      : { data: null, error: null };
    if (eT) throw new Error(eT.message);
    if (!trein) return { ok: false as const, motivo: "sem_aula" as const };

    // A pessoa é procurada DENTRO da conta dona do treinamento. Sem esse filtro,
    // quem está cadastrado em duas contas poderia ter a presença gravada com a
    // pessoa da conta errada — e aí a lista do professor mostra um estranho.
    const { data: pessoas, error: ePe } = await supabaseAdmin
      .from("people")
      .select("id, full_name, email, mentor_id")
      .eq("user_id", userId)
      .eq("mentor_id", trein.mentor_id);
    if (ePe) throw new Error(ePe.message);
    const pessoa = (pessoas ?? [])[0];
    if (!pessoa) return { ok: false as const, motivo: "nao_e_aluno" as const };

    // O grupo que autoriza — e que fica gravado na linha.
    //
    // Em dois passos, e não por join aninhado: `treinamento_grupos` e
    // `group_members` não têm chave estrangeira entre si (as duas apontam para
    // `groups`), então o PostgREST recusa o embed com "could not find a
    // relationship". Foi assim que este caminho quebrou no primeiro teste.
    const { data: gruposDoTrein, error: eG } = await supabaseAdmin
      .from("treinamento_grupos")
      .select("group_id")
      .eq("treinamento_id", trein.id);
    if (eG) throw new Error(eG.message);
    const idsDosGrupos = (gruposDoTrein ?? []).map((g) => g.group_id);
    if (idsDosGrupos.length === 0) return { ok: false as const, motivo: "sem_grupo" as const };

    // Ordenado pelo nome do grupo, não `.limit(1)` cru: quem está em dois grupos
    // do treinamento apareceria num ou noutro conforme o humor do planejador de
    // consultas, e a lista de presença mudaria entre dois carregamentos.
    const { data: elo, error: eE } = await supabaseAdmin
      .from("group_members")
      .select("group_id, groups(name)")
      .eq("person_id", pessoa.id)
      .in("group_id", idsDosGrupos);
    if (eE) throw new Error(eE.message);
    const grupos = (elo ?? [])
      .map((g) => ({ id: g.group_id, nome: (g.groups as unknown as { name: string } | null)?.name ?? "" }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.id.localeCompare(b.id));
    const groupId = grupos[0]?.id ?? null;
    if (!groupId) return { ok: false as const, motivo: "sem_grupo" as const };

    const aulaJaFechada = !!aula.fechada_em;
    const escaneadoEm = new Date(passe.escaneadoEm).toISOString();
    const { data: nova, error: eIns } = await supabaseAdmin
      .from("treinamento_presencas")
      .insert({
        aula_id: aula.id,
        person_id: pessoa.id,
        group_id: groupId,
        // O NOME do grupo junto, gravado agora: renomear a turma depois não pode
        // reescrever uma lista já emitida, e apagar o grupo não pode esvaziar a
        // célula de um documento de arquivo.
        group_nome: grupos[0]?.nome || null,
        origem: "qr",
        escaneado_em: escaneadoEm,
        passe_nonce: passe.nonce,
        // A DISTÂNCIA, não a coordenada. Guardar onde cada aluno estava seria
        // um rastro de localização que a lista de presença não precisa ter —
        // e que a plataforma teria de proteger para sempre.
        distancia_m: distancia,
      })
      .select("id, escaneado_em")
      .maybeSingle();

    if (eIns) {
      // 23505 = chave duplicada. Dois casos MUITO diferentes caem aqui.
      if (eIns.code !== "23505") throw new Error(eIns.message);

      // (a) o passe já foi usado: é o celular emprestado virando a turma toda.
      if (`${eIns.message ?? ""} ${eIns.details ?? ""}`.includes("passe_nonce")) {
        return { ok: false as const, motivo: "passe_usado" as const };
      }

      const { data: existente } = await supabaseAdmin
        .from("treinamento_presencas")
        .select("id, origem, situacao, escaneado_em, registrado_em")
        .eq("aula_id", aula.id)
        .eq("person_id", pessoa.id)
        .maybeSingle();

      // (b) o professor já tinha marcado à mão. A pessoa acabou de escanear na
      // sala, então a lista está desatualizada: promove para 'qr' e devolve a
      // situação ao cálculo, preservando a observação dele.
      //
      // Limpa TAMBÉM quando estava 'justificado', não só 'ausente': quem
      // justificou a falta e apareceu continuaria com falta justificada — e
      // falta justificada não conta como presença, então ele sairia com zero na
      // frequência mesmo tendo assistido à aula.
      if (existente && existente.origem === "manual") {
        const { error: eUp } = await supabaseAdmin
          .from("treinamento_presencas")
          .update({
            origem: "qr",
            escaneado_em: escaneadoEm,
            passe_nonce: passe.nonce,
            distancia_m: distancia,
            situacao:
              existente.situacao === "ausente" || existente.situacao === "justificado"
                ? null
                : existente.situacao,
          })
          .eq("id", existente.id);
        if (eUp) throw new Error(eUp.message);
        // Ponto só quando a lista já está fechada — quem chegou atrasado e
        // escaneou depois do fechamento. Com a lista aberta, quem lança é o
        // fechamento.
        if (aulaJaFechada) await pontuarPresenca(pessoa.id, aula.id, trein.mentor_id, true);
        return { ok: true as const, ja_estava: false, quando: escaneadoEm, aula: aula.titulo };
      }

      // (c) ela mesma já confirmou. Isso é SUCESSO — o toque duplo no celular é
      // o caso comum, e dizer "erro" manda a pessoa perguntar ao professor.
      return {
        ok: true as const,
        ja_estava: true,
        quando: existente?.escaneado_em ?? existente?.registrado_em ?? escaneadoEm,
        aula: aula.titulo,
      };
    }

    if (aulaJaFechada) await pontuarPresenca(pessoa.id, aula.id, trein.mentor_id, true);
    await avisarPresenca(trein.mentor_id, pessoa, aula.titulo, trein.titulo);
    return { ok: true as const, ja_estava: false, quando: nova?.escaneado_em ?? escaneadoEm, aula: aula.titulo };
  });

/**
 * Ponto de presença — concedido ou tirado, conforme o estado final da pessoa
 * naquela aula.
 *
 * Escreve com service role de propósito. A policy do `pontos` é
 * `user_id = auth.uid()` ("só em nome próprio"), o que serve para a comunidade,
 * onde a própria pessoa age — mas aqui quem confirma a presença pode ser o
 * PROFESSOR, marcando à mão para quem não tem celular. Com o cliente dele o
 * insert seria recusado, e recusado em silêncio: o aluno sem smartphone ficaria
 * de fora do ranking sem ninguém entender por quê. Quem autoriza é a server
 * function, antes de chamar isto.
 *
 * A repetição é inofensiva: o índice único (user_id, acao, referencia) da
 * tabela `pontos` recusa a segunda vez, e `darPonto` engole.
 */
async function pontuarPresenca(
  personId: string,
  aulaId: string,
  contaId: string,
  presente: boolean,
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { darPonto, tirarPonto } = await import("@/lib/pontos.functions");
    const { data: pessoa } = await supabaseAdmin
      .from("people").select("user_id").eq("id", personId).maybeSingle();
    // Sem login não há a quem dar ponto agora: `pontos.user_id` aponta para
    // auth.users. Não é perda — a presença fica gravada em
    // `treinamento_presencas`, e `claim_student_profile()` concede os pontos de
    // todas as aulas fechadas no dia em que a pessoa fizer o primeiro acesso
    // (migração 20260730270000). Quem compareceu não perde o encontro por não
    // ter criado a senha ainda.
    if (!pessoa?.user_id) return;
    if (presente) {
      await darPonto(supabaseAdmin, pessoa.user_id, contaId, "presenca", aulaId);
    } else {
      await tirarPonto(supabaseAdmin, pessoa.user_id, "presenca", aulaId);
    }
  } catch {
    // Pontuação nunca derruba o registro de presença.
  }
}

/**
 * O e-mail de presença confirmada.
 *
 * Silencioso de propósito, como a pontuação e as notificações: a presença já
 * está gravada quando isto roda. Se o Resend estiver fora, a pessoa esteve na
 * aula do mesmo jeito — o e-mail é aviso, não prova. Mas a falha vai para
 * `email_logs`, senão ninguém descobre que parou de enviar.
 */
async function avisarPresenca(
  contaId: string,
  pessoa: { id: string; full_name: string; email: string | null },
  aula: string,
  treinamento: string,
) {
  try {
    if (!pessoa.email) return;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { enviarEmail, montarHtml } = await import("@/lib/email.server");
    const { data: perfil } = await supabaseAdmin
      .from("profiles")
      .select("company_name, logo_url, brand_color, site_url, support_email, email_from")
      .eq("user_id", contaId)
      .maybeSingle();

    if (perfil?.logo_url) {
      const { assinarUrl, TTL_LOGO_EMAIL_SEGUNDOS } = await import("@/lib/storage-assinado.server");
      perfil.logo_url = await assinarUrl(supabaseAdmin, perfil.logo_url, TTL_LOGO_EMAIL_SEGUNDOS);
    }

    const assunto = `Presença confirmada — ${aula}`;
    const resultado = await enviarEmail({
      to: pessoa.email,
      subject: assunto,
      html: montarHtml({
        corpo: `Olá, ${pessoa.full_name.split(" ")[0]}!\n\nSua presença em “${aula}” (${treinamento}) está confirmada. Bom encontro!\n\nOs materiais da aula ficam no seu painel, junto com as próximas datas.`,
        link: "/aluno/classroom",
        rotuloBotao: "Ver o treinamento",
        marca: perfil ?? null,
      }),
      from: perfil?.email_from ?? null,
      replyTo: perfil?.support_email ?? null,
    });

    await supabaseAdmin.from("email_logs").insert({
      mentor_id: contaId,
      kind: "presenca",
      to_email: pessoa.email,
      subject: assunto,
      person_id: pessoa.id,
      status: resultado.ok ? "enviado" : "falhou",
      provider_id: resultado.ok ? resultado.provider_id : null,
      error: resultado.ok ? null : resultado.erro,
    });
  } catch {
    // Ver o comentário acima: o e-mail nunca derruba a presença.
  }
}

/** A minha presença nesta aula — para a página não exigir passe de quem já confirmou. */
export const minhaPresenca = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ aula_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Filtra pela pessoa EXPLICITAMENTE, em vez de confiar na policy para
    // recortar: quem abre esta tela pode ser o professor (a policy
    // `pres_professor` entrega a lista inteira da aula), e aí o `maybeSingle`
    // estouraria com "multiple rows" a partir da segunda presença.
    const { data: p, error } = await supabase
      .from("treinamento_presencas")
      .select("id, origem, escaneado_em, registrado_em, situacao, people!inner(user_id)")
      .eq("aula_id", data.aula_id)
      .eq("people.user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    // O nome da aula sem exigir acesso de professor: a RLS de aulas já entrega
    // ao aluno do grupo.
    const { data: aula } = await supabase
      .from("treinamento_aulas")
      .select("titulo, comeca_em, termina_em, local, local_lat, local_lng")
      .eq("id", data.aula_id)
      .maybeSingle();

    return {
      presenca: p ? { quando: p.escaneado_em ?? p.registrado_em, origem: p.origem } : null,
      // As coordenadas ficam FORA: a tela do aluno só precisa saber que vai ter
      // de liberar a localização. Devolver o ponto exato entregaria a quem
      // quisesse burlar a coordenada a falsear.
      exige_local: !!(aula?.local_lat !== null && aula?.local_lng !== null && aula),
      aula: aula
        ? {
            titulo: aula.titulo,
            comeca_em: aula.comeca_em,
            termina_em: aula.termina_em,
            local: aula.local,
          }
        : null,
    };
  });

/**
 * O professor marca presença à mão.
 *
 * Trazido da etapa 5 para cá de propósito. Sem isto, a primeira aula real vai ao
 * ar sem plano B: o aluno que nunca criou senha não consegue confirmar pelo QR
 * (o link do primeiro acesso chega por e-mail e abre no navegador embutido do
 * app de e-mail, onde o passe não existe), e o professor fica com um aluno
 * presente e nenhuma forma de registrar. Celular sem bateria e sala sem sinal
 * caem no mesmo lugar.
 *
 * A tabela de presença completa — atraso, frequência acumulada, exportação —
 * continua na etapa 5.
 */
export const marcarPresencaManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      aula_id: z.string().uuid(),
      person_id: z.string().uuid(),
      // `undefined` = não mexer nesta chave. `null` = devolver ao cálculo.
      // São coisas diferentes, e tratá-las igual apagava a observação do
      // professor a cada troca de situação.
      situacao: z.enum(["presente", "atrasado", "ausente", "justificado"]).nullable().optional(),
      observacao: z.string().trim().max(500).nullable().optional(),
      /** Apaga a linha inteira — só serve para linha criada à mão. */
      remover: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pode, error: ePode } = await supabase.rpc("posso_dar_aula", { p_aula: data.aula_id });
    if (ePode) throw new Error(ePode.message);
    if (pode !== true) throw new Error("Você não conduz esta aula.");

    if (data.remover) {
      // Só apaga o que foi marcado à mão: check-in do aluno não se desfaz por
      // clique do professor — para isso existe marcar 'ausente', que fica
      // registrado como decisão dele.
      const { error } = await supabase
        .from("treinamento_presencas")
        .delete()
        .eq("aula_id", data.aula_id)
        .eq("person_id", data.person_id)
        .eq("origem", "manual")
        .select("id");
      if (error) throw new Error(error.message);
      // O gatilho do banco (migração 20260730180000) tira o ponto junto quando a
      // linha some. Nada a fazer aqui — e é de propósito: se este caminho
      // tirasse o ponto por conta própria, apagar "nada" (linha de QR, que o
      // filtro `origem = manual` não casa) tiraria os pontos de uma presença que
      // continua na tela.
      return { ok: true };
    }

    // O nome de quem está mexendo, gravado em texto: colaborador desativado ou
    // apagado não pode apagar o rastro da linha mais contestável da lista.
    const { data: perfil } = await supabase
      .from("profiles").select("full_name").eq("user_id", userId).maybeSingle();
    const { data: eu } = await supabase.auth.getUser();
    const quem = perfil?.full_name?.trim() || eu.user?.email || "—";

    // A conta dona do treinamento — e a porteira da PESSOA.
    const { data: aulaDoPonto } = await supabase
      .from("treinamento_aulas").select("modulo_id, fechada_em").eq("id", data.aula_id).maybeSingle();
    const { data: moduloDoPonto } = aulaDoPonto
      ? await supabase.from("treinamento_modulos").select("treinamento_id")
          .eq("id", aulaDoPonto.modulo_id).maybeSingle()
      : { data: null };
    const { data: treinDoPonto } = moduloDoPonto
      ? await supabase.from("treinamentos").select("id, mentor_id")
          .eq("id", moduloDoPonto.treinamento_id).maybeSingle()
      : { data: null };

    // O grupo pelo qual a pessoa tem acesso a este treinamento. Serve para duas
    // coisas, e a segunda é o que importa: preencher a coluna Grupo, e RECUSAR
    // pessoa que não é da turma.
    //
    // A policy `pres_professor` só valida `aula_id` — `person_id` vem do cliente
    // e nunca era conferido. Sem esta porteira, quem conduz uma aula podia
    // gravar presença (e, a partir desta etapa, PONTO) para uma pessoa de outra
    // conta. A trava tem de estar aqui: a RLS não consegue fazê-la sozinha.
    let groupId: string | null = null;
    let groupNome: string | null = null;
    if (moduloDoPonto) {
      const { data: tg } = await supabase
        .from("treinamento_grupos").select("group_id").eq("treinamento_id", moduloDoPonto.treinamento_id);
      const ids = (tg ?? []).map((g) => g.group_id);
      if (ids.length) {
        const { data: elo } = await supabase
          .from("group_members").select("group_id, groups(name)")
          .eq("person_id", data.person_id).in("group_id", ids);
        const ordenado = (elo ?? [])
          .map((g) => ({ id: g.group_id, nome: (g.groups as unknown as { name: string } | null)?.name ?? "" }))
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.id.localeCompare(b.id));
        groupId = ordenado[0]?.id ?? null;
        groupNome = ordenado[0]?.nome || null;
      }
    }
    if (!groupId) {
      throw new Error("Esta pessoa não está em nenhum grupo com acesso a este treinamento.");
    }

    // Presença marcada à mão vale ponto igual à do QR: quem não tem celular ou
    // senha esteve na sala do mesmo jeito. Ausente tira o ponto — inclusive de
    // quem escaneou e foi embora. Falta justificada NÃO tira: ela já não conta
    // como presença, e punir quem avisou seria cobrar duas vezes pela mesma
    // falta, na única tela que a turma inteira vê.
    const contaPresente = data.situacao === undefined || data.situacao === null
      || data.situacao === "presente" || data.situacao === "atrasado";

    // Lê antes de escrever, em vez de um upsert de tiro único: se a pessoa já
    // deu check-in pelo QR, o `origem` NÃO pode virar 'manual'. O professor
    // pode ter razão para marcá-la ausente (ela escaneou e foi embora), mas
    // apagar o fato de que houve um check-in é a tabela mentindo por omissão —
    // exatamente o que a coluna `origem` existe para evitar.
    const { data: existente, error: eLer } = await supabase
      .from("treinamento_presencas")
      .select("id, origem")
      .eq("aula_id", data.aula_id)
      .eq("person_id", data.person_id)
      .maybeSingle();
    if (eLer) throw new Error(eLer.message);

    if (existente) {
      // Só as chaves que vieram. Trocar a situação não pode comer a observação.
      const patch: {
        registrado_por: string; marcado_por_nome: string;
        situacao?: string | null; observacao?: string | null;
      } = { registrado_por: userId, marcado_por_nome: quem };
      if (data.situacao !== undefined) patch.situacao = data.situacao;
      if (data.observacao !== undefined) patch.observacao = data.observacao;
      const { error } = await supabase
        .from("treinamento_presencas").update(patch).eq("id", existente.id);
      if (error) throw new Error(error.message);
      // Ajuste depois do fechamento mexe no ponto na hora. Com a lista ainda
      // aberta não há ponto para mexer: ele nasce no fechamento.
      if (data.situacao !== undefined && treinDoPonto && aulaDoPonto?.fechada_em) {
        await pontuarPresenca(data.person_id, data.aula_id, treinDoPonto.mentor_id, contaPresente);
      }
      return { ok: true, origem: existente.origem };
    }

    const { error } = await supabase.from("treinamento_presencas").insert({
      aula_id: data.aula_id,
      person_id: data.person_id,
      group_id: groupId,
      group_nome: groupNome,
      origem: "manual",
      // Sem situação gravada quando o professor só diz "estava presente": aí a
      // regra do cálculo continua valendo para esta linha. Gravar 'presente' por
      // efeito colateral tornaria a linha indistinguível de uma decisão
      // deliberada dele — e congelaria o valor contra o cálculo para sempre.
      situacao: data.situacao ?? null,
      observacao: data.observacao ?? null,
      registrado_por: userId,
      marcado_por_nome: quem,
    });
    if (error) throw new Error(error.message);
    if (treinDoPonto && aulaDoPonto?.fechada_em) {
      await pontuarPresenca(data.person_id, data.aula_id, treinDoPonto.mentor_id, contaPresente);
    }
    return { ok: true, origem: "manual" };
  });

// ============================================================
// A lista de presença (etapa 5)
// ============================================================

/**
 * A tabela inteira do treinamento, já derivada.
 *
 * A autorização é checada UMA vez, no nível do treinamento: `posso_dar_aula` é
 * SECURITY DEFINER, e chamá-la por linha numa turma de 40 com 12 aulas seriam
 * 480 chamadas numa leitura. As consultas depois são planas e escopadas pelas
 * aulas deste treinamento.
 */
export const tabelaDePresenca = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ treinamento_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: aulas, error } = await supabase
      .from("treinamento_modulos")
      .select("treinamento_aulas(id)")
      .eq("treinamento_id", data.treinamento_id);
    if (error) throw new Error(error.message);
    const primeira = (aulas ?? [])
      .flatMap((m) => (m.treinamento_aulas as unknown as Array<{ id: string }>) ?? [])[0]?.id;
    if (!primeira) {
      // Sem aula não há lista — e sem aula não há como checar `posso_dar_aula`.
      // A RLS já garantiu que ele pode LER o treinamento para chegar aqui.
      const { montarTabelaPresenca } = await import("@/lib/presenca.server");
      return montarTabelaPresenca(supabase, data.treinamento_id);
    }
    const { data: pode, error: ePode } = await supabase.rpc("posso_dar_aula", { p_aula: primeira });
    if (ePode) throw new Error(ePode.message);
    if (pode !== true) throw new Error("Você não conduz este treinamento.");

    const { montarTabelaPresenca } = await import("@/lib/presenca.server");
    return montarTabelaPresenca(supabase, data.treinamento_id);
  });

/**
 * A planilha. Montada no servidor, a partir da MESMA função da tela — a
 * exportação nunca recalcula nada por conta própria.
 */
export const presencaParaExportar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      treinamento_id: z.string().uuid(),
      /** Vazio = todas as aulas. */
      aula_ids: z.array(z.string().uuid()).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { montarTabelaPresenca, linhasParaPlanilha, resumoParaPlanilha } =
      await import("@/lib/presenca.server");

    const tabela = await montarTabelaPresenca(supabase, data.treinamento_id);
    const filtrada = data.aula_ids?.length
      ? { ...tabela, linhas: tabela.linhas.filter((l) => data.aula_ids!.includes(l.aula_id)) }
      : tabela;

    const { data: eu } = await supabase.auth.getUser();
    const emitidoEm = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const naConta = tabela.aulas.filter(
      (a) => !tabela.fora_da_conta.some((f) => f.titulo === a.titulo),
    ).length;

    // O rodapé é o que faz a planilha se sustentar longe da tela: sem ele,
    // ninguém sabe até quando a frequência foi apurada, nem por que uma aula
    // não entrou na conta, nem que falta justificada não conta como presença.
    const rodape = [
      `${tabela.treinamento.titulo} · emitido em ${emitidoEm} por ${eu.user?.email ?? "—"}`,
      `Frequência apurada até ${new Date(tabela.referencia).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (horário de Brasília)`,
      `${naConta} ${naConta === 1 ? "aula entra" : "aulas entram"} na conta da frequência` +
        (tabela.fora_da_conta.length
          ? ` · fora da conta: ${tabela.fora_da_conta.map((f) => `${f.titulo} (${f.motivo})`).join("; ")}`
          : ""),
      `Atrasado a partir de ${tabela.tolerancia_min} min · falta justificada não conta como presença`,
      "O denominador conta as aulas já realizadas e com lista fechada, não o total do treinamento",
      "Os horários registram a confirmação de chegada, não permanência na sala",
      "Registro pelo professor é caminho previsto para quem não tem celular, senha ou sinal — não indica irregularidade",
    ].join("\n");

    return {
      linhas: linhasParaPlanilha(filtrada),
      resumo: resumoParaPlanilha(tabela),
      rodape,
      titulo: tabela.treinamento.titulo,
    };
  });

/**
 * Fechar a lista da aula — o que transforma "ninguém escaneou" em "faltou".
 *
 * Enquanto a lista está aberta, quem não tem registro aparece como "sem
 * registro" e a aula não entra na conta da frequência. Isso existe porque o
 * silêncio não pode virar afirmação: QR que não subiu, wifi caído ou uma tela
 * que ninguém abriu produziriam a turma inteira "ausente" num documento que o
 * RH usa para negar reembolso.
 *
 * Reabrir é permitido e some com a afirmação — o professor achou o erro.
 */
/**
 * Cancela (ou descancela) um encontro.
 *
 * Cancelar NÃO é apagar, e a diferença é o ponto todo: apagar leva as presenças
 * em cascata — e o gatilho `presenca_apagada_tira_ponto` leva os pontos junto —,
 * destruindo o documento de arquivo. Cancelar preserva tudo o que aconteceu e
 * só deixa de contar.
 *
 * Os efeitos colaterais rodam todos aqui, num lugar só:
 *   1. o evento some da agenda de todo mundo e do Google Calendar;
 *   2. a turma é avisada — cancelamento é o aviso mais urgente que existe;
 *   3. os pontos já lançados são retirados (e devolvidos ao descancelar);
 *   4. o check-in para de aceitar (a checagem vive no endpoint, ver `cancelada`).
 *
 * `fechada_em` NÃO é limpo: quem fechou, fechou. É fato de auditoria.
 */
export const cancelarAula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      aula_id: z.string().uuid(),
      cancelar: z.boolean(),
      motivo: z.string().trim().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pode, error: ePode } = await supabase.rpc("posso_dar_aula", { p_aula: data.aula_id });
    if (ePode) throw new Error(ePode.message);
    if (pode !== true) throw new Error("Você não conduz esta aula.");

    // `.select()` e conferência do que voltou: a policy de escrita da aula é
    // mais estreita que `posso_dar_aula` (exige ser o DONO), e um UPDATE que
    // não atinge linha nenhuma volta SEM erro. Sem isto, a tela diria
    // "cancelada" e o banco continuaria como estava.
    const { data: mudadas, error } = await supabase
      .from("treinamento_aulas")
      .update({ cancelada: data.cancelar })
      .eq("id", data.aula_id)
      .select("id, titulo, comeca_em, fechada_em, cancelada, modulo_id");
    if (error) throw new Error(error.message);
    if (!mudadas || mudadas.length === 0) {
      throw new Error("Só o dono do treinamento pode cancelar um encontro.");
    }
    const aula = mudadas[0];

    // Tira o evento da agenda (ou o devolve ao descancelar). A própria função
    // já trata `cancelada` como "sem data".
    await sincronizarEventoDaAula(supabase, userId, data.aula_id);

    const { data: mod } = await supabase
      .from("treinamento_aulas").select("modulo_id").eq("id", data.aula_id).maybeSingle();
    const { data: modulo } = mod
      ? await supabase.from("treinamento_modulos").select("treinamento_id").eq("id", mod.modulo_id).maybeSingle()
      : { data: null };
    const { data: trein } = modulo
      ? await supabase.from("treinamentos").select("titulo, mentor_id").eq("id", modulo.treinamento_id).maybeSingle()
      : { data: null };

    // ---- Os pontos ----
    // Nascem no fechamento da lista e nada mais os recalcula. Se a aula for
    // cancelada DEPOIS de fechada, eles ficariam para sempre no ranking de um
    // encontro que já saiu da frequência. As presenças ficam: são o registro.
    let pontos = 0;
    if (trein && aula.fechada_em) {
      const { data: presencas } = await supabase
        .from("treinamento_presencas")
        .select("person_id, situacao, escaneado_em")
        .eq("aula_id", data.aula_id);
      const { data: cheia } = await supabase
        .from("treinamento_aulas")
        .select("comeca_em, termina_em, fechada_em, cancelada")
        .eq("id", data.aula_id).maybeSingle();

      if (cheia) {
        const { situacaoDe, contaComoPresenca } = await import("@/lib/presenca");
        const aulaPra = {
          id: data.aula_id, titulo: "", modulo: "", local: null,
          comeca_em: cheia.comeca_em, termina_em: cheia.termina_em,
          fechada_em: cheia.fechada_em, cancelada: cheia.cancelada,
        };
        for (const p of presencas ?? []) {
          const s = situacaoDe(
            {
              aula_id: data.aula_id, person_id: p.person_id, origem: "", grupo: null,
              escaneado_em: p.escaneado_em, registrado_em: "", situacao: p.situacao,
              observacao: null, marcado_por_nome: null,
            },
            aulaPra,
          );
          // Descancelar devolve o ponto pela MESMA regra do fechamento.
          const ganha = !data.cancelar && contaComoPresenca(s);
          await pontuarPresenca(p.person_id, data.aula_id, trein.mentor_id, ganha);
          pontos += 1;
        }
      }
    }

    // ---- O aviso ----
    // Até aqui a turma só era avisada quando o encontro NASCIA ou MUDAVA DE
    // HORA. Cancelamento é o que mais importa e era o único que não saía.
    if (trein && data.cancelar) {
      const { data: grupos } = await supabase
        .from("treinamento_grupos").select("group_id").eq("treinamento_id", modulo!.treinamento_id);
      const ids = (grupos ?? []).map((g) => g.group_id);
      if (ids.length) {
        const { quandoBr } = await import("@/lib/notificacoes.functions");
        const quando = aula.comeca_em ? quandoBr(aula.comeca_em) : null;
        await notificar(supabase, {
          conta: trein.mentor_id,
          tipo: "aula_cancelada",
          titulo: `Encontro cancelado: ${aula.titulo}`,
          corpo: [quando ? `Era ${quando}.` : null, data.motivo?.trim() || null]
            .filter(Boolean).join(" ") || null,
          link: "/aluno/classroom",
          grupos: ids,
        });
      }
    }

    return { ok: true, cancelada: aula.cancelada, pontos_recalculados: pontos };
  });

export const fecharListaDaAula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ aula_id: z.string().uuid(), fechar: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pode, error: ePode } = await supabase.rpc("posso_dar_aula", { p_aula: data.aula_id });
    if (ePode) throw new Error(ePode.message);
    if (pode !== true) throw new Error("Você não conduz esta aula.");

    const { error } = await supabase
      .from("treinamento_aulas")
      .update(
        data.fechar
          ? { fechada_em: new Date().toISOString(), fechada_por: userId }
          : { fechada_em: null, fechada_por: null },
      )
      .eq("id", data.aula_id);
    if (error) throw new Error(error.message);

    // ------------------------------------------------------------------
    // É AQUI que o ponto de presença nasce — e não no momento do scan.
    //
    // No instante em que o aluno escaneia, a situação dele ainda não existe: a
    // lista está aberta, "sem registro" não é ausência, e nada foi afirmado.
    // Pontuar no scan obrigava a ficar corrigindo depois, a cada ajuste do
    // professor. Fechar a lista é o ato que transforma os registros em fatos —
    // então é o ato que lança os pontos. Reabrir desfaz, pelo mesmo motivo.
    // ------------------------------------------------------------------
    const { data: presencas } = await supabase
      .from("treinamento_presencas")
      .select("person_id, situacao, escaneado_em")
      .eq("aula_id", data.aula_id);

    const { data: aulaFechada } = await supabase
      .from("treinamento_aulas")
      .select("comeca_em, termina_em, fechada_em, cancelada")
      .eq("id", data.aula_id)
      .maybeSingle();

    const { data: mod } = await supabase
      .from("treinamento_aulas").select("modulo_id").eq("id", data.aula_id).maybeSingle();
    const { data: modulo } = mod
      ? await supabase.from("treinamento_modulos").select("treinamento_id").eq("id", mod.modulo_id).maybeSingle()
      : { data: null };
    const { data: trein } = modulo
      ? await supabase.from("treinamentos").select("mentor_id").eq("id", modulo.treinamento_id).maybeSingle()
      : { data: null };

    if (trein && aulaFechada) {
      // A MESMA função que a tabela do professor usa para decidir a situação —
      // e aula cancelada não pontua ninguém.
      const { situacaoDe, contaComoPresenca } = await import("@/lib/presenca");
      const aulaPra = {
        id: data.aula_id, titulo: "", modulo: "", local: null,
        comeca_em: aulaFechada.comeca_em, termina_em: aulaFechada.termina_em,
        fechada_em: aulaFechada.fechada_em, cancelada: aulaFechada.cancelada,
      };
      for (const p of presencas ?? []) {
        const s = situacaoDe(
          {
            aula_id: data.aula_id, person_id: p.person_id, origem: "", grupo: null,
            escaneado_em: p.escaneado_em, registrado_em: "", situacao: p.situacao,
            observacao: null, marcado_por_nome: null,
          },
          aulaPra,
        );
        const ganha = data.fechar && !aulaFechada.cancelada && contaComoPresenca(s);
        await pontuarPresenca(p.person_id, data.aula_id, trein.mentor_id, ganha);
      }
    }

    return { ok: true, pontuados: (presencas ?? []).length };
  });

/**
 * Avalia a aula: estrelas (1-5) e comentário opcional. #231 — as três regras
 * — presença que conta (QR e manual iguais), aula já terminada, uma vez só —
 * vivem dentro da RPC `avaliar_aula` (SECURITY DEFINER), não aqui; esta
 * função só repassa e traduz o erro. Mesmo padrão de avaliarSessaoMentoria
 * (student.functions.ts).
 */
export const avaliarAula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      aula_id: z.string().uuid(),
      estrelas: z.number().int().min(1).max(5),
      comentario: z.string().trim().max(2000).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("avaliar_aula", {
      _aula_id: data.aula_id,
      _estrelas: data.estrelas,
      _comentario: data.comentario ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * #256 — marca uma aula GRAVADA como concluída. As regras — só aula sem
 * horário, não cancelada, quem tem acesso ao treinamento — vivem dentro da
 * RPC `marcar_conclusao_aula`, não aqui.
 */
export const marcarAulaConcluida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ aula_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("marcar_conclusao_aula", { _aula_id: data.aula_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * #256 — desfaz a conclusão. A RPC `desmarcar_conclusao_aula` recusa se a
 * aula já foi avaliada — desfazer depois deixaria a avaliação órfã.
 */
export const desmarcarAulaConcluida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ aula_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("desmarcar_conclusao_aula", { _aula_id: data.aula_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Mesma regra de "presença válida" que #231 já usa em `avaliar_aula`
 * (`situacao IS NULL OR situacao IN ('presente', 'atrasado')`) — sem
 * override, uma presença registrada sempre vale; ausente e falta
 * justificada, nunca. Repetida aqui, pequena e comentada, em vez de importar
 * de `presenca.ts`: aquele módulo calcula ATRASO por horário (não é o que a
 * régua pergunta) e a restrição desta demanda é clara — não mexer ali.
 */
function presencaContaNaRegua(situacao: string | null): boolean {
  return situacao === null || situacao === "presente" || situacao === "atrasado";
}

/**
 * #221 F1 — a régua de conclusão do Classroom: quem já cumpriu o percentual
 * mínimo do treinamento, e quanto cada um já fez.
 *
 * "Item cumprido": aula COM horário conta pela presença válida (regra acima,
 * a mesma da #231); aula GRAVADA conta pela conclusão marcada pelo aluno
 * (#256, tabela `treinamento_aula_conclusoes`). Aula CANCELADA não entra
 * nem no numerador nem no denominador — simplesmente não é considerada.
 *
 * A turma é a mesma da lista de presença (`montarTabelaPresenca`): membros
 * atuais dos grupos do treinamento, mais quem tem presença ou conclusão e já
 * saiu — quem cumpriu não pode sumir da lista por um ajuste de turma depois.
 *
 * Só LÊ `treinamento_presencas` e `treinamento_aula_conclusoes` — nenhuma
 * escrita, nenhuma regra de #231/#256 tocada.
 *
 * #221 F2 — extraída para fora de `listaDeConcluidosTreinamento` (que
 * continua existindo, agora como uma casca fina em cima desta) para o
 * autocheck do próprio aluno em `getTreinamento` fazer a MESMA pergunta,
 * sem duas contas que podem discordar — é a razão de existir da régua
 * central. Não checa permissão nenhuma; quem chama decide se pode ver a
 * turma inteira ou só a própria linha.
 */
export async function calcularConclusoesDoTreinamento(
  supabase: SupabaseClient<Database>,
  treinamentoId: string,
) {
  const { data: treinamento, error: eT } = await supabase
    .from("treinamentos")
    .select("id, titulo, mentor_id, percentual_minimo")
    .eq("id", treinamentoId)
    .maybeSingle();
  if (eT) throw new Error(eT.message);
  if (!treinamento) throw new Error("Treinamento não encontrado.");

  const { data: modulos, error: eM } = await supabase
    .from("treinamento_modulos").select("id").eq("treinamento_id", treinamentoId);
  if (eM) throw new Error(eM.message);
  const modIds = (modulos ?? []).map((m) => m.id);

  const { data: aulasCru, error: eA } = modIds.length
    ? await supabase.from("treinamento_aulas").select("id, comeca_em, cancelada").in("modulo_id", modIds)
    : { data: [], error: null };
  if (eA) throw new Error(eA.message);

  const validas = (aulasCru ?? []).filter((a) => !a.cancelada);
  const comHorario = validas.filter((a) => a.comeca_em);
  const gravadas = validas.filter((a) => !a.comeca_em);

  const { data: tg } = await supabase
    .from("treinamento_grupos").select("group_id").eq("treinamento_id", treinamentoId);
  const groupIds = (tg ?? []).map((g) => g.group_id);
  const { data: membros } = groupIds.length
    ? await supabase.from("group_members").select("person_id, people(full_name, email)").in("group_id", groupIds)
    : { data: [] as never[] };

  const alunos = new Map<string, { person_id: string; nome: string; email: string | null }>();
  for (const m of membros ?? []) {
    const p = m.people as unknown as { full_name: string; email: string | null } | null;
    if (!p || alunos.has(m.person_id)) continue;
    alunos.set(m.person_id, { person_id: m.person_id, nome: p.full_name, email: p.email });
  }

  const [presRes, conclRes] = await Promise.all([
    comHorario.length
      ? supabase.from("treinamento_presencas").select("aula_id, person_id, situacao").in("aula_id", comHorario.map((a) => a.id))
      : Promise.resolve({ data: [] as Array<{ aula_id: string; person_id: string; situacao: string | null }>, error: null }),
    gravadas.length
      ? supabase.from("treinamento_aula_conclusoes").select("aula_id, person_id").in("aula_id", gravadas.map((a) => a.id))
      : Promise.resolve({ data: [] as Array<{ aula_id: string; person_id: string }>, error: null }),
  ]);
  if (presRes.error) throw new Error(presRes.error.message);
  if (conclRes.error) throw new Error(conclRes.error.message);

  // Quem cumpriu mas já saiu do grupo continua na lista — mesmo motivo de
  // `montarTabelaPresenca`: a conclusão dele aconteceu, e sumir da lista
  // por um ajuste de turma depois apagaria isso.
  const idsExtras = new Set<string>();
  for (const p of presRes.data ?? []) if (!alunos.has(p.person_id)) idsExtras.add(p.person_id);
  for (const c of conclRes.data ?? []) if (!alunos.has(c.person_id)) idsExtras.add(c.person_id);
  if (idsExtras.size) {
    const { data: extras } = await supabase.from("people").select("id, full_name, email").in("id", [...idsExtras]);
    for (const p of extras ?? []) alunos.set(p.id, { person_id: p.id, nome: p.full_name, email: p.email });
  }

  const presPorAluno = new Map<string, Map<string, string | null>>();
  for (const p of presRes.data ?? []) {
    let m = presPorAluno.get(p.person_id);
    if (!m) { m = new Map(); presPorAluno.set(p.person_id, m); }
    m.set(p.aula_id, p.situacao);
  }
  const conclPorAluno = new Map<string, Set<string>>();
  for (const c of conclRes.data ?? []) {
    let s = conclPorAluno.get(c.person_id);
    if (!s) { s = new Set(); conclPorAluno.set(c.person_id, s); }
    s.add(c.aula_id);
  }

  const { calcularConclusao } = await import("@/lib/regua-de-conclusao");
  const pessoas = [...alunos.values()]
    .map((aluno) => {
      let feitos = 0;
      const minhasPresencas = presPorAluno.get(aluno.person_id);
      for (const a of comHorario) {
        // `.has` primeiro: SEM registro nenhum nunca conta — só cai em
        // `presencaContaNaRegua` quando existe uma linha de presença de
        // verdade (cujo `situacao` pode legitimamente ser null).
        if (minhasPresencas?.has(a.id) && presencaContaNaRegua(minhasPresencas.get(a.id) ?? null)) feitos++;
      }
      for (const a of gravadas) {
        if (conclPorAluno.get(aluno.person_id)?.has(a.id)) feitos++;
      }
      return {
        ...aluno,
        ...calcularConclusao(feitos, validas.length, treinamento.percentual_minimo),
      };
    })
    .sort(
      (a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }) ||
        a.person_id.localeCompare(b.person_id),
    );

  return {
    treinamento: {
      id: treinamento.id,
      titulo: treinamento.titulo,
      mentor_id: treinamento.mentor_id,
      percentual_minimo: treinamento.percentual_minimo,
    },
    total_itens: validas.length,
    pessoas,
  };
}

/**
 * #221 F2 — a casca fina: checa permissão (só quem dá aula vê a turma
 * inteira), pergunta para a régua central, e garante que quem concluiu
 * tenha certificado emitido antes de devolver a lista — o mentor não aperta
 * botão nenhum, isto roda toda vez que ele abre a aba "Conclusão" (rotina já
 * estabelecida pela F1).
 */
export const listaDeConcluidosTreinamento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ treinamento_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Mesmo truque de `tabelaDePresenca`: `posso_dar_aula` é por aula, não há
    // RPC de treinamento inteiro. Sem aula nenhuma, a RLS de `treinamentos`
    // já barrou quem não pode ler — não há mais nada para checar.
    const { data: modulos } = await supabase
      .from("treinamento_modulos")
      .select("id")
      .eq("treinamento_id", data.treinamento_id);
    const modIds = (modulos ?? []).map((m) => m.id);
    const { data: primeiraAula } = modIds.length
      ? await supabase
          .from("treinamento_aulas")
          .select("id")
          .in("modulo_id", modIds)
          .limit(1)
          .maybeSingle()
      : { data: null };
    if (primeiraAula) {
      const { data: pode, error: ePode } = await supabase.rpc("posso_dar_aula", {
        p_aula: primeiraAula.id,
      });
      if (ePode) throw new Error(ePode.message);
      if (pode !== true) throw new Error("Você não conduz este treinamento.");
    }

    const resultado = await calcularConclusoesDoTreinamento(supabase, data.treinamento_id);

    const { garantirCertificadosDoTreinamento, buscarCertificadosEmitidos } =
      await import("@/lib/certificados.functions");
    await garantirCertificadosDoTreinamento(
      resultado.treinamento.mentor_id,
      resultado.treinamento.id,
      resultado.treinamento.titulo,
      resultado.pessoas,
    );
    const certificados = await buscarCertificadosEmitidos(supabase, {
      treinamento_id: data.treinamento_id,
    });

    return {
      ...resultado,
      pessoas: resultado.pessoas.map((p) => ({
        ...p,
        certificado: certificados.get(p.person_id) ?? null,
      })),
    };
  });
