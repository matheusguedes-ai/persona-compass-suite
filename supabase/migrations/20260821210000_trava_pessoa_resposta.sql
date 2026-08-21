-- #277 — pessoa amarrada ao tipo de teste, no banco.
--
-- A Fatia 1 (#212 F1) tirou o NOT NULL de test_responses.person_id pra caber
-- o teste anônimo, mas afrouxou pra QUALQUER resposta — hoje o banco aceita
-- em silêncio tanto uma resposta de teste IDENTIFICADO sem pessoa quanto uma
-- resposta ANÔNIMA com pessoa gravada (quebra da promessa feita ao
-- respondente). Levantamento em 21/08 não achou nenhuma das duas entre as 19
-- respostas existentes — a trava fecha a porta antes da primeira aparecer.
--
-- CHECK simples não resolve: a regra depende de test_versions.is_anonymous,
-- de outra tabela. Mesmo mecanismo de validação-no-banco do avaliar_aula
-- (#231), aqui como TRIGGER em vez de RPC — quem grava é o endpoint público
-- direto na tabela (service role via api.public.invite/response), não uma
-- função dedicada que pudesse carregar a checagem.

CREATE OR REPLACE FUNCTION public.valida_pessoa_da_resposta()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  _anonimo boolean;
BEGIN
  SELECT is_anonymous INTO _anonimo FROM public.test_versions WHERE id = NEW.version_id;

  IF _anonimo AND NEW.person_id IS NOT NULL THEN
    RAISE EXCEPTION 'Teste anônimo não pode gravar quem respondeu.';
  END IF;

  IF NOT _anonimo AND NEW.person_id IS NULL THEN
    RAISE EXCEPTION 'Teste identificado precisa de uma pessoa vinculada à resposta.';
  END IF;

  RETURN NEW;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.valida_pessoa_da_resposta() TO authenticated;

CREATE TRIGGER tr_valida_pessoa_da_resposta
  BEFORE INSERT OR UPDATE OF person_id, version_id ON public.test_responses
  FOR EACH ROW EXECUTE FUNCTION public.valida_pessoa_da_resposta();
