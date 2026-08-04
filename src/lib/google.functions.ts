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

    // Informativo (Fatia 4b): quais calendários esta conta enxerga, para o
    // professor decidir se algum além do principal também deveria bloquear
    // horário. Não derruba a tela se falhar — o resto continua funcionando.
    let calendarios: { id: string; nome: string; principal: boolean }[] = [];
    if (linha) {
      try {
        const { renovarAcesso, listarCalendarios } = await import("@/lib/google.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: conexao } = await supabaseAdmin
          .from("google_conexoes").select("refresh_token").eq("user_id", context.userId).maybeSingle();
        if (conexao?.refresh_token) {
          const acesso = await renovarAcesso(conexao.refresh_token);
          calendarios = await listarCalendarios(acesso);
        }
      } catch {
        // Lista vazia — a tela mostra o resto normalmente.
      }
    }

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
      calendarios,
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
    // Apaga via RPC (SECURITY DEFINER), não via .delete() direto: RLS de
    // DELETE nesta tabela não funciona (planejador do Postgres descarta a
    // linha antes de checar — ver a migração 20260804010000). Os eventos já
    // criados ficam no Google: apagá-los sem avisar tiraria compromissos da
    // agenda de alguém.
    const { error } = await (context.supabase.rpc as never as (n: string) => Promise<{ error: Error | null }>)(
      "desconectar_minha_conexao_google",
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
