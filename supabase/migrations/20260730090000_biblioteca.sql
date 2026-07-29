-- Biblioteca: material que não pertence a aula nenhuma.
--
-- Item G de `docs/plano-demandas-30-07.md`, primeira parte. Hoje só dá para
-- anexar material DENTRO de uma aula; o Matheus quer um acervo solto.
--
-- TABELA PRÓPRIA, e não `lesson_id` nulo em `learning_materials`.
--
-- Reaproveitar aquela tabela pareceria econômico e entrelaçaria duas coisas
-- diferentes: material de aula herda as regras de liberação da TRILHA (quem
-- recebeu a trilha vê o material). Biblioteca não tem trilha — é da conta
-- inteira. Com uma coluna nula, toda consulta de material de aula passaria a
-- precisar lembrar de filtrar os da biblioteca, e um dia alguém esquece.

CREATE TABLE IF NOT EXISTS public.biblioteca_materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL,
  titulo text NOT NULL,
  descricao text,
  url text NOT NULL,
  kind text NOT NULL DEFAULT 'link'
    CHECK (kind IN ('link', 'pdf', 'planilha', 'video', 'audio', 'outro')),
  categoria text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS biblioteca_conta_idx
  ON public.biblioteca_materiais (mentor_id, created_at DESC);

ALTER TABLE public.biblioteca_materiais ENABLE ROW LEVEL SECURITY;

-- Todo mundo da conta LÊ: é o ponto da biblioteca. Alunos, mentores e o dono.
-- `acting_account()` resolve os três casos de uma vez.
DROP POLICY IF EXISTS bib_read ON public.biblioteca_materiais;
CREATE POLICY bib_read ON public.biblioteca_materiais FOR SELECT TO authenticated
  USING (
    mentor_id = public.acting_account()
    -- O avaliado não está em `team_members`, então `acting_account()` devolve o
    -- próprio id dele. Esta segunda porta é a dele.
    OR mentor_id IN (SELECT p.mentor_id FROM public.people p WHERE p.user_id = auth.uid())
  );

-- Só o dono da conta escreve. Material solto é curadoria, não colaboração.
DROP POLICY IF EXISTS bib_write ON public.biblioteca_materiais;
CREATE POLICY bib_write ON public.biblioteca_materiais FOR ALL TO authenticated
  USING (mentor_id = auth.uid()) WITH CHECK (mentor_id = auth.uid());
