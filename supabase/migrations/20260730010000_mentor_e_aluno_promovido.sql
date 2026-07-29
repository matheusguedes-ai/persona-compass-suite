-- Mentor passa a ser um AVALIADO promovido, não um cadastro à parte.
--
-- Antes havia duas identidades independentes: `people` (avaliado) e
-- `team_members` (equipe). O mesmo e-mail nos dois virava duas contas e dois
-- painéis. Já tinha acontecido: o próprio dono é "Teste VAK" em `people`, e foi
-- por isso que o nome dele saiu errado na comunidade.
--
-- Agora o mentor aponta para a pessoa. Uma pessoa, um cadastro, um painel — o
-- do aluno, com o menu Grupos a mais quando ela é mentora.
--
-- COLABORADOR NÃO MUDA. Ele não é aluno: é alguém da operação, com permissões
-- de funcionalidade. Continua com convite e cadastro próprios, e por isso
-- `person_id` fica opcional.

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS team_members_person_idx ON public.team_members (person_id);

-- Um mentor por pessoa. Sem isto, promover duas vezes criaria dois vínculos.
CREATE UNIQUE INDEX IF NOT EXISTS team_members_pessoa_unica
  ON public.team_members (person_id)
  WHERE person_id IS NOT NULL;

-- Liga os mentores que já existem à pessoa de mesmo e-mail, quando houver.
UPDATE public.team_members tm
   SET person_id = p.id
  FROM public.people p
 WHERE tm.kind = 'mentor'
   AND tm.person_id IS NULL
   AND lower(p.email) = lower(tm.email)
   AND p.mentor_id = tm.owner_id;

-- Mentor que não tinha pessoa correspondente vira uma: ele é avaliado também,
-- e sem isso ficaria sem painel depois da mudança.
INSERT INTO public.people (mentor_id, full_name, email, user_id)
SELECT tm.owner_id, tm.name, lower(tm.email), tm.user_id
  FROM public.team_members tm
 WHERE tm.kind = 'mentor'
   AND tm.person_id IS NULL
ON CONFLICT DO NOTHING;

UPDATE public.team_members tm
   SET person_id = p.id
  FROM public.people p
 WHERE tm.kind = 'mentor'
   AND tm.person_id IS NULL
   AND lower(p.email) = lower(tm.email)
   AND p.mentor_id = tm.owner_id;

/**
 * Promove um avaliado a mentor.
 *
 * Substitui o convite: quem é promovido já está cadastrado e já tem — ou terá —
 * o acesso de aluno. Não há segundo cadastro, segundo e-mail nem segundo
 * painel.
 *
 * Só o dono da conta promove.
 */
CREATE OR REPLACE FUNCTION public.promover_a_mentor(p_person_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_dono uuid := public.acting_account();
  v_pessoa record;
  v_id uuid;
BEGIN
  IF v_dono IS NULL OR v_dono <> auth.uid() THEN
    RAISE EXCEPTION 'Só o dono da conta pode promover alguém a mentor.';
  END IF;

  SELECT id, full_name, email, user_id, mentor_id INTO v_pessoa
    FROM public.people WHERE id = p_person_id AND mentor_id = v_dono;
  IF v_pessoa.id IS NULL THEN
    RAISE EXCEPTION 'Pessoa não encontrada nesta conta.';
  END IF;

  SELECT id INTO v_id FROM public.team_members WHERE person_id = p_person_id;
  IF v_id IS NOT NULL THEN
    UPDATE public.team_members SET kind = 'mentor', status = 'ativo' WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.team_members (owner_id, person_id, name, email, kind, status, user_id, accepted_at)
  VALUES (
    v_dono, p_person_id, v_pessoa.full_name, lower(v_pessoa.email), 'mentor',
    -- Já tem login: entra como mentor na hora. Ainda não: o primeiro acesso do
    -- aluno resolve, e é o mesmo caminho de sempre.
    CASE WHEN v_pessoa.user_id IS NULL THEN 'convidado' ELSE 'ativo' END,
    v_pessoa.user_id,
    CASE WHEN v_pessoa.user_id IS NULL THEN NULL ELSE now() END
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.promover_a_mentor(uuid) TO authenticated;

/** Tira o papel de mentor. A pessoa continua avaliada, com o painel dela. */
CREATE OR REPLACE FUNCTION public.rebaixar_mentor(p_person_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_dono uuid := public.acting_account();
BEGIN
  IF v_dono IS NULL OR v_dono <> auth.uid() THEN
    RAISE EXCEPTION 'Só o dono da conta pode remover o papel de mentor.';
  END IF;
  DELETE FROM public.team_members
   WHERE person_id = p_person_id AND owner_id = v_dono AND kind = 'mentor';
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.rebaixar_mentor(uuid) TO authenticated;
