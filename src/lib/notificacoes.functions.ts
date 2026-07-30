/**
 * Notificações — o sino.
 *
 * Quem recebe o quê está no banco, na função `notificar()` (migração
 * `20260730030000`), não aqui. É de propósito: a regra de visibilidade fica do
 * mesmo lado que a RLS, e a tela não tem como contornar.
 *
 * Aqui só se decide QUANDO disparar e com que texto.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Cliente = SupabaseClient<Database>;

/**
 * Dispara. Silenciosa de propósito, como a pontuação: notificação nunca pode
 * derrubar a ação que a gerou. Se falhar, a pessoa publicou do mesmo jeito —
 * só não avisou ninguém.
 */
export async function notificar(
  supabase: Cliente,
  args: {
    conta: string;
    tipo: string;
    titulo: string;
    corpo?: string | null;
    link?: string | null;
    ator?: string | null;
    atorNome?: string | null;
    grupos?: string[] | null;
    pessoaUser?: string | null;
    paraAlunos?: boolean;
  },
): Promise<void> {
  try {
    await (supabase.rpc as never as (n: string, a: unknown) => Promise<unknown>)("notificar", {
      p_conta: args.conta,
      p_tipo: args.tipo,
      p_titulo: args.titulo,
      p_corpo: args.corpo ?? null,
      p_link: args.link ?? null,
      p_ator: args.ator ?? null,
      p_ator_nome: args.atorNome ?? null,
      p_grupos: args.grupos ?? null,
      p_pessoa_user: args.pessoaUser ?? null,
      p_para_alunos: args.paraAlunos ?? false,
    });
  } catch {
    // Ver o comentário acima: notificação não derruba a ação.
  }
}


/**
 * Data e hora para LER, sempre em horário de Brasília.
 *
 * `toLocaleString("pt-BR")` sem `timeZone` usa o fuso de quem executa — e quem
 * executa é o servidor, que roda em UTC. O texto saía três horas adiantado: um
 * evento às 15:00 virava "18:00" na notificação. A interface é pt-BR e o
 * público é brasileiro, então o fuso é fixo e explícito.
 */
export function quandoBr(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

/** O nome que aparece no "fulano publicou". Mesma ordem de busca do feed. */
export async function nomeDoUsuario(supabase: Cliente, userId: string): Promise<string> {
  const { data: perfil } = await supabase
    .from("profiles").select("full_name").eq("user_id", userId).maybeSingle();
  if (perfil?.full_name?.trim()) return perfil.full_name.trim();
  const { data: sessao } = await supabase.auth.getUser();
  const meta = sessao.user?.user_metadata as { full_name?: string; name?: string } | undefined;
  const doLogin = meta?.full_name?.trim() || meta?.name?.trim();
  if (doLogin) return doLogin;
  const { data: pessoa } = await supabase
    .from("people").select("full_name").eq("user_id", userId).limit(1).maybeSingle();
  return pessoa?.full_name?.trim() || "Alguém";
}

/** A conta sob a qual a pessoa age — a notificação vive dentro dela. */
export async function contaAtual(supabase: Cliente, userId: string): Promise<string | null> {
  const { data } = await supabase.rpc("acting_account");
  if (data) return data as string;
  const { data: p } = await supabase
    .from("people").select("mentor_id").eq("user_id", userId).limit(1).maybeSingle();
  return p?.mentor_id ?? null;
}

/**
 * De que área do painel do aluno cada aviso fala.
 *
 * Serve para não avisar sobre uma parte que o grupo dele não libera: o aviso
 * levaria a uma tela de "sem acesso", e um sino que só entrega beco sem saída
 * é pior do que sino nenhum.
 */
const AREA_DA_NOTIFICACAO: Record<string, string> = {
  comunidade_post: "comunidade",
  comunidade_comentario: "comunidade",
  devolutiva: "devolutivas",
  devolutiva_agendada: "devolutivas",
  devolutiva_realizada: "devolutivas",
  evento: "agenda",
  evento_novo: "agenda",
  vespera_aula: "classroom",
  vespera_devolutiva: "devolutivas",
};

export const listarNotificacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Os avisos de véspera nascem AQUI, na leitura, e não num cron.
    //
    // A notificação do sino só tem efeito quando alguém abre a plataforma —
    // então gravá-la de madrugada, para quem talvez nunca entre, seria uma
    // extensão a mais para manter e uma fila que enche sozinha. Calculada na
    // abertura, ela chega exatamente quando pode ser vista.
    //
    // Idempotente pelo índice único parcial (user_id, tipo, link): F5 não
    // duplica. E silenciosa — o sino nunca deixa de abrir por causa disto.
    try {
      await (context.supabase.rpc as never as (n: string) => Promise<unknown>)("avisos_da_vespera");
    } catch {
      // Ver acima.
    }

    const [lista, areas] = await Promise.all([
      context.supabase
        .from("notificacoes")
        .select("id, tipo, titulo, corpo, link, ator_nome, lida_em, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      context.supabase.rpc("minhas_areas"),
    ]);
    if (lista.error) throw new Error(lista.error.message);
    if (areas.error) throw new Error(areas.error.message);

    const minhas = new Set(
      ((areas.data ?? []) as unknown as Array<string | Record<string, string>>).map((r) =>
        typeof r === "string" ? r : Object.values(r)[0],
      ),
    );
    // Tipo desconhecido passa: um aviso novo não deve sumir só porque este
    // mapa ainda não o conhece.
    const notificacoes = (lista.data ?? []).filter((n) => {
      const area = AREA_DA_NOTIFICACAO[n.tipo];
      return !area || minhas.has(area);
    });

    return {
      notificacoes,
      naoLidas: notificacoes.filter((n) => !n.lida_em).length,
    };
  });

export const marcarLida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    // A RLS garante que só a própria pessoa marca as dela.
    const { error } = await context.supabase
      .from("notificacoes")
      .update({ lida_em: new Date().toISOString() })
      .eq("id", data.id)
      .is("lida_em", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const marcarTodasLidas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("notificacoes")
      .update({ lida_em: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("lida_em", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
