-- #300 (entrega 2): unificar cadastros duplicados de uma pessoa.
--
-- Aditiva quanto ao que está publicado (regra 5): uma tabela nova, duas
-- funções novas e um CHECK AMPLIADO ('varredura' passa a valer como origem de
-- suspeita). O código no ar só grava 'link_aberto', que continua válido.
--
-- A plataforma nunca funde sozinha: quem chama `fundir_pessoas` é o servidor,
-- depois de o mentor ver a prévia e confirmar na tela. As duas funções só
-- rodam com a chave de serviço — a checagem de quem pode unificar (dono, ou
-- colaborador com permissão de Pessoas) é feita no código antes de chamar.

-- ---------------------------------------------------------------------------
-- 1. Suspeita também nasce da varredura do mentor (para "não são a mesma
--    pessoa" ficar registrado e o par parar de aparecer).
ALTER TABLE public.suspeitas_duplicidade DROP CONSTRAINT suspeitas_duplicidade_origem_check;
ALTER TABLE public.suspeitas_duplicidade
  ADD CONSTRAINT suspeitas_duplicidade_origem_check CHECK (origem IN ('link_aberto', 'varredura'));

-- ---------------------------------------------------------------------------
-- 2. O registro de cada unificação — a prova do que existiu.
--
-- O cadastro absorvido deixa de existir; aqui fica a linha inteira dele como
-- era, o que mudou de dono (ids, tabela por tabela) e o que foi descartado por
-- já existir no cadastro mantido (linhas inteiras). Com isso, desfazer uma
-- unificação é trabalho manual, mas possível: nada se perde de verdade.
CREATE TABLE public.fusoes_pessoas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL,
  pessoa_mantida_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  pessoa_absorvida_id uuid NOT NULL,
  pessoa_absorvida jsonb NOT NULL,
  movidos jsonb NOT NULL DEFAULT '{}'::jsonb,
  descartados jsonb NOT NULL DEFAULT '{}'::jsonb,
  campos_preenchidos jsonb NOT NULL DEFAULT '{}'::jsonb,
  login_movido boolean NOT NULL DEFAULT false,
  feita_por uuid,
  feita_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX fusoes_pessoas_mentor ON public.fusoes_pessoas (mentor_id, feita_em DESC);

ALTER TABLE public.fusoes_pessoas ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.fusoes_pessoas TO authenticated;
GRANT ALL ON public.fusoes_pessoas TO service_role;

CREATE POLICY fusoes_leitura_da_conta ON public.fusoes_pessoas
  FOR SELECT TO authenticated
  USING (mentor_id = public.acting_account() AND public.member_kind() <> 'mentor');

-- ---------------------------------------------------------------------------
-- 3. Prévia: o que a unificação faria, sem fazer nada.
--
-- `bloqueios` não vazio = a unificação não pode acontecer (a função de
-- verdade recusa pelos mesmos motivos — ela chama esta).
CREATE OR REPLACE FUNCTION public.previa_fusao(p_manter uuid, p_absorver uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  k public.people%ROWTYPE;
  a public.people%ROWTYPE;
  v_bloqueios jsonb := '[]'::jsonb;
  v_mover jsonb;
  v_conflitos jsonb;
  v_campos jsonb;
  v_login text;
BEGIN
  SELECT * INTO k FROM public.people WHERE id = p_manter;
  SELECT * INTO a FROM public.people WHERE id = p_absorver;
  IF k.id IS NULL OR a.id IS NULL THEN
    RETURN jsonb_build_object('bloqueios', jsonb_build_array('Cadastro não encontrado.'));
  END IF;
  IF k.id = a.id THEN
    RETURN jsonb_build_object('bloqueios', jsonb_build_array('Escolha dois cadastros diferentes.'));
  END IF;
  IF k.mentor_id <> a.mentor_id THEN
    RETURN jsonb_build_object('bloqueios', jsonb_build_array('Os dois cadastros precisam ser da mesma conta.'));
  END IF;

  IF k.user_id IS NOT NULL AND a.user_id IS NOT NULL AND k.user_id <> a.user_id THEN
    v_bloqueios := v_bloqueios || to_jsonb('Os dois cadastros têm login próprio. Unificar deixaria uma das contas de acesso sem cadastro — confirme com a pessoa qual login ela usa antes.'::text);
  END IF;
  IF EXISTS (SELECT 1 FROM team_members WHERE person_id = p_manter)
     AND EXISTS (SELECT 1 FROM team_members WHERE person_id = p_absorver) THEN
    v_bloqueios := v_bloqueios || to_jsonb('Os dois cadastros estão ligados à equipe. Resolva isso em Colaboradores antes de unificar.'::text);
  END IF;
  IF EXISTS (
    SELECT 1 FROM certificados ca
      JOIN certificados ck ON ck.person_id = p_manter
       AND ((ca.treinamento_id IS NOT NULL AND ca.treinamento_id = ck.treinamento_id)
         OR (ca.trilha_id IS NOT NULL AND ca.trilha_id = ck.trilha_id))
     WHERE ca.person_id = p_absorver) THEN
    v_bloqueios := v_bloqueios || to_jsonb('Os dois cadastros têm certificado do mesmo treinamento. Unificar apagaria um certificado já emitido.'::text);
  END IF;

  v_mover := jsonb_build_object(
    'test_responses', (SELECT count(*) FROM test_responses WHERE person_id = p_absorver),
    'test_responses_entregues', (SELECT count(*) FROM test_responses WHERE person_id = p_absorver AND submitted_at IS NOT NULL),
    'assessment_responses', (SELECT count(*) FROM assessment_responses WHERE person_id = p_absorver),
    'group_members', (SELECT count(*) FROM group_members g WHERE g.person_id = p_absorver
                        AND NOT EXISTS (SELECT 1 FROM group_members x WHERE x.person_id = p_manter AND x.group_id = g.group_id)),
    'treinamento_presencas', (SELECT count(*) FROM treinamento_presencas t WHERE t.person_id = p_absorver
                        AND NOT EXISTS (SELECT 1 FROM treinamento_presencas x WHERE x.person_id = p_manter AND x.aula_id = t.aula_id)),
    'treinamento_aula_conclusoes', (SELECT count(*) FROM treinamento_aula_conclusoes t WHERE t.person_id = p_absorver
                        AND NOT EXISTS (SELECT 1 FROM treinamento_aula_conclusoes x WHERE x.person_id = p_manter AND x.aula_id = t.aula_id)),
    'treinamento_avaliacoes', (SELECT count(*) FROM treinamento_avaliacoes t WHERE t.person_id = p_absorver
                        AND NOT EXISTS (SELECT 1 FROM treinamento_avaliacoes x WHERE x.person_id = p_manter AND x.aula_id = t.aula_id)),
    'certificados', (SELECT count(*) FROM certificados WHERE person_id = p_absorver),
    'mentorias', (SELECT count(*) FROM mentorias WHERE person_id = p_absorver),
    'email_logs', (SELECT count(*) FROM email_logs WHERE person_id = p_absorver),
    'team_members', (SELECT count(*) FROM team_members WHERE person_id = p_absorver),
    'destinos', (SELECT count(*) FROM evento_destinos d WHERE d.person_id = p_absorver
                   AND NOT EXISTS (SELECT 1 FROM evento_destinos x WHERE x.person_id = p_manter AND x.evento_id = d.evento_id))
              + (SELECT count(*) FROM learning_track_destinos d WHERE d.person_id = p_absorver
                   AND NOT EXISTS (SELECT 1 FROM learning_track_destinos x WHERE x.person_id = p_manter AND x.track_id = d.track_id))
              + (SELECT count(*) FROM biblioteca_material_destinos d WHERE d.person_id = p_absorver
                   AND NOT EXISTS (SELECT 1 FROM biblioteca_material_destinos x WHERE x.person_id = p_manter AND x.material_id = d.material_id))
              + (SELECT count(*) FROM biblioteca_pasta_destinos d WHERE d.person_id = p_absorver
                   AND NOT EXISTS (SELECT 1 FROM biblioteca_pasta_destinos x WHERE x.person_id = p_manter AND x.pasta_id = d.pasta_id))
  );

  v_conflitos := jsonb_build_object(
    'group_members', (SELECT count(*) FROM group_members g WHERE g.person_id = p_absorver
                        AND EXISTS (SELECT 1 FROM group_members x WHERE x.person_id = p_manter AND x.group_id = g.group_id)),
    'treinamento_presencas', (SELECT count(*) FROM treinamento_presencas t WHERE t.person_id = p_absorver
                        AND EXISTS (SELECT 1 FROM treinamento_presencas x WHERE x.person_id = p_manter AND x.aula_id = t.aula_id)),
    'treinamento_aula_conclusoes', (SELECT count(*) FROM treinamento_aula_conclusoes t WHERE t.person_id = p_absorver
                        AND EXISTS (SELECT 1 FROM treinamento_aula_conclusoes x WHERE x.person_id = p_manter AND x.aula_id = t.aula_id)),
    'treinamento_avaliacoes', (SELECT count(*) FROM treinamento_avaliacoes t WHERE t.person_id = p_absorver
                        AND EXISTS (SELECT 1 FROM treinamento_avaliacoes x WHERE x.person_id = p_manter AND x.aula_id = t.aula_id)),
    'destinos', (SELECT count(*) FROM evento_destinos d WHERE d.person_id = p_absorver
                   AND EXISTS (SELECT 1 FROM evento_destinos x WHERE x.person_id = p_manter AND x.evento_id = d.evento_id))
              + (SELECT count(*) FROM learning_track_destinos d WHERE d.person_id = p_absorver
                   AND EXISTS (SELECT 1 FROM learning_track_destinos x WHERE x.person_id = p_manter AND x.track_id = d.track_id))
              + (SELECT count(*) FROM biblioteca_material_destinos d WHERE d.person_id = p_absorver
                   AND EXISTS (SELECT 1 FROM biblioteca_material_destinos x WHERE x.person_id = p_manter AND x.material_id = d.material_id))
              + (SELECT count(*) FROM biblioteca_pasta_destinos d WHERE d.person_id = p_absorver
                   AND EXISTS (SELECT 1 FROM biblioteca_pasta_destinos x WHERE x.person_id = p_manter AND x.pasta_id = d.pasta_id))
  );

  -- Campos em branco no cadastro mantido que o absorvido preenche. Nome e
  -- e-mail NUNCA mudam: são os do cadastro que o mentor escolheu manter.
  v_campos := jsonb_strip_nulls(jsonb_build_object(
    'phone',           CASE WHEN coalesce(k.phone, '') = ''           AND coalesce(a.phone, '') <> ''           THEN a.phone END,
    'profession',      CASE WHEN coalesce(k.profession, '') = ''      AND coalesce(a.profession, '') <> ''      THEN a.profession END,
    'role_at_company', CASE WHEN coalesce(k.role_at_company, '') = '' AND coalesce(a.role_at_company, '') <> '' THEN a.role_at_company END,
    'company_name',    CASE WHEN coalesce(k.company_name, '') = ''    AND coalesce(a.company_name, '') <> ''    THEN a.company_name END,
    'avatar_url',      CASE WHEN coalesce(k.avatar_url, '') = ''      AND coalesce(a.avatar_url, '') <> ''      THEN a.avatar_url END,
    'banner_url',      CASE WHEN coalesce(k.banner_url, '') = ''      AND coalesce(a.banner_url, '') <> ''      THEN a.banner_url END,
    'linkedin_url',    CASE WHEN coalesce(k.linkedin_url, '') = ''    AND coalesce(a.linkedin_url, '') <> ''    THEN a.linkedin_url END,
    'instagram_url',   CASE WHEN coalesce(k.instagram_url, '') = ''   AND coalesce(a.instagram_url, '') <> ''   THEN a.instagram_url END,
    'site_url',        CASE WHEN coalesce(k.site_url, '') = ''        AND coalesce(a.site_url, '') <> ''        THEN a.site_url END,
    'notes',           CASE WHEN coalesce(k.notes, '') = ''           AND coalesce(a.notes, '') <> ''           THEN a.notes END
  ));

  v_login := CASE
    WHEN k.user_id IS NOT NULL AND a.user_id IS NOT NULL AND k.user_id <> a.user_id THEN 'conflito'
    WHEN k.user_id IS NOT NULL THEN 'mantido'
    WHEN a.user_id IS NOT NULL THEN 'movido'
    ELSE 'nenhum'
  END;

  RETURN jsonb_build_object(
    'bloqueios', v_bloqueios,
    'mover', v_mover,
    'conflitos', v_conflitos,
    'campos', v_campos,
    'login', v_login
  );
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. A unificação. Tudo numa transação só: ou acontece inteira, ou nada muda.
CREATE OR REPLACE FUNCTION public.fundir_pessoas(p_manter uuid, p_absorver uuid, p_por uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  k public.people%ROWTYPE;
  a public.people%ROWTYPE;
  v_previa jsonb;
  v_movidos jsonb := '{}'::jsonb;
  v_descartados jsonb := '{}'::jsonb;
  v_ids jsonb;
  v_linhas jsonb;
  v_fusao uuid;
  r record;
  v_sobrou boolean;
BEGIN
  -- Trava as duas linhas: duas unificações ao mesmo tempo sobre as mesmas
  -- pessoas esperam uma pela outra em vez de se atropelar.
  PERFORM 1 FROM public.people WHERE id IN (p_manter, p_absorver) ORDER BY id FOR UPDATE;

  v_previa := public.previa_fusao(p_manter, p_absorver);
  IF jsonb_array_length(v_previa->'bloqueios') > 0 THEN
    RAISE EXCEPTION '%', v_previa->'bloqueios'->>0;
  END IF;

  SELECT * INTO k FROM public.people WHERE id = p_manter;
  SELECT * INTO a FROM public.people WHERE id = p_absorver;

  -- (1) O login sai do absorvido ANTES de qualquer presença ser apagada: o
  --     gatilho `presenca_apagada_tira_ponto` apaga os pontos do login dono
  --     da presença apagada — e esses pontos continuam valendo para a pessoa.
  IF a.user_id IS NOT NULL THEN
    UPDATE public.people SET user_id = NULL WHERE id = p_absorver;
  END IF;

  -- (2) Sem conflito possível: tudo muda de dono.
  WITH m AS (UPDATE test_responses SET person_id = p_manter WHERE person_id = p_absorver RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM m;
  v_movidos := v_movidos || jsonb_build_object('test_responses', v_ids);

  WITH m AS (UPDATE assessment_responses SET person_id = p_manter WHERE person_id = p_absorver RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM m;
  v_movidos := v_movidos || jsonb_build_object('assessment_responses', v_ids);

  WITH m AS (UPDATE mentorias SET person_id = p_manter WHERE person_id = p_absorver RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM m;
  v_movidos := v_movidos || jsonb_build_object('mentorias', v_ids);

  WITH m AS (UPDATE email_logs SET person_id = p_manter WHERE person_id = p_absorver RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM m;
  v_movidos := v_movidos || jsonb_build_object('email_logs', v_ids);

  -- Conflito de equipe e de certificado já foi barrado na prévia.
  WITH m AS (UPDATE team_members SET person_id = p_manter WHERE person_id = p_absorver RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM m;
  v_movidos := v_movidos || jsonb_build_object('team_members', v_ids);

  WITH m AS (UPDATE certificados SET person_id = p_manter WHERE person_id = p_absorver RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM m;
  v_movidos := v_movidos || jsonb_build_object('certificados', v_ids);

  -- (3) Com unicidade: o que o cadastro mantido JÁ tem fica; a duplicata do
  --     absorvido é descartada — e guardada inteira no registro.

  -- grupos
  WITH d AS (DELETE FROM group_members g WHERE g.person_id = p_absorver
               AND EXISTS (SELECT 1 FROM group_members x WHERE x.person_id = p_manter AND x.group_id = g.group_id)
             RETURNING to_jsonb(g) AS linha)
    SELECT coalesce(jsonb_agg(linha), '[]'::jsonb) INTO v_linhas FROM d;
  IF jsonb_array_length(v_linhas) > 0 THEN v_descartados := v_descartados || jsonb_build_object('group_members', v_linhas); END IF;
  WITH m AS (UPDATE group_members SET person_id = p_manter WHERE person_id = p_absorver RETURNING group_id)
    SELECT coalesce(jsonb_agg(group_id), '[]'::jsonb) INTO v_ids FROM m;
  v_movidos := v_movidos || jsonb_build_object('group_members', v_ids);

  -- presenças
  WITH d AS (DELETE FROM treinamento_presencas t WHERE t.person_id = p_absorver
               AND EXISTS (SELECT 1 FROM treinamento_presencas x WHERE x.person_id = p_manter AND x.aula_id = t.aula_id)
             RETURNING to_jsonb(t) AS linha)
    SELECT coalesce(jsonb_agg(linha), '[]'::jsonb) INTO v_linhas FROM d;
  IF jsonb_array_length(v_linhas) > 0 THEN v_descartados := v_descartados || jsonb_build_object('treinamento_presencas', v_linhas); END IF;
  WITH m AS (UPDATE treinamento_presencas SET person_id = p_manter WHERE person_id = p_absorver RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM m;
  v_movidos := v_movidos || jsonb_build_object('treinamento_presencas', v_ids);

  -- aulas concluídas
  WITH d AS (DELETE FROM treinamento_aula_conclusoes t WHERE t.person_id = p_absorver
               AND EXISTS (SELECT 1 FROM treinamento_aula_conclusoes x WHERE x.person_id = p_manter AND x.aula_id = t.aula_id)
             RETURNING to_jsonb(t) AS linha)
    SELECT coalesce(jsonb_agg(linha), '[]'::jsonb) INTO v_linhas FROM d;
  IF jsonb_array_length(v_linhas) > 0 THEN v_descartados := v_descartados || jsonb_build_object('treinamento_aula_conclusoes', v_linhas); END IF;
  WITH m AS (UPDATE treinamento_aula_conclusoes SET person_id = p_manter WHERE person_id = p_absorver RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM m;
  v_movidos := v_movidos || jsonb_build_object('treinamento_aula_conclusoes', v_ids);

  -- avaliações de aula
  WITH d AS (DELETE FROM treinamento_avaliacoes t WHERE t.person_id = p_absorver
               AND EXISTS (SELECT 1 FROM treinamento_avaliacoes x WHERE x.person_id = p_manter AND x.aula_id = t.aula_id)
             RETURNING to_jsonb(t) AS linha)
    SELECT coalesce(jsonb_agg(linha), '[]'::jsonb) INTO v_linhas FROM d;
  IF jsonb_array_length(v_linhas) > 0 THEN v_descartados := v_descartados || jsonb_build_object('treinamento_avaliacoes', v_linhas); END IF;
  WITH m AS (UPDATE treinamento_avaliacoes SET person_id = p_manter WHERE person_id = p_absorver RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM m;
  v_movidos := v_movidos || jsonb_build_object('treinamento_avaliacoes', v_ids);

  -- liberações individuais (evento, trilha, material, pasta)
  WITH d AS (DELETE FROM evento_destinos t WHERE t.person_id = p_absorver
               AND EXISTS (SELECT 1 FROM evento_destinos x WHERE x.person_id = p_manter AND x.evento_id = t.evento_id)
             RETURNING to_jsonb(t) AS linha)
    SELECT coalesce(jsonb_agg(linha), '[]'::jsonb) INTO v_linhas FROM d;
  IF jsonb_array_length(v_linhas) > 0 THEN v_descartados := v_descartados || jsonb_build_object('evento_destinos', v_linhas); END IF;
  WITH m AS (UPDATE evento_destinos SET person_id = p_manter WHERE person_id = p_absorver RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM m;
  v_movidos := v_movidos || jsonb_build_object('evento_destinos', v_ids);

  WITH d AS (DELETE FROM learning_track_destinos t WHERE t.person_id = p_absorver
               AND EXISTS (SELECT 1 FROM learning_track_destinos x WHERE x.person_id = p_manter AND x.track_id = t.track_id)
             RETURNING to_jsonb(t) AS linha)
    SELECT coalesce(jsonb_agg(linha), '[]'::jsonb) INTO v_linhas FROM d;
  IF jsonb_array_length(v_linhas) > 0 THEN v_descartados := v_descartados || jsonb_build_object('learning_track_destinos', v_linhas); END IF;
  WITH m AS (UPDATE learning_track_destinos SET person_id = p_manter WHERE person_id = p_absorver RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM m;
  v_movidos := v_movidos || jsonb_build_object('learning_track_destinos', v_ids);

  WITH d AS (DELETE FROM biblioteca_material_destinos t WHERE t.person_id = p_absorver
               AND EXISTS (SELECT 1 FROM biblioteca_material_destinos x WHERE x.person_id = p_manter AND x.material_id = t.material_id)
             RETURNING to_jsonb(t) AS linha)
    SELECT coalesce(jsonb_agg(linha), '[]'::jsonb) INTO v_linhas FROM d;
  IF jsonb_array_length(v_linhas) > 0 THEN v_descartados := v_descartados || jsonb_build_object('biblioteca_material_destinos', v_linhas); END IF;
  WITH m AS (UPDATE biblioteca_material_destinos SET person_id = p_manter WHERE person_id = p_absorver RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM m;
  v_movidos := v_movidos || jsonb_build_object('biblioteca_material_destinos', v_ids);

  WITH d AS (DELETE FROM biblioteca_pasta_destinos t WHERE t.person_id = p_absorver
               AND EXISTS (SELECT 1 FROM biblioteca_pasta_destinos x WHERE x.person_id = p_manter AND x.pasta_id = t.pasta_id)
             RETURNING to_jsonb(t) AS linha)
    SELECT coalesce(jsonb_agg(linha), '[]'::jsonb) INTO v_linhas FROM d;
  IF jsonb_array_length(v_linhas) > 0 THEN v_descartados := v_descartados || jsonb_build_object('biblioteca_pasta_destinos', v_linhas); END IF;
  WITH m AS (UPDATE biblioteca_pasta_destinos SET person_id = p_manter WHERE person_id = p_absorver RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM m;
  v_movidos := v_movidos || jsonb_build_object('biblioteca_pasta_destinos', v_ids);

  -- (4) Campos em branco do mantido recebem os do absorvido; o login, se só
  --     o absorvido tinha, passa para o mantido.
  UPDATE public.people p SET
    phone           = coalesce(v_previa->'campos'->>'phone', p.phone),
    profession      = coalesce(v_previa->'campos'->>'profession', p.profession),
    role_at_company = coalesce(v_previa->'campos'->>'role_at_company', p.role_at_company),
    company_name    = coalesce(v_previa->'campos'->>'company_name', p.company_name),
    avatar_url      = coalesce(v_previa->'campos'->>'avatar_url', p.avatar_url),
    banner_url      = coalesce(v_previa->'campos'->>'banner_url', p.banner_url),
    linkedin_url    = coalesce(v_previa->'campos'->>'linkedin_url', p.linkedin_url),
    instagram_url   = coalesce(v_previa->'campos'->>'instagram_url', p.instagram_url),
    site_url        = coalesce(v_previa->'campos'->>'site_url', p.site_url),
    notes           = coalesce(v_previa->'campos'->>'notes', p.notes),
    user_id         = coalesce(p.user_id, a.user_id)
  WHERE p.id = p_manter;

  -- (5) Rede de segurança contra o esquema mudar no futuro: se alguma tabela
  --     nova apontar para `people` e não estiver tratada acima, o DELETE
  --     abaixo apagaria em cascata o que ela guarda — sem ninguém saber.
  --     Aqui qualquer sobra desfaz a unificação inteira.
  FOR r IN
    SELECT cl.relname AS tabela, att.attname AS coluna
      FROM pg_constraint con
      JOIN pg_class cl ON cl.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = cl.relnamespace AND ns.nspname = 'public'
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
     WHERE con.contype = 'f'
       AND con.confrelid = 'public.people'::regclass
       AND cl.relname NOT IN ('suspeitas_duplicidade', 'fusoes_pessoas')
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE %I = $1)', r.tabela, r.coluna)
      INTO v_sobrou USING p_absorver;
    IF v_sobrou THEN
      RAISE EXCEPTION 'Unificação cancelada: a tabela % ainda aponta para o cadastro absorvido e não sabe ser unificada. Nada foi alterado.', r.tabela;
    END IF;
  END LOOP;

  -- (6) O registro nasce ANTES de apagar: é a prova do que existiu.
  INSERT INTO public.fusoes_pessoas
    (mentor_id, pessoa_mantida_id, pessoa_absorvida_id, pessoa_absorvida, movidos, descartados, campos_preenchidos, login_movido, feita_por)
  VALUES
    (k.mentor_id, p_manter, p_absorver, to_jsonb(a), v_movidos, v_descartados, v_previa->'campos',
     (k.user_id IS NULL AND a.user_id IS NOT NULL), p_por)
  RETURNING id INTO v_fusao;

  -- As suspeitas que envolviam o absorvido somem com ele (CASCADE); a do par
  -- está resolvida — o registro acima é o que conta a história.
  DELETE FROM public.people WHERE id = p_absorver;

  RETURN jsonb_build_object(
    'fusao_id', v_fusao,
    'movidos', v_movidos,
    'descartados', v_descartados,
    'campos_preenchidos', v_previa->'campos',
    'login', v_previa->>'login'
  );
END;
$fn$;
