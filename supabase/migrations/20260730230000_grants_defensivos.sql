-- Os GRANTs das funcoes SECURITY DEFINER, e como reconstrui-los sozinho.
--
-- O PROBLEMA
--
-- As policies de RLS chamam funcoes SECURITY DEFINER (owns_test_version,
-- posso_ver_grupo, aluno_pode, track_liberada...). Sem `GRANT EXECUTE ... TO
-- authenticated`, a policy nao consegue chamar a funcao e a leitura falha --
-- o app inteiro cai. Ja aconteceu: o scanner de seguranca do Lovable revogou
-- os grants "para proteger" e derrubou a plataforma.
--
-- Ate aqui a defesa era uma lista escrita a mao, espalhada por ~15 migracoes.
-- Duas fraquezas: funcao nova nascia sem grant se alguem esquecesse a linha, e
-- reparar depois de um revoke exigia cacar as linhas uma a uma.
--
-- A DEFESA
--
-- `public.reconceder_grants()` percorre TODAS as funcoes SECURITY DEFINER do
-- schema public e concede EXECUTE a `authenticated`, pulando uma lista curta
-- de excecoes deliberadas. E idempotente: rodar de novo nao faz mal.
--
-- Se o app cair com erro de permissao em funcao, o conserto e uma linha:
--
--     SELECT public.reconceder_grants();
--
-- E `public.grants_faltando()` responde "esta tudo certo?" sem mudar nada --
-- da para rodar depois de cada deploy ou quando o scanner reclamar.

/**
 * Funcoes SECURITY DEFINER que NAO devem ser chamaveis por `authenticated`.
 *
 * Todas seguem o mesmo padrao: perguntam pelo acesso de OUTRA pessoa e so
 * podem ser alcancadas por uma funcao que confere antes se quem pergunta e o
 * dono da conta dela. Com grant direto, viravam um jeito de ler o acesso
 * alheio.
 */
CREATE OR REPLACE FUNCTION public.grants_excecoes()
RETURNS text[]
LANGUAGE sql IMMUTABLE
AS $fn$
  SELECT ARRAY[
    'track_liberada_para',
    'bib_pasta_liberada_para',
    'bib_material_liberado_para'
  ];
$fn$;

/** O que esta faltando. Nao muda nada -- serve para conferir e para alarmar. */
CREATE OR REPLACE FUNCTION public.grants_faltando()
RETURNS TABLE (funcao text, assinatura text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT p.proname::text,
         pg_get_function_identity_arguments(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prosecdef                                   -- SECURITY DEFINER
     AND NOT (p.proname = ANY (public.grants_excecoes()))
     AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
   ORDER BY 1;
$fn$;

/**
 * Reconcede tudo. O botao de reparo.
 *
 * Devolve quantas funcoes precisaram de grant -- zero significa que estava
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
       AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',
                   r.proname, r.args);
    n := n + 1;
  END LOOP;

  -- As excecoes no caminho inverso: se alguem der grant nelas por engano (ou
  -- se uma migracao antiga concedeu antes de a regra existir), tira de volta.
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

-- So o dono do banco repara; nenhum grant para authenticated aqui de
-- proposito. Quem chama e o painel do Supabase ou uma migracao.
REVOKE EXECUTE ON FUNCTION public.reconceder_grants() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.grants_faltando() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.grants_excecoes() FROM authenticated, anon;

-- E repara agora, de saida: fecha qualquer buraco que ja exista hoje.
SELECT public.reconceder_grants() AS grants_concedidos;
