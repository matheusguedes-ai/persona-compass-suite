-- #300 (entrega 1): o link aberto para de barrar e de duplicar.
--
-- Puramente aditiva (regra 5): uma tabela nova e uma função nova. Nada que o
-- código publicado usa muda de nome ou de regra.

-- ---------------------------------------------------------------------------
-- 1. Suspeita de duplicidade
--
-- Quando alguém entra pelo link com e-mail NOVO, mas com telefone igual ou
-- nome muito parecido com uma pessoa que já existe na mesma conta, a tela
-- pergunta à própria pessoa se ela já tem cadastro. Se ela disser que não, o
-- cadastro novo nasce — e a suspeita fica registrada aqui para o MENTOR
-- decidir (unificar ou descartar). A plataforma nunca funde sozinha.
--
-- Dono: `mentor_id` (a conta). Quem enxerga: dono e colaborador da conta —
-- não o mentor convidado, que só vê os grupos atribuídos a ele, e a
-- suspeita envolve pessoas da conta toda. Escrita só pelo servidor (service
-- role), depois das checagens de permissão feitas em código.
CREATE TABLE public.suspeitas_duplicidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL,
  pessoa_nova_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  pessoa_existente_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  motivo text NOT NULL CHECK (motivo IN ('telefone', 'nome', 'telefone_e_nome')),
  origem text NOT NULL DEFAULT 'link_aberto' CHECK (origem IN ('link_aberto')),
  invite_link_id uuid REFERENCES public.invite_links(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'unificada', 'descartada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolvida_em timestamptz,
  resolvida_por uuid,
  CONSTRAINT suspeita_par_unico UNIQUE (pessoa_nova_id, pessoa_existente_id),
  CONSTRAINT suspeita_pessoas_distintas CHECK (pessoa_nova_id <> pessoa_existente_id)
);

CREATE INDEX suspeitas_duplicidade_mentor_status ON public.suspeitas_duplicidade (mentor_id, status);

ALTER TABLE public.suspeitas_duplicidade ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.suspeitas_duplicidade TO authenticated;
GRANT ALL ON public.suspeitas_duplicidade TO service_role;

CREATE POLICY suspeitas_leitura_da_conta ON public.suspeitas_duplicidade
  FOR SELECT TO authenticated
  USING (mentor_id = public.acting_account() AND public.member_kind() <> 'mentor');

-- ---------------------------------------------------------------------------
-- 2. Devolver a vaga do link
--
-- `claim_invite_link` reserva a vaga ANTES de criar o cadastro. Quando o
-- cadastro falhava depois disso (o e-mail já existia — a falha A da aula de
-- 22/09), a vaga ficava gasta sem resposta nenhuma: o link de 12 vagas da
-- aula lotou em parte por tentativas que deram erro. O código novo só
-- reserva depois de reconhecer a pessoa; esta função cobre o que ainda pode
-- falhar entre a reserva e o cadastro (corrida, erro de banco).
CREATE OR REPLACE FUNCTION public.release_invite_link(link_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  UPDATE public.invite_links
     SET response_count = response_count - 1
   WHERE id = link_id
     AND response_count > 0;
$fn$;

-- Só o service role chama (endpoint público), igual a claim_invite_link.
REVOKE ALL ON FUNCTION public.release_invite_link(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_invite_link(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_invite_link(uuid) TO service_role;
