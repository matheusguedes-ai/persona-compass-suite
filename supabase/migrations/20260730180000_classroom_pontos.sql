-- Classroom etapa 6: presenca vale ponto no ranking.
--
-- Acao PROPRIA em vez de reusar 'aula'. O extrato do aluno mostra o rotulo por
-- acao ("Concluir uma aula" x2, "Participar de um encontro presencial" x3), e
-- juntar "assistiu um video" com "esteve na sala" faria o extrato mentir sobre
-- de onde vieram os pontos dele.
--
-- Sem ALTER do CHECK o insert seria RECUSADO -- e recusado em SILENCIO, porque
-- darPonto engolia o erro. Ninguem descobriria que o ranking parou de contar
-- presenca. (Esta etapa tambem passou a registrar essas falhas no log.)

ALTER TABLE public.pontos DROP CONSTRAINT IF EXISTS pontos_acao_check;
ALTER TABLE public.pontos ADD CONSTRAINT pontos_acao_check
  CHECK (acao IN ('aula', 'devolutiva', 'publicar', 'perfil', 'comentar', 'curtir', 'presenca'));

/**
 * Presenca apagada, ponto apagado.
 *
 * `pontos.referencia` e um uuid solto, sem chave estrangeira -- ele guarda a
 * referencia de acoes de origens diferentes (post, devolutiva, aula). Entao
 * apagar uma aula, um modulo ou o treinamento inteiro derruba as presencas em
 * cascata e deixaria os pontos vivos, pendurados numa aula que nao existe mais.
 * Excluir a pessoa faz o mesmo.
 *
 * O gatilho SO LIMPA. A regra de QUEM ganha ponto continua no aplicativo, num
 * lugar so: duplicar aqui a derivacao de presenca criaria a segunda fonte de
 * verdade que esta etapa inteira evita.
 */
CREATE OR REPLACE FUNCTION public.limpar_ponto_da_presenca()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  DELETE FROM public.pontos p
   USING public.people pe
   WHERE pe.id = OLD.person_id
     AND p.user_id = pe.user_id
     AND p.acao = 'presenca'
     AND p.referencia = OLD.aula_id;
  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS presenca_apagada_tira_ponto ON public.treinamento_presencas;
CREATE TRIGGER presenca_apagada_tira_ponto
  AFTER DELETE ON public.treinamento_presencas
  FOR EACH ROW EXECUTE FUNCTION public.limpar_ponto_da_presenca();
