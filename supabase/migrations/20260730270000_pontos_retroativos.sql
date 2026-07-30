-- Quem compareceu antes de ter login agora recebe os pontos ao criar a conta.
--
-- O PROBLEMA
--
-- A propria tela da lista de presenca avisa: "Aluno sem login nao entra no
-- ranking". O ponto de presenca e gravado em `pontos`, cuja chave e o
-- `user_id` de `auth.users` -- quem ainda nao criou senha nao tem user_id, e
-- `pontuarPresenca` nao tinha o que gravar.
--
-- Consequencia: a pessoa atravessa a cidade, escaneia (ou o professor marca a
-- mao), conta na frequencia, e aparece com ZERO na unica tela que a turma
-- inteira ve. Quando finalmente cria a senha, os encontros passados continuam
-- sem valer nada -- porque o ponto so nascia no fechamento da lista, que ja
-- aconteceu e nao roda de novo.
--
-- O CONSERTO
--
-- `claim_student_profile()` -- a funcao que casa a pessoa ao usuario no
-- primeiro acesso -- passa a conceder, de uma vez, os pontos de todas as aulas
-- JA FECHADAS em que ela conste como presente ou atrasada.
--
-- A regra de quem ganha e a mesma do fechamento, escrita aqui de novo porque
-- ela vive no TypeScript (`contaComoPresenca`): presente ou atrasado ganham;
-- ausente e justificado nao. Aula cancelada nao conta. Se a regra mudar la,
-- muda aqui -- esta e a duplicacao que o comentario existe para sinalizar.
--
-- `ON CONFLICT DO NOTHING` sustenta a ideia: `pontos` tem indice unico por
-- (user_id, acao, referencia), entao rodar de novo nao duplica nada.

CREATE OR REPLACE FUNCTION public.claim_student_profile()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_n integer;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
  IF v_email IS NULL THEN RETURN 0; END IF;

  UPDATE public.people p
     SET user_id = v_uid
   WHERE lower(p.email) = lower(v_email)
     AND p.user_id IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- Ja vinculado e com email diferente: o de acesso e o que vale.
  UPDATE public.people p
     SET email = v_email
   WHERE p.user_id = v_uid
     AND lower(p.email) <> lower(v_email);

  -- ---- Os pontos de presenca que ficaram para tras ----
  INSERT INTO public.pontos (user_id, mentor_id, acao, pontos, referencia)
  SELECT v_uid, t.mentor_id, 'presenca', 20, pr.aula_id
    FROM public.treinamento_presencas pr
    JOIN public.people pe          ON pe.id = pr.person_id AND pe.user_id = v_uid
    JOIN public.treinamento_aulas a ON a.id = pr.aula_id
    JOIN public.treinamento_modulos m ON m.id = a.modulo_id
    JOIN public.treinamentos t      ON t.id = m.treinamento_id
   WHERE a.fechada_em IS NOT NULL
     AND NOT a.cancelada
     -- Presente ou atrasado. `situacao` preenchida e a marcacao do professor,
     -- que vence; vazia com registro de scan significa que compareceu.
     AND (pr.situacao IS NULL OR pr.situacao IN ('presente', 'atrasado'))
  ON CONFLICT DO NOTHING;

  RETURN v_n;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.claim_student_profile() TO authenticated;
