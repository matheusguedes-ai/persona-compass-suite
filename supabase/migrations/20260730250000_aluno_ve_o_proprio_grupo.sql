-- O aluno nao conseguia ler o proprio grupo -- e a comunidade dele ficava vazia.
--
-- ACHADO COM LOGIN DE ALUNO DE VERDADE. A previa "ver como aluno" nunca pegou
-- isto porque ela roda autenticada como o DONO, que le todos os grupos da conta.
--
-- O SINTOMA
--
-- Aluno dentro de um grupo abria /aluno/comunidade e via "Voce ainda nao faz
-- parte de nenhuma comunidade". A aba Membros e o ranking do grupo tambem
-- ficavam vazios.
--
-- A CAUSA
--
-- As policies de SELECT de `groups` e `group_members` so tinham o ramo da
-- EQUIPE:
--
--   groups         → mentor_id = acting_account() AND (...)
--   group_members  → group_id IN (SELECT visible_group_ids())
--
-- Para um avaliado, `acting_account()` devolve o proprio uid dele, que nao e
-- `mentor_id` de grupo nenhum, e `visible_group_ids()` e a lista da equipe.
-- Zero linhas. As funcoes SECURITY DEFINER sabiam a verdade
-- (`meus_grupos_como_avaliado()` devolvia o grupo certo), mas quem decide a
-- leitura da TABELA e a policy -- e ela nao conhecia o aluno.
--
-- `gruposDoAvaliado` faz `from("groups").select("id, name").in("id", ids)`:
-- os ids vinham certos da funcao e a consulta voltava vazia.
--
-- O CONSERTO
--
-- `posso_ver_grupo()` ja existe exatamente para isto -- o comentario dela diz
-- "as tres portas numa funcao so, para as policies nao repetirem a mesma
-- logica quatro vezes". Ela cobre dono, colaborador, mentor do grupo E
-- avaliado do grupo. As policies passam a usa-la.
--
-- Nao ha recursao: ela e SECURITY DEFINER e le `groups` sem passar pela RLS.

-- Ler o grupo: as tres portas. Escrever continua so da equipe -- o aluno
-- participa do grupo, nao o administra (as policies de INSERT/UPDATE/DELETE
-- ficam como estao).
DROP POLICY IF EXISTS "Mentors view their own groups" ON public.groups;
DROP POLICY IF EXISTS grupos_read ON public.groups;
CREATE POLICY grupos_read ON public.groups FOR SELECT TO authenticated
  USING (public.posso_ver_grupo(id));

-- Os membros do grupo. O aluno precisa deles para a aba Membros e para o
-- ranking do grupo -- que e justamente o que ele ve na comunidade.
DROP POLICY IF EXISTS "Mentors view members of their groups" ON public.group_members;
DROP POLICY IF EXISTS grupo_membros_read ON public.group_members;
CREATE POLICY grupo_membros_read ON public.group_members FOR SELECT TO authenticated
  USING (public.posso_ver_grupo(group_id));
