-- Validade de link + link aberto com limite de respostas
-- ============================================================

-- 1) Validade nos links existentes (um por pessoa).
--    NULL = sem prazo, comportamento de antes.
ALTER TABLE public.test_responses
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.assessment_responses
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 2) Link aberto: UM link que várias pessoas podem responder.
--    Quem abre se identifica (nome + email) e o sistema cria a pessoa.
CREATE TABLE IF NOT EXISTS public.invite_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL,
  title text,
  -- versões de teste que o respondente vai fazer (>1 = bateria)
  version_ids uuid[] NOT NULL,
  -- opcional: já adiciona quem responder a este grupo
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  expires_at timestamptz,
  -- NULL = sem limite
  max_responses integer CHECK (max_responses IS NULL OR max_responses > 0),
  response_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invite_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS il_all_own ON public.invite_links;
CREATE POLICY il_all_own ON public.invite_links
  FOR ALL TO authenticated
  USING (mentor_id = auth.uid())
  WITH CHECK (mentor_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_invite_links_mentor ON public.invite_links(mentor_id);

-- 3) Rastro da origem: de qual link aberto a pessoa/resposta veio.
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS invite_link_id uuid REFERENCES public.invite_links(id) ON DELETE SET NULL;

-- 4) Reserva de vaga atômica.
--    Faz a checagem (ativo / no prazo / com vaga) e o incremento num único
--    UPDATE, então duas pessoas clicando ao mesmo tempo não estouram o limite.
--    Devolve a linha quando reservou; nada quando o link não aceita mais.
--    Devolve SETOF (e não o tipo composto) de propósito: sem vaga o retorno é
--    um conjunto VAZIO. Com o tipo composto o Postgres devolveria uma linha de
--    nulos, que o chamador confundiria com sucesso.
DROP FUNCTION IF EXISTS public.claim_invite_link(uuid);
CREATE FUNCTION public.claim_invite_link(link_id uuid)
RETURNS SETOF public.invite_links
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.invite_links
  SET response_count = response_count + 1
  WHERE id = link_id
    AND is_active
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_responses IS NULL OR response_count < max_responses)
  RETURNING *;
$$;

-- Só o service role chama (endpoint público). Sem GRANT para authenticated/anon.
REVOKE ALL ON FUNCTION public.claim_invite_link(uuid) FROM PUBLIC;
