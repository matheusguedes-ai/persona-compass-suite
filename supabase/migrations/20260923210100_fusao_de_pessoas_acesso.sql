-- #300 (entrega 2): quem pode chamar as funções de unificação.
--
-- Arquivo separado, sem corpo de função, de propósito: REVOKE escrito depois
-- de um `$fn$ … $fn$` já deixou de ser aplicado aqui (ver memória
-- "REVOKE precisa de PUBLIC"). E com PUBLIC na lista — sem ele, o REVOKE de
-- anon/authenticated não fecha nada.
REVOKE ALL ON FUNCTION public.previa_fusao(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fundir_pessoas(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.previa_fusao(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fundir_pessoas(uuid, uuid, uuid) TO service_role;
