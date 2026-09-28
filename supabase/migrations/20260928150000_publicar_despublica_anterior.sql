-- #278 — publicar uma versão nova de um instrumento despublica a anterior sozinho.
--
-- O PROBLEMA REAL: isso já falhou duas vezes com consequência (DISC em setembro, Temperamentos em
-- 28/09 — 15 envios abertos e 2 campanhas ativas continuaram na versão velha, com as frases que a
-- curadoria tinha acabado de corrigir). As duas vezes, quem publicou não foi só a tela: o script de
-- conteúdo (`scripts/temperamentos_versao_nova.py`) troca `is_published` com PATCH direto na REST,
-- com a chave de serviço — passa batido por qualquer trava que só more no código do app. Por isso o
-- "sozinho" do item (a) é um GATILHO no banco, não só uma função que a tela chama: publicar por
-- QUALQUER caminho (tela, script, editor SQL) despublica a versão anterior do mesmo instrumento,
-- da mesma conta.
--
-- O que o gatilho NÃO faz, de propósito: mexer em envio ou campanha. Migrar um envio pendente para a
-- versão nova é decisão do dono a cada publicação (regra 3 da demanda — "pergunte, não decida
-- sozinho"), então isso é ATO EXPLÍCITO, do mentor, pela tela: `previa_publicacao` mostra os números
-- antes, `publicar_versao` só migra se `p_migrar_pendentes = true`.
--
-- FORA DO ESCOPO, ACHADO NO CAMINHO: `instrument_id = 'personalizado'` é o balde de todo teste
-- criado do zero (#212 F1), não um instrumento com versões — hoje já há DUAS linhas publicadas com
-- esse instrument_id que não têm nada a ver uma com a outra ("CADASTRO DE NOVOS ALUNOS" e "Mapa da
-- Intenção"). O gatilho e as duas funções abaixo pulam 'personalizado' de propósito — despublicar
-- por instrument_id ali derrubaria um teste do mentor toda vez que ele publicasse outro sem relação
-- nenhuma. Decidir o que "a mesma versão" quer dizer para um teste personalizado é decisão de
-- produto (talvez precise de um id de família próprio), fora desta demanda.
--
-- Aditiva (regra 5): dois gatilhos/funções novos sobre uma coluna que já existe. Nada que está no ar
-- deixa de funcionar — só passa a limpar depois de publicar, e só quando alguém migrar.
--
-- `previa_publicacao`/`publicar_versao` são SECURITY DEFINER, como todo RPC chamado da API aqui —
-- com checagem EXPLÍCITA de dono dentro (replicando `tv_update_own`: mesma conta, e quem chama não
-- pode ser um mentor convidado). O gatilho, não: ele só reage a um UPDATE que a RLS de quem chamou já
-- deixou passar, então SECURITY INVOKER de propósito — o mesmo motivo de `assistente_observacao_dono`
-- (#305): função de gatilho SECURITY DEFINER sem grant nenhum só sujaria `grants_faltando()`.

-- ---------------------------------------------------------------------------------------------
-- 1. O GATILHO: ao publicar (is_published vira true), despublica toda outra versão do MESMO
--    instrumento, da MESMA conta. `mentor_id IS NOT DISTINCT FROM` — nulo com nulo também casa,
--    para o dia em que um template global (mentor_id NULL) existir de verdade.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.test_versions_despublica_anterior()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  -- 'personalizado' NÃO é um instrumento — é o balde de QUALQUER teste feito do zero (#212 F1) ou
  -- duplicado a partir de um. Existe, HOJE, duas linhas publicadas com instrument_id 'personalizado'
  -- que não têm nada a ver uma com a outra ("CADASTRO DE NOVOS ALUNOS" e "Mapa da Intenção" — a
  -- segunda nasceu de um Duplicar da primeira, forked_from_id aponta pra ela, mas são dois testes
  -- diferentes). Despublicar por instrument_id aqui derrubaria um teste do ar toda vez que o mentor
  -- publicasse outro sem relação nenhuma. Fica de fora de propósito: sem uma identidade de
  -- instrumento de verdade para 'personalizado' (isso exige decisão de produto), não é o #278.
  IF NEW.is_published
     AND NEW.instrument_id <> 'personalizado'
     AND (TG_OP = 'INSERT' OR OLD.is_published IS DISTINCT FROM true) THEN
    UPDATE public.test_versions
       SET is_published = false
     WHERE instrument_id = NEW.instrument_id
       AND mentor_id IS NOT DISTINCT FROM NEW.mentor_id
       AND id <> NEW.id
       AND is_published = true;
  END IF;
  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.test_versions_despublica_anterior() IS
  '#278 — ao publicar uma versão, despublica as outras do mesmo instrumento/conta. Roda em QUALQUER caminho de escrita (tela, script, SQL), não só pelo app.';

DROP TRIGGER IF EXISTS test_versions_despublica_anterior ON public.test_versions;
CREATE TRIGGER test_versions_despublica_anterior
  AFTER INSERT OR UPDATE OF is_published ON public.test_versions
  FOR EACH ROW EXECUTE FUNCTION public.test_versions_despublica_anterior();

-- ---------------------------------------------------------------------------------------------
-- 2. A PRÉVIA (item b — "avise antes, não depois"): o que vai acontecer, ANTES de publicar.
--    Junta as versões hoje publicadas do mesmo instrumento/conta (normalmente uma só, mas soma
--    todas se sobrou mais de uma — dado torto não pode fazer a prévia mentir por baixo) e conta:
--      - respostas:          já ENTREGUES na(s) versão(ões) anterior(es) — nunca migram (regra do
--                             item 4: resposta pertence à versão em que foi dada).
--      - abertos_migraveis:  envio criado mas NINGUÉM tocou ainda (sem nenhuma linha em
--                             `test_answers`) — o único conjunto seguro para migrar. Um envio que já
--                             tem resposta PARCIAL salva (respondeu algumas perguntas, não enviou)
--                             fica de fora por decisão desta entrega: mudar a versão por baixo dele
--                             deixaria a resposta já salva apontando para pergunta/opção de um teste
--                             que não é mais o dele. A demanda só exige não migrar o que foi
--                             ENTREGUE; isto vai um passo além pela mesma razão.
--      - em_andamento:       para a tela EXPLICAR por que o número de "abertos" é menor que o total
--                             de envios pendentes — sem isto, o dono acha que o script "esqueceu" um.
--      - campanhas_ativas:   invite_links ativos cujo `version_ids` ainda inclui a versão antiga.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.previa_publicacao(p_version_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_instrument text;
  v_mentor uuid;
  v_anteriores uuid[];
  v_lista jsonb;
  v_vazio jsonb := jsonb_build_object(
    'versoes_anteriores', '[]'::jsonb, 'respostas', 0,
    'abertos_migraveis', 0, 'em_andamento', 0, 'campanhas_ativas', '[]'::jsonb
  );
BEGIN
  SELECT instrument_id, mentor_id INTO v_instrument, v_mentor FROM public.test_versions WHERE id = p_version_id;
  IF v_instrument IS NULL THEN
    RAISE EXCEPTION 'Versão não encontrada.' USING ERRCODE = '22023';
  END IF;
  IF v_mentor IS DISTINCT FROM public.acting_account() OR public.member_kind() = 'mentor' THEN
    RAISE EXCEPTION 'Versão não encontrada ou não pertence a você.' USING ERRCODE = '42501';
  END IF;

  -- 'personalizado' não tem identidade de instrumento (ver o comentário no gatilho) — nunca há
  -- "versão anterior" a despublicar aqui.
  IF v_instrument = 'personalizado' THEN
    RETURN v_vazio;
  END IF;

  SELECT COALESCE(array_agg(id), '{}') INTO v_anteriores
    FROM public.test_versions
   WHERE instrument_id = v_instrument AND mentor_id IS NOT DISTINCT FROM v_mentor
     AND id <> p_version_id AND is_published = true;

  IF array_length(v_anteriores, 1) IS NULL THEN
    RETURN v_vazio;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'title', title) ORDER BY created_at DESC), '[]'::jsonb)
    INTO v_lista
    FROM public.test_versions WHERE id = ANY(v_anteriores);

  RETURN jsonb_build_object(
    'versoes_anteriores', v_lista,
    'respostas', (
      SELECT count(*) FROM public.test_responses
       WHERE version_id = ANY(v_anteriores) AND submitted_at IS NOT NULL AND canceled_at IS NULL
    ),
    'abertos_migraveis', (
      SELECT count(*) FROM public.test_responses tr
       WHERE tr.version_id = ANY(v_anteriores) AND tr.submitted_at IS NULL AND tr.canceled_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM public.test_answers ta WHERE ta.response_id = tr.id)
    ),
    'em_andamento', (
      SELECT count(*) FROM public.test_responses tr
       WHERE tr.version_id = ANY(v_anteriores) AND tr.submitted_at IS NULL AND tr.canceled_at IS NULL
         AND EXISTS (SELECT 1 FROM public.test_answers ta WHERE ta.response_id = tr.id)
    ),
    'campanhas_ativas', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id', l.id, 'title', l.title)), '[]'::jsonb)
        FROM public.invite_links l
       WHERE l.mentor_id IS NOT DISTINCT FROM v_mentor AND l.is_active = true AND l.version_ids && v_anteriores
    )
  );
END;
$fn$;

COMMENT ON FUNCTION public.previa_publicacao(uuid) IS
  '#278 — o que vai acontecer ao publicar esta versão: qual versão sai do ar, quantas respostas ela tem, quantos envios dá pra migrar e quantas campanhas ativas apontam pra ela.';

-- ---------------------------------------------------------------------------------------------
-- 3. O ATO (itens a e 3): publica (o gatilho acima despublica a anterior sozinho) e, só se
--    `p_migrar_pendentes`, move os envios abertos (o mesmo recorte seguro da prévia) e troca o id
--    antigo pelo novo dentro de `version_ids` das campanhas ativas — para um envio NOVO dentro
--    daquela campanha conseguir escolher a versão publicada (`validarCampanha`, em
--    `tests.functions.ts`, recusa versão que não está na lista da campanha).
--
--    Tudo numa função só: se a migração dos envios falhar, a versão não fica publicada com o
--    trabalho pela metade — mesma lógica do `fundir_pessoas` (#300).
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publicar_versao(p_version_id uuid, p_migrar_pendentes boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_mentor uuid;
  v_previa jsonb;
  v_anteriores uuid[];
  v_respostas_migradas jsonb := '[]'::jsonb;
  v_campanhas_migradas jsonb := '[]'::jsonb;
BEGIN
  SELECT mentor_id INTO v_mentor FROM public.test_versions WHERE id = p_version_id;
  IF v_mentor IS NULL THEN
    RAISE EXCEPTION 'Versão não encontrada.' USING ERRCODE = '22023';
  END IF;
  IF v_mentor IS DISTINCT FROM public.acting_account() OR public.member_kind() = 'mentor' THEN
    RAISE EXCEPTION 'Versão não encontrada ou não pertence a você.' USING ERRCODE = '42501';
  END IF;

  v_previa := public.previa_publicacao(p_version_id);
  SELECT COALESCE(array_agg((e->>'id')::uuid), '{}') INTO v_anteriores
    FROM jsonb_array_elements(v_previa->'versoes_anteriores') e;

  UPDATE public.test_versions SET is_published = true WHERE id = p_version_id;
  -- O gatilho `test_versions_despublica_anterior` já derrubou as de v_anteriores aqui.

  IF p_migrar_pendentes AND array_length(v_anteriores, 1) IS NOT NULL THEN
    WITH m AS (
      UPDATE public.test_responses tr
         SET version_id = p_version_id
       WHERE tr.version_id = ANY(v_anteriores)
         AND tr.submitted_at IS NULL
         AND tr.canceled_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM public.test_answers ta WHERE ta.response_id = tr.id)
      RETURNING tr.id
    )
    SELECT COALESCE(jsonb_agg(id), '[]'::jsonb) INTO v_respostas_migradas FROM m;

    WITH c AS (
      UPDATE public.invite_links l
         SET version_ids = (
               SELECT array_agg(CASE WHEN v = ANY(v_anteriores) THEN p_version_id ELSE v END ORDER BY ord)
                 FROM unnest(l.version_ids) WITH ORDINALITY AS u(v, ord)
             )
       WHERE l.mentor_id IS NOT DISTINCT FROM v_mentor
         AND l.is_active = true
         AND l.version_ids && v_anteriores
      RETURNING l.id
    )
    SELECT COALESCE(jsonb_agg(id), '[]'::jsonb) INTO v_campanhas_migradas FROM c;
  END IF;

  RETURN jsonb_build_object(
    'versoes_despublicadas', v_previa->'versoes_anteriores',
    'respostas_migradas', v_respostas_migradas,
    'campanhas_migradas', v_campanhas_migradas
  );
END;
$fn$;

COMMENT ON FUNCTION public.publicar_versao(uuid, boolean) IS
  '#278 — publica a versão (o gatilho despublica a anterior sozinho) e, só se pedido, migra os envios abertos e as campanhas ativas da versão anterior para esta.';
