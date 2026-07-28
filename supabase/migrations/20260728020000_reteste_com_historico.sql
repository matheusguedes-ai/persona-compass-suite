-- Reteste autorizado com histórico
-- ============================================================
-- O avaliado só responde de novo quando o mentor autoriza. Cada autorização
-- cria uma NOVA aplicação, encadeada à anterior — nada é sobrescrito, então o
-- histórico permite comparar a evolução ao longo do tempo.

ALTER TABLE public.test_responses
  ADD COLUMN IF NOT EXISTS attempt integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS previous_response_id uuid
    REFERENCES public.test_responses(id) ON DELETE SET NULL;

ALTER TABLE public.assessment_responses
  ADD COLUMN IF NOT EXISTS attempt integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS previous_assessment_id uuid
    REFERENCES public.assessment_responses(id) ON DELETE SET NULL;

-- Buscar a corrente de aplicações de uma pessoa é a consulta quente do histórico.
CREATE INDEX IF NOT EXISTS idx_test_responses_person_version
  ON public.test_responses(person_id, version_id);
CREATE INDEX IF NOT EXISTS idx_test_responses_previous
  ON public.test_responses(previous_response_id);
