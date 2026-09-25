-- #305 — acessos das observações do mentor, em arquivo próprio e SEM corpo de função (ver a memória
-- "REVOKE precisa de PUBLIC").

revoke all on table public.assistente_observacoes from public, anon, authenticated;
grant all on table public.assistente_observacoes to service_role;
-- A equipe usa pela tela da ficha da pessoa; a RLS decide quais linhas.
grant select, insert, update, delete on table public.assistente_observacoes to authenticated;

-- Função de gatilho: roda dentro do INSERT/UPDATE, ninguém chama direto. Não é SECURITY DEFINER —
-- lê `people` com a permissão de quem escreve, então quem não enxerga o cadastro nem acha a conta.
revoke execute on function public.assistente_observacao_dono() from public, anon, authenticated;

-- CREATE OR REPLACE mantém os privilégios, mas reafirmar não custa: a unificação é só do servidor.
revoke all on function public.previa_fusao(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fundir_pessoas(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.previa_fusao(uuid, uuid) to service_role;
grant execute on function public.fundir_pessoas(uuid, uuid, uuid) to service_role;
