-- #316A — acessos das chaves da assistente, em arquivo próprio e SEM corpo de função (memória "REVOKE
-- precisa de PUBLIC": REVOKE depois de um $fn$…$fn$ já deixou de ser aplicado neste projeto, e REVOKE
-- sem PUBLIC não fecha nada). As funções que já existiam e foram só substituídas (`assistente_situacao`,
-- `assistente_revogar` e os três gatilhos) mantêm as permissões que tinham.

-- Tabelas: só o próprio aluno LÊ (RLS); ninguém escreve pela API — quem grava são as funções.
revoke all on table public.assistente_chaves, public.assistente_chaves_registro from public, anon, authenticated;
grant all on table public.assistente_chaves, public.assistente_chaves_registro to service_role;
grant select on table public.assistente_chaves, public.assistente_chaves_registro to authenticated;

-- O que o aluno chama. Visitante sem login (anon) não chama nenhuma.
revoke execute on function public.assistente_aceitar(uuid, boolean, boolean, boolean, boolean, jsonb) from public, anon;
revoke execute on function public.assistente_definir_chaves(boolean, boolean, boolean, boolean, jsonb) from public, anon;
revoke execute on function public.assistente_apagar_tudo() from public, anon;
grant execute on function public.assistente_aceitar(uuid, boolean, boolean, boolean, boolean, jsonb) to authenticated, service_role, postgres;
grant execute on function public.assistente_definir_chaves(boolean, boolean, boolean, boolean, jsonb) to authenticated, service_role, postgres;
grant execute on function public.assistente_apagar_tudo() to authenticated, service_role, postgres;

-- Peças internas: só as funções acima as usam (rodando como dono). Ninguém de fora chama.
revoke execute on function public.assistente_chaves_de(uuid) from public, anon, authenticated;
revoke execute on function public.assistente_apagar_guardado(uuid, text[]) from public, anon, authenticated;
revoke execute on function public.assistente_gravar_chaves(uuid, uuid, uuid, integer, text, boolean, boolean, boolean, boolean, jsonb) from public, anon, authenticated;
revoke execute on function public.assistente_registro_imutavel() from public, anon, authenticated;
grant execute on function public.assistente_chaves_de(uuid) to service_role, postgres;
grant execute on function public.assistente_apagar_guardado(uuid, text[]) to service_role, postgres;
grant execute on function public.assistente_gravar_chaves(uuid, uuid, uuid, integer, text, boolean, boolean, boolean, boolean, jsonb) to service_role, postgres;
