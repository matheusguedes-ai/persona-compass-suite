-- #273 — blindagem do GRANT EXECUTE nas funções SECURITY DEFINER (auditoria
-- #214, Prioridade 3), estendendo o mecanismo que já existe desde o #114/#241
-- (20260730230000_grants_defensivos.sql, 20260803010000_grants_excecoes_completa.sql).
--
-- O QUE MUDA
--
-- grants_faltando() e reconceder_grants() só olhavam para `authenticated`.
-- As policies de RLS chamam essas funções como `authenticated`, então era o
-- papel que importava para o app não cair — mas a demanda #273 pede o mesmo
-- cinto de segurança também para `service_role` e `postgres`, os outros dois
-- papéis que hoje têm a permissão. As duas funções passam a checar (e
-- reconceder) os três: authenticated, service_role, postgres.
--
-- O QUE NÃO MUDA
--
-- grants_excecoes() continua com as mesmas 6 funções de sempre — elas nunca
-- deveriam ser chamáveis por `authenticated`/`anon` diretamente, e isso não é
-- assunto desta demanda. service_role e postgres já tinham acesso a essas 6
-- por fora deste mecanismo (dono do objeto, no caso de postgres) — nada a
-- fazer aí.
--
-- LEVANTAMENTO ANTES DE APLICAR (verificação, não conserto — #273 pede isso
-- por escrito): consultei has_function_privilege() para os três papéis nas
-- 54 funções SECURITY DEFINER de public. Resultado: 100% saudável — as 48
-- que deveriam ter authenticated/service_role/postgres têm os três, e as 6
-- exceções corretamente não têm authenticated (mas têm service_role e
-- postgres, por fora deste mecanismo). Nada estava quebrado antes desta
-- migração — não houve necessidade de avisar sobre incidente nenhum.
--
-- É o mesmo "botão de reset" de sempre, só que mais completo:
--
--     SELECT public.reconceder_grants();
--
-- Idempotente: rodar de novo com tudo certo devolve 0 e não muda nada.

/** O que está faltando, nos três papéis. Não muda nada — só confere.
    DROP antes: o formato de saída mudou (2 colunas -> 5), e Postgres não
    deixa trocar o "shape" de uma função TABLE com CREATE OR REPLACE. Sem
    problema apagar e recriar: nenhum código do app chama esta função, só
    uso manual pelo editor SQL. */
DROP FUNCTION IF EXISTS public.grants_faltando();

CREATE OR REPLACE FUNCTION public.grants_faltando()
RETURNS TABLE (
  funcao text,
  assinatura text,
  falta_authenticated boolean,
  falta_service_role boolean,
  falta_postgres boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    p.proname::text,
    pg_get_function_identity_arguments(p.oid),
    NOT has_function_privilege('authenticated', p.oid, 'EXECUTE'),
    NOT has_function_privilege('service_role', p.oid, 'EXECUTE'),
    NOT has_function_privilege('postgres', p.oid, 'EXECUTE')
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prosecdef                                   -- SECURITY DEFINER
     AND NOT (p.proname = ANY (public.grants_excecoes()))
     AND (
       NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
       OR NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
       OR NOT has_function_privilege('postgres', p.oid, 'EXECUTE')
     )
   ORDER BY 1;
$fn$;

-- CREATE FUNCTION concede EXECUTE a PUBLIC por padrão — o DROP+CREATE acima
-- reabriu esta função de manutenção sem querer. Fecha de novo, como o
-- 20260730230000_grants_defensivos.sql já fazia na criação original.
REVOKE EXECUTE ON FUNCTION public.grants_faltando() FROM PUBLIC;

/**
 * Reconcede tudo, nos três papéis. O botão de reparo.
 *
 * Devolve quantas funções precisaram de grant — zero significa que estava
 * tudo certo e nada mudou.
 */
CREATE OR REPLACE FUNCTION public.reconceder_grants()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace nsp ON nsp.oid = p.pronamespace
     WHERE nsp.nspname = 'public'
       AND p.prosecdef
       AND NOT (p.proname = ANY (public.grants_excecoes()))
       AND (
         NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
         OR NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
         OR NOT has_function_privilege('postgres', p.oid, 'EXECUTE')
       )
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role, postgres',
                   r.proname, r.args);
    n := n + 1;
  END LOOP;

  -- As exceções no caminho inverso: se alguém der grant nelas por engano (ou
  -- se uma migração antiga concedeu antes de a regra existir), tira de volta.
  -- Só authenticated/anon — service_role e postgres não são o problema aqui.
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace nsp ON nsp.oid = p.pronamespace
     WHERE nsp.nspname = 'public'
       AND p.prosecdef
       AND p.proname = ANY (public.grants_excecoes())
       AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM authenticated, anon',
                   r.proname, r.args);
  END LOOP;

  RETURN n;
END;
$fn$;

-- E repara agora, de saída: fecha qualquer buraco que já exista hoje. Pelo
-- levantamento acima, deve devolver 0.
SELECT public.reconceder_grants() AS grants_concedidos;
