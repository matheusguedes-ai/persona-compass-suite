-- M1c — a FUSÃO DE CADASTROS também religa "quem confirmou" (mentoria_sessoes.confirmada_por_person_id, sem chave
-- estrangeira). Mesmo método das anteriores: lê a definição VIVA, encaixa o bloco novo depois do bloco das mensagens
-- recebidas e regrava; se o ponto de encaixe não aparecer exatamente uma vez, aborta sem mudar nada.

do $patch$
declare v_def text; v_ancora text; v_n integer;
begin
  v_def := pg_get_functiondef('public.fundir_pessoas(uuid, uuid, uuid)'::regprocedure);
  v_ancora := E'  v_movidos := v_movidos || jsonb_build_object(\'mensagens_recebidas\', v_ids);\n';
  v_n := (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora);
  if v_n <> 1 then raise exception 'fundir_pessoas: ponto de encaixe encontrado % vezes (esperava 1) — nada foi alterado', v_n; end if;
  v_def := replace(v_def, v_ancora, v_ancora || $bloco$

  WITH m AS (UPDATE mentoria_sessoes SET confirmada_por_person_id = p_manter WHERE confirmada_por_person_id = p_absorver RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM m;
  v_movidos := v_movidos || jsonb_build_object('mentoria_sessoes_confirmadas', v_ids);
$bloco$);
  execute v_def;
end
$patch$;
