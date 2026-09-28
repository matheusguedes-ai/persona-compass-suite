-- #320 — acesso de `bib_resumo_material`, em arquivo próprio e SEM corpo de função (ver a memória
-- "REVOKE precisa de PUBLIC").

REVOKE ALL ON FUNCTION public.bib_resumo_material(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bib_resumo_material(uuid) TO authenticated, service_role, postgres;
