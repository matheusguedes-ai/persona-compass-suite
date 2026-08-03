-- Fecha #241 — a receita do #114 reabria 3 funções fechadas por segurança.
--
-- grants_excecoes() listava só as três "_para" (track_liberada_para,
-- bib_pasta_liberada_para, bib_material_liberado_para). A migração
-- 20260730340000_fechar_rpcs_abertas.sql fechou DEPOIS mais três: as próprias
-- ferramentas de manutenção grants_faltando, reconceder_grants e
-- retrato_do_schema — nenhuma delas é chamada pelo app, e retrato_do_schema
-- despeja o DDL inteiro do schema. grants_excecoes() nunca foi atualizada.
--
-- O efeito prático: rodar `SELECT public.reconceder_grants()` hoje — a
-- receita de conserto que a PRÓPRIA prova do #114 recomenda no kanban —
-- reabriria essas 3 para `authenticated`, porque o loop da função ignora
-- só quem está na lista de exceções, e elas tinham ficado de fora.
--
-- Conserto: a lista de exceções passa a cobrir as 6.
CREATE OR REPLACE FUNCTION public.grants_excecoes()
RETURNS text[]
LANGUAGE sql IMMUTABLE
AS $fn$
  SELECT ARRAY[
    'track_liberada_para',
    'bib_pasta_liberada_para',
    'bib_material_liberado_para',
    'grants_faltando',
    'reconceder_grants',
    'retrato_do_schema'
  ];
$fn$;

-- Conferência: nenhuma das 6 pode aparecer aqui como concedida hoje.
SELECT p.proname
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname = ANY (public.grants_excecoes())
   AND has_function_privilege('authenticated', p.oid, 'EXECUTE');
