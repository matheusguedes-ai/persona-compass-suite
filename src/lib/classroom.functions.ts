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
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Inclui `slide` e `roteiro`, que a Academy não tem: são o material de quem dá aula presencial. */
export const TIPOS_MATERIAL_TREINAMENTO = [
  "link", "pdf", "slide", "roteiro", "planilha", "video", "audio", "outro",
] as const;

// ============================================================
// Treinamentos
// ============================================================
export const listTreinamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("treinamentos")
      .select("*, treinamento_grupos(count), treinamento_modulos(treinamento_aulas(count))")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((t) => {
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
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: treinamento, error } = await supabase
      .from("treinamentos").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!treinamento) throw new Error("Treinamento não encontrado.");

    const [mods, grupos] = await Promise.all([
      supabase
        .from("treinamento_modulos")
        .select("*, treinamento_aulas(*, treinamento_materiais(*))")
        .eq("treinamento_id", data.id),
      supabase.from("treinamento_grupos").select("group_id, groups(id, name)").eq("treinamento_id", data.id),
    ]);
    if (mods.error) throw new Error(mods.error.message);
    if (grupos.error) throw new Error(grupos.error.message);

    // As anotações moram em tabela própria com RLS só do dono (migração
    // 20260730150000): o aluno não recebe o roteiro do professor nem
    // consultando a API direto. Só vale buscar quando é o dono olhando.
    const dono = treinamento.mentor_id === userId;
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

    const modules = porOrdem(mods.data ?? []).map((m) => ({
      ...m,
      treinamento_aulas: undefined,
      aulas: porOrdem(
        ((m.treinamento_aulas as unknown as Array<Record<string, unknown>>) ?? []).map((a) => {
          const aula = a as { id: string; modulo_id: string; titulo: string; descricao: string | null; comeca_em: string | null; termina_em: string | null; local: string | null; ordem: number };
          return {
            ...aula,
            anotacoes: anotPorAula.get(aula.id) ?? null,
            treinamento_materiais: undefined,
            materiais: porOrdem(
              (a.treinamento_materiais as Array<{ id: string; titulo: string; url: string; kind: string; ordem: number }>) ?? [],
            ),
          };
        }),
      ),
    }));

    return {
      treinamento,
      modules,
      grupos: (grupos.data ?? []).map((g) => ({
        id: g.group_id,
        name: (g.groups as unknown as { name: string } | null)?.name ?? "—",
      })),
      can_edit: dono,
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
      capa_url: z.string().trim().max(600).optional().nullable(),
      publicado: z.boolean().optional(),
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
    return row;
  });

export const deleteAula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("treinamento_aulas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
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
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...rest } = data;
    if (id) {
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
      .select("id, titulo, comeca_em, termina_em, local, modulo_id")
      .eq("id", data.aula_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!aula) throw new Error("Aula não encontrada.");

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
      .select("id, person_id, origem, escaneado_em, registrado_em, situacao, observacao, people(full_name)")
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
      janela: janela
        ? { inicio: janela.inicio.toISOString(), fim: janela.fim.toISOString(), aberta: dentroDaJanela(janela, agora) }
        : null,
      codigos,
      presencas: (presencas ?? []).map((p) => ({
        id: p.id,
        person_id: p.person_id,
        nome: (p.people as unknown as { full_name: string } | null)?.full_name ?? "—",
        origem: p.origem,
        // O atraso é calculado do SCAN, não do clique. Ver a migração.
        quando: p.escaneado_em ?? p.registrado_em,
        situacao: p.situacao,
        observacao: p.observacao,
      })),
      turma: [...porPessoa.entries()].map(([person_id, v]) => ({ person_id, ...v }))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    };
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
  .inputValidator((d) => z.object({ aula_id: z.string().uuid() }).parse(d))
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
      .select("id, titulo, comeca_em, termina_em, modulo_id")
      .eq("id", data.aula_id)
      .maybeSingle();
    if (eA) throw new Error(eA.message);
    if (!aula) return { ok: false as const, motivo: "sem_aula" as const };

    const janela = janelaDaAula(aula);
    if (!janela || !dentroDaJanela(janela)) {
      return { ok: false as const, motivo: "fora_da_janela" as const, fim: janela?.fim.toISOString() ?? null };
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
    const { data: elo, error: eE } = await supabaseAdmin
      .from("treinamento_grupos")
      .select("group_id, group_members!inner(person_id)")
      .eq("treinamento_id", trein.id)
      .eq("group_members.person_id", pessoa.id)
      .limit(1);
    if (eE) throw new Error(eE.message);
    const groupId = (elo ?? [])[0]?.group_id ?? null;
    if (!groupId) return { ok: false as const, motivo: "sem_grupo" as const };

    const escaneadoEm = new Date(passe.escaneadoEm).toISOString();
    const { data: nova, error: eIns } = await supabaseAdmin
      .from("treinamento_presencas")
      .insert({
        aula_id: aula.id,
        person_id: pessoa.id,
        group_id: groupId,
        origem: "qr",
        escaneado_em: escaneadoEm,
        passe_nonce: passe.nonce,
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

      // (b) o professor já tinha marcado à mão. Se marcou como AUSENTE e a
      // pessoa acabou de escanear na sala, a lista está errada: promove para
      // 'qr' e limpa a situação, preservando a observação dele. Sem isso a lista
      // mente e ninguém percebe.
      if (existente && existente.origem === "manual") {
        const { error: eUp } = await supabaseAdmin
          .from("treinamento_presencas")
          .update({
            origem: "qr",
            escaneado_em: escaneadoEm,
            passe_nonce: passe.nonce,
            situacao: existente.situacao === "ausente" ? null : existente.situacao,
          })
          .eq("id", existente.id);
        if (eUp) throw new Error(eUp.message);
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

    await avisarPresenca(trein.mentor_id, pessoa, aula.titulo, trein.titulo);
    return { ok: true as const, ja_estava: false, quando: nova?.escaneado_em ?? escaneadoEm, aula: aula.titulo };
  });

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
    const { supabase } = context;
    // A policy `pres_minha` já recorta para a própria pessoa.
    const { data: p, error } = await supabase
      .from("treinamento_presencas")
      .select("id, origem, escaneado_em, registrado_em, situacao")
      .eq("aula_id", data.aula_id)
      .maybeSingle();
    if (error) throw new Error(error.message);

    // O nome da aula sem exigir acesso de professor: a RLS de aulas já entrega
    // ao aluno do grupo.
    const { data: aula } = await supabase
      .from("treinamento_aulas")
      .select("titulo, comeca_em, termina_em, local")
      .eq("id", data.aula_id)
      .maybeSingle();

    return {
      presenca: p ? { quando: p.escaneado_em ?? p.registrado_em, origem: p.origem } : null,
      aula: aula ?? null,
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
      // `null` remove a marcação — o professor errou a linha e desfaz.
      situacao: z.enum(["presente", "atrasado", "ausente", "justificado"]).nullable(),
      observacao: z.string().trim().max(500).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pode, error: ePode } = await supabase.rpc("posso_dar_aula", { p_aula: data.aula_id });
    if (ePode) throw new Error(ePode.message);
    if (pode !== true) throw new Error("Você não conduz esta aula.");

    if (data.situacao === null) {
      // Só apaga o que foi marcado à mão: check-in do aluno não se desfaz por
      // clique do professor — para isso existe marcar 'ausente', que fica
      // registrado como decisão dele.
      const { error } = await supabase
        .from("treinamento_presencas")
        .delete()
        .eq("aula_id", data.aula_id)
        .eq("person_id", data.person_id)
        .eq("origem", "manual");
      if (error) throw new Error(error.message);
      return { ok: true };
    }

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
      const { error } = await supabase
        .from("treinamento_presencas")
        .update({
          situacao: data.situacao,
          observacao: data.observacao ?? null,
          registrado_por: userId,
        })
        .eq("id", existente.id);
      if (error) throw new Error(error.message);
      return { ok: true, origem: existente.origem };
    }

    const { error } = await supabase.from("treinamento_presencas").insert({
      aula_id: data.aula_id,
      person_id: data.person_id,
      origem: "manual",
      situacao: data.situacao,
      observacao: data.observacao ?? null,
      registrado_por: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true, origem: "manual" };
  });
