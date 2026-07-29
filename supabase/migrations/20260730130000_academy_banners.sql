-- Banners rotativos no topo da Academy. Item G, parte 2.
--
-- So o dono cadastra; todos da conta veem. Mesma divisao da biblioteca:
-- curadoria e do master, consumo e de todo mundo.

CREATE TABLE IF NOT EXISTS public.academy_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL,
  imagem_url text NOT NULL,
  link_url text,
  titulo text,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS banners_conta_idx
  ON public.academy_banners (mentor_id, ordem);

ALTER TABLE public.academy_banners ENABLE ROW LEVEL SECURITY;

-- Duas portas, como na biblioteca: `acting_account()` cobre dono, mentor e
-- colaborador; o avaliado nao esta em team_members, entao precisa da segunda.
DROP POLICY IF EXISTS banner_read ON public.academy_banners;
CREATE POLICY banner_read ON public.academy_banners FOR SELECT TO authenticated
  USING (
    mentor_id = public.acting_account()
    OR mentor_id IN (SELECT p.mentor_id FROM public.people p WHERE p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS banner_write ON public.academy_banners;
CREATE POLICY banner_write ON public.academy_banners FOR ALL TO authenticated
  USING (mentor_id = auth.uid()) WITH CHECK (mentor_id = auth.uid());
