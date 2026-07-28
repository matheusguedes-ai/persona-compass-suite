-- Remetente configurável na tela, em vez de variável de ambiente
-- ============================================================
-- Trocar o endereço de envio não deveria exigir mexer em secret do projeto e
-- republicar. Passa a ser campo em Configurações → Emails.
--
-- Formato aceito: "contato@dominio.com.br" ou "Nome <contato@dominio.com.br>".
-- O domínio precisa estar verificado no Resend — quem valida isso é o próprio
-- Resend na hora do envio, e a mensagem de erro já é traduzida na interface.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_from text;
