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
import { notificar, quandoBr } from "@/lib/notificacoes.functions";

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
  /** Devolutiva é conversa com uma pessoa; evento é o que o master publicou. */
  tipo: "devolutiva" | "evento";
  descricao?: string | null;
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
      /** Painel do aluno: só as devolutivas dele, não as da conta. */
      somenteMinhas: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { de, ate } = data;

    // No painel do aluno o recorte da RLS não basta.
    //
    // Para o AVALIADO a RLS já entrega só o que é dele. Mas na prévia "Ver como
    // aluno" quem está autenticado é o DONO — e para ele a RLS entrega a conta
    // inteira. Sem este filtro, a agenda da prévia mostraria todos os
    // compromissos da conta como se fossem daquela pessoa. Foi exatamente o que
    // aconteceu com a comunidade antes de `gruposDoAvaliado` existir.
    let meus: string[] | null = null;
    if (data.somenteMinhas) {
      const { data: eu, error: eE } = await context.supabase
        .from("people").select("id").eq("user_id", context.userId);
      if (eE) throw new Error(eE.message);
      meus = (eu ?? []).map((p) => p.id);
      if (meus.length === 0) return { compromissos: [] };
    }

    const { data: devs, error } = await context.supabase
      .from("devolutivas")
      .select("id, person_id, status, scheduled_at, completed_at, people(full_name)")
      .neq("status", "cancelada")
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", de)
      .lt("scheduled_at", ate)
      .order("scheduled_at")
      .then((r) => (meus ? { ...r, data: (r.data ?? []).filter((d) => meus!.includes(d.person_id)) } : r));
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
        tipo: "devolutiva" as const,
      }));

    // Os eventos do master entram na mesma agenda.
    //
    // Aqui NÃO se aplica `somenteMinhas`: o recorte do evento é o destino dele,
    // e `posso_ver_evento` já resolveu isso na RLS. Filtrar de novo por
    // `person_id` esconderia do aluno justamente os eventos de grupo — que são
    // o caso mais comum.
    const { data: evs, error: eE2 } = await context.supabase
      .from("eventos")
      .select("id, titulo, descricao, quando")
      .gte("quando", de)
      .lt("quando", ate)
      .order("quando");
    if (eE2) throw new Error(eE2.message);

    for (const e of evs ?? []) {
      compromissos.push({
        id: e.id,
        person_id: "",
        person_name: e.titulo,
        quando: e.quando,
        status: "agendada",
        atrasada: false,
        tipo: "evento",
        descricao: e.descricao,
      });
    }
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

    const { data: criado, error } = await supabase
      .from("eventos")
      .insert({
        conta_id: context.userId,
        titulo: data.titulo,
        descricao: data.descricao?.trim() || null,
        quando: data.quando,
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
        link: "/gestao",
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
        link: "/gestao",
        ator: context.userId,
        pessoaUser: p.user_id,
      });
    }

    return { id: criado.id };
  });

export const excluirEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    // Os destinos caem por CASCADE.
    const { error } = await context.supabase.from("eventos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
