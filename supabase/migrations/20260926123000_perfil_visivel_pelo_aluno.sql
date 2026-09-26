-- #308 — a chavinha "Meus dados para o grupo" (people.perfil_visivel) NUNCA gravou pela tela.
--
-- A tela do aluno fazia `update people set perfil_visivel = … where user_id = <login>` com o login
-- do aluno. A única policy de UPDATE de `people` é a do mentor ("Mentors update their own people":
-- mentor_id = acting_account()), e para um aluno acting_account() é o próprio login — nunca o mentor
-- dono do cadastro. O banco filtrava a linha, alterava ZERO linhas e respondia "ok", sem erro; a
-- tela mostrava "Seus dados agora aparecem para o grupo" e, ao reler, a chave voltava desligada.
--
-- Uma policy de UPDATE para o aluno abriria TODAS as colunas do cadastro dele (mentor_id, notes…)
-- para escrita direta pela API. Em vez disso, o mesmo padrão de `update_my_person`: uma função que
-- grava SÓ esta coluna, SÓ nos cadastros do próprio login, e devolve o valor que FICOU no banco —
-- a tela mostra isso, nunca o que foi pedido.
--
-- Só acrescenta (regra 5): nada do que está no ar usa este nome.

CREATE OR REPLACE FUNCTION public.definir_meu_perfil_visivel(_visivel boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_valor boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'É preciso estar logado.';
  END IF;
  IF _visivel IS NULL THEN
    RAISE EXCEPTION 'Escolha ligar ou desligar.';
  END IF;

  UPDATE public.people p
     SET perfil_visivel = _visivel
   WHERE p.user_id = v_uid;

  -- Lido de volta: o que vale é o que ficou gravado. bool_and porque, se um dia o mesmo login tiver
  -- mais de um cadastro, "ligado" só é verdade se estiver ligado em todos.
  SELECT bool_and(p.perfil_visivel) INTO v_valor
    FROM public.people p
   WHERE p.user_id = v_uid;
  IF v_valor IS NULL THEN
    RAISE EXCEPTION 'Não encontrei o seu cadastro de aluno.';
  END IF;
  RETURN v_valor;
END;
$fn$;

COMMENT ON FUNCTION public.definir_meu_perfil_visivel(boolean) IS
  '#308: o aluno liga/desliga people.perfil_visivel do PRÓPRIO cadastro (auth.uid()) e recebe o valor gravado.';

-- Função nova nasce executável por PUBLIC (e, portanto, por anon): tirar dos dois, dar só a quem usa.
REVOKE EXECUTE ON FUNCTION public.definir_meu_perfil_visivel(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_meu_perfil_visivel(boolean) TO authenticated, service_role, postgres;
