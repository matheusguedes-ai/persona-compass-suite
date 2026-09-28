-- #319, conferência depois de publicar (28/09/2026): o aluno passou a ver a turma inteira no Ranking,
-- mas com ZERO ponto para todo colega.
--
-- A MESMA CAUSA da #319, noutro lugar. A policy `pontos_read` (20260730210000_areas_do_grupo.sql) já
-- pretendia mostrar ao aluno os pontos de quem está num grupo dele (quando o grupo tem Comunidade) — o
-- ranking é "visível para o grupo todo, por decisão do Matheus" (`rankingDoGrupo`). Só que ela pergunta
-- "o dono deste ponto é colega de um grupo meu?" com um JOIN em `people` feito com a RLS de QUEM LÊ, e
-- a RLS de `people` só entrega ao aluno a PRÓPRIA linha. Para todo colega o EXISTS dava falso.
-- Medido simulando a sessão de um aluno real da T4 (só leitura): 8 colegas com login na lista do ranking,
-- pontos visíveis de 1 — os dele. Na tela: ele em 1º com 80 e os outros sete com 0.
--
-- O conserto segue o padrão da #319 (`colegas_de_grupo`): a pergunta vai para uma função SECURITY
-- DEFINER, que responde só sim/não e reaproveita a MESMA regra que a policy já tinha
-- (`meus_grupos_como_avaliado`). Nenhum ponto passa a ser visível além do que a policy pretendia: o
-- próprio aluno, a equipe da conta, e colegas de grupo quando a Comunidade está liberada.
CREATE OR REPLACE FUNCTION public.e_colega_de_grupo(p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1
      FROM public.group_members gm
      JOIN public.people p ON p.id = gm.person_id
     WHERE p.user_id = p_user_id
       AND gm.group_id IN (SELECT public.meus_grupos_como_avaliado())
  );
$fn$;

COMMENT ON FUNCTION public.e_colega_de_grupo(uuid) IS
  '#319 — o login informado está num grupo de quem pergunta? Só sim/não, sem nenhum dado da pessoa. Usada pela policy pontos_read, que antes fazia o mesmo JOIN em people com a RLS de quem lê (e falhava para todo colega).';

DROP POLICY IF EXISTS pontos_read ON public.pontos;
CREATE POLICY pontos_read ON public.pontos FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR mentor_id = public.acting_account()
    OR (public.aluno_pode('comunidade') AND public.e_colega_de_grupo(user_id))
  );
