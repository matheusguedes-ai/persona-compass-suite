-- Educação (LMS) + acesso do aluno
-- ============================================================
-- Estrutura: trilha → módulo → submódulo → aula → materiais.
-- Vídeo entra por link do YouTube e material por link externo (Drive etc.) —
-- decisão do usuário: sem upload de arquivo pesado.
--
-- `track_id` aparece repetido em módulo, aula e material de propósito: deixa
-- toda policy ser uma checagem só, sem subir a árvore a cada linha lida.

-- ============================================================
-- 1. Aluno passa a poder ter login
-- ============================================================
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Uma mesma pessoa pode ser aluna de mais de um mentor, então não é único.
CREATE INDEX IF NOT EXISTS idx_people_user ON public.people(user_id) WHERE user_id IS NOT NULL;

-- Cadastros do usuário logado, por email. É o que liga a conta ao cadastro que
-- o mentor já tinha feito.
CREATE OR REPLACE FUNCTION public.my_person_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id FROM public.people p WHERE p.user_id = auth.uid();
$$;

/**
 * Liga a conta recém-criada aos cadastros com o mesmo email.
 * Roda como definer porque, antes do vínculo, a RLS não deixaria o aluno nem
 * enxergar a própria linha.
 */
CREATE OR REPLACE FUNCTION public.claim_student_profile()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_n integer;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
  IF v_email IS NULL THEN RETURN 0; END IF;

  UPDATE public.people p
     SET user_id = v_uid
   WHERE lower(p.email) = lower(v_email)
     AND p.user_id IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_person_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_student_profile() TO authenticated;

-- O aluno enxerga o próprio cadastro e as próprias respostas, sem virar membro
-- da equipe. Policies novas e separadas: as do mentor continuam intactas.
DROP POLICY IF EXISTS people_self_read ON public.people;
CREATE POLICY people_self_read ON public.people FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS tr_student_read ON public.test_responses;
CREATE POLICY tr_student_read ON public.test_responses FOR SELECT TO authenticated
  USING (person_id IN (SELECT public.my_person_ids()));

DROP POLICY IF EXISTS ar_student_read ON public.assessment_responses;
CREATE POLICY ar_student_read ON public.assessment_responses FOR SELECT TO authenticated
  USING (person_id IN (SELECT public.my_person_ids()));

-- ============================================================
-- 2. Conteúdo
-- ============================================================
CREATE TABLE IF NOT EXISTS public.learning_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  cover_url text,
  -- Quem assiste. 'ambos' = equipe e alunos.
  audience text NOT NULL DEFAULT 'alunos' CHECK (audience IN ('equipe', 'alunos', 'ambos')),
  is_published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.learning_tracks(id) ON DELETE CASCADE,
  -- Preenchido = submódulo (filho de outro módulo da mesma trilha).
  parent_id uuid REFERENCES public.learning_modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.learning_tracks(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.learning_modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  -- Link do YouTube; o player monta o embed a partir daqui.
  video_url text,
  duration_min integer,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.learning_tracks(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.learning_lessons(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  kind text NOT NULL DEFAULT 'link' CHECK (kind IN ('link', 'pdf', 'planilha', 'video', 'audio', 'outro')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.learning_lessons(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.learning_tracks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_progress ON public.learning_progress(lesson_id, user_id);

CREATE INDEX IF NOT EXISTS idx_lm_track ON public.learning_modules(track_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_ll_module ON public.learning_lessons(module_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lmat_lesson ON public.learning_materials(lesson_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lp_user ON public.learning_progress(user_id, track_id);

DROP TRIGGER IF EXISTS trg_lt_updated ON public.learning_tracks;
CREATE TRIGGER trg_lt_updated BEFORE UPDATE ON public.learning_tracks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_lm_updated ON public.learning_modules;
CREATE TRIGGER trg_lm_updated BEFORE UPDATE ON public.learning_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_ll_updated ON public.learning_lessons;
CREATE TRIGGER trg_ll_updated BEFORE UPDATE ON public.learning_lessons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. Quem vê e quem edita
-- ============================================================
-- Ver: a equipe da conta vê tudo; o aluno vê o que estiver publicado para ele
-- pelo mentor em cujo cadastro ele está.
CREATE OR REPLACE FUNCTION public.can_see_track(_track_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.learning_tracks t
     WHERE t.id = _track_id
       AND (
         t.owner_id = public.acting_account()
         OR (
           t.is_published
           AND t.audience IN ('alunos', 'ambos')
           AND t.owner_id IN (SELECT p.mentor_id FROM public.people p WHERE p.user_id = auth.uid())
         )
       )
  );
$$;

-- Editar: dono e colaborador da conta. Mentor convidado consome, não publica.
CREATE OR REPLACE FUNCTION public.can_edit_track(_track_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.member_kind() <> 'mentor'
     AND EXISTS (
       SELECT 1 FROM public.learning_tracks t
        WHERE t.id = _track_id AND t.owner_id = public.acting_account()
     );
$$;

GRANT EXECUTE ON FUNCTION public.can_see_track(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_track(uuid) TO authenticated;

ALTER TABLE public.learning_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lt_read ON public.learning_tracks;
CREATE POLICY lt_read ON public.learning_tracks FOR SELECT TO authenticated
  USING (public.can_see_track(id));

DROP POLICY IF EXISTS lt_insert ON public.learning_tracks;
CREATE POLICY lt_insert ON public.learning_tracks FOR INSERT TO authenticated
  WITH CHECK (owner_id = public.acting_account() AND public.member_kind() <> 'mentor');

DROP POLICY IF EXISTS lt_update ON public.learning_tracks;
CREATE POLICY lt_update ON public.learning_tracks FOR UPDATE TO authenticated
  USING (public.can_edit_track(id)) WITH CHECK (owner_id = public.acting_account());

DROP POLICY IF EXISTS lt_delete ON public.learning_tracks;
CREATE POLICY lt_delete ON public.learning_tracks FOR DELETE TO authenticated
  USING (public.can_edit_track(id));

DROP POLICY IF EXISTS lm_read ON public.learning_modules;
CREATE POLICY lm_read ON public.learning_modules FOR SELECT TO authenticated
  USING (public.can_see_track(track_id));
DROP POLICY IF EXISTS lm_write ON public.learning_modules;
CREATE POLICY lm_write ON public.learning_modules FOR ALL TO authenticated
  USING (public.can_edit_track(track_id)) WITH CHECK (public.can_edit_track(track_id));

DROP POLICY IF EXISTS ll_read ON public.learning_lessons;
CREATE POLICY ll_read ON public.learning_lessons FOR SELECT TO authenticated
  USING (public.can_see_track(track_id));
DROP POLICY IF EXISTS ll_write ON public.learning_lessons;
CREATE POLICY ll_write ON public.learning_lessons FOR ALL TO authenticated
  USING (public.can_edit_track(track_id)) WITH CHECK (public.can_edit_track(track_id));

DROP POLICY IF EXISTS lmat_read ON public.learning_materials;
CREATE POLICY lmat_read ON public.learning_materials FOR SELECT TO authenticated
  USING (public.can_see_track(track_id));
DROP POLICY IF EXISTS lmat_write ON public.learning_materials;
CREATE POLICY lmat_write ON public.learning_materials FOR ALL TO authenticated
  USING (public.can_edit_track(track_id)) WITH CHECK (public.can_edit_track(track_id));

-- Progresso é de quem assistiu; o dono da trilha pode ler para acompanhar.
DROP POLICY IF EXISTS lp_own ON public.learning_progress;
CREATE POLICY lp_own ON public.learning_progress FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS lp_owner_read ON public.learning_progress;
CREATE POLICY lp_owner_read ON public.learning_progress FOR SELECT TO authenticated
  USING (public.can_edit_track(track_id));
