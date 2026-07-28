-- O avaliado passa a ver as próprias devolutivas.
--
-- A tabela nasceu como ferramenta do mentor: a policy de leitura exige
-- `mentor_id = acting_account()`, o que exclui o aluno. Resultado: quem mais
-- precisa saber que a conversa está marcada era justamente quem não via nada.
--
-- Esta migração acrescenta uma SEGUNDA policy de leitura, para o aluno ver as
-- devolutivas ligadas ao cadastro dele. `my_person_ids()` já existe desde a
-- área do aluno e resolve "quais pessoas sou eu".
--
-- Só leitura. O aluno não agenda, não registra e não apaga — para isso as
-- policies de INSERT/UPDATE/DELETE continuam como estão, exigindo a conta do
-- mentor.

DROP POLICY IF EXISTS devolutivas_read_aluno ON public.devolutivas;
CREATE POLICY devolutivas_read_aluno ON public.devolutivas FOR SELECT TO authenticated
  USING (person_id IN (SELECT public.my_person_ids()));

-- Quem conduziu a conversa. `created_by` é o usuário que criou a devolutiva —
-- pode ser o dono da conta ou um mentor convidado. O aluno precisa desse nome:
-- "devolutiva com quem?" é a primeira pergunta ao reabrir um registro antigo.
--
-- A função é SECURITY DEFINER porque `profiles` não é legível pelo aluno, e
-- não deve ser: ela guarda configuração de marca e e-mail da conta. Aqui sai
-- só o nome, e só de quem conduziu uma devolutiva dele.
CREATE OR REPLACE FUNCTION public.nome_do_mentor(p_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT p.full_name
    FROM public.profiles p
   WHERE p.user_id = p_user_id
     AND EXISTS (
       SELECT 1 FROM public.devolutivas d
        WHERE d.created_by = p_user_id
          AND d.person_id IN (SELECT public.my_person_ids())
     );
$fn$;

GRANT EXECUTE ON FUNCTION public.nome_do_mentor(uuid) TO authenticated;
