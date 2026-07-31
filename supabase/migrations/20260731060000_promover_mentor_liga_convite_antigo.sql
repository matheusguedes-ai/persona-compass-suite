-- Fecha o cuidado do Anexo 3 (docs/plano-area-do-aluno.md): promover alguém
-- a mentor cujo e-mail já tinha um convite SOLTO do modelo antigo (um
-- `team_members` sem `person_id`, de antes de "mentor é aluno promovido")
-- precisa LIGAR nesse convite, não duplicar.
--
-- `promover_a_mentor` só olhava `team_members.person_id = p_person_id` — um
-- convite antigo (person_id NULL) nunca bate nessa busca. Cai no INSERT do
-- fim, que tentaria criar uma segunda linha com o mesmo (owner_id, email) e
-- esbarraria no índice único `uq_team_members_owner_email` -- ou seja, hoje
-- promover essa pessoa simplesmente FALHA com um erro que não explica nada.
--
-- Adiciona um segundo caso, entre o "já ligado" e o "cria do zero": acha o
-- convite solto pelo e-mail e liga nele em vez de inserir de novo.
--
-- Nenhum mentor órfão existe hoje (conferido em 31/07/2026 -- o único
-- `team_members` do banco já tem `person_id`), então isto é prevenção, não
-- reparo de dado quebrado agora. `createTeamMember` também já foi fechado
-- para não aceitar `kind: 'mentor'` nunca mais (commit do lote de 31/07).

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

  -- 1) Já existe team_members ligado a ESTA pessoa: reaproveita.
  SELECT id INTO v_id FROM public.team_members WHERE person_id = p_person_id;
  IF v_id IS NOT NULL THEN
    UPDATE public.team_members SET kind = 'mentor', status = 'ativo' WHERE id = v_id;
    RETURN v_id;
  END IF;

  -- 2) Convite solto do modelo antigo (sem person_id), mesmo e-mail desta
  --    pessoa: liga nele em vez de duplicar -- o cuidado do Anexo 3.
  SELECT id INTO v_id FROM public.team_members
   WHERE owner_id = v_dono AND person_id IS NULL AND lower(email) = lower(v_pessoa.email);
  IF v_id IS NOT NULL THEN
    UPDATE public.team_members
       SET kind = 'mentor', status = 'ativo', person_id = p_person_id,
           user_id = v_pessoa.user_id, accepted_at = COALESCE(accepted_at, now())
     WHERE id = v_id;
    RETURN v_id;
  END IF;

  -- 3) Nada existente: cria do zero, como já era.
  INSERT INTO public.team_members (owner_id, person_id, name, email, kind, status, user_id, accepted_at)
  VALUES (
    v_dono, p_person_id, v_pessoa.full_name, lower(v_pessoa.email), 'mentor',
    CASE WHEN v_pessoa.user_id IS NULL THEN 'convidado' ELSE 'ativo' END,
    v_pessoa.user_id,
    CASE WHEN v_pessoa.user_id IS NULL THEN NULL ELSE now() END
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;

-- Conferir depois de rodar (deve devolver a função com "person_id IS NULL" no corpo):
--   SELECT prosrc FROM pg_proc WHERE proname = 'promover_a_mentor';
