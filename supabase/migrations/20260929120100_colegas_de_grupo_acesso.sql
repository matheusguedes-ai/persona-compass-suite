-- #319 — acesso de `colegas_de_grupo`, em arquivo próprio e SEM corpo de função (ver a memória
-- "REVOKE precisa de PUBLIC").

REVOKE ALL ON FUNCTION public.colegas_de_grupo(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.colegas_de_grupo(uuid[]) TO authenticated, service_role, postgres;
