/**
 * Devolutivas: a conversa entre mentor e avaliado sobre o resultado.
 *
 * A plataforma cobria até a entrega do relatório. O que vinha depois — sentar
 * com a pessoa, explicar o que o teste mostrou e combinar o plano de ação — não
 * tinha onde ser registrado. Sem registro, não dá para saber quem já teve a
 * conversa e quem está esperando há três semanas.
 *
 * A tela tem duas partes, e a primeira é a que importa no dia a dia:
 * 1. **Fila** — quem terminou um teste e ainda não teve devolutiva, ordenado
 *    por quem espera há mais tempo. É calculado, não cadastrado: ninguém
 *    precisa lembrar de pôr a pessoa na fila.
 * 2. **Devolutivas** — as agendadas e as já realizadas, com o que ficou
 *    combinado em cada uma.
 *
 * Quem enxerga o quê é decidido pela RLS (ver `20260729150000_devolutivas.sql`):
 * mentor convidado só vê gente dos grupos dele.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notificar, nomeDoUsuario, quandoBr } from "@/lib/notificacoes.functions";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const STATUS = ["agendada", "realizada", "cancelada"] as const;
export type StatusDevolutiva = (typeof STATUS)[number];

export const STATUS_LABEL: Record<StatusDevolutiva, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

/** Item da fila: um resultado pronto que ainda não virou conversa. */
export type ItemDaFila = {
  person_id: string;
  person_name: string;
  /** Preenchido para teste avulso. */
  response_id: string | null;
  /** Preenchido para bateria. */
  assessment_id: string | null;
  titulo: string;
  concluido_em: string;
  /** Dias desde a conclusão — é o número que faz o mentor agir. */
  dias_esperando: number;
};

/**
 * Dias em CALENDÁRIO, não em blocos de 24h.
 *
 * `floor(ms / 24h)` dizia "concluiu hoje" para quem respondeu ontem às 20h:
 * quinze horas não fecham um bloco. Para quem lê, ontem é ontem. A fila e o
 * Kanban mostram esse número na cara do mentor, então ele precisa bater com o
 * calendário que a pessoa tem na cabeça.
 */
function diasDesde(iso: string) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const quando = new Date(iso); quando.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((hoje.getTime() - quando.getTime()) / 86_400_000));
}

/**
 * A fila é derivada, não cadastrada.
 *
 * Busca tudo que foi concluído e subtrai o que já tem devolutiva aberta ou
 * realizada. Uma bateria conta como UM item, não como um por teste — a
 * devolutiva é sobre o conjunto, e listar as partes separadas encheria a fila
 * de linhas que representam a mesma conversa.
 */
/**
 * O cálculo da fila, separado da server function.
 *
 * O Kanban do menu Gestão mostra a mesma fila numa das colunas. Se cada tela
 * fizesse a própria conta, elas divergiriam no primeiro caso de canto — uma
 * bateria cancelada, um teste sem `submitted_at` — e o sintoma seria o pior
 * possível: dois números diferentes para a mesma pergunta, sem ninguém saber
 * qual está certo. Uma conta só, dois consumidores.
 */
export async function calcularFila(
  supabase: SupabaseClient<Database>,
  groupId?: string | null,
): Promise<ItemDaFila[]> {

    

    const [{ data: baterias, error: e1 }, { data: avulsas, error: e2 }, { data: jaTem, error: e3 }] =
      await Promise.all([
        supabase
          .from("assessment_responses")
          .select("id, person_id, submitted_at, people(full_name)")
          .not("submitted_at", "is", null)
          .is("canceled_at", null),
        supabase
          .from("test_responses")
          .select("id, person_id, submitted_at, assessment_response_id, people(full_name), test_versions(title)")
          .not("submitted_at", "is", null)
          .is("assessment_response_id", null)
          .is("canceled_at", null),
        supabase.from("devolutivas").select("response_id, assessment_id").neq("status", "cancelada"),
      ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    if (e3) throw new Error(e3.message);

    const comDevolutiva = new Set(
      (jaTem ?? []).flatMap((d) => [d.response_id, d.assessment_id].filter(Boolean) as string[]),
    );

    const fila: ItemDaFila[] = [];
    for (const b of baterias ?? []) {
      if (comDevolutiva.has(b.id) || !b.submitted_at) continue;
      fila.push({
        person_id: b.person_id,
        person_name: b.people?.full_name ?? "—",
        response_id: null,
        assessment_id: b.id,
        titulo: "Bateria completa",
        concluido_em: b.submitted_at,
        dias_esperando: diasDesde(b.submitted_at),
      });
    }
    for (const r of avulsas ?? []) {
      if (comDevolutiva.has(r.id) || !r.submitted_at) continue;
      fila.push({
        person_id: r.person_id,
        person_name: r.people?.full_name ?? "—",
        response_id: r.id,
        assessment_id: null,
        titulo: r.test_versions?.title ?? "Teste",
        concluido_em: r.submitted_at,
        dias_esperando: diasDesde(r.submitted_at),
      });
    }
    // Filtro por grupo, para a aba dentro do grupo mostrar só quem é dele.
    let recorte = fila;
    if (groupId) {
      const { data: membros } = await supabase
        .from("group_members").select("person_id").eq("group_id", groupId);
      const doGrupo = new Set((membros ?? []).map((m) => m.person_id));
      recorte = fila.filter((f) => doGrupo.has(f.person_id));
    }
    // Quem espera há mais tempo primeiro: é a ordem que resolve o problema.
    recorte.sort((a, b) => b.dias_esperando - a.dias_esperando);
    return recorte;
}

export const listarFila = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ group_id: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => ({
    fila: await calcularFila(context.supabase, data.group_id),
  }));

export const listarDevolutivas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("devolutivas")
      .select(
        "id, person_id, response_id, assessment_id, status, scheduled_at, completed_at, duration_min, notes, agreements, next_at, created_at, people(full_name, email)",
      )
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    return {
      devolutivas: (data ?? []).map((d) => ({
        ...d,
        person_name: d.people?.full_name ?? "—",
        person_email: d.people?.email ?? null,
        /** Agendada com data já passada: precisa de ação, e a tela destaca. */
        atrasada:
          d.status === "agendada" && !!d.scheduled_at && new Date(d.scheduled_at) < hoje,
      })),
    };
  });

const alvoSchema = z.object({
  person_id: z.string().uuid(),
  response_id: z.string().uuid().nullable().optional(),
  assessment_id: z.string().uuid().nullable().optional(),
});

export const agendarDevolutiva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    alvoSchema
      .extend({
        scheduled_at: z.string().datetime({ offset: true }).nullable().optional(),
        notes: z.string().max(4000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    // Ownership: a RLS já barra, mas errar aqui devolve mensagem legível em vez
    // de um "violates row-level security policy" na cara do mentor.
    const { data: pessoa, error: ePessoa } = await supabase
      .from("people")
      .select("id, mentor_id")
      .eq("id", data.person_id)
      .maybeSingle();
    if (ePessoa) throw new Error(ePessoa.message);
    if (!pessoa) throw new Error("Pessoa não encontrada.");

    const { data: criada, error } = await supabase
      .from("devolutivas")
      .insert({
        mentor_id: pessoa.mentor_id,
        person_id: data.person_id,
        response_id: data.response_id ?? null,
        assessment_id: data.assessment_id ?? null,
        status: "agendada",
        scheduled_at: data.scheduled_at ?? null,
        notes: data.notes?.trim() || null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) {
      // O índice parcial impede duas devolutivas abertas para o mesmo resultado.
      if (error.code === "23505") throw new Error("Já existe uma devolutiva para este resultado.");
      throw new Error(error.message);
    }
    // Avisa o avaliado (é sobre ele) e quem cuida dos grupos dele.
    const [{ data: quem }, { data: gruposDele }] = await Promise.all([
      supabase.from("people").select("full_name, user_id").eq("id", data.person_id).maybeSingle(),
      supabase.from("group_members").select("group_id").eq("person_id", data.person_id),
    ]);
    await notificar(supabase, {
      conta: pessoa.mentor_id,
      tipo: "devolutiva_agendada",
      titulo: data.scheduled_at
        ? `Devolutiva agendada com ${quem?.full_name ?? "um avaliado"}`
        : `Devolutiva criada para ${quem?.full_name ?? "um avaliado"}`,
      corpo: data.scheduled_at ? quandoBr(data.scheduled_at) : "Ainda sem data marcada.",
      link: "/devolutivas",
      ator: context.userId,
      atorNome: await nomeDoUsuario(supabase, context.userId),
      grupos: (gruposDele ?? []).map((g) => g.group_id),
      pessoaUser: quem?.user_id ?? null,
    });
    // Mão única: o que é marcado aqui aparece lá. Silenciosa — se o Google
    // falhar, a devolutiva continua agendada.
    if (data.scheduled_at) {
      const { sincronizar } = await import("@/lib/google.server");
      await sincronizar(pessoa.mentor_id, "devolutiva", criada.id, {
        titulo: `Devolutiva · ${quem?.full_name ?? "avaliado"}`,
        descricao: data.notes?.trim() || null,
        quando: data.scheduled_at,
      });
    }
    return { id: criada.id };
  });

export const registrarDevolutiva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      completed_at: z.string().datetime({ offset: true }).optional(),
      duration_min: z.number().int().min(1).max(600).nullable().optional(),
      notes: z.string().max(4000).optional(),
      agreements: z.string().max(4000).optional(),
      next_at: z.string().date().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("devolutivas")
      .update({
        status: "realizada",
        completed_at: data.completed_at ?? new Date().toISOString(),
        duration_min: data.duration_min ?? null,
        notes: data.notes?.trim() || null,
        agreements: data.agreements?.trim() || null,
        next_at: data.next_at ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // O ponto é do AVALIADO, por ter participado — quem realiza é o mentor.
    const { data: dev } = await context.supabase
      .from("devolutivas").select("person_id, mentor_id, people(user_id)").eq("id", data.id).maybeSingle();
    if (dev?.people?.user_id) {
      const { darPonto } = await import("@/lib/pontos.functions");
      await darPonto(context.supabase, dev.people.user_id, dev.mentor_id, "devolutiva", data.id);
    }
    if (dev) {
      const { data: quem } = await context.supabase
        .from("people").select("full_name").eq("id", dev.person_id).maybeSingle();
      const { data: gruposDele } = await context.supabase
        .from("group_members").select("group_id").eq("person_id", dev.person_id);
      await notificar(context.supabase, {
        conta: dev.mentor_id,
        tipo: "devolutiva_realizada",
        titulo: `Devolutiva realizada com ${quem?.full_name ?? "um avaliado"}`,
        corpo: data.agreements?.trim()?.slice(0, 140) || "Registrada no painel.",
        link: "/devolutivas",
        ator: context.userId,
        atorNome: await nomeDoUsuario(context.supabase, context.userId),
        grupos: (gruposDele ?? []).map((g) => g.group_id),
        pessoaUser: dev.people?.user_id ?? null,
      });
    }
    return { ok: true };
  });

export const atualizarDevolutiva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      scheduled_at: z.string().datetime({ offset: true }).nullable().optional(),
      notes: z.string().max(4000).optional(),
      agreements: z.string().max(4000).optional(),
      next_at: z.string().date().nullable().optional(),
      status: z.enum(STATUS).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...campos } = data;
    // Só o que veio no envio entra no patch: mandar `undefined` para o Supabase
    // apagaria o valor que já estava lá.
    const patch: Database["public"]["Tables"]["devolutivas"]["Update"] = {};
    if ("scheduled_at" in campos) patch.scheduled_at = campos.scheduled_at ?? null;
    if ("notes" in campos) patch.notes = campos.notes?.trim() || null;
    if ("agreements" in campos) patch.agreements = campos.agreements?.trim() || null;
    if ("next_at" in campos) patch.next_at = campos.next_at ?? null;
    if (campos.status) patch.status = campos.status;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await context.supabase.from("devolutivas").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirDevolutiva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("devolutivas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Painel da devolutiva: tudo que o mentor precisa ter à vista na conversa.
 *
 * Junta numa chamada só o que hoje está espalhado — a pessoa, o resultado
 * (teste avulso ou bateria inteira), o selo de confiabilidade e o que ficou
 * combinado da última vez. É essa última parte que faz a conversa começar de
 * onde parou em vez de recomeçar do zero.
 */
export const carregarPainel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const { data: dev, error } = await supabase
      .from("devolutivas")
      .select(
        "id, person_id, response_id, assessment_id, status, scheduled_at, completed_at, duration_min, notes, agreements, next_at, people(full_name, email)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!dev) throw new Error("Devolutiva não encontrada.");

    // A conversa anterior com esta mesma pessoa. Sem isso, toda devolutiva
    // recomeça do zero e o combinado da última vez se perde.
    const { data: anteriores } = await supabase
      .from("devolutivas")
      .select("id, completed_at, agreements, next_at")
      .eq("person_id", dev.person_id)
      .eq("status", "realizada")
      .neq("id", dev.id)
      .order("completed_at", { ascending: false })
      .limit(1);
    const anterior = anteriores?.[0] ?? null;

    // Quais respostas alimentam o painel. Bateria vira várias partes.
    let respostaIds: string[] = [];
    if (dev.assessment_id) {
      const { data: partes } = await supabase
        .from("test_responses")
        .select("id, assessment_sort, submitted_at")
        .eq("assessment_response_id", dev.assessment_id)
        .eq("kind", "self")
        .not("submitted_at", "is", null)
        .order("assessment_sort");
      respostaIds = (partes ?? []).map((p) => p.id);
    } else if (dev.response_id) {
      respostaIds = [dev.response_id];
    }

    // `buildReport` usa service role e não passa pela RLS. A checagem de acesso
    // já aconteceu acima: se a RLS deixou ler a devolutiva, o mentor pode ver
    // este resultado. Sem essa ordem, um id de resposta alheio vazaria.
    const { buildReport } = await import("@/lib/report.server");
    const construidos = await Promise.all(respostaIds.map((id) => buildReport(id)));

    // Só o que vira cartão. O relatório completo tem 20+ campos e boa parte é
    // texto longo para leitura solitária — no painel, atrapalha e pesa.
    const partes = construidos
      .map((b) => {
        if (b.status !== 200) return null;
        const r = b.data;
        const d = (r.derived ?? {}) as {
          competencias?: Array<{ name: string; natural: number; adaptado: number; band: string }>;
          indices?: Array<{ key: string; label: string; value: number }>;
          dominant?: { key: string; label: string; pct: number };
        };
        return {
          response_id: r.response_id ?? null,
          titulo: r.test_title,
          instrumento: r.instrument_id ?? null,
          is_disc: !!r.is_disc,
          is_mbti: !!r.is_mbti,
          mbti: r.mbti ?? null,
          perfil: r.perfil_indefinido ? null : r.profile,
          perfil_rotulos: r.profile_labels ?? [],
          qualidade: r.qualidade ?? null,
          fatores: r.factors
            .filter((f) => f.has_data !== false)
            .map((f) => ({
              key: f.key,
              label: f.label,
              color: f.color,
              natural: Math.round(f.natural_norm),
              adaptado: Math.round(f.adaptado_norm),
              faixa: f.band_natural?.title ?? null,
            })),
          competencias: d.competencias ?? [],
          indices: d.indices ?? [],
          lideranca: d.dominant ?? null,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p != null);

    return {
      devolutiva: {
        id: dev.id,
        status: dev.status,
        scheduled_at: dev.scheduled_at,
        completed_at: dev.completed_at,
        duration_min: dev.duration_min,
        notes: dev.notes,
        agreements: dev.agreements,
        next_at: dev.next_at,
        person_name: dev.people?.full_name ?? "—",
        person_email: dev.people?.email ?? null,
      },
      anterior,
      partes,
    };
  });

/**
 * Pessoas disponíveis para uma devolutiva avulsa.
 *
 * A fila só enxerga quem concluiu teste. Mas conversa de acompanhamento — a
 * segunda, a terceira — não nasce de resultado novo, e sem isto não havia como
 * registrar. Aqui sai o cadastro inteiro que o mentor pode ver; a RLS de
 * `people` já limita mentor convidado aos grupos dele.
 */
export const listarPessoasParaDevolutiva = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("people")
      .select("id, full_name, email")
      .order("full_name");
    if (error) throw new Error(error.message);
    return { pessoas: data ?? [] };
  });
