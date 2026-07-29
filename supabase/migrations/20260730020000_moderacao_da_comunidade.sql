-- Quem pode apagar o post dos outros.
--
-- O Matheus viu o aluno com o botão de apagar na publicação DELE. Duas falhas
-- distintas, e a interface era só a mais visível:
--
-- 1. A tela mostrava a lixeira em todo post, para todo mundo. No aluno o clique
--    não apagava nada (a RLS barrava), mas oferecer o botão já está errado.
--
-- 2. A regra antiga era `g.mentor_id = acting_account()`. Para o mentor
--    promovido, `acting_account()` devolve o id do DONO — e `mentor_id` de todo
--    grupo da conta também é o dono. Ou seja: o mentor podia moderar qualquer
--    grupo da conta, inclusive os que não são dele.
--
-- Agora a moderação é explícita: o dono da conta (os grupos são dele) ou o
-- mentor ATRIBUÍDO àquele grupo. Ninguém mais.

CREATE OR REPLACE FUNCTION public.posso_moderar_post(p_post uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1
      FROM public.community_post_groups pg
      JOIN public.groups g ON g.id = pg.group_id
     WHERE pg.post_id = p_post
       AND (
         g.mentor_id = auth.uid()
         OR EXISTS (
              SELECT 1 FROM public.team_member_groups tmg
                JOIN public.team_members tm ON tm.id = tmg.team_member_id
               WHERE tmg.group_id = g.id
                 AND tm.user_id = auth.uid()
                 AND tm.status = 'ativo'
                 AND tm.kind IN ('mentor', 'colaborador'))
       )
  );
$fn$;

GRANT EXECUTE ON FUNCTION public.posso_moderar_post(uuid) TO authenticated;

DROP POLICY IF EXISTS cp_delete ON public.community_posts;
CREATE POLICY cp_delete ON public.community_posts FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.posso_moderar_post(id));

DROP POLICY IF EXISTS cc_delete ON public.community_comments;
CREATE POLICY cc_delete ON public.community_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.posso_moderar_post(post_id));
