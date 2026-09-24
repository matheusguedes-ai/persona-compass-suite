-- #289 — acessos da assistente, em arquivo próprio e SEM corpo de função (ver a memória "REVOKE
-- precisa de PUBLIC": REVOKE depois de um $fn$…$fn$ já deixou de ser aplicado neste projeto, e
-- REVOKE sem PUBLIC não fecha nada).
--
-- Tabelas: o Supabase dá tudo a anon/authenticated por padrão e quem restringe é a RLS. Aqui a
-- permissão também vai ao mínimo — se um dia a RLS de uma destas tabelas for desligada por engano,
-- a porta continua fechada.

revoke all on table
  public.assistente_termos,
  public.assistente_liberacoes,
  public.assistente_consentimentos,
  public.assistente_conversas,
  public.assistente_mensagens,
  public.assistente_uso
from public, anon, authenticated;

grant all on table
  public.assistente_termos,
  public.assistente_liberacoes,
  public.assistente_consentimentos,
  public.assistente_conversas,
  public.assistente_mensagens,
  public.assistente_uso
to service_role;

grant select on table public.assistente_termos to authenticated;
grant select on table public.assistente_consentimentos to authenticated;
grant select, delete on table public.assistente_conversas to authenticated;
grant select on table public.assistente_mensagens to authenticated;

-- Funções que o aluno chama. Visitante sem login (anon) não chama nenhuma.
revoke execute on function public.assistente_liberada() from public, anon;
revoke execute on function public.assistente_situacao() from public, anon;
revoke execute on function public.assistente_revogar() from public, anon;

grant execute on function public.assistente_liberada() to authenticated, service_role, postgres;
grant execute on function public.assistente_situacao() to authenticated, service_role, postgres;
grant execute on function public.assistente_revogar() to authenticated, service_role, postgres;

-- Funções de gatilho: rodam dentro do INSERT/UPDATE, ninguém chama direto.
revoke execute on function public.assistente_termo_imutavel() from public, anon, authenticated;
revoke execute on function public.assistente_confere_termo() from public, anon, authenticated;
revoke execute on function public.assistente_exige_consentimento() from public, anon, authenticated;
