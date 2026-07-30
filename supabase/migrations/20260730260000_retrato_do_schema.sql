-- `retrato_do_schema()`: le o catalogo e devolve o DDL do que existe hoje.
--
-- Serve ao script scripts/exportar_estado_banco.py, que grava o resultado em
-- supabase/estado/schema.sql. A partir dai o `git diff` acusa policy trocada
-- fora de migracao -- que e como a plataforma chegou ao ponto de o repositorio
-- sozinho nao reconstruir o banco.
--
-- So o dono do banco chama: e um raio-x completo do schema.

CREATE OR REPLACE FUNCTION public.retrato_do_schema()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  WITH tabelas AS (
    SELECT format(
      E'-- ============ TABELA %s ============\n%s\n',
      c.relname,
      string_agg(
        format('--   %s %s%s', a.attname, format_type(a.atttypid, a.atttypmod),
               CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END),
        E'\n' ORDER BY a.attnum)
    ) AS txt, c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
     WHERE n.nspname = 'public' AND c.relkind = 'r'
     GROUP BY c.relname
  ),
  policies AS (
    SELECT format(
      E'-- policy %s.%s [%s]\n--   USING %s\n--   CHECK %s\n',
      p.tablename, p.policyname, p.cmd,
      COALESCE(p.qual, '-'), COALESCE(p.with_check, '-')
    ) AS txt, p.tablename, p.policyname
      FROM pg_policies p
     WHERE p.schemaname = 'public'
  ),
  funcoes AS (
    SELECT pg_get_functiondef(pr.oid) || E';\n' AS txt, pr.proname
      FROM pg_proc pr
      JOIN pg_namespace n ON n.oid = pr.pronamespace
     WHERE n.nspname = 'public' AND pr.prokind = 'f'
  ),
  indices AS (
    SELECT indexdef || E';\n' AS txt, indexname
      FROM pg_indexes WHERE schemaname = 'public'
  )
  SELECT
    E'-- ===================== TABELAS =====================\n'
    || COALESCE((SELECT string_agg(txt, E'\n' ORDER BY relname) FROM tabelas), '')
    || E'\n-- ===================== POLICIES =====================\n'
    || COALESCE((SELECT string_agg(txt, '' ORDER BY tablename, policyname) FROM policies), '')
    || E'\n-- ===================== INDICES =====================\n'
    || COALESCE((SELECT string_agg(txt, '' ORDER BY indexname) FROM indices), '')
    || E'\n-- ===================== FUNCOES =====================\n'
    || COALESCE((SELECT string_agg(txt, E'\n' ORDER BY proname) FROM funcoes), '');
$fn$;

REVOKE EXECUTE ON FUNCTION public.retrato_do_schema() FROM authenticated, anon;
