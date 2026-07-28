-- Corrige policies de SELECT que consultavam a própria tabela
-- ============================================================
-- Sintoma: "new row violates row-level security policy" ao criar uma trilha
-- (e o mesmo valeria para criar um grupo).
--
-- Causa: `lt_read` chamava `can_see_track(id)` e a policy de SELECT de `groups`
-- chamava `visible_group_ids()` — ambas funções STABLE que **releem a própria
-- tabela**. Uma função STABLE enxerga o snapshot do início da instrução, que
-- não contém a linha que aquela mesma instrução está inserindo. Como o app usa
-- `INSERT ... RETURNING` (o `.select()` depois do `.insert()`), o Postgres
-- aplica a policy de SELECT na linha nova, ela some do snapshot e o INSERT é
-- recusado.
--
-- Correção: escrever a condição direto sobre as colunas da própria linha. Nada
-- muda em quem enxerga o quê — muda só o caminho para chegar à resposta.
--
-- As demais policies não têm o problema: elas consultam OUTRA tabela (por
-- exemplo, `learning_modules` consulta `learning_tracks`), cuja linha já está
-- no snapshot.

DROP POLICY IF EXISTS lt_read ON public.learning_tracks;
CREATE POLICY lt_read ON public.learning_tracks FOR SELECT TO authenticated
  USING (
    owner_id = public.acting_account()
    OR (
      is_published
      AND audience IN ('alunos', 'ambos')
      AND owner_id IN (SELECT p.mentor_id FROM public.people p WHERE p.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Mentors view their own groups" ON public.groups;
CREATE POLICY "Mentors view their own groups" ON public.groups FOR SELECT TO authenticated
  USING (
    mentor_id = public.acting_account()
    AND (
      public.member_kind() <> 'mentor'
      OR id IN (
        SELECT tmg.group_id
          FROM public.team_member_groups tmg
          JOIN public.team_members tm ON tm.id = tmg.team_member_id
         WHERE tm.user_id = auth.uid() AND tm.status = 'ativo'
      )
    )
  );
