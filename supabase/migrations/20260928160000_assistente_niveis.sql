-- #317, fatia A — três níveis de potência da assistente: Básica, Smart e Pro.
-- ETAPA ÚNICA, só ADITIVA (regra 5): coluna nova com valor padrão, coluna nova que aceita vazio, tabela
-- nova e função nova; `assistente_situacao()` ganha UMA chave a mais no mesmo JSON (quem não a lê não
-- percebe). Nada do que está no ar muda de significado — quem já tem a assistente continua na Básica,
-- que é exatamente a configuração de sempre (claude-sonnet-5, esforço baixo).
--
-- O DESENHO — uma fonte só (a lição da #315):
--   1. O TETO mora na PRÓPRIA linha de liberação (`assistente_liberacoes`, grupo OU login). Não existe uma
--      segunda tabela "níveis do grupo" que pudesse divergir de "o grupo tem assistente": liberar a
--      assistente É liberar pelo menos um nível; tirar todos os níveis é apagar a linha (assistente fechada).
--   2. O teto de quem está logado é a SOMA das linhas que valem para ele — o próprio login e os grupos dos
--      cadastros dele —, as MESMAS linhas que `assistente_liberada()` já olha. Por construção:
--      liberada() = true  ⇔  cardinality(assistente_categorias()) > 0.
--   3. A ESCOLHA do aluno fica em `assistente_preferencias`, mas nunca vale sozinha: o servidor e a edge
--      function conferem contra o teto a cada pergunta. Teto que encolheu depois = escolha velha ignorada.
--   4. O REGISTRO: `assistente_uso.categoria` diz qual nível respondeu cada chamada (a fatia B, o painel de
--      custo, depende disso). As 30 linhas anteriores ficam com NULL = "antes dos níveis"; todas são
--      claude-sonnet-5 com esforço baixo (conferido no histórico da edge function) — a Básica de hoje.

-- ============================================================================ 1. o teto, na liberação
ALTER TABLE public.assistente_liberacoes
  ADD COLUMN IF NOT EXISTS categorias text[] NOT NULL DEFAULT ARRAY['basica']::text[];

ALTER TABLE public.assistente_liberacoes DROP CONSTRAINT IF EXISTS assistente_liberacoes_categorias_validas;
ALTER TABLE public.assistente_liberacoes ADD CONSTRAINT assistente_liberacoes_categorias_validas
  CHECK (cardinality(categorias) >= 1 AND categorias <@ ARRAY['basica', 'smart', 'pro']::text[]);

COMMENT ON COLUMN public.assistente_liberacoes.categorias IS
  '#317: níveis que esta liberação dá (basica/smart/pro). O teto do aluno é a soma das linhas do login e dos grupos dele. Nunca vazio: sem nível = sem linha = assistente fechada.';

-- ============================================================================ 2. o registro por chamada
ALTER TABLE public.assistente_uso
  ADD COLUMN IF NOT EXISTS categoria text
  CHECK (categoria IS NULL OR categoria IN ('basica', 'smart', 'pro'));

COMMENT ON COLUMN public.assistente_uso.categoria IS
  '#317: nível que respondeu (basica/smart/pro). NULL = chamada anterior aos níveis (até 28/09/2026) — todas claude-sonnet-5 com esforço baixo, a mesma configuração da Básica.';

-- ============================================================================ 3. a escolha lembrada
CREATE TABLE IF NOT EXISTS public.assistente_preferencias (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Aluno e mentor são duas assistentes; quem é as duas coisas tem uma escolha em cada.
  escopo text NOT NULL CHECK (escopo IN ('aluno', 'mentor')),
  conta_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria text NOT NULL CHECK (categoria IN ('basica', 'smart', 'pro')),
  atualizada_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, escopo)
);

COMMENT ON TABLE public.assistente_preferencias IS
  '#317: o nível que a pessoa escolheu por último, lembrado para a próxima vez. Não é permissão: o teto é conferido a cada pergunta.';

ALTER TABLE public.assistente_preferencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS apref_read ON public.assistente_preferencias;
CREATE POLICY apref_read ON public.assistente_preferencias
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Sem policy de escrita: quem grava é o servidor (chave de serviço), DEPOIS de conferir o teto — o mesmo
-- padrão das outras tabelas da assistente.

-- ============================================================================ 4. o teto de quem está logado
-- Mesmas linhas de `assistente_liberada()`. Devolve os níveis na ordem da escada, não em ordem alfabética.
CREATE OR REPLACE FUNCTION public.assistente_categorias()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT coalesce(array_agg(s.c ORDER BY array_position(ARRAY['basica', 'smart', 'pro']::text[], s.c)), '{}'::text[])
    FROM (
      SELECT DISTINCT unnest(l.categorias) AS c
        FROM public.assistente_liberacoes l
       WHERE auth.uid() IS NOT NULL
         AND (
           l.user_id = auth.uid()
           OR l.group_id IN (
             SELECT gm.group_id
               FROM public.group_members gm
               JOIN public.people p ON p.id = gm.person_id
              WHERE p.user_id = auth.uid())
         )
    ) s;
$fn$;

-- A situação que a tela e o menu já pedem, com os níveis juntos (uma chamada só). Corpo idêntico ao vivo
-- (conferido por pg_get_functiondef em 28/09), mais a chave 'categorias'.
CREATE OR REPLACE FUNCTION public.assistente_situacao()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  select jsonb_build_object(
    'liberada', public.assistente_liberada(),
    'tem_relatorio', auth.uid() is not null and public.aluno_pode('resultados') and exists (
      select 1 from public.test_responses tr
       where tr.person_id in (select public.my_person_ids())
         and tr.kind = 'self'
         and tr.submitted_at is not null
         and tr.canceled_at is null),
    'termo_publicado', exists (select 1 from public.assistente_termos t where t.status = 'publicado'),
    'consentimento_ativo', exists (
      select 1 from public.assistente_consentimentos c
       where c.user_id = auth.uid() and c.revogado_em is null),
    'tem_historico', exists (select 1 from public.assistente_conversas cv where cv.user_id = auth.uid()),
    'categorias', to_jsonb(public.assistente_categorias())
  );
$fn$;

-- ============================================================================ 5. acessos
REVOKE ALL ON TABLE public.assistente_preferencias FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.assistente_preferencias TO authenticated;
GRANT ALL ON TABLE public.assistente_preferencias TO service_role;

REVOKE EXECUTE ON FUNCTION public.assistente_categorias() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assistente_categorias() TO authenticated, service_role, postgres;
-- assistente_situacao: CREATE OR REPLACE preserva as permissões que ela já tinha (20260924200100).
