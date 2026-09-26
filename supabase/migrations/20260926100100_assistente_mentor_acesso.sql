-- #307 — acessos da assistente do mentor, em arquivo próprio e SEM corpo de função (ver a memória
-- "REVOKE precisa de PUBLIC"). Mesmo desenho do `20260924200100_assistente_n1_acesso.sql`: a porta
-- fica no mínimo mesmo que a RLS de uma destas tabelas seja desligada por engano.

revoke all on table public.assistente_mentor_conversas, public.assistente_mentor_mensagens
  from public, anon, authenticated;

grant all on table public.assistente_mentor_conversas, public.assistente_mentor_mensagens to service_role;

grant select, delete on table public.assistente_mentor_conversas to authenticated;
grant select on table public.assistente_mentor_mensagens to authenticated;

-- A função que o menu e a edge function consultam. Visitante sem login (anon) não chama.
revoke execute on function public.assistente_mentor_liberada() from public, anon;
grant execute on function public.assistente_mentor_liberada() to authenticated, service_role, postgres;

-- Função de gatilho: roda dentro do INSERT, ninguém chama direto.
revoke execute on function public.assistente_mentor_exige_dono() from public, anon, authenticated;
