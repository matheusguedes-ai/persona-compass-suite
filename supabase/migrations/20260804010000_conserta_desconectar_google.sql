-- Conserta desconectarGoogle: o DELETE nunca apagava a linha de verdade.
--
-- Achado ao testar #64 (domínio próprio), não relacionado a ele: clicar em
-- "Desconectar" em Configurações > Agenda sempre mostrava sucesso, mas a
-- conexão do Google Calendar nunca era removida. Confirmado de duas formas
-- independentes: chamando a mesma rota REST que o app usa (o DELETE volta
-- 204, mas `Content-Range: */0` -- zero linhas afetadas) e com
-- EXPLAIN (ANALYZE), que mostra "One-Time Filter: false" -- o Postgres
-- decide, em tempo de planejamento, que a condição da policy nunca pode ser
-- verdadeira, e descarta a linha sem nunca reavaliar por linha.
--
-- Isolei a causa recriando o mesmo desenho em tabelas de teste descartáveis:
-- o gatilho é ter, ao mesmo tempo, (a) RLS com policy de DELETE dependente de
-- `auth.uid()` e (b) FOREIGN KEY na coluna filtrada. As duas sozinhas não
-- reproduzem -- START `auth.uid()` puro, `(select auth.uid())` e uma função
-- SECURITY DEFINER (STABLE ou VOLATILE) sofrem igual quando a coluna tem FK.
-- `google_conexoes.user_id` tem FK para `auth.users(id) on delete cascade`
-- (para a linha sumir sozinha se a conta for apagada) -- e é essa combinação
-- que aciona o problema.
--
-- Não achei outro lugar do schema no mesmo risco: das 58 policies de
-- DELETE/UPDATE, `google_conexoes` é a única sem uma policy de SELECT
-- companheira na mesma tabela (de propósito -- o refresh_token não pode virar
-- legível pelo cliente), e testei diretamente uma tabela representativa do
-- desenho comum (`academy_banners`, policy FOR ALL + SELECT separada): o
-- Postgres monta plano normal, com Index Scan por linha, sem "One-Time
-- Filter". Não tem FK relevante na coluna filtrada dessas outras policies.
--
-- A correção: em vez de brigar com o planejador, tirar o DELETE de dentro de
-- uma policy de RLS. `desconectar_minha_conexao_google()` roda como o dono da
-- tabela (SECURITY DEFINER, sem FORCE ROW LEVEL SECURITY na tabela --
-- confirmado), então o DELETE dela ignora RLS por completo; a checagem "só
-- pode apagar a própria linha" vira uma comparação explícita em PL/pgSQL, não
-- uma policy declarativa. Testado com a mesma tabela-armadilha (RLS + FK) via
-- REST de verdade, incluindo confirmação com a service role de que a linha
-- realmente sumiu -- não só que a chamada voltou 204.
--
-- A policy `gc_delete` antiga sai porque não serve mais para nada -- o
-- cliente nunca deve apagar `google_conexoes` direto, sempre por esta função.
-- Deixá-la ali só confundiria quem lesse depois, achando que o caminho por
-- RLS funciona.
--
-- Puramente aditiva: cria uma função nova e remove uma policy que não tinha
-- efeito nenhum (nunca apagava nada). Nada que está publicado depende do nome
-- dela ou do caminho de RLS para isto.

CREATE OR REPLACE FUNCTION public.desconectar_minha_conexao_google()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  DELETE FROM public.google_conexoes WHERE user_id = auth.uid();
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.desconectar_minha_conexao_google() TO authenticated;

DROP POLICY IF EXISTS gc_delete ON public.google_conexoes;
