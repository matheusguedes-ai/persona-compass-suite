-- #52: o código publicado agora chama update_my_person com os 8 argumentos
-- (nome, telefone, avatar, empresa, banner, linkedin, instagram, site).
-- A versão antiga de 3 argumentos ficou órfã desde a migração
-- 20260812220000_perfil_aluno_enriquecido.sql — mantida viva até a publicação
-- para não quebrar o app antigo ainda no ar. Publicação confirmada em produção
-- (commit 4b0eee1), então agora é seguro remover a versão antiga.
DROP FUNCTION IF EXISTS public.update_my_person(text, text, text);
