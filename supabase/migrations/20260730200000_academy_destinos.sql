-- Academy: escolher quem abre cada trilha.
--
-- Ate aqui, trilha publicada para "alunos" era vista por TODO aluno da conta.
-- Agora o professor escolhe pessoas e grupos. Quem nao foi escolhido continua
-- vendo o card -- com cadeado -- e nao recebe as aulas.
--
-- A tranca vale no BANCO, e nao so na tela: sem isso o cadeado seria enfeite,
-- porque a lista de aulas continuaria vindo na resposta da API e qualquer um
-- abriria o console para ler o link do video.
--
-- Trilha SEM destino nenhum continua aberta a todos. E como as trilhas antigas
-- nasceram, e trocar isso trancaria tudo o que ja existe no dia da migracao.

CREATE TABLE IF NOT EXISTS public.learning_track_destinos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.learning_tracks(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.people(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Um destino e um grupo ou uma pessoa, nunca os dois nem nenhum. Linha vazia
  -- viraria destino que nao casa com ninguem: a trilha deixaria de ser aberta
  -- (ja existe destino) sem liberar para ninguem.
  CONSTRAINT ltd_um_ou_outro CHECK ((group_id IS NULL) <> (person_id IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS ltd_grupo_uk
  ON public.learning_track_destinos (track_id, group_id) WHERE group_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ltd_pessoa_uk
  ON public.learning_track_destinos (track_id, person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ltd_track_idx ON public.learning_track_destinos (track_id);


-- Uma pessoa especifica abre esta trilha? Usada pela previa "ver como aluno",
-- para o cadeado aparecer la igual ao que o aluno ve de verdade.
CREATE OR REPLACE FUNCTION public.track_liberada_para(_track_id uuid, _person_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT NOT EXISTS (
           SELECT 1 FROM public.learning_track_destinos d WHERE d.track_id = _track_id
         )
      OR EXISTS (
           SELECT 1 FROM public.learning_track_destinos d
            WHERE d.track_id = _track_id
              AND (
                d.person_id = _person_id
                OR d.group_id IN (
                     SELECT gm.group_id FROM public.group_members gm
                      WHERE gm.person_id = _person_id)
              )
         );
$fn$;

-- Quem esta pedindo abre esta trilha?
--
-- SECURITY DEFINER: a resposta depende de people e group_members, que tem RLS
-- propria. Sem isso o resultado mudaria conforme o papel de quem pergunta em
-- vez de conforme o destino da trilha.
CREATE OR REPLACE FUNCTION public.track_liberada(_track_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    -- A equipe da conta abre tudo: a tranca e para o aluno.
    EXISTS (SELECT 1 FROM public.learning_tracks t
             WHERE t.id = _track_id AND t.owner_id = public.acting_account())
    OR NOT EXISTS (
         SELECT 1 FROM public.learning_track_destinos d WHERE d.track_id = _track_id)
    OR EXISTS (
         SELECT 1 FROM public.learning_track_destinos d
          WHERE d.track_id = _track_id
            AND (
              -- Enderecada a mim, pessoalmente.
              d.person_id IN (SELECT p.id FROM public.people p WHERE p.user_id = auth.uid())
              -- Ou a um grupo em que eu estou.
              OR d.group_id IN (
                   SELECT gm.group_id FROM public.group_members gm
                     JOIN public.people p ON p.id = gm.person_id
                    WHERE p.user_id = auth.uid())
              -- Ou a um grupo que eu acompanho como mentor.
              OR d.group_id IN (
                   SELECT tmg.group_id FROM public.team_member_groups tmg
                     JOIN public.team_members tm ON tm.id = tmg.team_member_id
                    WHERE tm.user_id = auth.uid() AND tm.status = 'ativo')
            )
       );
$fn$;

-- Quais trilhas eu abro, de uma vez -- o catalogo precisa da lista inteira, e
-- perguntar trilha a trilha seria uma ida ao banco por card.
CREATE OR REPLACE FUNCTION public.trilhas_liberadas(_person_id uuid DEFAULT NULL)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT t.id
    FROM public.learning_tracks t
   WHERE public.can_see_track(t.id)
     AND CASE
           WHEN _person_id IS NULL THEN public.track_liberada(t.id)
           -- Previa: so o dono da conta daquela pessoa pode perguntar pelo
           -- acesso dela. Sem esta trava, qualquer aluno leria o acesso alheio.
           WHEN EXISTS (SELECT 1 FROM public.people p
                         WHERE p.id = _person_id
                           AND p.mentor_id = public.acting_account())
             THEN public.track_liberada_para(t.id, _person_id)
           ELSE false
         END;
$fn$;

GRANT EXECUTE ON FUNCTION public.track_liberada(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trilhas_liberadas(uuid) TO authenticated;
-- track_liberada_para NAO recebe grant de proposito: perguntar pelo acesso de
-- OUTRA pessoa so pode passar por trilhas_liberadas, que confere antes se quem
-- pergunta e o dono da conta dela. Como trilhas_liberadas e SECURITY DEFINER,
-- ela mesma continua podendo chamar.
REVOKE EXECUTE ON FUNCTION public.track_liberada_para(uuid, uuid) FROM authenticated, anon;


ALTER TABLE public.learning_track_destinos ENABLE ROW LEVEL SECURITY;

-- So quem edita a trilha le os destinos. O aluno nao precisa: a resposta de
-- "eu abro isto?" vem de track_liberada, e a lista crua diria a ele quais
-- grupos existem na conta e quem esta em cada um.
DROP POLICY IF EXISTS ltd_read ON public.learning_track_destinos;
CREATE POLICY ltd_read ON public.learning_track_destinos FOR SELECT TO authenticated
  USING (public.can_edit_track(track_id));

DROP POLICY IF EXISTS ltd_write ON public.learning_track_destinos;
CREATE POLICY ltd_write ON public.learning_track_destinos FOR ALL TO authenticated
  USING (public.can_edit_track(track_id))
  WITH CHECK (public.can_edit_track(track_id));


-- A tranca de verdade: a linha da TRILHA continua legivel (e o que desenha o
-- card com cadeado), mas modulo, aula e material passam a exigir liberacao.
DROP POLICY IF EXISTS lm_read ON public.learning_modules;
CREATE POLICY lm_read ON public.learning_modules FOR SELECT TO authenticated
  USING (public.can_see_track(track_id) AND public.track_liberada(track_id));

DROP POLICY IF EXISTS ll_read ON public.learning_lessons;
CREATE POLICY ll_read ON public.learning_lessons FOR SELECT TO authenticated
  USING (public.can_see_track(track_id) AND public.track_liberada(track_id));

DROP POLICY IF EXISTS lmat_read ON public.learning_materials;
CREATE POLICY lmat_read ON public.learning_materials FOR SELECT TO authenticated
  USING (public.can_see_track(track_id) AND public.track_liberada(track_id));

-- Progresso tambem: sem isto, quem ja tinha assistido continuaria marcando
-- aula concluida numa trilha que perdeu o acesso.
DROP POLICY IF EXISTS lp_own ON public.learning_progress;
CREATE POLICY lp_own ON public.learning_progress FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.track_liberada(track_id));
