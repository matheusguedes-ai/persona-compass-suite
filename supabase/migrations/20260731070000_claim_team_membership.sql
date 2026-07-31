-- Fecha a outra metade do #24 (generalizar /aluno/criar-senha): a tela nova
-- serve os dois papéis, mas só ela não bastava. Um mentor promovido "a frio"
-- (nunca tinha logado antes de virar mentor) ganha o team_members certo --
-- kind='mentor', person_id ligado -- só que com user_id NULL e
-- status='convidado' (ver promover_a_mentor, migração 20260730010000). O
-- primeiro login dele passa pelo MESMO caminho do aluno, que só resolve
-- people.user_id (claim_student_profile) -- o lado de team_members nunca era
-- ligado, e a pessoa promovida continuava sendo tratada como aluno comum.
--
-- claim_team_membership() faz o mesmo tipo de "ligar pelo e-mail" que
-- claim_student_profile() já faz, mas com escopo BEM mais estreito de
-- propósito: só team_members com kind='mentor' (nunca 'colaborador' -- esse
-- convite continua exigindo o token de /convite-equipe, não pode virar
-- automático) E cujo person_id já esteja ligado a ESTE auth.uid() via
-- people.user_id (ou seja, alguém que o dono já promoveu a mentor a partir de
-- uma pessoa que já é, comprovadamente, esta conta). Não casa por e-mail
-- direto contra team_members -- isso abriria a porta para um dono qualquer
-- "convidar" o e-mail de outra pessoa como colaborador e ganhar esse vínculo
-- de graça no primeiro login dela em QUALQUER lugar da plataforma.

CREATE OR REPLACE FUNCTION public.claim_team_membership()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_n integer;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;

  UPDATE public.team_members tm
     SET user_id = v_uid, status = 'ativo', accepted_at = COALESCE(accepted_at, now())
   WHERE tm.kind = 'mentor'
     AND tm.user_id IS NULL
     AND tm.person_id IN (SELECT id FROM public.people WHERE user_id = v_uid);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.claim_team_membership() TO authenticated;

-- Conferir depois de rodar:
--   SELECT proname FROM pg_proc WHERE proname = 'claim_team_membership';
