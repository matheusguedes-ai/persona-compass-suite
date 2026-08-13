-- #52: perfil_do_colega ficou executável por PUBLIC/anon desde a criação
-- original (20260730070000), que nunca teve REVOKE explícito — só GRANT TO
-- authenticated, que sozinho não fecha o acesso de PUBLIC. O DROP+CREATE
-- desta demanda recriou a função com o mesmo grant padrão do Postgres,
-- preservando a lacuna. Na prática o WHERE interno (auth.uid() = NULL para
-- anônimo) já barrava qualquer linha real de sair, mas a permissão de
-- EXECUTE em si devia estar fechada, no mesmo padrão de update_my_person e
-- do restante do projeto (ver #273). Corrigido aqui, na função que esta
-- demanda tocou diretamente.
REVOKE EXECUTE ON FUNCTION public.perfil_do_colega(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perfil_do_colega(uuid) TO authenticated;
