-- Troca da senha do relógio de lembretes (segurança).
--
-- A senha antiga do /api/cron/lembretes ficou escrita por extenso em
-- 20260805070000_lembrete_por_email.sql (repositório público) e no comando da
-- tarefa agendada. Aquele valor está queimado. Esta migração NÃO reescreve o
-- arquivo antigo nem o histórico: depois da troca, o valor antigo deixa de valer
-- e vira lixo inofensivo.
--
-- A senha nova nasce DENTRO do banco, no cofre (Vault), e nunca aparece em
-- arquivo, código ou chat. A tarefa agendada passa a buscá-la no cofre a cada
-- rodada, em vez de carregar o valor escrito no comando.
--
-- ORDEM DE APLICAÇÃO (regra 5 do projeto — o que está no ar ainda procura a senha
-- velha até a variável CRON_SECRET do Lovable ser trocada e publicada):
--   PASSO 1 (aditivo, só cria o segredo no cofre)  ← este arquivo, parte 1
--   PASSO 2 (o Matheus cola o valor em CRON_SECRET no Lovable e publica)
--   PASSO 3 (troca o comando da tarefa)            ← 20260930120100_cron_lembretes_usa_o_cofre.sql

-- PASSO 1 — idempotente: se o segredo já existe, não faz nada (não troca o valor).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_lembretes_secret') THEN
    PERFORM vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'cron_lembretes_secret',
      'Senha que o relógio do banco manda em x-cron-secret para /api/cron/lembretes'
    );
  END IF;
END
$$;
