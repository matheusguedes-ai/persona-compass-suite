-- #231 — Avaliação de aula por quem esteve presente.
--
-- Decisão do cartão (05/08): NÃO pendurar colunas na aula como foi feito em
-- mentoria_sessoes. Lá fazia sentido — a sessão é 1:1 (um aluno por pacote),
-- então há no máximo uma avaliação. Aqui uma aula é 1-para-MUITOS: uma turma
-- inteira passa pela mesma aula, e cada pessoa avalia a própria experiência.
-- Tabela própria, um registro por pessoa por aula, com a trava de "uma vez
-- só" na ESTRUTURA (UNIQUE), não só na tela — o mesmo raciocínio que já
-- protege treinamento_presencas (aula_id, person_id).
--
-- QUEM pode avaliar: presença que CONTA (situacao IS NULL ou 'presente'/
-- 'atrasado') — a MESMA regra que já decide o certo verde do aluno
-- (getTreinamento, classroom.functions.ts) e o ponto de presença
-- (`contaPresente`, marcarPresencaManual). QR e manual entram exatamente
-- igual: a checagem nem olha a coluna `origem`. Presença marcada como
-- 'ausente' ou 'justificado' (o professor PODE gravar essas linhas — ver
-- marcarPresencaManual) não libera avaliação, porque não é presença.
--
-- QUANDO: só depois de treinamento_aulas.termina_em. Sem data de término,
-- sem avaliação — nunca.
--
-- A escrita passa INTEIRA pela função avaliar_aula (SECURITY DEFINER), no
-- mesmo padrão de avaliar_sessao_mentoria (20260801010000): nenhuma policy
-- de INSERT para authenticated. Sem policy de escrita, a única porta é a
-- função, e a função confere presença + horário + (o UNIQUE cobre) duplicata.

CREATE TABLE public.treinamento_avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id uuid NOT NULL REFERENCES public.treinamento_aulas(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  -- Dono nasce junto (padrão #271/#272): a conta do treinamento, preenchida
  -- pela função — nunca pelo cliente.
  conta_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estrelas integer NOT NULL CHECK (estrelas BETWEEN 1 AND 5),
  comentario text,
  avaliada_em timestamptz NOT NULL DEFAULT now(),
  -- A trava estrutural: nem a tela, nem uma chamada direta à API conseguem
  -- criar uma segunda linha para a mesma pessoa na mesma aula.
  UNIQUE (aula_id, person_id)
);

CREATE INDEX treinamento_avaliacoes_aula_idx ON public.treinamento_avaliacoes (aula_id);

ALTER TABLE public.treinamento_avaliacoes ENABLE ROW LEVEL SECURITY;

-- Quem dá a aula vê TODAS as avaliações dela (média + contagem +
-- comentários identificados). O próprio aluno vê a SUA. Ninguém mais.
CREATE POLICY taval_read ON public.treinamento_avaliacoes FOR SELECT TO authenticated
  USING (
    public.posso_dar_aula(aula_id)
    OR EXISTS (SELECT 1 FROM public.people p WHERE p.id = person_id AND p.user_id = auth.uid())
  );

-- Nenhuma policy de INSERT/UPDATE/DELETE: só a função abaixo escreve.

CREATE OR REPLACE FUNCTION public.avaliar_aula(
  _aula_id uuid,
  _estrelas integer,
  _comentario text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  _person_id uuid;
  _conta_id uuid;
  _termina_em timestamptz;
BEGIN
  IF _estrelas IS NULL OR _estrelas < 1 OR _estrelas > 5 THEN
    RAISE EXCEPTION 'A nota precisa ser de 1 a 5.';
  END IF;

  SELECT a.termina_em INTO _termina_em
    FROM public.treinamento_aulas a
   WHERE a.id = _aula_id;
  IF _termina_em IS NULL OR _termina_em > now() THEN
    RAISE EXCEPTION 'Esta aula ainda não terminou.';
  END IF;

  -- A pessoa, dentre as minhas (my_person_ids cobre o mesmo e-mail em mais
  -- de uma conta), com presença que CONTA nesta aula — QR e manual iguais,
  -- só a coluna `situacao` decide.
  SELECT p.person_id INTO _person_id
    FROM public.treinamento_presencas p
   WHERE p.aula_id = _aula_id
     AND p.person_id IN (SELECT public.my_person_ids())
     AND (p.situacao IS NULL OR p.situacao IN ('presente', 'atrasado'))
   LIMIT 1;
  IF _person_id IS NULL THEN
    RAISE EXCEPTION 'Você não tem presença registrada nesta aula.';
  END IF;

  SELECT t.mentor_id INTO _conta_id
    FROM public.treinamento_aulas a
    JOIN public.treinamento_modulos m ON m.id = a.modulo_id
    JOIN public.treinamentos t ON t.id = m.treinamento_id
   WHERE a.id = _aula_id;

  INSERT INTO public.treinamento_avaliacoes (aula_id, person_id, conta_id, estrelas, comentario)
  VALUES (_aula_id, _person_id, _conta_id, _estrelas, NULLIF(btrim(COALESCE(_comentario, '')), ''));
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Você já avaliou esta aula.';
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.avaliar_aula(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.avaliar_aula(uuid, integer, text) TO authenticated;
