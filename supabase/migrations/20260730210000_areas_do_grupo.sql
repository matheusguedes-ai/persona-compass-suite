-- Permissoes do painel do aluno, por GRUPO.
--
-- Ao criar (ou editar) um grupo, o dono escolhe quais areas do menu do aluno
-- aquele grupo acessa. Exemplo dele: um grupo que so recebe a Academy, sem
-- testes, sem comunidade, sem classroom.
--
-- NULL = tudo liberado. E como os grupos existentes nasceram, e inverter isso
-- deixaria toda a base sem acesso a nada no dia da migracao.
--
-- Quem esta em mais de um grupo recebe a UNIAO das permissoes. Foi o que ficou
-- combinado com ele: a alternativa (intersecao) faria adicionar alguem a um
-- grupo TIRAR acesso que ela ja tinha -- efeito colateral invisivel de uma
-- acao que parece so somar.
--
-- A trava vale no BANCO, nao so no menu. Esconder o item e deixar a rota
-- respondendo seria a mesma tranca de enfeite que o cadeado da Academy evitou:
-- bastaria digitar /aluno/comunidade.

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS areas_aluno text[];

ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_areas_conhecidas;
ALTER TABLE public.groups ADD CONSTRAINT groups_areas_conhecidas CHECK (
  areas_aluno IS NULL
  OR areas_aluno <@ ARRAY['resultados','comunidade','devolutivas','agenda','academy','classroom']::text[]
);

COMMENT ON COLUMN public.groups.areas_aluno IS
  'Areas do painel do aluno liberadas para este grupo. NULL = todas. Meu perfil nao entra: e onde ele troca a propria senha e os proprios dados.';


/**
 * Esta pessoa pode abrir esta area do painel do aluno?
 *
 * SECURITY DEFINER porque depende de people, group_members e team_members --
 * todas com RLS propria. Sem isso a resposta mudaria conforme o papel de quem
 * pergunta em vez de conforme a permissao do grupo.
 *
 * Devolve TRUE para quem nao e aluno puro (dono, colaborador, mentor). A trava
 * e do painel do aluno; aplica-la a equipe esconderia dados de quem administra.
 */
CREATE OR REPLACE FUNCTION public.aluno_pode(p_area text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    -- Nao tem cadastro de avaliado: e o dono da conta.
    NOT EXISTS (SELECT 1 FROM public.people p WHERE p.user_id = auth.uid())
    -- Ou e da equipe (colaborador, ou avaliado promovido a mentor).
    OR EXISTS (SELECT 1 FROM public.team_members tm
                WHERE tm.user_id = auth.uid() AND tm.status = 'ativo')
    -- Aluno sem grupo nenhum: nao ha grupo para restringir, vale o padrao.
    OR NOT EXISTS (
         SELECT 1 FROM public.group_members gm
           JOIN public.people p ON p.id = gm.person_id
          WHERE p.user_id = auth.uid())
    -- Uniao: basta UM grupo dele liberar a area.
    OR EXISTS (
         SELECT 1 FROM public.group_members gm
           JOIN public.groups g ON g.id = gm.group_id
           JOIN public.people p ON p.id = gm.person_id
          WHERE p.user_id = auth.uid()
            AND (g.areas_aluno IS NULL OR p_area = ANY (g.areas_aluno)));
$fn$;

GRANT EXECUTE ON FUNCTION public.aluno_pode(text) TO authenticated;

/**
 * As areas de uma PESSOA -- para a previa "ver como aluno" e para o menu.
 * So o dono da conta dela pode perguntar; senao isto viraria um jeito de ler
 * a permissao alheia.
 */
CREATE OR REPLACE FUNCTION public.areas_da_pessoa(p_person_id uuid)
RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT a FROM unnest(ARRAY['resultados','comunidade','devolutivas','agenda','academy','classroom']) a
   WHERE EXISTS (SELECT 1 FROM public.people p
                  WHERE p.id = p_person_id AND p.mentor_id = public.acting_account())
     AND (
       NOT EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.person_id = p_person_id)
       OR EXISTS (SELECT 1 FROM public.group_members gm
                    JOIN public.groups g ON g.id = gm.group_id
                   WHERE gm.person_id = p_person_id
                     AND (g.areas_aluno IS NULL OR a = ANY (g.areas_aluno)))
     );
$fn$;

GRANT EXECUTE ON FUNCTION public.areas_da_pessoa(uuid) TO authenticated;

/** As minhas areas, para o menu do aluno montar so o que ele abre. */
CREATE OR REPLACE FUNCTION public.minhas_areas()
RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT a FROM unnest(ARRAY['resultados','comunidade','devolutivas','agenda','academy','classroom']) a
   WHERE public.aluno_pode(a);
$fn$;

GRANT EXECUTE ON FUNCTION public.minhas_areas() TO authenticated;


-- ============================================================
-- Onde a trava morde
-- ============================================================

-- --- Resultados (os testes) ---
DROP POLICY IF EXISTS tr_student_read ON public.test_responses;
CREATE POLICY tr_student_read ON public.test_responses FOR SELECT TO authenticated
  USING (person_id IN (SELECT public.my_person_ids()) AND public.aluno_pode('resultados'));

DROP POLICY IF EXISTS ar_student_read ON public.assessment_responses;
CREATE POLICY ar_student_read ON public.assessment_responses FOR SELECT TO authenticated
  USING (person_id IN (SELECT public.my_person_ids()) AND public.aluno_pode('resultados'));

-- --- Comunidade (e o ranking, que vive dentro dela) ---
-- posso_ver_post e o funil de comentario e reacao, leitura e escrita.
CREATE OR REPLACE FUNCTION public.posso_ver_post(p_post_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT public.aluno_pode('comunidade')
     AND EXISTS (
       SELECT 1 FROM public.community_post_groups g
        WHERE g.post_id = p_post_id AND public.posso_ver_grupo(g.group_id)
     );
$fn$;

DROP POLICY IF EXISTS cp_read ON public.community_posts;
CREATE POLICY cp_read ON public.community_posts FOR SELECT TO authenticated
  USING (
    public.aluno_pode('comunidade')
    AND EXISTS (SELECT 1 FROM public.community_post_groups g
                 WHERE g.post_id = id AND public.posso_ver_grupo(g.group_id))
  );

DROP POLICY IF EXISTS cp_insert ON public.community_posts;
CREATE POLICY cp_insert ON public.community_posts FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.aluno_pode('comunidade'));

DROP POLICY IF EXISTS cpg_insert ON public.community_post_groups;
CREATE POLICY cpg_insert ON public.community_post_groups FOR INSERT TO authenticated
  WITH CHECK (
    public.posso_ver_grupo(group_id)
    AND public.sou_autor_do_post(post_id)
    AND public.aluno_pode('comunidade')
  );

-- O ranking e a aba de dentro da comunidade: ver o placar dos colegas segue a
-- mesma permissao. O proprio extrato (user_id = auth.uid()) continua sempre
-- visivel -- os pontos sao dele, e some-los seria apagar o historico.
DROP POLICY IF EXISTS pontos_read ON public.pontos;
CREATE POLICY pontos_read ON public.pontos FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR mentor_id = public.acting_account()
    OR (
      public.aluno_pode('comunidade')
      AND EXISTS (
        SELECT 1 FROM public.group_members gm
          JOIN public.people p ON p.id = gm.person_id
         WHERE p.user_id = pontos.user_id
           AND gm.group_id IN (SELECT public.meus_grupos_como_avaliado())
      )
    )
  );

-- --- Devolutivas ---
DROP POLICY IF EXISTS devolutivas_read_aluno ON public.devolutivas;
CREATE POLICY devolutivas_read_aluno ON public.devolutivas FOR SELECT TO authenticated
  USING (person_id IN (SELECT public.my_person_ids()) AND public.aluno_pode('devolutivas'));

-- --- Agenda ---
CREATE OR REPLACE FUNCTION public.posso_ver_evento(p_evento uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    -- O dono da conta: o evento e dele.
    EXISTS (SELECT 1 FROM public.eventos e
             WHERE e.id = p_evento AND e.conta_id = auth.uid())
    OR (
      -- aluno_pode devolve true para a equipe, entao o mentor que acompanha o
      -- grupo continua passando por aqui.
      public.aluno_pode('agenda')
      AND EXISTS (
        SELECT 1 FROM public.evento_destinos d
         WHERE d.evento_id = p_evento
           AND (
             d.person_id IN (SELECT p.id FROM public.people p WHERE p.user_id = auth.uid())
             OR d.group_id IN (
                  SELECT gm.group_id FROM public.group_members gm
                    JOIN public.people p ON p.id = gm.person_id
                   WHERE p.user_id = auth.uid())
             OR d.group_id IN (
                  SELECT tmg.group_id FROM public.team_member_groups tmg
                    JOIN public.team_members tm ON tm.id = tmg.team_member_id
                   WHERE tm.user_id = auth.uid() AND tm.status = 'ativo')
           ))
    );
$fn$;

-- --- Academy ---
CREATE OR REPLACE FUNCTION public.can_see_track(_track_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.learning_tracks t
     WHERE t.id = _track_id
       AND (
         t.owner_id = public.acting_account()
         OR (
           t.is_published
           AND t.audience IN ('alunos', 'ambos')
           AND t.owner_id IN (SELECT p.mentor_id FROM public.people p WHERE p.user_id = auth.uid())
           AND public.aluno_pode('academy')
         )
       )
  );
$fn$;

-- --- Classroom ---
CREATE OR REPLACE FUNCTION public.posso_ver_treinamento(p_trein uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.treinamentos t
     WHERE t.id = p_trein AND t.mentor_id = auth.uid()
  ) OR (
    public.aluno_pode('classroom')
    AND EXISTS (
      SELECT 1
        FROM public.treinamentos t
        JOIN public.treinamento_grupos tg ON tg.treinamento_id = t.id
        JOIN public.group_members gm ON gm.group_id = tg.group_id
        JOIN public.people p ON p.id = gm.person_id
       WHERE t.id = p_trein AND t.publicado AND p.user_id = auth.uid()
    )
  ) OR EXISTS (
    SELECT 1
      FROM public.treinamento_grupos tg
      JOIN public.team_member_groups tmg ON tmg.group_id = tg.group_id
      JOIN public.team_members tm ON tm.id = tmg.team_member_id
     WHERE tg.treinamento_id = p_trein
       AND tm.user_id = auth.uid() AND tm.status = 'ativo'
  );
$fn$;
