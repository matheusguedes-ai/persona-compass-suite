/**
 * Mentorias: pacote de sessões entre professor e aluno.
 *
 * Substitui Devolutivas (Fecha #213 — ver docs/plano-mentorias.md). Diferença
 * que muda tudo: devolutiva nascia de um teste respondido; mentoria é criada
 * livremente, sem depender de resultado nenhum — é feature de hub, não de
 * plataforma de teste.
 *
 * Fatia 1, o ciclo indivisível: criar pacote → agendar sessão → marcar
 * concluída → escrever o resumo → o aluno recebe. Fora desta fatia, de
 * propósito: link de auto-agendamento, avaliação por estrelas, NPS, arquivos
 * no resumo, comentário do aluno, painel de métricas.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissaoOuMentor } from "@/lib/permissao.server";
import { notificar, nomeDoUsuario, quandoBr } from "@/lib/notificacoes.functions";
import { assinarArquivosMentoria } from "@/lib/storage-assinado.server";
import type { Database } from "@/integrations/supabase/types";

export const MODALIDADES = ["presencial", "online"] as const;
export type Modalidade = (typeof MODALIDADES)[number];

export const STATUS_SESSAO = ["agendada", "concluida", "cancelada"] as const;
export type StatusSessao = (typeof STATUS_SESSAO)[number];

// ============================================================
// O pacote
// ============================================================

const criarMentoriaSchema = z.object({
  person_id: z.string().uuid(),
  titulo: z.string().trim().max(200).optional().nullable(),
  sessoes_contratadas: z.number().int().min(1).max(999),
  observacoes: z.string().trim().max(2000).optional().nullable(),
});

/**
 * Lista de pacotes ativos, com a conta calculada.
 *
 * Realizadas = sessões concluídas. Agendadas = sessões `agendada` com data
 * futura. Faltam agendar = contratadas − realizadas − agendadas. Nunca
 * digitado — mesmo princípio que já regia a fila de devolutivas.
 */
export const listMentorias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirPermissaoOuMentor(context.supabase, context.userId, "mentorias");
    const { data, error } = await context.supabase
      .from("mentorias")
      .select(
        "id, titulo, sessoes_contratadas, observacoes, status, created_at, person_id, people(full_name), mentoria_sessoes(id, status, quando)",
      )
      .eq("status", "ativa")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const agora = Date.now();
    return {
      mentorias: (data ?? []).map((m) => {
        const sessoes = (m.mentoria_sessoes ?? []) as Array<{ id: string; status: string; quando: string }>;
        const realizadas = sessoes.filter((s) => s.status === "concluida").length;
        const futuras = sessoes.filter((s) => s.status === "agendada" && new Date(s.quando).getTime() >= agora);
        const faltam = Math.max(0, m.sessoes_contratadas - realizadas - futuras.length);
        const proxima = futuras.sort((a, b) => a.quando.localeCompare(b.quando))[0];
        return {
          id: m.id,
          titulo: m.titulo,
          observacoes: m.observacoes,
          sessoes_contratadas: m.sessoes_contratadas,
          person_id: m.person_id,
          person_name: m.people?.full_name ?? "—",
          realizadas,
          agendadas: futuras.length,
          faltam,
          proxima_sessao: proxima?.quando ?? null,
        };
      }),
    };
  });

/** O pacote aberto: cabeçalho com a conta + sessões em ordem de data (mais recente primeiro). */
export const getMentoria = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissaoOuMentor(context.supabase, context.userId, "mentorias");
    const { data: m, error } = await context.supabase
      .from("mentorias")
      .select("id, titulo, sessoes_contratadas, observacoes, status, person_id, people(id, full_name, email)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!m) throw new Error("Mentoria não encontrada.");

    const { data: sessoes, error: eS } = await context.supabase
      .from("mentoria_sessoes")
      .select(
        "id, quando, termina_em, modalidade, local, link_url, status, duracao_real_min, resumo, checklist_titulo, concluida_em, avaliacao_estrelas, avaliacao_comentario, avaliada_em, mentoria_tarefas(id, titulo, ordem, concluida, concluida_em), mentoria_arquivos(id, nome, caminho, tamanho_bytes, tipo)",
      )
      .eq("mentoria_id", data.id)
      .order("quando", { ascending: false });
    if (eS) throw new Error(eS.message);

    const lista = sessoes ?? [];
    const agora = Date.now();
    const realizadas = lista.filter((s) => s.status === "concluida").length;
    const agendadas = lista.filter((s) => s.status === "agendada" && new Date(s.quando).getTime() >= agora).length;
    const faltam = Math.max(0, m.sessoes_contratadas - realizadas - agendadas);

    // Satisfação: só das sessões avaliadas, e sempre com a contagem junto —
    // "4,5" sozinho engana quando vem de um voto só (spec, seção 3).
    const notas = lista.map((s) => s.avaliacao_estrelas).filter((n): n is number => n != null);
    const satisfacao = notas.length > 0
      ? { media: notas.reduce((a, b) => a + b, 0) / notas.length, avaliacoes: notas.length }
      : null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sessoesComArquivos = await Promise.all(
      lista.map(async (s) => ({
        ...s,
        tarefas: ((s.mentoria_tarefas ?? []) as Array<{
          id: string; titulo: string; ordem: number; concluida: boolean; concluida_em: string | null;
        }>).slice().sort((a, b) => a.ordem - b.ordem),
        arquivos: await assinarArquivosMentoria(
          supabaseAdmin,
          (s.mentoria_arquivos ?? []) as Array<{ id: string; nome: string; caminho: string; tamanho_bytes: number; tipo: string }>,
        ),
      })),
    );

    return {
      mentoria: { ...m, realizadas, agendadas, faltam, satisfacao },
      sessoes: sessoesComArquivos,
    };
  });

/** Criação livre — aluno, quantidade, título e observações. Sem modelos pré-definidos. */
export const criarMentoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => criarMentoriaSchema.parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissaoOuMentor(context.supabase, context.userId, "mentorias");
    const { data: pessoa, error: eP } = await context.supabase
      .from("people").select("id, mentor_id").eq("id", data.person_id).maybeSingle();
    if (eP) throw new Error(eP.message);
    if (!pessoa) throw new Error("Pessoa não encontrada.");

    const { data: row, error } = await context.supabase
      .from("mentorias")
      .insert({
        mentor_id: pessoa.mentor_id,
        person_id: data.person_id,
        titulo: data.titulo?.trim() || null,
        sessoes_contratadas: data.sessoes_contratadas,
        observacoes: data.observacoes?.trim() || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/**
 * Edita o pacote. Aumentar de 3 para 5 é editar `sessoes_contratadas` — não
 * se cria um pacote novo, foi pedido explicitamente.
 */
export const atualizarMentoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      titulo: z.string().trim().max(200).optional().nullable(),
      sessoes_contratadas: z.number().int().min(1).max(999).optional(),
      observacoes: z.string().trim().max(2000).optional().nullable(),
      status: z.enum(["ativa", "encerrada"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await exigirPermissaoOuMentor(context.supabase, context.userId, "mentorias");
    const { id, ...campos } = data;
    const patch: Database["public"]["Tables"]["mentorias"]["Update"] = {};
    if ("titulo" in campos) patch.titulo = campos.titulo?.trim() || null;
    if (campos.sessoes_contratadas !== undefined) patch.sessoes_contratadas = campos.sessoes_contratadas;
    if ("observacoes" in campos) patch.observacoes = campos.observacoes?.trim() || null;
    if (campos.status) patch.status = campos.status;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await context.supabase.from("mentorias").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// O diálogo "Criar" usa `listarPessoasParaEscolher` (data.functions.ts) para o
// seletor de aluno — a tela já é gated por 'mentorias', o seletor não precisa
// da própria checagem. Ver o comentário lá: é o mesmo seletor genérico que o
// evento e a Academy usam, cada um atrás da PRÓPRIA permissão.

// ============================================================
// A sessão
// ============================================================

const agendarSessaoSchema = z.object({
  mentoria_id: z.string().uuid(),
  quando: z.string().datetime({ offset: true }),
  termina_em: z.string().datetime({ offset: true }).nullable().optional(),
  modalidade: z.enum(MODALIDADES),
  local: z.string().trim().max(500).optional().nullable(),
  link_url: z.string().trim().url().max(1000).optional().nullable(),
});

export const agendarSessao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => agendarSessaoSchema.parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissaoOuMentor(context.supabase, context.userId, "mentorias");
    const { data: mentoria, error: eM } = await context.supabase
      .from("mentorias").select("id, mentor_id, person_id").eq("id", data.mentoria_id).maybeSingle();
    if (eM) throw new Error(eM.message);
    if (!mentoria) throw new Error("Mentoria não encontrada.");

    const { data: row, error } = await context.supabase
      .from("mentoria_sessoes")
      .insert({
        mentoria_id: data.mentoria_id,
        mentor_id: mentoria.mentor_id,
        quando: data.quando,
        termina_em: data.termina_em ?? null,
        modalidade: data.modalidade,
        local: data.modalidade === "presencial" ? (data.local?.trim() || null) : null,
        link_url: data.modalidade === "online" ? (data.link_url?.trim() || null) : null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { data: pessoa } = await context.supabase
      .from("people").select("full_name, user_id").eq("id", mentoria.person_id).maybeSingle();
    const { data: gruposDele } = await context.supabase
      .from("group_members").select("group_id").eq("person_id", mentoria.person_id);
    await notificar(context.supabase, {
      conta: mentoria.mentor_id,
      tipo: "mentoria_agendada",
      titulo: `Mentoria agendada com ${pessoa?.full_name ?? "um avaliado"}`,
      corpo: quandoBr(data.quando),
      link: "/mentorias",
      ator: context.userId,
      atorNome: await nomeDoUsuario(context.supabase, context.userId),
      grupos: (gruposDele ?? []).map((g) => g.group_id),
      pessoaUser: pessoa?.user_id ?? null,
    });

    // Mão única, silenciosa: se o Google falhar, a sessão continua agendada.
    const { sincronizar } = await import("@/lib/google.server");
    await sincronizar(mentoria.mentor_id, "mentoria", row.id, {
      titulo: `Mentoria · ${pessoa?.full_name ?? "avaliado"}`,
      descricao: data.modalidade === "presencial" ? (data.local ?? null) : (data.link_url ?? null),
      quando: data.quando,
      terminaEm: data.termina_em ?? null,
    });

    return { id: row.id };
  });

const salvarResumoSchema = z.object({
  id: z.string().uuid(),
  duracao_real_min: z.number().int().min(1).max(600),
  resumo: z.string().trim().min(1).max(8000),
  checklist_titulo: z.string().trim().max(200).optional().nullable(),
  // Só usado na primeira vez (transição agendada → concluída). Reeditar
  // depois não cria nem apaga item — a spec não descreve essa edição.
  itens: z.array(z.string().trim().min(1).max(300)).max(50).optional(),
});

/**
 * Marca como concluída (primeira vez) ou edita o resumo já salvo (depois).
 *
 * Mesma função para as duas coisas porque a tela é a mesma: "Marcar como
 * concluída" abre este cartão, e reabri-lo depois é o "editar sempre" que
 * a regra pede. Só a PRIMEIRA chamada (`status` ainda `agendada`) muda o
 * status, grava `concluida_em`, cria o checklist, pontua e notifica — uma
 * reedição não repete nada disso.
 */
export const salvarResumoSessao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => salvarResumoSchema.parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissaoOuMentor(context.supabase, context.userId, "mentorias");
    const { data: sessao, error: eS } = await context.supabase
      .from("mentoria_sessoes")
      .select("id, mentor_id, mentoria_id, status, mentorias(person_id)")
      .eq("id", data.id)
      .maybeSingle();
    if (eS) throw new Error(eS.message);
    if (!sessao) throw new Error("Sessão não encontrada.");

    const primeiraVez = sessao.status === "agendada";
    const patch: Database["public"]["Tables"]["mentoria_sessoes"]["Update"] = {
      duracao_real_min: data.duracao_real_min,
      resumo: data.resumo.trim(),
      checklist_titulo: data.checklist_titulo?.trim() || null,
    };
    if (primeiraVez) {
      patch.status = "concluida";
      patch.concluida_em = new Date().toISOString();
    }
    const { error } = await context.supabase.from("mentoria_sessoes").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);

    if (primeiraVez) {
      if (data.itens && data.itens.length > 0) {
        const { error: eT } = await context.supabase.from("mentoria_tarefas").insert(
          data.itens.map((titulo, i) => ({
            sessao_id: data.id,
            mentor_id: sessao.mentor_id,
            titulo,
            ordem: i,
          })),
        );
        if (eT) throw new Error(eT.message);
      }

      const personId = (sessao.mentorias as unknown as { person_id: string } | null)?.person_id ?? null;
      if (personId) {
        const { data: pessoa } = await context.supabase
          .from("people").select("full_name, user_id").eq("id", personId).maybeSingle();

        // O ponto é do ALUNO, por ter participado — quem conclui é o professor.
        // Service role: a policy de `pontos` é "só em nome próprio", e quem
        // grava aqui é o professor dando o ponto ao aluno (mesma armadilha já
        // resolvida em registrarDevolutiva).
        if (pessoa?.user_id) {
          const { darPonto } = await import("@/lib/pontos.functions");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await darPonto(supabaseAdmin, pessoa.user_id, sessao.mentor_id, "mentoria", data.id);
        }

        const { data: gruposDele } = await context.supabase
          .from("group_members").select("group_id").eq("person_id", personId);
        await notificar(context.supabase, {
          conta: sessao.mentor_id,
          tipo: "mentoria_concluida",
          titulo: `Resumo disponível: mentoria com ${pessoa?.full_name ?? "você"}`,
          corpo: data.resumo.trim().slice(0, 140),
          link: "/mentorias",
          ator: context.userId,
          atorNome: await nomeDoUsuario(context.supabase, context.userId),
          grupos: (gruposDele ?? []).map((g) => g.group_id),
          pessoaUser: pessoa?.user_id ?? null,
        });
      }
    }

    return { ok: true };
  });

// ============================================================
// Arquivos anexados ao resumo (Fatia 2)
// ============================================================

const anexarArquivoSchema = z.object({
  sessao_id: z.string().uuid(),
  nome: z.string().trim().min(1).max(300),
  caminho: z.string().trim().min(1).max(500),
  tamanho_bytes: z.number().int().positive(),
  tipo: z.string().trim().min(1).max(200),
});

/**
 * Registra um arquivo já enviado ao bucket 'mentorias' (o upload em si
 * acontece no navegador, na própria pasta do usuário — ver a policy de
 * INSERT em storage.objects). Só o professor chama isto: a RLS de
 * mentoria_arquivos exige mentor_id = acting_account() + posso_agendar_mentoria.
 */
export const anexarArquivoMentoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => anexarArquivoSchema.parse(d))
  .handler(async ({ data, context }) => {
    await exigirPermissaoOuMentor(context.supabase, context.userId, "mentorias");
    const { data: sessao, error: eS } = await context.supabase
      .from("mentoria_sessoes").select("id, mentor_id").eq("id", data.sessao_id).maybeSingle();
    if (eS) throw new Error(eS.message);
    if (!sessao) throw new Error("Sessão não encontrada.");

    const { data: row, error } = await context.supabase
      .from("mentoria_arquivos")
      .insert({
        sessao_id: data.sessao_id,
        mentor_id: sessao.mentor_id,
        nome: data.nome,
        caminho: data.caminho,
        tamanho_bytes: data.tamanho_bytes,
        tipo: data.tipo,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
