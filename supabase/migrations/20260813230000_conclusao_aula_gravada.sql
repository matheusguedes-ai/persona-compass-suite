-- #256 — Conclusão de aula gravada, liberando a avaliação da #231.
--
-- Aula GRAVADA (sem horário — comeca_em IS NULL) não tem "terminou" pelo
-- relógio. Decisão do dono do produto (05/08): para essa aula, é a
-- CONCLUSÃO marcada pelo aluno que libera a avaliação, no lugar da dupla
-- presença+término que já vale para aula com horário.
--
-- ESTRUTURA PRÓPRIA (decisão de 13/08): não reaproveita o learning_progress
-- da Academy — chaves diferentes (user_id/lesson_id) e módulo diferente.
-- Esta tabela segue o padrão-irmão de treinamento_avaliacoes e
-- treinamento_presencas: aula_id + person_id + conta_id, um registro por
-- pessoa por aula, com a trava de duplicata na ESTRUTURA (UNIQUE), não só
-- na tela.
--
-- A escrita passa INTEIRA por duas funções SECURITY DEFINER — nenhuma
-- policy de INSERT/DELETE para authenticated, mesmo padrão de avaliar_aula
-- (#231): marcar_conclusao_aula (confere aula gravada, não cancelada, e que
-- quem chama tem acesso ao treinamento) e desmarcar_conclusao_aula (confere
-- que ainda NÃO foi avaliada — desfazer depois de avaliar deixaria uma
-- avaliação órfã de conclusão, e por isso a trava vive no banco, dentro da
-- própria função, não numa policy solta).

CREATE TABLE public.treinamento_aula_conclusoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id uuid NOT NULL REFERENCES public.treinamento_aulas(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  -- Dono nasce junto (padrão #271/#272), preenchido pela função — nunca
  -- pelo cliente.
  conta_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concluida_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (aula_id, person_id)
);

CREATE INDEX treinamento_aula_conclusoes_aula_idx ON public.treinamento_aula_conclusoes (aula_id);

ALTER TABLE public.treinamento_aula_conclusoes ENABLE ROW LEVEL SECURITY;

-- Mesma regra de leitura de treinamento_avaliacoes: quem dá a aula vê
-- TODAS as linhas (para a contagem "N concluíram"), o próprio aluno vê a
-- SUA. Nenhuma policy de escrita — só as funções abaixo gravam.
CREATE POLICY tconcl_read ON public.treinamento_aula_conclusoes FOR SELECT TO authenticated
  USING (
    public.posso_dar_aula(aula_id)
    OR EXISTS (SELECT 1 FROM public.people p WHERE p.id = person_id AND p.user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.marcar_conclusao_aula(_aula_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  _comeca_em timestamptz;
  _cancelada boolean;
  _person_id uuid;
  _conta_id uuid;
BEGIN
  SELECT a.comeca_em, a.cancelada INTO _comeca_em, _cancelada
    FROM public.treinamento_aulas a WHERE a.id = _aula_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aula não encontrada.';
  END IF;
  IF _comeca_em IS NOT NULL THEN
    RAISE EXCEPTION 'Esta aula tem horário marcado — a conclusão é só para aula gravada.';
  END IF;
  IF _cancelada THEN
    RAISE EXCEPTION 'Esta aula foi cancelada.';
  END IF;

  -- A pessoa, dentre as minhas, que tem acesso ao treinamento desta aula
  -- (mesmo caminho de posso_ver_treinamento, do lado do aluno: grupo do
  -- treinamento → membro do grupo). Aula gravada não tem presença para
  -- ancorar o person_id, então a âncora aqui é o acesso ao treinamento.
  SELECT gm.person_id INTO _person_id
    FROM public.treinamento_aulas a
    JOIN public.treinamento_modulos m ON m.id = a.modulo_id
    JOIN public.treinamento_grupos tg ON tg.treinamento_id = m.treinamento_id
    JOIN public.group_members gm ON gm.group_id = tg.group_id
   WHERE a.id = _aula_id
     AND gm.person_id IN (SELECT public.my_person_ids())
   LIMIT 1;
  IF _person_id IS NULL THEN
    RAISE EXCEPTION 'Você não tem acesso a este treinamento.';
  END IF;

  SELECT t.mentor_id INTO _conta_id
    FROM public.treinamento_aulas a
    JOIN public.treinamento_modulos m ON m.id = a.modulo_id
    JOIN public.treinamentos t ON t.id = m.treinamento_id
   WHERE a.id = _aula_id;

  INSERT INTO public.treinamento_aula_conclusoes (aula_id, person_id, conta_id)
  VALUES (_aula_id, _person_id, _conta_id)
  ON CONFLICT (aula_id, person_id) DO NOTHING;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.marcar_conclusao_aula(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_conclusao_aula(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.desmarcar_conclusao_aula(_aula_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  -- A TRAVA: só apaga se ainda não existe avaliação da mesma pessoa na
  -- mesma aula. Depois de avaliar, desfazer a conclusão deixaria a
  -- avaliação órfã — o requisito pede exatamente que isso não aconteça.
  DELETE FROM public.treinamento_aula_conclusoes c
   WHERE c.aula_id = _aula_id
     AND c.person_id IN (SELECT public.my_person_ids())
     AND NOT EXISTS (
       SELECT 1 FROM public.treinamento_avaliacoes av
        WHERE av.aula_id = c.aula_id AND av.person_id = c.person_id
     );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Não foi possível desmarcar — a aula já foi avaliada, ou você não concluiu esta aula.';
  END IF;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.desmarcar_conclusao_aula(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desmarcar_conclusao_aula(uuid) TO authenticated;

-- ============================================================
-- avaliar_aula (#231) passa a entender os dois caminhos.
--
-- Aula com horário (comeca_em IS NOT NULL): EXATAMENTE a mesma lógica já
-- publicada — presença que conta, depois do término. Nada muda para quem
-- já usa esse caminho.
--
-- Aula gravada (comeca_em IS NULL): passa a exigir uma linha em
-- treinamento_aula_conclusoes, no lugar de presença+término.
-- ============================================================

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
  _comeca_em timestamptz;
  _termina_em timestamptz;
BEGIN
  IF _estrelas IS NULL OR _estrelas < 1 OR _estrelas > 5 THEN
    RAISE EXCEPTION 'A nota precisa ser de 1 a 5.';
  END IF;

  SELECT a.comeca_em, a.termina_em INTO _comeca_em, _termina_em
    FROM public.treinamento_aulas a WHERE a.id = _aula_id;

  IF _comeca_em IS NULL THEN
    -- #256 — aula gravada: quem concluiu pode avaliar.
    SELECT c.person_id INTO _person_id
      FROM public.treinamento_aula_conclusoes c
     WHERE c.aula_id = _aula_id
       AND c.person_id IN (SELECT public.my_person_ids())
     LIMIT 1;
    IF _person_id IS NULL THEN
      RAISE EXCEPTION 'Marque esta aula como concluída antes de avaliar.';
    END IF;
  ELSE
    -- #231 — aula com horário: presença que conta, depois do término.
    IF _termina_em IS NULL OR _termina_em > now() THEN
      RAISE EXCEPTION 'Esta aula ainda não terminou.';
    END IF;
    SELECT p.person_id INTO _person_id
      FROM public.treinamento_presencas p
     WHERE p.aula_id = _aula_id
       AND p.person_id IN (SELECT public.my_person_ids())
       AND (p.situacao IS NULL OR p.situacao IN ('presente', 'atrasado'))
     LIMIT 1;
    IF _person_id IS NULL THEN
      RAISE EXCEPTION 'Você não tem presença registrada nesta aula.';
    END IF;
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
