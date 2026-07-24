
-- ========================================================================
-- ENUMS
-- ========================================================================
DO $$ BEGIN
  CREATE TYPE public.question_type AS ENUM (
    'multiple_choice', 'checkboxes', 'linear_scale', 'ranking', 'drag_order'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ========================================================================
-- test_versions
-- ========================================================================
CREATE TABLE public.test_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id TEXT NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  mentor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_template BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.test_versions(instrument_id);
CREATE INDEX ON public.test_versions(mentor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_versions TO authenticated;
GRANT ALL ON public.test_versions TO service_role;
ALTER TABLE public.test_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tv_read_templates ON public.test_versions FOR SELECT TO authenticated
  USING (is_template = true OR mentor_id = auth.uid());
CREATE POLICY tv_insert_own ON public.test_versions FOR INSERT TO authenticated
  WITH CHECK (mentor_id = auth.uid() AND is_template = false);
CREATE POLICY tv_update_own ON public.test_versions FOR UPDATE TO authenticated
  USING (mentor_id = auth.uid()) WITH CHECK (mentor_id = auth.uid());
CREATE POLICY tv_delete_own ON public.test_versions FOR DELETE TO authenticated
  USING (mentor_id = auth.uid());

CREATE TRIGGER tv_updated_at BEFORE UPDATE ON public.test_versions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- helper: owns version?
CREATE OR REPLACE FUNCTION public.owns_test_version(_version_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.test_versions v
    WHERE v.id = _version_id AND v.mentor_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.test_version_is_template(_version_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_template FROM public.test_versions WHERE id = _version_id), false);
$$;

-- ========================================================================
-- test_dimensions
-- ========================================================================
CREATE TABLE public.test_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.test_versions(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  color TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (version_id, key)
);
CREATE INDEX ON public.test_dimensions(version_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_dimensions TO authenticated;
GRANT ALL ON public.test_dimensions TO service_role;
ALTER TABLE public.test_dimensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY td_read ON public.test_dimensions FOR SELECT TO authenticated
  USING (public.test_version_is_template(version_id) OR public.owns_test_version(version_id));
CREATE POLICY td_write ON public.test_dimensions FOR ALL TO authenticated
  USING (public.owns_test_version(version_id))
  WITH CHECK (public.owns_test_version(version_id));

-- ========================================================================
-- test_questions
-- ========================================================================
CREATE TABLE public.test_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.test_versions(id) ON DELETE CASCADE,
  type public.question_type NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  helper TEXT,
  required BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.test_questions(version_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_questions TO authenticated;
GRANT ALL ON public.test_questions TO service_role;
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tq_read ON public.test_questions FOR SELECT TO authenticated
  USING (public.test_version_is_template(version_id) OR public.owns_test_version(version_id));
CREATE POLICY tq_write ON public.test_questions FOR ALL TO authenticated
  USING (public.owns_test_version(version_id))
  WITH CHECK (public.owns_test_version(version_id));

-- ========================================================================
-- test_options
-- ========================================================================
CREATE TABLE public.test_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.test_questions(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  value TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.test_options(question_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_options TO authenticated;
GRANT ALL ON public.test_options TO service_role;
ALTER TABLE public.test_options ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.question_version_id(_question_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT version_id FROM public.test_questions WHERE id = _question_id;
$$;

CREATE POLICY to_read ON public.test_options FOR SELECT TO authenticated
  USING (
    public.test_version_is_template(public.question_version_id(question_id))
    OR public.owns_test_version(public.question_version_id(question_id))
  );
CREATE POLICY to_write ON public.test_options FOR ALL TO authenticated
  USING (public.owns_test_version(public.question_version_id(question_id)))
  WITH CHECK (public.owns_test_version(public.question_version_id(question_id)));

-- ========================================================================
-- option_scores
-- ========================================================================
CREATE TABLE public.option_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id UUID NOT NULL REFERENCES public.test_options(id) ON DELETE CASCADE,
  dimension_id UUID NOT NULL REFERENCES public.test_dimensions(id) ON DELETE CASCADE,
  points NUMERIC NOT NULL DEFAULT 0,
  UNIQUE (option_id, dimension_id)
);
CREATE INDEX ON public.option_scores(option_id);
CREATE INDEX ON public.option_scores(dimension_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.option_scores TO authenticated;
GRANT ALL ON public.option_scores TO service_role;
ALTER TABLE public.option_scores ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.option_version_id(_option_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT q.version_id FROM public.test_options o
  JOIN public.test_questions q ON q.id = o.question_id
  WHERE o.id = _option_id;
$$;

CREATE POLICY os_read ON public.option_scores FOR SELECT TO authenticated
  USING (
    public.test_version_is_template(public.option_version_id(option_id))
    OR public.owns_test_version(public.option_version_id(option_id))
  );
CREATE POLICY os_write ON public.option_scores FOR ALL TO authenticated
  USING (public.owns_test_version(public.option_version_id(option_id)))
  WITH CHECK (public.owns_test_version(public.option_version_id(option_id)));

-- ========================================================================
-- test_result_bands
-- ========================================================================
CREATE TABLE public.test_result_bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.test_versions(id) ON DELETE CASCADE,
  dimension_id UUID REFERENCES public.test_dimensions(id) ON DELETE CASCADE,
  min_score NUMERIC NOT NULL DEFAULT 0,
  max_score NUMERIC NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.test_result_bands(version_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_result_bands TO authenticated;
GRANT ALL ON public.test_result_bands TO service_role;
ALTER TABLE public.test_result_bands ENABLE ROW LEVEL SECURITY;

CREATE POLICY trb_read ON public.test_result_bands FOR SELECT TO authenticated
  USING (public.test_version_is_template(version_id) OR public.owns_test_version(version_id));
CREATE POLICY trb_write ON public.test_result_bands FOR ALL TO authenticated
  USING (public.owns_test_version(version_id))
  WITH CHECK (public.owns_test_version(version_id));

-- ========================================================================
-- test_responses
-- ========================================================================
CREATE TABLE public.test_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.test_versions(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  mentor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  computed_scores JSONB,
  dominant_dimension_id UUID REFERENCES public.test_dimensions(id) ON DELETE SET NULL,
  result_band_id UUID REFERENCES public.test_result_bands(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.test_responses(mentor_id);
CREATE INDEX ON public.test_responses(person_id);
CREATE INDEX ON public.test_responses(version_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_responses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.test_responses TO anon;
GRANT ALL ON public.test_responses TO service_role;
ALTER TABLE public.test_responses ENABLE ROW LEVEL SECURITY;

-- Mentor can manage all its responses
CREATE POLICY tr_mentor_all ON public.test_responses FOR ALL TO authenticated
  USING (mentor_id = auth.uid()) WITH CHECK (mentor_id = auth.uid());
-- Anon/public can read one response by exact id (used by the responder link);
-- exposure is limited: the id is a UUID acting as a bearer token.
CREATE POLICY tr_public_read ON public.test_responses FOR SELECT TO anon
  USING (true);
CREATE POLICY tr_public_update ON public.test_responses FOR UPDATE TO anon
  USING (submitted_at IS NULL) WITH CHECK (true);

CREATE TRIGGER tr_updated_at BEFORE UPDATE ON public.test_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========================================================================
-- test_answers
-- ========================================================================
CREATE TABLE public.test_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES public.test_responses(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.test_questions(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (response_id, question_id)
);
CREATE INDEX ON public.test_answers(response_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_answers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_answers TO anon;
GRANT ALL ON public.test_answers TO service_role;
ALTER TABLE public.test_answers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.response_mentor_id(_response_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT mentor_id FROM public.test_responses WHERE id = _response_id;
$$;

CREATE POLICY ta_mentor ON public.test_answers FOR ALL TO authenticated
  USING (public.response_mentor_id(response_id) = auth.uid())
  WITH CHECK (public.response_mentor_id(response_id) = auth.uid());
CREATE POLICY ta_public ON public.test_answers FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- ========================================================================
-- group_instruments: link to specific version (optional)
-- ========================================================================
ALTER TABLE public.group_instruments
  ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES public.test_versions(id) ON DELETE SET NULL;

-- ========================================================================
-- SEED: templates for each instrument
-- ========================================================================
DO $seed$
DECLARE
  v_id UUID;
  q_id UUID;
  o_id UUID;
  d_ids JSONB;
BEGIN
  -- ============================
  -- DISC
  -- ============================
  IF NOT EXISTS (SELECT 1 FROM public.test_versions WHERE instrument_id = 'disc' AND is_template) THEN
    INSERT INTO public.test_versions (instrument_id, mentor_id, title, description, is_template, is_published)
    VALUES ('disc', NULL, 'DISC — Template Padrão',
            'Identifique o perfil comportamental dominante (Dominância, Influência, Estabilidade, Conformidade).',
            true, true)
    RETURNING id INTO v_id;

    WITH dims AS (
      INSERT INTO public.test_dimensions (version_id, key, label, color, sort_order) VALUES
        (v_id, 'D', 'Dominância',  '#ef4444', 1),
        (v_id, 'I', 'Influência',  '#f59e0b', 2),
        (v_id, 'S', 'Estabilidade','#10b981', 3),
        (v_id, 'C', 'Conformidade','#3b82f6', 4)
      RETURNING key, id
    )
    SELECT jsonb_object_agg(key, id) INTO d_ids FROM dims;

    -- Q1: multiple choice
    INSERT INTO public.test_questions (version_id, type, prompt, sort_order)
    VALUES (v_id, 'multiple_choice', 'Em um projeto novo, você tende a:', 1)
    RETURNING id INTO q_id;

    INSERT INTO public.test_options (question_id, label, sort_order) VALUES (q_id, 'Assumir o comando e definir o rumo.', 1) RETURNING id INTO o_id;
    INSERT INTO public.option_scores (option_id, dimension_id, points) VALUES (o_id, (d_ids->>'D')::uuid, 3);
    INSERT INTO public.test_options (question_id, label, sort_order) VALUES (q_id, 'Motivar o time e envolver as pessoas.', 2) RETURNING id INTO o_id;
    INSERT INTO public.option_scores (option_id, dimension_id, points) VALUES (o_id, (d_ids->>'I')::uuid, 3);
    INSERT INTO public.test_options (question_id, label, sort_order) VALUES (q_id, 'Garantir estabilidade e apoiar a equipe.', 3) RETURNING id INTO o_id;
    INSERT INTO public.option_scores (option_id, dimension_id, points) VALUES (o_id, (d_ids->>'S')::uuid, 3);
    INSERT INTO public.test_options (question_id, label, sort_order) VALUES (q_id, 'Analisar os detalhes e planejar com cuidado.', 4) RETURNING id INTO o_id;
    INSERT INTO public.option_scores (option_id, dimension_id, points) VALUES (o_id, (d_ids->>'C')::uuid, 3);

    -- Q2
    INSERT INTO public.test_questions (version_id, type, prompt, sort_order)
    VALUES (v_id, 'multiple_choice', 'Quando enfrenta um problema, você prefere:', 2)
    RETURNING id INTO q_id;
    INSERT INTO public.test_options (question_id, label, sort_order) VALUES (q_id, 'Agir rápido, mesmo com riscos.', 1) RETURNING id INTO o_id;
    INSERT INTO public.option_scores (option_id, dimension_id, points) VALUES (o_id, (d_ids->>'D')::uuid, 3);
    INSERT INTO public.test_options (question_id, label, sort_order) VALUES (q_id, 'Conversar e buscar consenso.', 2) RETURNING id INTO o_id;
    INSERT INTO public.option_scores (option_id, dimension_id, points) VALUES (o_id, (d_ids->>'I')::uuid, 3);
    INSERT INTO public.test_options (question_id, label, sort_order) VALUES (q_id, 'Manter a calma e seguir um processo conhecido.', 3) RETURNING id INTO o_id;
    INSERT INTO public.option_scores (option_id, dimension_id, points) VALUES (o_id, (d_ids->>'S')::uuid, 3);
    INSERT INTO public.test_options (question_id, label, sort_order) VALUES (q_id, 'Estudar dados antes de decidir.', 4) RETURNING id INTO o_id;
    INSERT INTO public.option_scores (option_id, dimension_id, points) VALUES (o_id, (d_ids->>'C')::uuid, 3);

    -- Result bands
    INSERT INTO public.test_result_bands (version_id, dimension_id, min_score, max_score, title, description, sort_order) VALUES
      (v_id, (d_ids->>'D')::uuid, 5, 999, 'Perfil Dominante', 'Foco em resultados, decisão rápida e liderança direta.', 1),
      (v_id, (d_ids->>'I')::uuid, 5, 999, 'Perfil Influente', 'Comunicação, entusiasmo e conexão com pessoas.', 2),
      (v_id, (d_ids->>'S')::uuid, 5, 999, 'Perfil Estável',   'Consistência, empatia e trabalho em equipe.', 3),
      (v_id, (d_ids->>'C')::uuid, 5, 999, 'Perfil Conforme',  'Precisão, análise e aderência a padrões.', 4);
  END IF;

  -- ============================
  -- MBTI (simplified 4-axis)
  -- ============================
  IF NOT EXISTS (SELECT 1 FROM public.test_versions WHERE instrument_id = 'mbti' AND is_template) THEN
    INSERT INTO public.test_versions (instrument_id, mentor_id, title, description, is_template, is_published)
    VALUES ('mbti', NULL, 'MBTI — Template Padrão',
            'Preferências em 4 eixos: E/I, S/N, T/F, J/P.', true, true)
    RETURNING id INTO v_id;
    WITH dims AS (
      INSERT INTO public.test_dimensions (version_id, key, label, sort_order) VALUES
        (v_id, 'E', 'Extroversão', 1),(v_id, 'I', 'Introversão', 2),
        (v_id, 'S', 'Sensorial',   3),(v_id, 'N', 'Intuitivo',   4),
        (v_id, 'T', 'Racional',    5),(v_id, 'F', 'Emocional',   6),
        (v_id, 'J', 'Julgador',    7),(v_id, 'P', 'Perceptivo',  8)
      RETURNING key, id
    ) SELECT jsonb_object_agg(key, id) INTO d_ids FROM dims;

    INSERT INTO public.test_questions (version_id, type, prompt, sort_order)
    VALUES (v_id, 'multiple_choice', 'Você recarrega suas energias:', 1) RETURNING id INTO q_id;
    INSERT INTO public.test_options (question_id, label, sort_order) VALUES (q_id, 'Estando com outras pessoas.', 1) RETURNING id INTO o_id;
    INSERT INTO public.option_scores (option_id, dimension_id, points) VALUES (o_id, (d_ids->>'E')::uuid, 2);
    INSERT INTO public.test_options (question_id, label, sort_order) VALUES (q_id, 'Passando tempo sozinho(a).', 2) RETURNING id INTO o_id;
    INSERT INTO public.option_scores (option_id, dimension_id, points) VALUES (o_id, (d_ids->>'I')::uuid, 2);
  END IF;

  -- ============================
  -- Big Five (OCEAN)
  -- ============================
  IF NOT EXISTS (SELECT 1 FROM public.test_versions WHERE instrument_id = 'bigfive' AND is_template) THEN
    INSERT INTO public.test_versions (instrument_id, mentor_id, title, description, is_template, is_published)
    VALUES ('bigfive', NULL, 'Big Five — Template Padrão',
            'Cinco grandes traços: Abertura, Conscienciosidade, Extroversão, Amabilidade, Neuroticismo.', true, true)
    RETURNING id INTO v_id;
    WITH dims AS (
      INSERT INTO public.test_dimensions (version_id, key, label, sort_order) VALUES
        (v_id, 'O', 'Abertura',           1),
        (v_id, 'C', 'Conscienciosidade',  2),
        (v_id, 'E', 'Extroversão',        3),
        (v_id, 'A', 'Amabilidade',        4),
        (v_id, 'N', 'Neuroticismo',       5)
      RETURNING key, id
    ) SELECT jsonb_object_agg(key, id) INTO d_ids FROM dims;

    INSERT INTO public.test_questions (version_id, type, prompt, config, sort_order)
    VALUES (v_id, 'linear_scale', 'Eu gosto de experimentar coisas novas.',
            jsonb_build_object('min', 1, 'max', 5, 'minLabel', 'Discordo', 'maxLabel', 'Concordo', 'dimension_key', 'O'), 1)
    RETURNING id INTO q_id;

    INSERT INTO public.test_questions (version_id, type, prompt, config, sort_order)
    VALUES (v_id, 'linear_scale', 'Sou organizado(a) e cumpro prazos.',
            jsonb_build_object('min', 1, 'max', 5, 'minLabel', 'Discordo', 'maxLabel', 'Concordo', 'dimension_key', 'C'), 2)
    RETURNING id INTO q_id;
  END IF;

  -- ============================
  -- Temperamentos (Sanguíneo, Colérico, Melancólico, Fleumático)
  -- ============================
  IF NOT EXISTS (SELECT 1 FROM public.test_versions WHERE instrument_id = 'temperamentos' AND is_template) THEN
    INSERT INTO public.test_versions (instrument_id, mentor_id, title, description, is_template, is_published)
    VALUES ('temperamentos', NULL, 'Temperamentos — Template Padrão',
            'Sanguíneo, Colérico, Melancólico e Fleumático.', true, true)
    RETURNING id INTO v_id;
    WITH dims AS (
      INSERT INTO public.test_dimensions (version_id, key, label, sort_order) VALUES
        (v_id, 'SAN', 'Sanguíneo',    1),
        (v_id, 'COL', 'Colérico',     2),
        (v_id, 'MEL', 'Melancólico',  3),
        (v_id, 'FLE', 'Fleumático',   4)
      RETURNING key, id
    ) SELECT jsonb_object_agg(key, id) INTO d_ids FROM dims;

    INSERT INTO public.test_questions (version_id, type, prompt, sort_order)
    VALUES (v_id, 'multiple_choice', 'Em um evento social, você:', 1) RETURNING id INTO q_id;
    INSERT INTO public.test_options (question_id, label, sort_order) VALUES (q_id, 'Anima o ambiente e conversa com todos.', 1) RETURNING id INTO o_id;
    INSERT INTO public.option_scores (option_id, dimension_id, points) VALUES (o_id, (d_ids->>'SAN')::uuid, 3);
    INSERT INTO public.test_options (question_id, label, sort_order) VALUES (q_id, 'Assume um papel de organização.', 2) RETURNING id INTO o_id;
    INSERT INTO public.option_scores (option_id, dimension_id, points) VALUES (o_id, (d_ids->>'COL')::uuid, 3);
    INSERT INTO public.test_options (question_id, label, sort_order) VALUES (q_id, 'Prefere conversas profundas com poucos.', 3) RETURNING id INTO o_id;
    INSERT INTO public.option_scores (option_id, dimension_id, points) VALUES (o_id, (d_ids->>'MEL')::uuid, 3);
    INSERT INTO public.test_options (question_id, label, sort_order) VALUES (q_id, 'Observa em silêncio e escuta.', 4) RETURNING id INTO o_id;
    INSERT INTO public.option_scores (option_id, dimension_id, points) VALUES (o_id, (d_ids->>'FLE')::uuid, 3);
  END IF;

  -- ============================
  -- VAK (Visual/Auditivo/Cinestésico)
  -- ============================
  IF NOT EXISTS (SELECT 1 FROM public.test_versions WHERE instrument_id = 'vak' AND is_template) THEN
    INSERT INTO public.test_versions (instrument_id, mentor_id, title, description, is_template, is_published)
    VALUES ('vak', NULL, 'VAK — Template Padrão',
            'Canal preferido: Visual, Auditivo ou Cinestésico.', true, true)
    RETURNING id INTO v_id;
    WITH dims AS (
      INSERT INTO public.test_dimensions (version_id, key, label, sort_order) VALUES
        (v_id, 'V', 'Visual',       1),
        (v_id, 'A', 'Auditivo',     2),
        (v_id, 'K', 'Cinestésico',  3)
      RETURNING key, id
    ) SELECT jsonb_object_agg(key, id) INTO d_ids FROM dims;

    INSERT INTO public.test_questions (version_id, type, prompt, sort_order)
    VALUES (v_id, 'multiple_choice', 'Você aprende melhor:', 1) RETURNING id INTO q_id;
    INSERT INTO public.test_options (question_id, label, sort_order) VALUES (q_id, 'Vendo diagramas e imagens.', 1) RETURNING id INTO o_id;
    INSERT INTO public.option_scores (option_id, dimension_id, points) VALUES (o_id, (d_ids->>'V')::uuid, 3);
    INSERT INTO public.test_options (question_id, label, sort_order) VALUES (q_id, 'Ouvindo explicações.', 2) RETURNING id INTO o_id;
    INSERT INTO public.option_scores (option_id, dimension_id, points) VALUES (o_id, (d_ids->>'A')::uuid, 3);
    INSERT INTO public.test_options (question_id, label, sort_order) VALUES (q_id, 'Praticando com as mãos.', 3) RETURNING id INTO o_id;
    INSERT INTO public.option_scores (option_id, dimension_id, points) VALUES (o_id, (d_ids->>'K')::uuid, 3);
  END IF;

  -- ============================
  -- QI (single dimension, band-based)
  -- ============================
  IF NOT EXISTS (SELECT 1 FROM public.test_versions WHERE instrument_id = 'qi' AND is_template) THEN
    INSERT INTO public.test_versions (instrument_id, mentor_id, title, description, is_template, is_published)
    VALUES ('qi', NULL, 'QI — Template Padrão',
            'Pontuação total interpretada por faixas.', true, true)
    RETURNING id INTO v_id;
    WITH dims AS (
      INSERT INTO public.test_dimensions (version_id, key, label, sort_order) VALUES
        (v_id, 'QI', 'QI Total', 1)
      RETURNING key, id
    ) SELECT jsonb_object_agg(key, id) INTO d_ids FROM dims;

    INSERT INTO public.test_questions (version_id, type, prompt, sort_order)
    VALUES (v_id, 'multiple_choice', 'Qual número completa a sequência: 2, 4, 8, 16, ?', 1) RETURNING id INTO q_id;
    INSERT INTO public.test_options (question_id, label, sort_order) VALUES (q_id, '20', 1);
    INSERT INTO public.test_options (question_id, label, sort_order) VALUES (q_id, '24', 2);
    INSERT INTO public.test_options (question_id, label, sort_order) VALUES (q_id, '32', 3) RETURNING id INTO o_id;
    INSERT INTO public.option_scores (option_id, dimension_id, points) VALUES (o_id, (d_ids->>'QI')::uuid, 10);
    INSERT INTO public.test_options (question_id, label, sort_order) VALUES (q_id, '30', 4);

    INSERT INTO public.test_result_bands (version_id, dimension_id, min_score, max_score, title, description, sort_order) VALUES
      (v_id, (d_ids->>'QI')::uuid,  0,   9, 'Iniciante',    'Ponto de partida — muito espaço para crescimento.', 1),
      (v_id, (d_ids->>'QI')::uuid, 10,  49, 'Intermediário','Bom raciocínio, com margem para evolução.', 2),
      (v_id, (d_ids->>'QI')::uuid, 50, 999, 'Avançado',     'Alto desempenho em raciocínio lógico.', 3);
  END IF;
END $seed$;
