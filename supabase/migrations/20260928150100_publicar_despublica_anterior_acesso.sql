-- #278 — acessos das funções de publicação, em arquivo próprio e SEM corpo de função (ver a
-- memória "REVOKE precisa de PUBLIC": REVOKE escrito depois de um $fn$…$fn$ já deixou de ser
-- aplicado neste projeto, e REVOKE sem PUBLIC não fecha nada).

REVOKE ALL ON FUNCTION public.previa_publicacao(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publicar_versao(uuid, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.previa_publicacao(uuid) TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.publicar_versao(uuid, boolean) TO authenticated, service_role, postgres;

-- A função de gatilho roda dentro do INSERT/UPDATE — ninguém chama direto.
REVOKE EXECUTE ON FUNCTION public.test_versions_despublica_anterior() FROM PUBLIC, anon, authenticated;
