-- Cancelar um envio sem destruí-lo
-- ============================================================
-- Faltava desfazer: criado o envio, só dava para deixar rolando. Duas ações
-- diferentes, de propósito:
--
--   CANCELAR — o link para de funcionar, o registro fica. Reversível. É o que
--     se quer em 9 de 10 casos: mandou para a pessoa errada, adiou a aplicação,
--     mudou o teste.
--   EXCLUIR  — some tudo, inclusive as respostas e o relatório. Sem volta.
--
-- `canceled_at` em vez de um status novo: `status` já é usado pelo motor de
-- pontuação ('pending'/'in_progress'/'submitted') e misturar as duas coisas
-- faria um envio cancelado perder o registro de que havia sido respondido.

ALTER TABLE public.test_responses
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz;

ALTER TABLE public.assessment_responses
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz;
