-- Corrige de novo a policy de SELECT de `groups` — regressão do mesmo bug já
-- resolvido em 20260729010000_corrige_policy_autoreferente.sql
-- ============================================================================
-- Sintoma: "new row violates row-level security policy for table \"groups\"" ao
-- criar um grupo pela tela. Reproduzido: INSERT sem RETURNING passa, o mesmo
-- INSERT com RETURNING falha.
--
-- Causa: em algum ponto depois de 29/07 — provavelmente ao generalizar a
-- checagem de visibilidade de grupo para community_posts, group_members e
-- mentoria_arquivos — a policy `grupos_read` passou a chamar
-- `posso_ver_grupo(id)`, uma função STABLE que faz
-- `EXISTS (SELECT 1 FROM public.groups g WHERE g.id = p_group_id AND ...)`.
-- Ela releem a PRÓPRIA tabela que a policy protege. Uma função STABLE enxerga
-- o snapshot do início da instrução, que não contém a linha que a mesma
-- instrução está inserindo. Como `createGroup` faz `.insert(...).select()`
-- (INSERT ... RETURNING), o Postgres aplica a policy de SELECT na linha nova,
-- ela some do snapshot, e o INSERT inteiro é recusado.
--
-- `posso_ver_grupo()` continua correta e não é tocada aqui — ela existe para
-- ser chamada de FORA da tabela groups (community_posts, group_members,
-- mentoria_arquivos etc.), onde não há autorreferência e o problema não
-- existe. O problema é só usá-la NA PRÓPRIA policy de `groups`.
--
-- Correção: igual à de 29/07 — escrever a condição direto sobre as colunas
-- da própria linha (`id`, `mentor_id`, já disponíveis na policy sem precisar
-- reconsultar a tabela), reproduzindo exatamente a semântica atual de
-- `posso_ver_grupo(id)`:
--   1. é da conta e quem olha não é mentor convidado;
--   2. é da conta e é mentor convidado com este grupo atribuído
--      (via team_member_groups + team_members — mesmo join de
--      `visible_group_ids()`, que por sua vez também releria `groups` e por
--      isso não é chamada aqui);
--   3. quem olha é avaliado deste grupo (`meus_grupos_como_avaliado()`, que lê
--      `group_members`, não `groups` — sem autorreferência, mantida).
-- Nada muda em quem enxerga o quê — muda só o caminho para chegar à resposta.

DROP POLICY IF EXISTS grupos_read ON public.groups;
CREATE POLICY grupos_read ON public.groups FOR SELECT TO authenticated
  USING (
    (
      mentor_id = public.acting_account()
      AND (
        public.member_kind() <> 'mentor'
        OR id IN (
          SELECT tmg.group_id
            FROM public.team_member_groups tmg
            JOIN public.team_members tm ON tm.id = tmg.team_member_id
           WHERE tm.user_id = auth.uid() AND tm.status = 'ativo'
        )
      )
    )
    OR (id IN (SELECT public.meus_grupos_como_avaliado()))
  );
