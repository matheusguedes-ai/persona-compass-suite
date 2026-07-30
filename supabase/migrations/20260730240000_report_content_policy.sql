-- report_content: fecha o alerta Critical do scanner, sem quebrar o relatorio.
--
-- A policy era `rc_read_authenticated USING (true)`: qualquer usuario logado
-- lia o conteudo de relatorio de TODOS os mentores. Hoje isso nao vaza nada --
-- os 502 registros sao globais (`version_id IS NULL`), escritos por nos e
-- iguais para todo mundo. Mas:
--
--   1. o alerta fica aberto no painel do Lovable, e o botao "Try to fix all"
--      ja derrubou o app uma vez ao revogar GRANTs;
--   2. no dia em que um mentor escrever conteudo proprio (`version_id`
--      preenchido), ele vaza para a conta vizinha sem ninguem perceber.
--
-- A regra correta e a mesma que a tabela ja carrega no desenho:
--   version_id NULL  = conteudo global, todo mundo le (e o ponto dele);
--   version_id X     = conteudo daquela versao, so quem e dono da versao le.
--
-- O relatorio NAO passa por aqui: `buildReport` usa service role
-- (src/lib/report.server.ts:10), que ignora RLS. Apertar a leitura nao muda
-- uma linha do que o avaliado recebe.
--
-- A tabela tambem passa a existir NA MIGRACAO. Ate agora ela so existia no
-- banco em producao -- e o repositorio sozinho nao reconstruia a plataforma.

CREATE TABLE IF NOT EXISTS public.report_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = global. E o caso dos 502 registros de hoje.
  version_id uuid REFERENCES public.test_versions(id) ON DELETE CASCADE,
  section text NOT NULL,
  dimension_key text NOT NULL,
  mode text NOT NULL DEFAULT 'natural',
  band_min numeric,
  band_max numeric,
  title text,
  body text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rc_busca_idx
  ON public.report_content (section, dimension_key, mode, sort_order);
CREATE INDEX IF NOT EXISTS rc_versao_idx
  ON public.report_content (version_id) WHERE version_id IS NOT NULL;

ALTER TABLE public.report_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rc_read_authenticated ON public.report_content;
DROP POLICY IF EXISTS rc_read ON public.report_content;
CREATE POLICY rc_read ON public.report_content FOR SELECT TO authenticated
  USING (version_id IS NULL OR public.owns_test_version(version_id));

-- Escrever conteudo de uma versao e do dono dela. O conteudo GLOBAL continua
-- sem porta pelo cliente: entra por `scripts/aplicar_conteudo.py`, que usa
-- service role. E curadoria, nao colaboracao -- e um erro ali sai no relatorio
-- de todas as contas.
DROP POLICY IF EXISTS rc_write ON public.report_content;
CREATE POLICY rc_write ON public.report_content FOR ALL TO authenticated
  USING (version_id IS NOT NULL AND public.owns_test_version(version_id))
  WITH CHECK (version_id IS NOT NULL AND public.owns_test_version(version_id));

COMMENT ON TABLE public.report_content IS
  'Blocos de texto do relatorio. version_id NULL = global (curadoria da plataforma, escrito por service role); preenchido = conteudo daquela versao, do mentor dono.';
