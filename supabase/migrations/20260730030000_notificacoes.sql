-- Notificações.
--
-- As três regras do Matheus, e o que cada uma implica:
--
--   MASTER (dono)  — tudo que acontece na conta: aluno, mentor, colaborador.
--   MENTOR         — tudo que o master publicar de novo, mais tudo dos grupos
--                    que ELE mentora (comunidade, devolutivas, os alunos dele).
--   ALUNO          — só o que é sobre ele mesmo, mais a comunidade dos grupos
--                    em que está.
--
-- UMA LINHA POR DESTINATÁRIO, não uma linha por evento.
--
-- A alternativa seria guardar o evento uma vez e calcular quem vê pela RLS.
-- Fica elegante e quebra no "lida": lida é por pessoa, então precisaria de uma
-- segunda tabela de leituras e de um LEFT JOIN em toda listagem. Com uma linha
-- por destinatário, a RLS é `user_id = auth.uid()` e "lida" é uma coluna. O
-- custo é duplicar texto — irrelevante nesta escala, e barato de podar depois.

CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conta_id uuid NOT NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  corpo text,
  link text,
  ator_nome text,
  lida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- A listagem é sempre "minhas, mais recentes primeiro"; o contador é sempre
-- "minhas não lidas". Um índice para cada.
CREATE INDEX IF NOT EXISTS notif_minhas_idx
  ON public.notificacoes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notif_nao_lidas_idx
  ON public.notificacoes (user_id) WHERE lida_em IS NULL;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Só a própria pessoa lê. Não há policy de INSERT para `authenticated`: quem
-- escreve é a função abaixo, SECURITY DEFINER. Se a inserção fosse livre,
-- qualquer um poderia plantar notificação no sino de outra pessoa.
DROP POLICY IF EXISTS notif_read ON public.notificacoes;
CREATE POLICY notif_read ON public.notificacoes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Marcar como lida é a única escrita permitida, e só nas próprias.
DROP POLICY IF EXISTS notif_update ON public.notificacoes;
CREATE POLICY notif_update ON public.notificacoes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notif_delete ON public.notificacoes;
CREATE POLICY notif_delete ON public.notificacoes FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- O leque: dado um evento, quem fica sabendo.
--
-- `p_grupos`      — grupos afetados. NULL = a conta inteira.
-- `p_pessoa_user` — o aluno de quem o evento trata (ele sempre recebe).
-- `p_para_alunos` — se os alunos DAQUELES grupos também recebem. Comunidade
--                   sim; "fulano respondeu o teste" não, senão o aluno ficaria
--                   sabendo da vida dos colegas.
-- `p_ator`        — quem fez. Nunca recebe: ninguém precisa ser avisado do que
--                   acabou de fazer.
CREATE OR REPLACE FUNCTION public.notificar(
  p_conta uuid,
  p_tipo text,
  p_titulo text,
  p_corpo text DEFAULT NULL,
  p_link text DEFAULT NULL,
  p_ator uuid DEFAULT NULL,
  p_ator_nome text DEFAULT NULL,
  p_grupos uuid[] DEFAULT NULL,
  p_pessoa_user uuid DEFAULT NULL,
  p_para_alunos boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_destinos uuid[];
BEGIN
  SELECT array_agg(DISTINCT u) INTO v_destinos FROM (
    -- 1. O MASTER vê tudo que acontece na conta dele.
    SELECT p_conta AS u

    UNION
    -- 2. MENTORES. Duas portas: o grupo é dele, ou é novidade do master
    --    (`p_grupos IS NULL` = anúncio da conta inteira).
    SELECT tm.user_id
      FROM public.team_members tm
      LEFT JOIN public.team_member_groups tmg ON tmg.team_member_id = tm.id
     WHERE tm.owner_id = p_conta
       AND tm.status = 'ativo'
       AND tm.kind IN ('mentor', 'colaborador')
       AND tm.user_id IS NOT NULL
       AND (p_grupos IS NULL OR tmg.group_id = ANY(p_grupos))

    UNION
    -- 3. O ALUNO DE QUEM O EVENTO TRATA. Sempre, mesmo fora de grupo: é sobre
    --    ele. É o "referente a ele mesmo" da regra.
    SELECT p_pessoa_user WHERE p_pessoa_user IS NOT NULL

    UNION
    -- 4. OS DEMAIS ALUNOS dos grupos, só quando o evento é de comunidade.
    SELECT pe.user_id
      FROM public.people pe
      JOIN public.group_members gm ON gm.person_id = pe.id
     WHERE p_para_alunos
       AND p_grupos IS NOT NULL
       AND gm.group_id = ANY(p_grupos)
       AND pe.user_id IS NOT NULL
  ) alvos(u)
  WHERE u IS NOT NULL AND u IS DISTINCT FROM p_ator;

  IF v_destinos IS NULL OR array_length(v_destinos, 1) IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.notificacoes (user_id, conta_id, tipo, titulo, corpo, link, ator_nome)
  SELECT d, p_conta, p_tipo, p_titulo, p_corpo, p_link, p_ator_nome
    FROM unnest(v_destinos) AS d;

  RETURN array_length(v_destinos, 1);
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.notificar(
  uuid, text, text, text, text, uuid, text, uuid[], uuid, boolean
) TO authenticated;
