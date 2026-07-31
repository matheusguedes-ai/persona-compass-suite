-- Fecha #218: 'configuracoes' não é permissão delegável — a lista errada, não
-- uma checagem que falhou. A tela mexe em marca, logo, nome da empresa,
-- mensagens-padrão e remetente: reconfigura a plataforma para todo mundo.
-- src/lib/team.functions.ts já tirou 'configuracoes' de PERMISSOES (o Zod
-- recusa esse valor daqui para frente); esta migração limpa quem já tinha —
-- em produção agora, é o colaborador 'Sucesso do Aluno' (matheusgc321@gmail.com).
--
-- Migra em vez de apagar a linha: as OUTRAS permissões de quem tinha
-- 'configuracoes' continuam valendo (ex.: 'Sucesso do Aluno' mantém as demais
-- sete). Só remove o item que nunca devia ter sido oferecido.

UPDATE public.team_members
   SET permissions = array_remove(permissions, 'configuracoes')
 WHERE 'configuracoes' = ANY(permissions);

-- Conferir depois de rodar (deve devolver zero linhas):
--   SELECT id, name, email, permissions FROM public.team_members
--    WHERE 'configuracoes' = ANY(permissions);
