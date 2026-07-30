-- Classroom: as anotacoes do professor saem da linha da aula.
--
-- A RLS de treinamento_aulas entrega a LINHA INTEIRA a quem pode ver o
-- treinamento. A tela do aluno nao mostra as anotacoes, mas qualquer aluno com
-- o proprio token leria a coluna consultando a API direto. A decisao da etapa 1
-- foi "descricao o aluno le, anotacao e roteiro de quem da a aula" — para
-- valer, o roteiro precisa morar numa tabela que a RLS so entrega ao dono.

CREATE TABLE IF NOT EXISTS public.treinamento_anotacoes (
  aula_id uuid PRIMARY KEY REFERENCES public.treinamento_aulas(id) ON DELETE CASCADE,
  texto text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Preserva o que houver. Hoje a tabela de aulas esta vazia em producao, mas
-- migracao nao confia em "hoje".
INSERT INTO public.treinamento_anotacoes (aula_id, texto)
SELECT id, anotacoes FROM public.treinamento_aulas
 WHERE anotacoes IS NOT NULL AND btrim(anotacoes) <> ''
ON CONFLICT (aula_id) DO NOTHING;

ALTER TABLE public.treinamento_aulas DROP COLUMN IF EXISTS anotacoes;

ALTER TABLE public.treinamento_anotacoes ENABLE ROW LEVEL SECURITY;

-- So o dono da conta le e escreve. O aluno nao tem policy NENHUMA aqui — e o
-- que fecha o vazamento. A subconsulta le outras tabelas, nao esta propria
-- (a armadilha da policy autorreferente nao se aplica).
DROP POLICY IF EXISTS anot_rw ON public.treinamento_anotacoes;
CREATE POLICY anot_rw ON public.treinamento_anotacoes FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.treinamento_aulas a
    JOIN public.treinamento_modulos m ON m.id = a.modulo_id
    JOIN public.treinamentos t ON t.id = m.treinamento_id
    WHERE a.id = aula_id AND t.mentor_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.treinamento_aulas a
    JOIN public.treinamento_modulos m ON m.id = a.modulo_id
    JOIN public.treinamentos t ON t.id = m.treinamento_id
    WHERE a.id = aula_id AND t.mentor_id = auth.uid()));
