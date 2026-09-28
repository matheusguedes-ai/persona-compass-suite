-- #319 (conferência pós-publicação) — acesso de `e_colega_de_grupo`, em arquivo próprio e SEM corpo de
-- função (ver a memória "REVOKE precisa de PUBLIC"). A policy roda com a permissão de quem lê, então
-- `authenticated` precisa executar; o público e o anônimo, não.

REVOKE ALL ON FUNCTION public.e_colega_de_grupo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.e_colega_de_grupo(uuid) TO authenticated, service_role, postgres;
