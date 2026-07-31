-- Menu Mentorias — Fatia 1. Substitui Devolutivas.
--
-- Devolutiva era feature de plataforma de teste (nasce de uma resposta).
-- Mentoria é feature de hub: pacote de sessões criado livremente, sem
-- depender de teste nenhum. Especificação completa em docs/plano-mentorias.md.
--
-- A tabela `devolutivas` tem 1 registro (conferido em 31/07) — sem histórico
-- a preservar. Ela é apagada no fim deste arquivo.

-- ============================================================
-- 1. As três tabelas — todas nascem com dono (mentor_id)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mentorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  titulo text,
  sessoes_contratadas integer NOT NULL DEFAULT 1 CHECK (sessoes_contratadas > 0),
  observacoes text,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'encerrada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mentorias_mentor_idx ON public.mentorias (mentor_id, status);
CREATE INDEX IF NOT EXISTS mentorias_person_idx ON public.mentorias (person_id);

DROP TRIGGER IF EXISTS mentorias_set_updated_at ON public.mentorias;
CREATE TRIGGER mentorias_set_updated_at
  BEFORE UPDATE ON public.mentorias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.mentoria_sessoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentoria_id uuid NOT NULL REFERENCES public.mentorias(id) ON DELETE CASCADE,
  -- Redundante de propósito (a mentoria já tem mentor_id): simplifica a RLS,
  -- mesmo padrão de `mentoria_sessoes` espelhando `devolutivas`/`eventos`.
  mentor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quando timestamptz NOT NULL,
  termina_em timestamptz,
  modalidade text NOT NULL CHECK (modalidade IN ('presencial', 'online')),
  local text,
  link_url text,
  status text NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada', 'concluida', 'cancelada')),
  -- O professor informa ao concluir; alimenta a média (Fatia 3, mais tarde).
  duracao_real_min integer CHECK (duracao_real_min IS NULL OR duracao_real_min BETWEEN 1 AND 600),
  resumo text,
  -- Nome do checklist inteiro, se o professor quiser dar um. Cada item tem o
  -- próprio texto em `mentoria_tarefas.titulo` — uma tabela a menos.
  checklist_titulo text,
  concluida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mentoria_sessoes_mentoria_idx ON public.mentoria_sessoes (mentoria_id);
CREATE INDEX IF NOT EXISTS mentoria_sessoes_mentor_idx ON public.mentoria_sessoes (mentor_id, status);
CREATE INDEX IF NOT EXISTS mentoria_sessoes_quando_idx ON public.mentoria_sessoes (quando);

DROP TRIGGER IF EXISTS mentoria_sessoes_set_updated_at ON public.mentoria_sessoes;
CREATE TRIGGER mentoria_sessoes_set_updated_at
  BEFORE UPDATE ON public.mentoria_sessoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.mentoria_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid NOT NULL REFERENCES public.mentoria_sessoes(id) ON DELETE CASCADE,
  mentor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  -- Só o ALUNO marca. O professor nunca tem policy de UPDATE nesta tabela —
  -- ver a seção de RLS abaixo e `marcar_tarefa_mentoria()`.
  concluida boolean NOT NULL DEFAULT false,
  concluida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mentoria_tarefas_sessao_idx ON public.mentoria_tarefas (sessao_id);

ALTER TABLE public.mentorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentoria_sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentoria_tarefas ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Mentor convidado: mesma trava que já existia para devolutiva,
--    renomeada. Dono sempre pode; mentor só se o dono ligou a chave
--    NESTE grupo em comum com a pessoa.
-- ============================================================

ALTER TABLE public.team_member_groups
  RENAME COLUMN can_schedule_devolutivas TO can_schedule_mentorias;

CREATE OR REPLACE FUNCTION public.posso_agendar_mentoria(p_person_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    public.member_kind() <> 'mentor'
    OR EXISTS (
      SELECT 1
        FROM public.group_members gm
        JOIN public.team_member_groups tmg ON tmg.group_id = gm.group_id
        JOIN public.team_members tm ON tm.id = tmg.team_member_id
       WHERE gm.person_id = p_person_id
         AND tm.user_id = auth.uid()
         AND tmg.can_schedule_mentorias
    );
$fn$;

GRANT EXECUTE ON FUNCTION public.posso_agendar_mentoria(uuid) TO authenticated;

-- A função antiga só é apagada no fim (seção 10): enquanto a tabela
-- `devolutivas` existir, as policies dela (devolutivas_insert/update)
-- ainda dependem de posso_agendar_devolutiva, e o DROP FUNCTION falha
-- sem CASCADE. Descoberto rodando este bloco de verdade (31/07).

-- ============================================================
-- 3. Área do painel do aluno: 'devolutivas' vira 'mentorias'
-- ============================================================

-- Renomeia primeiro os dados existentes — senão o ALTER CHECK abaixo
-- rejeitaria qualquer grupo que já tivesse 'devolutivas' marcado.
UPDATE public.groups
   SET areas_aluno = array_replace(areas_aluno, 'devolutivas', 'mentorias')
 WHERE areas_aluno @> ARRAY['devolutivas']::text[];

ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_areas_conhecidas;
ALTER TABLE public.groups ADD CONSTRAINT groups_areas_conhecidas CHECK (
  areas_aluno IS NULL
  OR areas_aluno <@ ARRAY['resultados','comunidade','mentorias','agenda','academy','classroom']::text[]
);

CREATE OR REPLACE FUNCTION public.areas_da_pessoa(p_person_id uuid)
RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT a FROM unnest(ARRAY['resultados','comunidade','mentorias','agenda','academy','classroom']) a
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

CREATE OR REPLACE FUNCTION public.minhas_areas()
RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT a FROM unnest(ARRAY['resultados','comunidade','mentorias','agenda','academy','classroom']) a
   WHERE public.aluno_pode(a);
$fn$;

-- ============================================================
-- 4. RLS — mentorias (o pacote)
-- ============================================================

DROP POLICY IF EXISTS mentorias_read ON public.mentorias;
CREATE POLICY mentorias_read ON public.mentorias FOR SELECT TO authenticated
  USING (
    (mentor_id = public.acting_account() AND public.can_see_person(person_id))
    OR (person_id IN (SELECT public.my_person_ids()) AND public.aluno_pode('mentorias'))
  );

DROP POLICY IF EXISTS mentorias_insert ON public.mentorias;
CREATE POLICY mentorias_insert ON public.mentorias FOR INSERT TO authenticated
  WITH CHECK (
    mentor_id = public.acting_account()
    AND public.can_see_person(person_id)
    AND public.posso_agendar_mentoria(person_id)
  );

DROP POLICY IF EXISTS mentorias_update ON public.mentorias;
CREATE POLICY mentorias_update ON public.mentorias FOR UPDATE TO authenticated
  USING (
    mentor_id = public.acting_account()
    AND public.can_see_person(person_id)
    AND public.posso_agendar_mentoria(person_id)
  )
  WITH CHECK (mentor_id = public.acting_account());

DROP POLICY IF EXISTS mentorias_delete ON public.mentorias;
CREATE POLICY mentorias_delete ON public.mentorias FOR DELETE TO authenticated
  USING (
    mentor_id = public.acting_account()
    AND public.can_see_person(person_id)
    AND public.posso_agendar_mentoria(person_id)
  );

-- ============================================================
-- 5. RLS — mentoria_sessoes (cada encontro)
--
-- O aluno NÃO tem policy de UPDATE aqui — por desenho. É o que garante,
-- no banco e não só na tela, que ele nunca marca concluída nem edita o
-- resumo, nem colando a rota.
-- ============================================================

DROP POLICY IF EXISTS mentoria_sessoes_read ON public.mentoria_sessoes;
CREATE POLICY mentoria_sessoes_read ON public.mentoria_sessoes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mentorias m
       WHERE m.id = mentoria_sessoes.mentoria_id
         AND (
           (m.mentor_id = public.acting_account() AND public.can_see_person(m.person_id))
           OR (m.person_id IN (SELECT public.my_person_ids()) AND public.aluno_pode('mentorias'))
         )
    )
  );

DROP POLICY IF EXISTS mentoria_sessoes_insert ON public.mentoria_sessoes;
CREATE POLICY mentoria_sessoes_insert ON public.mentoria_sessoes FOR INSERT TO authenticated
  WITH CHECK (
    mentor_id = public.acting_account()
    AND EXISTS (
      SELECT 1 FROM public.mentorias m
       WHERE m.id = mentoria_sessoes.mentoria_id
         AND m.mentor_id = public.acting_account()
         AND public.can_see_person(m.person_id)
         AND public.posso_agendar_mentoria(m.person_id)
    )
  );

DROP POLICY IF EXISTS mentoria_sessoes_update ON public.mentoria_sessoes;
CREATE POLICY mentoria_sessoes_update ON public.mentoria_sessoes FOR UPDATE TO authenticated
  USING (
    mentor_id = public.acting_account()
    AND EXISTS (
      SELECT 1 FROM public.mentorias m
       WHERE m.id = mentoria_sessoes.mentoria_id
         AND m.mentor_id = public.acting_account()
         AND public.can_see_person(m.person_id)
         AND public.posso_agendar_mentoria(m.person_id)
    )
  )
  WITH CHECK (mentor_id = public.acting_account());

DROP POLICY IF EXISTS mentoria_sessoes_delete ON public.mentoria_sessoes;
CREATE POLICY mentoria_sessoes_delete ON public.mentoria_sessoes FOR DELETE TO authenticated
  USING (
    mentor_id = public.acting_account()
    AND EXISTS (
      SELECT 1 FROM public.mentorias m
       WHERE m.id = mentoria_sessoes.mentoria_id
         AND m.mentor_id = public.acting_account()
         AND public.can_see_person(m.person_id)
         AND public.posso_agendar_mentoria(m.person_id)
    )
  );

-- ============================================================
-- 6. RLS — mentoria_tarefas (o checklist)
--
-- De propósito, SEM policy de UPDATE para ninguém: o professor só INSERE
-- (ao concluir a sessão) e o aluno só marca via `marcar_tarefa_mentoria()`,
-- uma função SECURITY DEFINER que mexe SÓ em `concluida`/`concluida_em` —
-- mesmo padrão de `update_my_person`. Column-level RLS não existe no
-- Postgres; a função estreita é como o resto do projeto já resolve isto.
-- ============================================================

DROP POLICY IF EXISTS mentoria_tarefas_read ON public.mentoria_tarefas;
CREATE POLICY mentoria_tarefas_read ON public.mentoria_tarefas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mentoria_sessoes s
        JOIN public.mentorias m ON m.id = s.mentoria_id
       WHERE s.id = mentoria_tarefas.sessao_id
         AND (
           (m.mentor_id = public.acting_account() AND public.can_see_person(m.person_id))
           OR (m.person_id IN (SELECT public.my_person_ids()) AND public.aluno_pode('mentorias'))
         )
    )
  );

DROP POLICY IF EXISTS mentoria_tarefas_insert ON public.mentoria_tarefas;
CREATE POLICY mentoria_tarefas_insert ON public.mentoria_tarefas FOR INSERT TO authenticated
  WITH CHECK (
    mentor_id = public.acting_account()
    AND EXISTS (
      SELECT 1 FROM public.mentoria_sessoes s
        JOIN public.mentorias m ON m.id = s.mentoria_id
       WHERE s.id = mentoria_tarefas.sessao_id
         AND m.mentor_id = public.acting_account()
         AND public.can_see_person(m.person_id)
         AND public.posso_agendar_mentoria(m.person_id)
    )
  );

DROP POLICY IF EXISTS mentoria_tarefas_delete ON public.mentoria_tarefas;
CREATE POLICY mentoria_tarefas_delete ON public.mentoria_tarefas FOR DELETE TO authenticated
  USING (
    mentor_id = public.acting_account()
    AND EXISTS (
      SELECT 1 FROM public.mentoria_sessoes s
        JOIN public.mentorias m ON m.id = s.mentoria_id
       WHERE s.id = mentoria_tarefas.sessao_id
         AND m.mentor_id = public.acting_account()
         AND public.can_see_person(m.person_id)
         AND public.posso_agendar_mentoria(m.person_id)
    )
  );

/**
 * Marca (ou desmarca) um item do checklist. SÓ O ALUNO chama isto.
 *
 * SECURITY DEFINER porque não existe RLS por coluna: sem isto, dar ao aluno
 * uma policy de UPDATE aberta na tabela deixaria ele reescrever o título do
 * item também. A ownership é conferida aqui dentro, explicitamente.
 */
CREATE OR REPLACE FUNCTION public.marcar_tarefa_mentoria(_tarefa_id uuid, _concluida boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  UPDATE public.mentoria_tarefas t
     SET concluida = _concluida,
         concluida_em = CASE WHEN _concluida THEN now() ELSE NULL END
   WHERE t.id = _tarefa_id
     AND EXISTS (
       SELECT 1 FROM public.mentoria_sessoes s
         JOIN public.mentorias m ON m.id = s.mentoria_id
        WHERE s.id = t.sessao_id
          AND m.person_id IN (SELECT public.my_person_ids())
     );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item não encontrado ou você não pode marcá-lo.';
  END IF;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.marcar_tarefa_mentoria(uuid, boolean) TO authenticated;

-- ============================================================
-- 7. Pontos: 'devolutiva' vira 'mentoria' (mesmo valor, rótulo atualizado
--    no código).
--
-- Ordem importa AQUI, ao contrário do passo 3: 'devolutivas' em
-- groups.areas_aluno não tinha nenhum grupo usando o valor, então renomear
-- antes ou depois do ALTER dava no mesmo. Aqui há uma linha real em
-- google_eventos com origem='devolutiva' — renomear ANTES do DROP CONSTRAINT
-- viola a constraint ainda ativa (só aceita 'devolutiva'/'evento'), e
-- renomear DEPOIS do ADD CONSTRAINT viola a nova (só aceita
-- 'mentoria'/'evento', e a linha ainda diz 'devolutiva' nesse instante).
-- A ordem sem essa armadilha: derruba a constraint (fica sem checagem por
-- um instante) → renomeia o dado → recria a constraint já validando o
-- dado já renomeado. Descoberto rodando isto de verdade (31/07).
-- ============================================================

ALTER TABLE public.pontos DROP CONSTRAINT IF EXISTS pontos_acao_check;
UPDATE public.pontos SET acao = 'mentoria' WHERE acao = 'devolutiva';
ALTER TABLE public.pontos ADD CONSTRAINT pontos_acao_check
  CHECK (acao IN ('aula', 'mentoria', 'publicar', 'perfil', 'comentar', 'curtir', 'presenca'));

-- Mesmo motivo: a sincronização com o Google Calendar guarda a origem do
-- evento ('devolutiva' ou 'evento') para saber qual atualizar/apagar depois.
ALTER TABLE public.google_eventos DROP CONSTRAINT IF EXISTS google_eventos_origem_check;
UPDATE public.google_eventos SET origem = 'mentoria' WHERE origem = 'devolutiva';
ALTER TABLE public.google_eventos ADD CONSTRAINT google_eventos_origem_check
  CHECK (origem IN ('mentoria', 'evento'));

-- ============================================================
-- 8. Permissão de colaborador: 'devolutivas' vira 'mentorias'.
--    Quem já tinha a antiga migra automaticamente.
-- ============================================================

UPDATE public.team_members
   SET permissions = array_replace(permissions, 'devolutivas', 'mentorias')
 WHERE 'devolutivas' = ANY(permissions);

-- ============================================================
-- 9. Aviso da véspera (o sino): o bloco de devolutiva lia a tabela que
--    este arquivo apaga. Sem isto, `avisos_da_vespera()` quebraria na
--    próxima vez que alguém abrisse o sino — ver 20260730330000.
-- ============================================================

DROP INDEX IF EXISTS public.notif_vespera_unica;
CREATE UNIQUE INDEX IF NOT EXISTS notif_vespera_unica
  ON public.notificacoes (user_id, tipo, link)
  WHERE tipo IN ('vespera_aula', 'vespera_mentoria');

CREATE OR REPLACE FUNCTION public.avisos_da_vespera()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_n integer := 0;
  v_criados integer;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;

  -- ---- Aulas presenciais das próximas 24h (inalterado) ----
  INSERT INTO public.notificacoes (user_id, conta_id, tipo, titulo, corpo, link)
  SELECT DISTINCT
         v_uid,
         t.mentor_id,
         'vespera_aula',
         'Amanha: ' || a.titulo,
         to_char(a.comeca_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "as" HH24:MI')
           || COALESCE(' · ' || a.local, ''),
         '/aluno/classroom/' || t.id
    FROM public.treinamento_aulas a
    JOIN public.treinamento_modulos m ON m.id = a.modulo_id
    JOIN public.treinamentos t        ON t.id = m.treinamento_id
    JOIN public.treinamento_grupos tg ON tg.treinamento_id = t.id
    JOIN public.group_members gm      ON gm.group_id = tg.group_id
    JOIN public.people pe             ON pe.id = gm.person_id AND pe.user_id = v_uid
   WHERE a.comeca_em IS NOT NULL
     AND NOT a.cancelada
     AND a.fechada_em IS NULL
     AND a.comeca_em > now()
     AND a.comeca_em <= now() + interval '24 hours'
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_criados = ROW_COUNT;
  v_n := v_n + v_criados;

  -- ---- Sessões de mentoria agendadas das próximas 24h ----
  --
  -- Os DOIS lados recebem: quem conduz e quem vai ser atendido. Mesma regra
  -- de sempre, só trocando `devolutivas` por `mentoria_sessoes`/`mentorias`.
  INSERT INTO public.notificacoes (user_id, conta_id, tipo, titulo, corpo, link)
  SELECT DISTINCT
         v_uid,
         s.mentor_id,
         'vespera_mentoria',
         'Amanha: mentoria com ' || COALESCE(pe.full_name, 'seu professor'),
         to_char(s.quando AT TIME ZONE 'America/Sao_Paulo', 'DD/MM "as" HH24:MI'),
         '/mentorias'
    FROM public.mentoria_sessoes s
    JOIN public.mentorias m    ON m.id = s.mentoria_id
    LEFT JOIN public.people pe ON pe.id = m.person_id
   WHERE s.status = 'agendada'
     AND s.quando > now()
     AND s.quando <= now() + interval '24 hours'
     AND (s.mentor_id = v_uid OR pe.user_id = v_uid)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_criados = ROW_COUNT;
  v_n := v_n + v_criados;

  RETURN v_n;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.avisos_da_vespera() TO authenticated;

-- ============================================================
-- 10. Sai o antigo. A tabela tem 1 registro e não há histórico a
--     preservar (decisão do Matheus, 31/07 — ver docs/plano-mentorias.md).
--
-- Nesta ordem: primeiro a tabela (CASCADE já derruba devolutivas_insert e
-- devolutivas_update, as duas policies que seguravam a função antiga), só
-- depois a função — sem CASCADE nela, porque a esta altura já não há
-- mais nada dependendo.
-- ============================================================

DROP TABLE IF EXISTS public.devolutivas CASCADE;

DROP FUNCTION IF EXISTS public.posso_agendar_devolutiva(uuid);
