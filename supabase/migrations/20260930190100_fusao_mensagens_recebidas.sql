-- Menu Mensagens — M1a: a FUSÃO DE CADASTROS também religa as mensagens recebidas.
--
-- Mesmo método de 20260930160100: a definição VIVA de `fundir_pessoas`/`previa_fusao` é lida do banco (ela está à
-- frente do repositório), recebe o bloco novo no ponto de encaixe e é regravada; cada encaixe precisa aparecer
-- EXATAMENTE uma vez, senão aborta sem mudar nada. `mensagens_recebidas.person_id` não tem chave estrangeira, então
-- sem este bloco ficaria apontando para um cadastro que deixa de existir.

do $patch$
declare
  v_def text; v_ancora text; v_n integer;
begin
  v_def := pg_get_functiondef('public.previa_fusao(uuid, uuid)'::regprocedure);
  v_ancora := E'    \'envios_mensagens\', (SELECT count(*) FROM envios_mensagens WHERE person_id = p_absorver),\n';
  v_n := (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora);
  if v_n <> 1 then raise exception 'previa_fusao: ponto de encaixe encontrado % vezes (esperava 1) — nada foi alterado', v_n; end if;
  v_def := replace(v_def, v_ancora, v_ancora ||
    E'    \'mensagens_recebidas\', (SELECT count(*) FROM mensagens_recebidas WHERE person_id = p_absorver),\n');
  execute v_def;

  v_def := pg_get_functiondef('public.fundir_pessoas(uuid, uuid, uuid)'::regprocedure);
  v_ancora := E'  v_movidos := v_movidos || jsonb_build_object(\'envios_mensagens\', v_ids);\n';
  v_n := (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora);
  if v_n <> 1 then raise exception 'fundir_pessoas: ponto de encaixe encontrado % vezes (esperava 1) — nada foi alterado', v_n; end if;
  v_def := replace(v_def, v_ancora, v_ancora || $bloco$

  -- Menu Mensagens M1a: o que a pessoa absorvida mandou pelo WhatsApp passa para o cadastro mantido.
  WITH m AS (UPDATE mensagens_recebidas SET person_id = p_manter WHERE person_id = p_absorver RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM m;
  v_movidos := v_movidos || jsonb_build_object('mensagens_recebidas', v_ids);
$bloco$);
  execute v_def;
end
$patch$;
