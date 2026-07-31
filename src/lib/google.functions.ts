/**
 * Google Calendar — o que a tela chama.
 *
 * Nada aqui devolve o refresh token: `estadoDoGoogle` responde só "conectado?"
 * e "com qual e-mail?". O token vive no servidor e não tem policy de leitura.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirDono } from "@/lib/team.functions";

/** A conexão é da conta (as devolutivas de todo mundo caem na mesma agenda). Só dono. */
export const estadoDoGoogle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirDono(context.supabase);
    const { credenciais } = await import("@/lib/google.server");
    const { data } = await (context.supabase.rpc as never as (n: string) => Promise<{
      data: Array<{
        conectado: boolean; email: string | null; conectado_em: string;
        ultimo_erro: string | null; ultimo_uso_em: string | null;
      }> | null;
    }>)("minha_conexao_google");
    const linha = (data ?? [])[0];
    return {
      // Sem as chaves do app, conectar nem deve ser oferecido — o botão levaria
      // a uma tela de erro do Google.
      configurado: !!credenciais(),
      conectado: !!linha,
      email: linha?.email ?? null,
      // A última falha de sincronia. `sincronizar()` já gravava isto e nenhuma
      // tela lia — o mentor marcava a devolutiva, a tela dizia "salvo", e o
      // compromisso não aparecia no Google. Ele descobria no dia.
      ultimo_erro: linha?.ultimo_erro ?? null,
      ultimo_uso_em: linha?.ultimo_uso_em ?? null,
    };
  });

/** Devolve para onde mandar a pessoa. A tela navega; o servidor assina o estado. */
export const iniciarConexaoGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirDono(context.supabase);
    const { urlDeAutorizacao, assinarEstado } = await import("@/lib/google.server");
    const url = urlDeAutorizacao(assinarEstado(context.userId));
    if (!url) throw new Error("O Google ainda não foi configurado nesta plataforma.");
    return { url };
  });

export const desconectarGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirDono(context.supabase);
    // A RLS só deixa apagar a própria conexão. Os eventos já criados ficam no
    // Google: apagá-los sem avisar tiraria compromissos da agenda de alguém.
    const { error } = await context.supabase
      .from("google_conexoes").delete().eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
