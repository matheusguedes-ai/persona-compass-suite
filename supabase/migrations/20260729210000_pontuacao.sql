-- Pontuação e ranking.
--
-- Peso por esforço, como o Matheus definiu: aula 20 · devolutiva 15 ·
-- publicar 8 · perfil 5 · comentar 2 · curtir 1.
--
-- RESPONDER TESTE NÃO PONTUA, por decisão dele. É a decisão certa: um ranking
-- que sobe quando você responde paga a pessoa para clicar rápido, e é
-- exatamente o comportamento contra o qual os testes foram reescritos.
--
-- Duas proteções contra farm de ponto:
-- 1. `referencia` + índice único: a mesma aula, a mesma devolutiva e a mesma
--    curtida contam UMA vez. Descurtir e curtir de novo não repontua.
-- 2. Teto diário nas ações baratas, aplicado ao gravar. Sem ele, curtir cem
--    posts vira estratégia, e o topo do ranking passa a ser quem clica mais.

CREATE TABLE IF NOT EXISTS public.pontos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  /** A conta a que a pontuação pertence — o ranking é sempre dentro dela. */
  mentor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acao text NOT NULL CHECK (acao IN ('aula', 'devolutiva', 'publicar', 'perfil', 'comentar', 'curtir')),
  pontos integer NOT NULL CHECK (pontos > 0),
  /** O que gerou o ponto: id da aula, do post, da devolutiva. Evita repetir. */
  referencia uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pontos_sem_repeticao
  ON public.pontos (user_id, acao, referencia)
  WHERE referencia IS NOT NULL;

CREATE INDEX IF NOT EXISTS pontos_conta_idx ON public.pontos (mentor_id, user_id);
CREATE INDEX IF NOT EXISTS pontos_dia_idx ON public.pontos (user_id, acao, created_at);

ALTER TABLE public.pontos ENABLE ROW LEVEL SECURITY;

-- Ler: a própria pontuação, a de quem divide grupo comigo, e a conta inteira
-- para o dono. O ranking é público dentro do grupo, por decisão do Matheus.
DROP POLICY IF EXISTS pontos_read ON public.pontos;
CREATE POLICY pontos_read ON public.pontos FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR mentor_id = public.acting_account()
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
        JOIN public.people p ON p.id = gm.person_id
       WHERE p.user_id = pontos.user_id
         AND gm.group_id IN (SELECT public.meus_grupos_como_avaliado())
    )
  );

-- Gravar: só em nome próprio. Quem dá o ponto é o código do app, na ação.
DROP POLICY IF EXISTS pontos_insert ON public.pontos;
CREATE POLICY pontos_insert ON public.pontos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
