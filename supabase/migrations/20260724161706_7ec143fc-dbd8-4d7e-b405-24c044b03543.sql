
-- Helper trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================
-- instruments (public catalog)
-- ============================================================
CREATE TABLE public.instruments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('comportamental','psicometrico','cognitivo')),
  duration_min INTEGER NOT NULL DEFAULT 15,
  description TEXT,
  accent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.instruments TO anon, authenticated;
GRANT ALL ON public.instruments TO service_role;

ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instruments are readable by everyone"
ON public.instruments FOR SELECT
USING (true);

CREATE TRIGGER instruments_set_updated_at
BEFORE UPDATE ON public.instruments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.instruments (id, name, short_name, category, duration_min, description, accent) VALUES
  ('disc',          'Análise DISC',            'DISC',          'comportamental', 15, 'Identifique o perfil de dominância, influência, estabilidade e conformidade.', 'rose'),
  ('bigfive',       'Big Five (OCEAN)',        'Big Five',      'psicometrico',   25, 'O padrão ouro para medir as cinco grandes dimensões da personalidade humana.', 'zinc'),
  ('mbti',          'MBTI',                    'MBTI',          'psicometrico',   30, 'Identificação dos 16 tipos de personalidade a partir de quatro dicotomias.', 'violet'),
  ('temperamentos', 'Temperamentos',           'Temperamentos', 'comportamental', 12, 'Análise clássica de sanguíneo, colérico, melancólico e fleumático.', 'amber'),
  ('vak',           'Canais de Acesso (VAK)',  'VAK',           'comportamental',  8, 'Descubra se o avaliado é predominantemente visual, auditivo ou sinestésico.', 'emerald'),
  ('qi',            'Matrizes de QI',          'QI',            'cognitivo',      45, 'Avaliação de raciocínio lógico-espacial e inteligência fluida.', 'teal');

-- ============================================================
-- people
-- ============================================================
CREATE TABLE public.people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  profession TEXT,
  role_at_company TEXT,
  role TEXT NOT NULL DEFAULT 'cliente' CHECK (role IN ('cliente','aluno','colaborador')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX people_mentor_idx ON public.people(mentor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentors view their own people"
ON public.people FOR SELECT TO authenticated
USING (auth.uid() = mentor_id);

CREATE POLICY "Mentors insert their own people"
ON public.people FOR INSERT TO authenticated
WITH CHECK (auth.uid() = mentor_id);

CREATE POLICY "Mentors update their own people"
ON public.people FOR UPDATE TO authenticated
USING (auth.uid() = mentor_id)
WITH CHECK (auth.uid() = mentor_id);

CREATE POLICY "Mentors delete their own people"
ON public.people FOR DELETE TO authenticated
USING (auth.uid() = mentor_id);

CREATE TRIGGER people_set_updated_at
BEFORE UPDATE ON public.people
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- groups
-- ============================================================
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'turma' CHECK (type IN ('turma','empresa','setor')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX groups_mentor_idx ON public.groups(mentor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentors view their own groups"
ON public.groups FOR SELECT TO authenticated
USING (auth.uid() = mentor_id);

CREATE POLICY "Mentors insert their own groups"
ON public.groups FOR INSERT TO authenticated
WITH CHECK (auth.uid() = mentor_id);

CREATE POLICY "Mentors update their own groups"
ON public.groups FOR UPDATE TO authenticated
USING (auth.uid() = mentor_id)
WITH CHECK (auth.uid() = mentor_id);

CREATE POLICY "Mentors delete their own groups"
ON public.groups FOR DELETE TO authenticated
USING (auth.uid() = mentor_id);

CREATE TRIGGER groups_set_updated_at
BEFORE UPDATE ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- group_members (groups <-> people)
-- ============================================================
CREATE TABLE public.group_members (
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, person_id)
);

CREATE INDEX group_members_person_idx ON public.group_members(person_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Access allowed when the caller owns the parent group.
CREATE POLICY "Mentors view members of their groups"
ON public.group_members FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.groups g
  WHERE g.id = group_members.group_id AND g.mentor_id = auth.uid()
));

CREATE POLICY "Mentors add members to their groups"
ON public.group_members FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_members.group_id AND g.mentor_id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = group_members.person_id AND p.mentor_id = auth.uid())
);

CREATE POLICY "Mentors remove members from their groups"
ON public.group_members FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.groups g
  WHERE g.id = group_members.group_id AND g.mentor_id = auth.uid()
));

-- ============================================================
-- group_instruments (groups <-> instruments)
-- ============================================================
CREATE TABLE public.group_instruments (
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  instrument_id TEXT NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, instrument_id)
);

CREATE INDEX group_instruments_instrument_idx ON public.group_instruments(instrument_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_instruments TO authenticated;
GRANT ALL ON public.group_instruments TO service_role;

ALTER TABLE public.group_instruments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentors view instruments of their groups"
ON public.group_instruments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.groups g
  WHERE g.id = group_instruments.group_id AND g.mentor_id = auth.uid()
));

CREATE POLICY "Mentors add instruments to their groups"
ON public.group_instruments FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.groups g
  WHERE g.id = group_instruments.group_id AND g.mentor_id = auth.uid()
));

CREATE POLICY "Mentors remove instruments from their groups"
ON public.group_instruments FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.groups g
  WHERE g.id = group_instruments.group_id AND g.mentor_id = auth.uid()
));
