/**
 * Menu Gestão — a visão de quem coordena.
 *
 * Etapa 1 do plano em `docs/plano-menu-gestao.md`: o Kanban das devolutivas.
 * Três colunas que respondem a uma pergunta só — em que pé está cada pessoa.
 *
 * A coluna "sem devolutiva" NÃO é recalculada aqui: usa `calcularFila`, a mesma
 * do menu Devolutivas. Duas contas para a mesma pergunta divergiriam no
 * primeiro caso de canto, e o sintoma seria dois números diferentes na mesma
 * plataforma.
 *
 * Quem vê o quê é a RLS: o mentor só enxerga gente dos grupos dele, então o
 * mesmo código serve o master e o mentor sem `if` de papel.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calcularFila } from "@/lib/devolutivas.functions";

export type CartaoGestao = {
  id: string;
  person_id: string;
  person_name: string;
  titulo: string;
  /** Dias esperando (coluna 1) ou dias até/desde a data (colunas 2 e 3). */
  quando: string | null;
  dias: number | null;
  atrasada: boolean;
};

function diasAte(iso: string): number {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(iso); alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

export const quadroDeGestao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase;

    const [fila, { data: devs, error }] = await Promise.all([
      calcularFila(supabase),
      supabase
        .from("devolutivas")
        .select("id, person_id, status, scheduled_at, completed_at, agreements, people(full_name)")
        .neq("status", "cancelada")
        .order("scheduled_at", { ascending: true, nullsFirst: false }),
    ]);
    if (error) throw new Error(error.message);

    const semDevolutiva: CartaoGestao[] = fila.map((f) => ({
      id: f.assessment_id ?? f.response_id ?? f.person_id,
      person_id: f.person_id,
      person_name: f.person_name,
      titulo: f.titulo,
      quando: f.concluido_em,
      dias: f.dias_esperando,
      atrasada: f.dias_esperando >= 14,
    }));

    const agendadas: CartaoGestao[] = [];
    const realizadas: CartaoGestao[] = [];

    for (const d of devs ?? []) {
      const base = {
        id: d.id,
        person_id: d.person_id,
        person_name: d.people?.full_name ?? "—",
      };
      if (d.status === "agendada") {
        const dias = d.scheduled_at ? diasAte(d.scheduled_at) : null;
        agendadas.push({
          ...base,
          titulo: d.scheduled_at ? "Devolutiva marcada" : "Sem data definida",
          quando: d.scheduled_at,
          dias,
          // Passou da data e ninguém registrou: é o que precisa de ação.
          atrasada: dias !== null && dias < 0,
        });
      } else if (d.status === "realizada") {
        realizadas.push({
          ...base,
          titulo: d.agreements?.trim() ? "Com combinados registrados" : "Realizada",
          quando: d.completed_at,
          dias: d.completed_at ? -diasAte(d.completed_at) : null,
          atrasada: false,
        });
      }
    }

    // Quem espera há mais tempo primeiro; depois, o que está mais próximo.
    semDevolutiva.sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0));
    agendadas.sort((a, b) => (a.dias ?? 999) - (b.dias ?? 999));
    realizadas.sort((a, b) => (a.dias ?? 999) - (b.dias ?? 999));

    return { semDevolutiva, agendadas, realizadas };
  });
