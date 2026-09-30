-- #316A — prova das quatro chaves da assistente NO BANCO, com rastro ZERO.
--
-- Um DO só: publica a versão 2 do termo APENAS dentro do teste, faz um aluno FICTÍCIO aceitar a versão 1
-- e depois a 2, mexe nas chaves e termina com `raise exception` — o erro desfaz TUDO (nem a publicação
-- sobra). O resultado chega na mensagem de erro. Rodar no editor SQL ou pelo `execute_sql`.
--
-- Antes: `python3 scripts/fixture_assistente.py criar --login` e troque o login abaixo pelo `user_id`
-- impresso (o fictício precisa estar sem aceite). Depois: conferir que nada ficou (aceites, chaves,
-- registro e conversas do fictício = 0; versão 2 ainda `pendente`, se ainda não foi publicada).
do $$
declare
  v_user uuid := '00000000-0000-0000-0000-000000000000';  -- ← o user_id do aluno FICTÍCIO
  v_t1 uuid := (select id from public.assistente_termos where versao = 1);
  v_t2 uuid := (select id from public.assistente_termos where versao = 2);
  s jsonb; r jsonb;
  saida text := '';
  v_conta uuid;
begin
  if not exists (select 1 from auth.users u where u.id = v_user and u.email like '%@exemplo.invalido') then
    raise exception 'use só um login FICTÍCIO (@exemplo.invalido)';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

  -- 1. aceite da versão 1 (não explica as chaves): pedir chave ligada não liga nada
  perform set_config('role', 'authenticated', true);
  r := public.assistente_aceitar(v_t1, true, true, true, true, null);
  s := public.assistente_situacao();
  saida := saida || format(E'1. aceite v1 pedindo as 4 ligadas -> %s | em_dia=%s disponiveis=%s chaves=%s\n',
    r, s->'consentimento_em_dia', s->'chaves_disponiveis', s->'chaves');

  -- 2. uma conversa guardada (para ver que sobrevive ao reaceite)
  perform set_config('role', 'postgres', true);
  select conta_id into v_conta from public.assistente_consentimentos where user_id = v_user and revogado_em is null;
  insert into public.assistente_conversas (user_id, conta_id, titulo) values (v_user, v_conta, 'conversa de teste 316A');

  -- 3. a versão 2 entra em vigor SÓ dentro deste teste
  update public.assistente_termos set status = 'publicado', publicado_em = now() where id = v_t2;

  perform set_config('role', 'authenticated', true);
  s := public.assistente_situacao();
  saida := saida || format(E'2. v2 publicada -> em_dia=%s termo=%s aceite=%s disponiveis=%s ativo=%s\n',
    s->'consentimento_em_dia', s->'termo_versao', s->'consentimento_versao', s->'chaves_disponiveis', s->'consentimento_ativo');

  begin
    r := public.assistente_definir_chaves(true, false, false, false, null);
    saida := saida || E'3. ligar chave com aceite antigo -> ACEITOU (errado)\n';
  exception when others then
    saida := saida || format(E'3. ligar chave com aceite antigo -> recusado: %s\n', sqlerrm);
  end;

  -- 4. reaceite da v2 com a 1 e a 3 ligadas
  r := public.assistente_aceitar(v_t2, true, false, true, false, null);
  s := public.assistente_situacao();
  saida := saida || format(E'4. reaceite v2 (1 e 3) -> %s | em_dia=%s disponiveis=%s chaves=%s\n',
    r, s->'consentimento_em_dia', s->'chaves_disponiveis', s->'chaves');
  perform set_config('role', 'postgres', true);
  saida := saida || format(E'   aceites: %s | conversas guardadas: %s\n',
    (select string_agg(format('v%s %s', termo_versao,
       case when revogado_em is not null then 'revogado' when substituido_em is not null then 'substituído' else 'vigente' end),
       ', ' order by aceito_em) from public.assistente_consentimentos where user_id = v_user),
    (select count(*) from public.assistente_conversas where user_id = v_user));
  perform set_config('role', 'authenticated', true);

  begin
    r := public.assistente_definir_chaves(false, false, true, false, null);
    saida := saida || E'5. desligar a 1 sem escolher -> ACEITOU (errado)\n';
  exception when others then
    saida := saida || format(E'5. desligar a 1 sem escolher -> recusado: %s\n', sqlerrm);
  end;

  r := public.assistente_definir_chaves(false, false, true, false, '{"lembrar_conversas":"manter","mentor_acompanha":"manter"}');
  saida := saida || format(E'6. desligar a 1 (manter) -> %s\n', r);

  begin
    r := public.assistente_definir_chaves(false, false, true, false, null);
    saida := saida || format(E'7. ligar a 3 sem a 1 -> ACEITOU (errado) %s\n', r);
  exception when others then
    saida := saida || format(E'7. ligar a 3 sem a 1 -> recusado: %s\n', sqlerrm);
  end;

  r := public.assistente_definir_chaves(false, true, false, false, null);
  saida := saida || format(E'8. ligar a 2 -> mudou=%s chaves=%s\n', r->'mudou', r->'chaves');
  r := public.assistente_definir_chaves(false, true, false, false, null);
  saida := saida || format(E'9. clique repetido -> mudou=%s\n', r->'mudou');
  r := public.assistente_definir_chaves(false, false, false, false, '{"aprender_plataforma":"apagar"}');
  saida := saida || format(E'10. desligar a 2 (apagar) -> mudou=%s apagados=%s\n', r->'mudou', r->'apagados');

  r := public.assistente_apagar_tudo();
  saida := saida || format(E'11. apagar tudo -> %s\n', r);

  perform public.assistente_revogar();
  s := public.assistente_situacao();
  saida := saida || format(E'12. revogar -> ativo=%s chaves=%s\n', s->'consentimento_ativo', s->'chaves');

  saida := saida || format(E'13. o aluno lê %s linhas do próprio registro\n', (select count(*) from public.assistente_chaves_registro));

  perform set_config('role', 'postgres', true);
  begin
    update public.assistente_chaves_registro set evento = 'mudanca' where user_id = v_user;
    saida := saida || E'14. reescrever o registro -> ACEITOU (errado)\n';
  exception when others then
    saida := saida || format(E'14. reescrever o registro -> recusado: %s\n', sqlerrm);
  end;

  saida := saida || E'REGISTRO:\n' || coalesce((
    select string_agg(format('  %s v%s | ligadas: %s | desligou: %s %s | apagados %s',
      evento, coalesce(termo_versao::text, '-'),
      concat_ws(',', case when lembrar_conversas then '1' end, case when aprender_plataforma then '2' end,
                     case when mentor_acompanha then '3' end, case when melhorar_assistente then '4' end),
      array_to_string(desligadas, ','), coalesce(ao_desligar::text, ''), apagados), E'\n' order by criado_em, id)
      from public.assistente_chaves_registro where user_id = v_user), '(vazio)');

  raise exception E'RESULTADO (tudo desfeito):\n%', saida;
end $$;
