-- #298: o aluno também precisa ler a VERSÃO do teste liberada ao grupo dele,
-- não só a linha de group_instruments. A policy existente (tv_read_templates)
-- só cobre o template global (is_template = true) ou o dono da própria versão
-- (mentor_id = acting_account()) — um aluno nunca é acting_account() do
-- mentor, então a versão PUBLICADA e PRÓPRIA do mentor (o caso comum: quase
-- nenhum mentor usa o template puro, cada um publica a sua) ficava invisível
-- pra quem for responder por conta própria. resolverVersao() em
-- student.functions.ts não achava candidata nenhuma e a tela avisava "sem
-- versão pronta" mesmo com tudo liberado certo.
--
-- Escopo apertado de propósito: só amplia para a versão cujo mentor_id é o
-- MESMO do grupo que liberou o instrumento (g.mentor_id = test_versions.mentor_id).
-- Sem isso, o instrument_id sozinho bastaria pra casar — e um aluno enxergaria
-- a versão publicada de OUTRO mentor pro mesmo instrumento do catálogo, o que
-- vaza conteúdo de teste entre contas. Puramente aditiva (regra 5).
CREATE POLICY tv_student_read ON public.test_versions FOR SELECT TO authenticated
  USING (
    is_published = true
    AND EXISTS (
      SELECT 1
        FROM public.group_instruments gi
        JOIN public.groups g ON g.id = gi.group_id
       WHERE gi.instrument_id = test_versions.instrument_id
         AND g.mentor_id = test_versions.mentor_id
         AND public.posso_ver_grupo(gi.group_id)
    )
    AND public.aluno_pode('resultados')
  );
