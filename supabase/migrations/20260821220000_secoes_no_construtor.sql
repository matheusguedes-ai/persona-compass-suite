-- #212 Fase 4, Fatia 4 — seções.
--
-- test_sections agrupa perguntas em blocos. Opcional: teste sem seção
-- continua lista corrida, como sempre foi — os 7 templates e qualquer teste
-- já criado nascem sem nenhuma linha aqui, e test_questions.section_id
-- nasce nulo (sem migração forçada, sem seção fantasma).
--
-- mentor_id nasce SEMPRE certo, nunca por conta do cliente: o trigger abaixo
-- resolve a partir de version_id, no espírito do conta_do_autor() da #271 —
-- só que aqui a fonte é uma coluna irmã (version_id) na mesma linha, que
-- DEFAULT não alcança (Postgres não deixa um DEFAULT ler outra coluna da
-- mesma INSERT), daí trigger em vez de DEFAULT.

CREATE TABLE public.test_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.test_versions(id) ON DELETE CASCADE,
  mentor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.preenche_mentor_da_secao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  NEW.mentor_id := (SELECT mentor_id FROM public.test_versions WHERE id = NEW.version_id);
  IF NEW.mentor_id IS NULL THEN
    RAISE EXCEPTION 'Versão do teste não encontrada.';
  END IF;
  RETURN NEW;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.preenche_mentor_da_secao() TO authenticated;

CREATE TRIGGER tr_preenche_mentor_da_secao
  BEFORE INSERT ON public.test_sections
  FOR EACH ROW EXECUTE FUNCTION public.preenche_mentor_da_secao();

ALTER TABLE public.test_sections ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de td_read/td_write (test_dimensions): template é legível por
-- qualquer mentor autenticado (pra listar/duplicar), dono lê e escreve o seu.
CREATE POLICY ts_read ON public.test_sections FOR SELECT
  USING (public.test_version_is_template(version_id) OR public.owns_test_version(version_id));

CREATE POLICY ts_write ON public.test_sections FOR ALL TO authenticated
  USING (public.owns_test_version(version_id))
  WITH CHECK (public.owns_test_version(version_id));

-- Pergunta pertence a uma seção — opcional (nullable). ON DELETE RESTRICT:
-- apagar uma seção com pergunta dentro é recusado pelo próprio banco: a
-- aplicação tem de mover as perguntas antes. Perder pergunta configurada é
-- o pior erro possível aqui (item 4 da demanda), por isso a trava não fica
-- só na tela.
ALTER TABLE public.test_questions
  ADD COLUMN section_id uuid REFERENCES public.test_sections(id) ON DELETE RESTRICT;
