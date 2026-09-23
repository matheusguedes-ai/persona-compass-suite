-- #298 — o aluno enxerga os testes liberados para o grupo dele.
--
-- Hoje `group_instruments` só tem policy de leitura para o lado da equipe
-- (`visible_group_ids()`, escopada a `mentor_id = acting_account()`). É por
-- isso que "testes liberados" no grupo não chega a lugar nenhum para quem
-- está do outro lado: o aluno logado não enxerga nem uma linha.
--
-- Mesmo padrão já usado para groups/group_members (`posso_ver_grupo`,
-- 20260729180000_comunidade.sql) e para test_responses/assessment_responses
-- (`aluno_pode('resultados')`, 20260730210000_areas_do_grupo.sql): só ADD,
-- nada é removido nem renomeado — a policy da equipe continua intacta.

CREATE POLICY gi_student_read ON public.group_instruments FOR SELECT TO authenticated
  USING (public.posso_ver_grupo(group_id) AND public.aluno_pode('resultados'));
