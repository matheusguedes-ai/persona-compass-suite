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

export const listarNotificacoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notificacoes")
      .select("id, tipo, titulo, corpo, link, ator_nome, lida_em, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return {
      notificacoes: data ?? [],
      naoLidas: (data ?? []).filter((n) => !n.lida_em).length,
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
