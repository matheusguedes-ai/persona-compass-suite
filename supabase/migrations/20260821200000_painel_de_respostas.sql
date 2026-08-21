-- #212 Fase 4, Fatia 2 — painel de respostas.
--
-- Não cria tabela nova: o painel é leitura agregada de test_responses/
-- test_answers, que já existem. A única mudança de banco de verdade é a
-- proteção do anonimato — e essa PRECISA ser trava de RLS, não só checagem
-- na função de servidor, senão "não dá pra ver pela tela" vira "dá pra ver
-- direto pela API" (mesmo raciocínio do `ja_votei_na_enquete`, #54).

-- Teste identificado: sempre pode. Teste anônimo: só com 3+ respostas
-- SUBMETIDAS na mesma versão — pendente/em andamento não conta, porque ainda
-- não existe test_answers pra essa linha mesmo.
CREATE OR REPLACE FUNCTION public.pode_ver_conteudo_resposta(_response_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT CASE WHEN v.is_anonymous THEN (
    SELECT count(*) >= 3 FROM public.test_responses r2
     WHERE r2.version_id = v.id AND r2.submitted_at IS NOT NULL
  ) ELSE true END
  FROM public.test_responses r
  JOIN public.test_versions v ON v.id = r.version_id
  WHERE r.id = _response_id;
$fn$;

GRANT EXECUTE ON FUNCTION public.pode_ver_conteudo_resposta(uuid) TO authenticated;

-- `ta_mentor` era FOR ALL com só a checagem de dono — cobria SELECT também,
-- então uma policy nova só de leitura mais restrita não adiantaria nada
-- (Postgres faz OR entre policies permissivas: a antiga, sem a trava,
-- continuaria liberando geral). Troca por quatro policies por comando: as
-- três de escrita ficam exatamente como estavam (dono, sem trava — hoje
-- nem são exercidas por aqui, quem grava é o endpoint público com service
-- role); só a de leitura ganha a condição de anonimato.
DROP POLICY IF EXISTS ta_mentor ON public.test_answers;

CREATE POLICY ta_insert ON public.test_answers FOR INSERT TO authenticated
  WITH CHECK (public.response_mentor_id(response_id) = public.acting_account());

CREATE POLICY ta_update ON public.test_answers FOR UPDATE TO authenticated
  USING (public.response_mentor_id(response_id) = public.acting_account())
  WITH CHECK (public.response_mentor_id(response_id) = public.acting_account());

CREATE POLICY ta_delete ON public.test_answers FOR DELETE TO authenticated
  USING (public.response_mentor_id(response_id) = public.acting_account());

CREATE POLICY ta_read ON public.test_answers FOR SELECT TO authenticated
  USING (
    public.response_mentor_id(response_id) = public.acting_account()
    AND public.pode_ver_conteudo_resposta(response_id)
  );
