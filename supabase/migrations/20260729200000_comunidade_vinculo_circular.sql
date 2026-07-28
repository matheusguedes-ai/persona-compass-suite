-- Quebra a dependência circular ao publicar.
--
-- A policy de INSERT do vínculo conferia a autoria assim:
--   EXISTS (SELECT 1 FROM community_posts p WHERE p.id = post_id AND p.author_id = auth.uid())
--
-- Esse SELECT passa pela policy de LEITURA do post, que exige o post já estar
-- ligado a um grupo visível. Só que o vínculo é justamente o que está sendo
-- criado. Um espera o outro, e publicar falhava sempre.
--
-- A saída é conferir a autoria por uma função SECURITY DEFINER, que lê a tabela
-- sem passar pela policy de leitura. A checagem continua existindo — o que
-- muda é o caminho até ela.

CREATE OR REPLACE FUNCTION public.sou_autor_do_post(p_post_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.community_posts p
     WHERE p.id = p_post_id AND p.author_id = auth.uid()
  );
$fn$;

GRANT EXECUTE ON FUNCTION public.sou_autor_do_post(uuid) TO authenticated;

DROP POLICY IF EXISTS cpg_insert ON public.community_post_groups;
CREATE POLICY cpg_insert ON public.community_post_groups FOR INSERT TO authenticated
  WITH CHECK (public.posso_ver_grupo(group_id) AND public.sou_autor_do_post(post_id));

DROP POLICY IF EXISTS cpg_delete ON public.community_post_groups;
CREATE POLICY cpg_delete ON public.community_post_groups FOR DELETE TO authenticated
  USING (public.sou_autor_do_post(post_id));

-- Mesmo motivo em comentário e curtida: as duas conferem a existência do post,
-- e essa leitura também passava pela policy de leitura.
CREATE OR REPLACE FUNCTION public.posso_ver_post(p_post_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.community_post_groups g
     WHERE g.post_id = p_post_id AND public.posso_ver_grupo(g.group_id)
  );
$fn$;

GRANT EXECUTE ON FUNCTION public.posso_ver_post(uuid) TO authenticated;

DROP POLICY IF EXISTS cc_read ON public.community_comments;
CREATE POLICY cc_read ON public.community_comments FOR SELECT TO authenticated
  USING (public.posso_ver_post(post_id));

DROP POLICY IF EXISTS cc_insert ON public.community_comments;
CREATE POLICY cc_insert ON public.community_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.posso_ver_post(post_id));

DROP POLICY IF EXISTS cr_read ON public.community_reactions;
CREATE POLICY cr_read ON public.community_reactions FOR SELECT TO authenticated
  USING (public.posso_ver_post(post_id));

DROP POLICY IF EXISTS cr_insert ON public.community_reactions;
CREATE POLICY cr_insert ON public.community_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.posso_ver_post(post_id));
