-- Eventos criados pelo master, direcionados a pessoas ou grupos.
--
-- Etapa 3 de `docs/plano-menu-gestao.md`. A devolutiva já preenche a agenda com
-- o que é da plataforma; isto é para o que não é: uma live, um prazo de turma,
-- um encontro presencial.
--
-- DESTINO É N-PARA-N, e cada linha aponta para UM grupo OU UMA pessoa.
--
-- Guardar `group_id` na própria linha do evento obrigaria a duplicar o evento
-- para mandá-lo a três turmas — três títulos para editar, três para apagar, e
-- a certeza de que um dia sobra um. Mesma razão pela qual a publicação da
-- comunidade virou `community_post_groups`.

CREATE TABLE IF NOT EXISTS public.eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL,
  titulo text NOT NULL,
  descricao text,
  quando timestamptz NOT NULL,
  duracao_min integer,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eventos_conta_quando_idx ON public.eventos (conta_id, quando);

CREATE TABLE IF NOT EXISTS public.evento_destinos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.people(id) ON DELETE CASCADE,
  -- Um destino é um grupo ou uma pessoa, nunca os dois nem nenhum. Sem esta
  -- trava, uma linha vazia viraria evento sem público — invisível para todos,
  -- inclusive para quem o criou, e sem sintoma nenhum.
  CONSTRAINT destino_e_um_ou_outro CHECK ((group_id IS NULL) <> (person_id IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS evento_destino_grupo_uk
  ON public.evento_destinos (evento_id, group_id) WHERE group_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS evento_destino_pessoa_uk
  ON public.evento_destinos (evento_id, person_id) WHERE person_id IS NOT NULL;


-- Quem enxerga um evento.
--
-- SECURITY DEFINER porque a resposta depende de `people`, `group_members` e
-- `team_member_groups` — tabelas com RLS própria. Sem isso, a policy dependeria
-- de o usuário poder ler cada uma delas, e o resultado mudaria conforme o papel
-- de quem pergunta em vez de conforme o destino do evento.
CREATE OR REPLACE FUNCTION public.posso_ver_evento(p_evento uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    -- O dono da conta: o evento é dele.
    EXISTS (SELECT 1 FROM public.eventos e
             WHERE e.id = p_evento AND e.conta_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.evento_destinos d
       WHERE d.evento_id = p_evento
         AND (
           -- Endereçado a mim, pessoalmente.
           d.person_id IN (SELECT p.id FROM public.people p WHERE p.user_id = auth.uid())
           -- Ou a um grupo em que eu participo.
           OR d.group_id IN (
                SELECT gm.group_id FROM public.group_members gm
                  JOIN public.people p ON p.id = gm.person_id
                 WHERE p.user_id = auth.uid())
           -- Ou a um grupo que eu acompanho como mentor.
           OR d.group_id IN (
                SELECT tmg.group_id FROM public.team_member_groups tmg
                  JOIN public.team_members tm ON tm.id = tmg.team_member_id
                 WHERE tm.user_id = auth.uid() AND tm.status = 'ativo')
         ));
$fn$;

GRANT EXECUTE ON FUNCTION public.posso_ver_evento(uuid) TO authenticated;


ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento_destinos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eventos_read ON public.eventos;
CREATE POLICY eventos_read ON public.eventos FOR SELECT TO authenticated
  USING (public.posso_ver_evento(id));

-- Criar, editar e apagar é só do dono da conta. Mentor não cria evento para os
-- grupos dele: o Matheus definiu que quem publica novidade é o master.
DROP POLICY IF EXISTS eventos_write ON public.eventos;
CREATE POLICY eventos_write ON public.eventos FOR ALL TO authenticated
  USING (conta_id = auth.uid()) WITH CHECK (conta_id = auth.uid());

DROP POLICY IF EXISTS ed_read ON public.evento_destinos;
CREATE POLICY ed_read ON public.evento_destinos FOR SELECT TO authenticated
  USING (public.posso_ver_evento(evento_id));

DROP POLICY IF EXISTS ed_write ON public.evento_destinos;
CREATE POLICY ed_write ON public.evento_destinos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.eventos e
                  WHERE e.id = evento_id AND e.conta_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.eventos e
                       WHERE e.id = evento_id AND e.conta_id = auth.uid()));
