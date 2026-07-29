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
import { z } from "zod";
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

/** Um compromisso na agenda. */
export type Compromisso = {
  id: string;
  person_id: string;
  person_name: string;
  /** ISO completo; pode ter hora ou ser só data. */
  quando: string;
  status: "agendada" | "realizada";
  atrasada: boolean;
};

/**
 * A agenda de um período.
 *
 * ⚠️ O PERÍODO VEM PRONTO DO NAVEGADOR, em ISO. Não recebe "ano e mês" para o
 * servidor converter: o servidor roda em **UTC**, então `new Date(2026, 6, 1)`
 * ali é 1º de julho 00:00 UTC — que no Brasil ainda é 30 de junho, 21h. Uma
 * devolutiva marcada para o último dia do mês às 22h cairia fora do intervalo e
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
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { de, ate } = data;

    const { data: devs, error } = await context.supabase
      .from("devolutivas")
      .select("id, person_id, status, scheduled_at, completed_at, people(full_name)")
      .neq("status", "cancelada")
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", de)
      .lt("scheduled_at", ate)
      .order("scheduled_at");
    if (error) throw new Error(error.message);

    const agora = Date.now();
    const compromissos: Compromisso[] = (devs ?? [])
      .filter((d) => d.scheduled_at)
      .map((d) => ({
        id: d.id,
        person_id: d.person_id,
        person_name: d.people?.full_name ?? "—",
        quando: d.scheduled_at!,
        status: d.status as "agendada" | "realizada",
        atrasada: d.status === "agendada" && new Date(d.scheduled_at!).getTime() < agora,
      }));

    return { compromissos };
  });
