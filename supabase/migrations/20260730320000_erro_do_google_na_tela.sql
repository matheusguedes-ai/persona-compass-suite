-- O erro de sincronia com o Google era gravado e nunca lido.
--
-- `sincronizar()` guarda a falha em `google_conexoes.ultimo_erro`, e o
-- comentario dela diz, com todas as letras, "para a tela poder mostrar". Nenhuma
-- tela le a coluna. `minha_conexao_google()` devolve conectado, email e
-- conectado_em -- e mais nada.
--
-- O resultado e a pior forma de falhar: o mentor marca a devolutiva, a tela diz
-- "salvo", e o compromisso simplesmente nao aparece no Google. Token revogado,
-- permissao retirada, calendario apagado -- tudo isso vira silencio. Ele so
-- descobre no dia, quando o cliente nao entra na chamada.
--
-- A funcao passa a devolver o erro e a hora do ultimo uso. Nada de token: o
-- refresh_token continua sem policy de leitura e sem sair daqui.

-- DROP antes do CREATE, e nao `CREATE OR REPLACE`: mudar as colunas de um
-- RETURNS TABLE muda o tipo de retorno, e o Postgres recusa a substituicao com
-- "cannot change return type of existing function". Sem o DROP a migracao
-- pareceria aplicada e a coluna nova nunca chegaria a tela.
DROP FUNCTION IF EXISTS public.minha_conexao_google();

CREATE FUNCTION public.minha_conexao_google()
RETURNS TABLE (
  conectado boolean,
  email text,
  conectado_em timestamptz,
  ultimo_erro text,
  ultimo_uso_em timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT true, g.email, g.conectado_em, g.ultimo_erro, g.ultimo_uso_em
    FROM public.google_conexoes g
   WHERE g.user_id = auth.uid();
$fn$;

GRANT EXECUTE ON FUNCTION public.minha_conexao_google() TO authenticated;
