-- Classroom, duas correcoes pedidas por ele:
--
-- 1. O MATERIAL passa a ter dono de audiencia. Hoje todo material que o
--    professor anexa a aula fica visivel e baixavel pelo aluno, e o caso mais
--    comum dele e o oposto: o slide da aula nao deve circular.
--
--    A trava tem de estar na RLS, e nao so na tela. O aluno tem token e le a API
--    direto -- foi assim que as anotacoes do professor vazavam (migracao
--    20260730150000). Esconder na interface e maquiagem.
--
--    Default TRUE de proposito: o que ja existe continua como esta. Mudar
--    material antigo para invisivel seria eu decidindo por ele, calado, sobre
--    coisa que os alunos ja podem ter visto. A tela mostra o estado de cada um
--    e deixa trocar num clique.
--
-- 2. A AULA com data passa a criar EVENTO NA AGENDA, ligado por `aula_id`. A
--    ligacao mora no evento (e nao um `evento_id` na aula) porque e o evento que
--    deixa de fazer sentido quando a aula some -- ON DELETE CASCADE resolve, e
--    o indice unico garante que uma aula nunca gere dois eventos, mesmo que dois
--    salvamentos cheguem juntos.

ALTER TABLE public.treinamento_materiais
  ADD COLUMN IF NOT EXISTS visivel_aluno boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS mat_read ON public.treinamento_materiais;
CREATE POLICY mat_read ON public.treinamento_materiais FOR SELECT TO authenticated
  USING (
    -- Quem conduz a aula ve tudo, inclusive o que e so dele.
    public.posso_dar_aula(aula_id)
    -- O aluno ve o que foi liberado para ele, e nada mais.
    OR (
      visivel_aluno AND EXISTS (
        SELECT 1
          FROM public.treinamento_aulas a
          JOIN public.treinamento_modulos m ON m.id = a.modulo_id
         WHERE a.id = aula_id AND public.posso_ver_treinamento(m.treinamento_id)
      )
    )
  );

ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS aula_id uuid REFERENCES public.treinamento_aulas(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS eventos_aula_uk
  ON public.eventos (aula_id) WHERE aula_id IS NOT NULL;
