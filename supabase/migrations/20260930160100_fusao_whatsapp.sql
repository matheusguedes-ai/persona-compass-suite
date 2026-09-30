-- #291 F1b — a FUSÃO DE CADASTROS aprende as tabelas novas de WhatsApp.
--
-- POR QUE ESTE ARQUIVO É UM "PATCH" E NÃO A FUNÇÃO INTEIRA: o banco tem versões de `fundir_pessoas` e
-- `previa_fusao` MAIS NOVAS que as do repositório (a #313 acrescentou os bloqueios da Biblioteca direto no
-- banco; 20260925150000 ficou para trás). Regravar a função a partir do arquivo DESFARIA isso em silêncio.
-- Então aqui a definição VIVA é lida do banco, recebe os blocos novos nos pontos de encaixe e é regravada.
-- Cada encaixe é conferido: se não houver EXATAMENTE uma ocorrência, aborta sem mudar nada.
--
-- Sem isto toda fusão seria recusada pela rede de segurança (as tabelas novas apontam para `people`), e
-- `envios_mensagens.person_id` (sem chave estrangeira, de propósito) ficaria pendurado num cadastro que deixa de
-- existir. Mesmas assinaturas e mesmo retorno: o código publicado continua chamando do mesmo jeito (regra 5).
--
-- ⚠️ Outra migração que recriar `fundir_pessoas` a partir de arquivo precisa partir DESTA versão viva.

do $patch$
declare
  v_def text;
  v_ancora text;
  v_n integer;
begin
  -- ------------------------------------------------------------------ previa_fusao (contagens)
  v_def := pg_get_functiondef('public.previa_fusao(uuid, uuid)'::regprocedure);
  v_ancora := E'    \'email_logs\', (SELECT count(*) FROM email_logs WHERE person_id = p_absorver),\n';
  v_n := (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora);
  if v_n <> 1 then raise exception 'previa_fusao: ponto de encaixe encontrado % vezes (esperava 1) — nada foi alterado', v_n; end if;
  v_def := replace(v_def, v_ancora, v_ancora ||
    E'    \'envios_mensagens\', (SELECT count(*) FROM envios_mensagens WHERE person_id = p_absorver),\n' ||
    E'    \'whatsapp_consentimentos\', (SELECT count(*) FROM whatsapp_consentimentos WHERE person_id = p_absorver),\n');
  execute v_def;

  -- ------------------------------------------------------------------ fundir_pessoas (mover)
  v_def := pg_get_functiondef('public.fundir_pessoas(uuid, uuid, uuid)'::regprocedure);
  v_ancora := E'  v_movidos := v_movidos || jsonb_build_object(\'email_logs\', v_ids);\n';
  v_n := (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora);
  if v_n <> 1 then raise exception 'fundir_pessoas: ponto de encaixe encontrado % vezes (esperava 1) — nada foi alterado', v_n; end if;
  v_def := replace(v_def, v_ancora, v_ancora || $bloco$

  -- #291 F1b: registro de envios de mensagem (a coluna `person_id` NÃO tem chave estrangeira, de propósito).
  WITH m AS (UPDATE envios_mensagens SET person_id = p_manter WHERE person_id = p_absorver RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM m;
  v_movidos := v_movidos || jsonb_build_object('envios_mensagens', v_ids);

  -- #291 F1b: consentimentos de WhatsApp. O HISTÓRICO inteiro passa para o cadastro mantido. Como só pode haver
  -- UM vigente por pessoa, se os dois tinham, vale o mais recente e o outro é revogado ("fusao") antes de mover.
  UPDATE whatsapp_consentimentos c
     SET revogado_em = now(), revogado_motivo = 'fusao'
   WHERE c.person_id IN (p_manter, p_absorver) AND c.revogado_em IS NULL
     AND c.id <> (SELECT v.id FROM whatsapp_consentimentos v
                   WHERE v.person_id IN (p_manter, p_absorver) AND v.revogado_em IS NULL
                   ORDER BY v.aceito_em DESC, v.id LIMIT 1)
     AND (SELECT count(*) FROM whatsapp_consentimentos v
           WHERE v.person_id IN (p_manter, p_absorver) AND v.revogado_em IS NULL) > 1;
  WITH m AS (UPDATE whatsapp_consentimentos SET person_id = p_manter WHERE person_id = p_absorver RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM m;
  v_movidos := v_movidos || jsonb_build_object('whatsapp_consentimentos', v_ids);

  -- #291 F1b: códigos de confirmação pendentes são efêmeros (10 min) e presos ao número do cadastro absorvido:
  -- descartados, sem guardar nada (só existe o resumo deles).
  DELETE FROM whatsapp_codigos WHERE person_id = p_absorver;
$bloco$);
  execute v_def;
end
$patch$;
