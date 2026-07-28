-- Equipe: mentores com acesso por grupo e colaboradores com permissões
-- ============================================================
-- Até aqui a plataforma tinha um dono só: toda policy era `mentor_id = auth.uid()`
-- e `mentors` era uma agenda de contatos que não dava acesso a nada.
--
-- A virada é a função `acting_account()`: ela responde "sob qual conta esta
-- pessoa está agindo". Para o dono devolve o próprio id — ou seja, **as policies
-- reescritas se comportam exatamente como antes para quem já usava o sistema**.
-- Para um convidado devolve o id do dono que o convidou.

-- ============================================================
-- 1. Tabelas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Fica nulo até a pessoa aceitar o convite e criar/entrar na conta dela.
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('mentor', 'colaborador')),
  name text NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'convidado' CHECK (status IN ('convidado', 'ativo', 'inativo')),
  invite_token uuid NOT NULL DEFAULT gen_random_uuid(),
  invite_expires_at timestamptz,
  accepted_at timestamptz,
  -- Só para colaborador. Chaves: pessoas, grupos, testes, envios, relatorios,
  -- educacao, configuracoes.
  permissions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Uma pessoa não entra duas vezes na mesma conta.
CREATE UNIQUE INDEX IF NOT EXISTS uq_team_members_owner_email
  ON public.team_members(owner_id, lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS uq_team_members_token
  ON public.team_members(invite_token);
-- Consulta quente: "sob qual conta este usuário age?"
CREATE INDEX IF NOT EXISTS idx_team_members_user_ativo
  ON public.team_members(user_id) WHERE status = 'ativo';

CREATE TABLE IF NOT EXISTS public.team_member_groups (
  team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  -- Ver dentro da plataforma é sempre permitido; baixar é opt-in.
  can_download_reports boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_member_id, group_id)
);

DROP TRIGGER IF EXISTS trg_team_members_updated ON public.team_members;
CREATE TRIGGER trg_team_members_updated BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. Funções de contexto
-- ============================================================
-- SECURITY DEFINER porque precisam ler team_members sem cair na RLS da própria
-- tabela (isso geraria recursão infinita nas policies).

CREATE OR REPLACE FUNCTION public.acting_account()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT tm.owner_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'ativo'
      ORDER BY tm.created_at LIMIT 1),
    auth.uid()
  );
$$;

-- 'owner' | 'mentor' | 'colaborador'
CREATE OR REPLACE FUNCTION public.member_kind()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT tm.kind FROM public.team_members tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'ativo'
      ORDER BY tm.created_at LIMIT 1),
    'owner'
  );
$$;

-- Grupos que o usuário atual enxerga. Dono e colaborador veem todos os da conta;
-- mentor vê só os que lhe foram atribuídos.
CREATE OR REPLACE FUNCTION public.visible_group_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT g.id FROM public.groups g
   WHERE g.mentor_id = public.acting_account()
     AND (
       public.member_kind() <> 'mentor'
       OR g.id IN (
         SELECT tmg.group_id FROM public.team_member_groups tmg
           JOIN public.team_members tm ON tm.id = tmg.team_member_id
          WHERE tm.user_id = auth.uid() AND tm.status = 'ativo'
       )
     );
$$;

-- Pessoas que o usuário atual enxerga: mentor só vê quem está nos grupos dele.
CREATE OR REPLACE FUNCTION public.can_see_person(p_person_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.member_kind() <> 'mentor'
      OR EXISTS (
        SELECT 1 FROM public.group_members gm
         WHERE gm.person_id = p_person_id
           AND gm.group_id IN (SELECT public.visible_group_ids())
      );
$$;

GRANT EXECUTE ON FUNCTION public.acting_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_kind() TO authenticated;
GRANT EXECUTE ON FUNCTION public.visible_group_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_person(uuid) TO authenticated;

-- ============================================================
-- 3. RLS das novas tabelas
-- ============================================================
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_member_groups ENABLE ROW LEVEL SECURITY;

-- Só o dono da conta administra a equipe. O convidado enxerga a própria linha
-- (a interface precisa saber quem ele é), mas não a dos colegas.
DROP POLICY IF EXISTS tm_owner_all ON public.team_members;
CREATE POLICY tm_owner_all ON public.team_members FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS tm_self_read ON public.team_members;
CREATE POLICY tm_self_read ON public.team_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS tmg_owner_all ON public.team_member_groups;
CREATE POLICY tmg_owner_all ON public.team_member_groups FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_members tm
                  WHERE tm.id = team_member_id AND tm.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.team_members tm
                       WHERE tm.id = team_member_id AND tm.owner_id = auth.uid()));

DROP POLICY IF EXISTS tmg_self_read ON public.team_member_groups;
CREATE POLICY tmg_self_read ON public.team_member_groups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_members tm
                  WHERE tm.id = team_member_id AND tm.user_id = auth.uid()));

-- ============================================================
-- 4. Policies existentes passam a valer para a conta, não para o usuário
-- ============================================================
-- Para o dono `acting_account() = auth.uid()`, então nada muda no uso atual.

-- ---------- people ----------
DROP POLICY IF EXISTS "Mentors view their own people" ON public.people;
CREATE POLICY "Mentors view their own people" ON public.people FOR SELECT TO authenticated
  USING (mentor_id = public.acting_account() AND public.can_see_person(id));

DROP POLICY IF EXISTS "Mentors insert their own people" ON public.people;
CREATE POLICY "Mentors insert their own people" ON public.people FOR INSERT TO authenticated
  WITH CHECK (mentor_id = public.acting_account());

DROP POLICY IF EXISTS "Mentors update their own people" ON public.people;
CREATE POLICY "Mentors update their own people" ON public.people FOR UPDATE TO authenticated
  USING (mentor_id = public.acting_account() AND public.can_see_person(id))
  WITH CHECK (mentor_id = public.acting_account());

DROP POLICY IF EXISTS "Mentors delete their own people" ON public.people;
CREATE POLICY "Mentors delete their own people" ON public.people FOR DELETE TO authenticated
  USING (mentor_id = public.acting_account() AND public.member_kind() <> 'mentor');

-- ---------- groups ----------
DROP POLICY IF EXISTS "Mentors view their own groups" ON public.groups;
CREATE POLICY "Mentors view their own groups" ON public.groups FOR SELECT TO authenticated
  USING (id IN (SELECT public.visible_group_ids()));

DROP POLICY IF EXISTS "Mentors insert their own groups" ON public.groups;
CREATE POLICY "Mentors insert their own groups" ON public.groups FOR INSERT TO authenticated
  WITH CHECK (mentor_id = public.acting_account() AND public.member_kind() <> 'mentor');

DROP POLICY IF EXISTS "Mentors update their own groups" ON public.groups;
CREATE POLICY "Mentors update their own groups" ON public.groups FOR UPDATE TO authenticated
  USING (mentor_id = public.acting_account() AND public.member_kind() <> 'mentor')
  WITH CHECK (mentor_id = public.acting_account());

DROP POLICY IF EXISTS "Mentors delete their own groups" ON public.groups;
CREATE POLICY "Mentors delete their own groups" ON public.groups FOR DELETE TO authenticated
  USING (mentor_id = public.acting_account() AND public.member_kind() <> 'mentor');

-- ---------- group_members ----------
DROP POLICY IF EXISTS "Mentors view members of their groups" ON public.group_members;
CREATE POLICY "Mentors view members of their groups" ON public.group_members FOR SELECT TO authenticated
  USING (group_id IN (SELECT public.visible_group_ids()));

DROP POLICY IF EXISTS "Mentors add members to their groups" ON public.group_members;
CREATE POLICY "Mentors add members to their groups" ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (group_id IN (SELECT public.visible_group_ids()) AND public.member_kind() <> 'mentor');

DROP POLICY IF EXISTS "Mentors remove members from their groups" ON public.group_members;
CREATE POLICY "Mentors remove members from their groups" ON public.group_members FOR DELETE TO authenticated
  USING (group_id IN (SELECT public.visible_group_ids()) AND public.member_kind() <> 'mentor');

-- ---------- group_instruments ----------
DROP POLICY IF EXISTS "Mentors view instruments of their groups" ON public.group_instruments;
CREATE POLICY "Mentors view instruments of their groups" ON public.group_instruments FOR SELECT TO authenticated
  USING (group_id IN (SELECT public.visible_group_ids()));

DROP POLICY IF EXISTS "Mentors add instruments to their groups" ON public.group_instruments;
CREATE POLICY "Mentors add instruments to their groups" ON public.group_instruments FOR INSERT TO authenticated
  WITH CHECK (group_id IN (SELECT public.visible_group_ids()) AND public.member_kind() <> 'mentor');

DROP POLICY IF EXISTS "Mentors remove instruments from their groups" ON public.group_instruments;
CREATE POLICY "Mentors remove instruments from their groups" ON public.group_instruments FOR DELETE TO authenticated
  USING (group_id IN (SELECT public.visible_group_ids()) AND public.member_kind() <> 'mentor');

-- ---------- test_versions ----------
DROP POLICY IF EXISTS tv_read_templates ON public.test_versions;
CREATE POLICY tv_read_templates ON public.test_versions FOR SELECT TO authenticated
  USING (is_template = true OR mentor_id = public.acting_account());

DROP POLICY IF EXISTS tv_insert_own ON public.test_versions;
CREATE POLICY tv_insert_own ON public.test_versions FOR INSERT TO authenticated
  WITH CHECK (mentor_id = public.acting_account() AND is_template = false
              AND public.member_kind() <> 'mentor');

DROP POLICY IF EXISTS tv_update_own ON public.test_versions;
CREATE POLICY tv_update_own ON public.test_versions FOR UPDATE TO authenticated
  USING (mentor_id = public.acting_account() AND public.member_kind() <> 'mentor')
  WITH CHECK (mentor_id = public.acting_account());

DROP POLICY IF EXISTS tv_delete_own ON public.test_versions;
CREATE POLICY tv_delete_own ON public.test_versions FOR DELETE TO authenticated
  USING (mentor_id = public.acting_account() AND public.member_kind() <> 'mentor');

-- ---------- helper dos testes ----------
-- Passa a considerar a conta, não o usuário: um colaborador precisa editar os
-- testes da conta em que trabalha.
CREATE OR REPLACE FUNCTION public.owns_test_version(_version_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.test_versions v
    WHERE v.id = _version_id AND v.mentor_id = public.acting_account()
  );
$$;

-- ---------- test_responses ----------
-- Mentor só enxerga resposta de quem está nos grupos dele.
DROP POLICY IF EXISTS tr_mentor_all ON public.test_responses;
CREATE POLICY tr_mentor_all ON public.test_responses FOR ALL TO authenticated
  USING (mentor_id = public.acting_account() AND public.can_see_person(person_id))
  WITH CHECK (mentor_id = public.acting_account() AND public.can_see_person(person_id));

DROP POLICY IF EXISTS ta_mentor ON public.test_answers;
CREATE POLICY ta_mentor ON public.test_answers FOR ALL TO authenticated
  USING (public.response_mentor_id(response_id) = public.acting_account())
  WITH CHECK (public.response_mentor_id(response_id) = public.acting_account());

DROP POLICY IF EXISTS "ar_all_own" ON public.assessment_responses;
CREATE POLICY "ar_all_own" ON public.assessment_responses FOR ALL TO authenticated
  USING (mentor_id = public.acting_account() AND public.can_see_person(person_id))
  WITH CHECK (mentor_id = public.acting_account() AND public.can_see_person(person_id));

DROP POLICY IF EXISTS il_all_own ON public.invite_links;
CREATE POLICY il_all_own ON public.invite_links FOR ALL TO authenticated
  USING (mentor_id = public.acting_account())
  WITH CHECK (mentor_id = public.acting_account());

-- ============================================================
-- 5. Aceitar convite
-- ============================================================
-- Roda como definer porque quem aceita ainda não tem vínculo nenhum com a conta
-- — sem isso a RLS barraria a própria linha que ele precisa atualizar.
CREATE OR REPLACE FUNCTION public.accept_team_invite(_token uuid)
RETURNS TABLE (id uuid, kind text, owner_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_row public.team_members%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'É preciso estar logado para aceitar o convite.';
  END IF;

  SELECT tm.* INTO v_row FROM public.team_members tm WHERE tm.invite_token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;
  IF v_row.invite_expires_at IS NOT NULL AND v_row.invite_expires_at < now() THEN
    RAISE EXCEPTION 'Este convite expirou. Peça um novo.';
  END IF;
  IF v_row.status = 'inativo' THEN
    RAISE EXCEPTION 'Este convite foi desativado.';
  END IF;
  -- Já aceito por outra pessoa: não deixa trocar o dono do vínculo.
  IF v_row.user_id IS NOT NULL AND v_row.user_id <> v_uid THEN
    RAISE EXCEPTION 'Este convite já foi usado.';
  END IF;

  -- O convite é nominal: vale para o email convidado, não para quem receber o link.
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
  IF lower(COALESCE(v_email, '')) <> lower(v_row.email) THEN
    RAISE EXCEPTION 'Este convite foi enviado para %. Entre com esse email para aceitar.', v_row.email;
  END IF;

  UPDATE public.team_members tm
     SET user_id = v_uid, status = 'ativo', accepted_at = COALESCE(tm.accepted_at, now())
   WHERE tm.id = v_row.id;

  RETURN QUERY SELECT v_row.id, v_row.kind, v_row.owner_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_team_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_team_invite(uuid) TO authenticated;
