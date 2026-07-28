-- Os testes passam a pertencer à conta, em vez de serem "de ninguém"
-- ============================================================
-- Situação anterior: TODAS as `test_versions` tinham `mentor_id NULL` e
-- `is_template = true`. Como as policies de edição pedem
-- `mentor_id = acting_account()`, ninguém conseguia editar nada — só duplicar.
-- E como a cópia ficava lado a lado com o original na hora de enviar, apareciam
-- duas opções do mesmo teste.
--
-- Correção de dados: os modelos passam a ser da conta do Matheus. Continuam com
-- `is_template = true`, então:
--   - seguem rotulados como "Modelo" na interface;
--   - seguem legíveis por qualquer conta (a policy de leitura é
--     `is_template = true OR mentor_id = acting_account()`), que é o que faz
--     sentido para uma biblioteca de inventários de domínio público;
--   - mas só a conta dona edita e apaga.

UPDATE public.test_versions
   SET mentor_id = 'b676892d-6b3a-4bcb-8e95-8ae1d15dd08f'
 WHERE mentor_id IS NULL;

-- As duas "(cópia)" sobraram da correção de FK feita na migração para o banco
-- próprio: são cópias de trabalho, não modelos. Marcadas como versão comum, dá
-- para apagá-las pela interface.
UPDATE public.test_versions
   SET is_template = false
 WHERE title LIKE '%(cópia)%';

-- ============================================================
-- Trava contra perda de resposta
-- ============================================================
-- `test_responses.version_id` é ON DELETE CASCADE: apagar uma versão levava
-- junto todas as respostas dela — e os relatórios. Enquanto ninguém conseguia
-- apagar nada isso ficou escondido; agora que a conta é dona dos testes, vira
-- um risco real de perder histórico com um clique.
--
-- O gatilho recusa a exclusão quando existe resposta. Fica no banco, e não só
-- na tela, porque a proteção precisa valer para qualquer caminho.
CREATE OR REPLACE FUNCTION public.bloqueia_apagar_versao_em_uso()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_n integer;
BEGIN
  SELECT count(*) INTO v_n FROM public.test_responses r WHERE r.version_id = OLD.id;
  IF v_n > 0 THEN
    RAISE EXCEPTION
      'Este teste já foi respondido % vez(es). Apagar levaria junto as respostas e os relatórios. Despublique a versão para parar de usá-la sem perder o histórico.', v_n
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_bloqueia_apagar_versao ON public.test_versions;
CREATE TRIGGER trg_bloqueia_apagar_versao
  BEFORE DELETE ON public.test_versions
  FOR EACH ROW EXECUTE FUNCTION public.bloqueia_apagar_versao_em_uso();
