-- Uma publicação passa a pertencer a VÁRIOS grupos.
--
-- O desenho anterior amarrava cada post a um grupo só. O Matheus definiu outra
-- coisa, e ela exige N-para-N:
--
-- * o avaliado que está em mais de um grupo vê os grupos dele JUNTOS, num feed
--   só, e o que ele publica aparece em todos eles;
-- * quem está em um grupo só continua vendo apenas o que pertence àquele grupo
--   — inclusive os posts de quem está em vários, porque esses posts também
--   pertencem ao grupo dele;
-- * o dono publica escolhendo para quais grupos vai.
--
-- Com `group_id` na própria linha, "aparecer em três grupos" viraria três
-- cópias do mesmo post — três contagens de curtida, três fios de comentário, e
-- apagar num lugar deixando nos outros. Uma publicação, vários destinos.

CREATE TABLE IF NOT EXISTS public.community_post_groups (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, group_id)
);

CREATE INDEX IF NOT EXISTS cpg_group_idx ON public.community_post_groups (group_id);

-- Leva o que já existe para o novo formato ANTES de tirar a coluna antiga.
INSERT INTO public.community_post_groups (post_id, group_id)
SELECT id, group_id FROM public.community_posts
 WHERE group_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- As policies existentes referenciam `group_id`, então o banco recusa remover a
-- coluna enquanto elas existirem. Derruba todas primeiro; as novas são criadas
-- mais abaixo, já olhando o vínculo.
DROP POLICY IF EXISTS cp_read ON public.community_posts;
DROP POLICY IF EXISTS cp_insert ON public.community_posts;
DROP POLICY IF EXISTS cp_update ON public.community_posts;
DROP POLICY IF EXISTS cp_delete ON public.community_posts;
DROP POLICY IF EXISTS cc_read ON public.community_comments;
DROP POLICY IF EXISTS cc_insert ON public.community_comments;
DROP POLICY IF EXISTS cc_delete ON public.community_comments;
DROP POLICY IF EXISTS cr_read ON public.community_reactions;
DROP POLICY IF EXISTS cr_insert ON public.community_reactions;
DROP POLICY IF EXISTS cr_delete ON public.community_reactions;

ALTER TABLE public.community_posts DROP COLUMN IF EXISTS group_id;

ALTER TABLE public.community_post_groups ENABLE ROW LEVEL SECURITY;

-- Vejo o vínculo se vejo o grupo. `posso_ver_grupo` já resolve as três portas
-- (avaliado do grupo, dono da conta, mentor atribuído a ele).
DROP POLICY IF EXISTS cpg_read ON public.community_post_groups;
CREATE POLICY cpg_read ON public.community_post_groups FOR SELECT TO authenticated
  USING (public.posso_ver_grupo(group_id));

DROP POLICY IF EXISTS cpg_insert ON public.community_post_groups;
CREATE POLICY cpg_insert ON public.community_post_groups FOR INSERT TO authenticated
  WITH CHECK (
    public.posso_ver_grupo(group_id)
    AND EXISTS (SELECT 1 FROM public.community_posts p
                 WHERE p.id = post_id AND p.author_id = auth.uid())
  );

DROP POLICY IF EXISTS cpg_delete ON public.community_post_groups;
CREATE POLICY cpg_delete ON public.community_post_groups FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.community_posts p
                  WHERE p.id = post_id AND p.author_id = auth.uid()));

-- As policies do post agora olham os grupos pelo vínculo.
CREATE POLICY cp_read ON public.community_posts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.community_post_groups g
                  WHERE g.post_id = id AND public.posso_ver_grupo(g.group_id)));

-- Criar o post não exige grupo: o vínculo vem logo depois, na mesma operação.
-- Sem isso, seria preciso saber o id do post antes de criá-lo.
CREATE POLICY cp_insert ON public.community_posts FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY cp_delete ON public.community_posts FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.community_post_groups pg
                JOIN public.groups g ON g.id = pg.group_id
               WHERE pg.post_id = id AND g.mentor_id = public.acting_account())
  );

-- Comentário e curtida seguem o post, que agora é visto pelo vínculo.
CREATE POLICY cc_read ON public.community_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_id));

CREATE POLICY cc_insert ON public.community_comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_id)
  );

CREATE POLICY cc_delete ON public.community_comments FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.community_post_groups pg
                JOIN public.groups g ON g.id = pg.group_id
               WHERE pg.post_id = post_id AND g.mentor_id = public.acting_account())
  );

CREATE POLICY cr_read ON public.community_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_id));

CREATE POLICY cr_insert ON public.community_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_id)
  );

-- Editar continua sendo só do autor.
DROP POLICY IF EXISTS cp_update ON public.community_posts;
CREATE POLICY cp_update ON public.community_posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

-- Descurtir: só a própria reação.
DROP POLICY IF EXISTS cr_delete ON public.community_reactions;
CREATE POLICY cr_delete ON public.community_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());
