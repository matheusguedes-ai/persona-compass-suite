-- O dono decide, por GRUPO, se o mentor afiliado pode agendar devolutivas.
--
-- Fica ao lado de `can_download_reports`, que já existia com a mesma lógica: a
-- permissão do mentor não é da conta inteira, é de cada grupo em que ele foi
-- posto. O mesmo mentor pode conduzir devolutivas numa turma e só acompanhar
-- em outra.

ALTER TABLE public.team_member_groups
  ADD COLUMN IF NOT EXISTS can_schedule_devolutivas boolean NOT NULL DEFAULT false;

/**
 * Posso agendar devolutiva com esta pessoa?
 *
 * O dono sempre pode. O mentor afiliado, só se estiver num grupo dela com a
 * permissão ligada — por isso a checagem passa pelos grupos em comum, e não
 * por um campo no cadastro do mentor.
 */
CREATE OR REPLACE FUNCTION public.posso_agendar_devolutiva(p_person_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    public.member_kind() <> 'mentor'
    OR EXISTS (
      SELECT 1
        FROM public.group_members gm
        JOIN public.team_member_groups tmg ON tmg.group_id = gm.group_id
        JOIN public.team_members tm ON tm.id = tmg.team_member_id
       WHERE gm.person_id = p_person_id
         AND tm.user_id = auth.uid()
         AND tmg.can_schedule_devolutivas
    );
$fn$;

GRANT EXECUTE ON FUNCTION public.posso_agendar_devolutiva(uuid) TO authenticated;

-- Criar e registrar devolutiva passam a exigir a permissão. Ler continua
-- liberado para o mentor do grupo: acompanhar é o mínimo do papel dele.
DROP POLICY IF EXISTS devolutivas_insert ON public.devolutivas;
CREATE POLICY devolutivas_insert ON public.devolutivas FOR INSERT TO authenticated
  WITH CHECK (
    mentor_id = public.acting_account()
    AND public.can_see_person(person_id)
    AND public.posso_agendar_devolutiva(person_id)
  );

DROP POLICY IF EXISTS devolutivas_update ON public.devolutivas;
CREATE POLICY devolutivas_update ON public.devolutivas FOR UPDATE TO authenticated
  USING (
    mentor_id = public.acting_account()
    AND public.can_see_person(person_id)
    AND public.posso_agendar_devolutiva(person_id)
  )
  WITH CHECK (mentor_id = public.acting_account());
