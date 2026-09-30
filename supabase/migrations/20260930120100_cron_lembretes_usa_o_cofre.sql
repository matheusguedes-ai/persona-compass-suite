-- PASSO 3 da troca da senha do relógio de lembretes.
-- Só aplicar DEPOIS de a variável CRON_SECRET do Lovable receber o valor do cofre
-- e o site ser publicado (ver 20260930120000_cron_lembretes_senha_no_cofre.sql).
--
-- Mesmo nome de tarefa: cron.schedule com nome existente substitui a antiga.
-- Se o segredo sumisse do cofre, o cabeçalho iria vazio e a rota responderia 404
-- (nunca enviaria lembrete sem senha).
SELECT cron.schedule(
  'enviar-lembretes-mentoria',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://assessment.metodointencao.com.br/api/cron/lembretes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_lembretes_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
