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
import type { Database } from "@/integrations/supabase/types";

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

function diasDesde(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/**
 * A fila é derivada, não cadastrada.
 *
 * Busca tudo que foi concluído e subtrai o que já tem devolutiva aberta ou
 * realizada. Uma bateria conta como UM item, não como um por teste — a
 * devolutiva é sobre o conjunto, e listar as partes separadas encheria a fila
 * de linhas que representam a mesma conversa.
 */
export const listarFila = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;

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
    // Quem espera há mais tempo primeiro: é a ordem que resolve o problema.
    fila.sort((a, b) => b.dias_esperando - a.dias_esperando);
    return { fila };
  });

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
