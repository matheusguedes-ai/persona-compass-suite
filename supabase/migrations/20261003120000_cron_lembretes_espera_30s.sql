-- M1c-4: o relógio dos lembretes passa a ESPERAR até 30 s pela resposta da rota (o padrão do pg_net é 5 s).
-- Nada de senha nem de horário muda: só o tempo de espera da chamada. Em 01/10 e 03/10 as rodadas com WhatsApp a enviar
-- estouraram os 5 s ("Timeout of 5000 ms"); o código também ficou mais rápido (sessões, e-mails e WhatsApp em paralelo),
-- esta é a segunda camada de segurança. Regra 5: não remove nem renomeia nada.
do $$
declare
  v_id bigint;
  v_cmd text;
  v_novo text;
begin
  select jobid, command into v_id, v_cmd from cron.job where jobname = 'enviar-lembretes-mentoria';
  if v_id is null then raise exception 'job enviar-lembretes-mentoria não existe'; end if;
  if v_cmd like '%timeout_milliseconds%' then return; end if; -- já aplicado
  v_novo := replace(v_cmd, E'body := ''{}''::jsonb', E'body := ''{}''::jsonb,\n    timeout_milliseconds := 30000');
  if v_novo = v_cmd then raise exception 'âncora do comando não encontrada'; end if;
  perform cron.alter_job(v_id, command := v_novo);
end
$$;
