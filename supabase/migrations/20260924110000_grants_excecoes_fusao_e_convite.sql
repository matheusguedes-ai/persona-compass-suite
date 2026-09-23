-- #301, item (f) — grants_faltando() precisa voltar vazio antes de fechar a
-- demanda. Rodei a conferência e achei exatamente 3 pendências, todas do
-- #300: fundir_pessoas, previa_fusao e release_invite_link.
--
-- Não é bug de permissão — as três foram desenhadas de propósito como
-- service_role-only (fusão de cadastros e o resgate de vaga do link aberto
-- só rodam a partir de código de servidor, nunca por uma sessão autenticada
-- comum: um mentor não deve conseguir fundir pessoas ou mexer no contador de
-- outro link chamando a função direto). O REVOKE em cada migração original já
-- fechou o authenticated corretamente — só faltou registrar as três aqui,
-- em grants_excecoes(), pra esta ferramenta de auditoria parar de acusar o
-- que é intencional.
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
    'retrato_do_schema',
    'fundir_pessoas',
    'previa_fusao',
    'release_invite_link'
  ];
$fn$;

-- Conferência: nenhuma das 9 pode aparecer aqui como concedida a authenticated hoje.
SELECT p.proname
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname = ANY (public.grants_excecoes())
   AND has_function_privilege('authenticated', p.oid, 'EXECUTE');
