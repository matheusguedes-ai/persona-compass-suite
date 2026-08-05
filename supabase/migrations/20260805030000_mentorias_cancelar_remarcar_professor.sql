-- Menu Mentorias — #257: o professor cancela e remarca pela própria tela.
--
-- Puramente aditiva: uma coluna nova em mentoria_sessoes, preenchida só
-- quando o PROFESSOR cancela com um motivo (opcional). Nada publicado lê
-- cancelamento_motivo hoje — só passa a existir de verdade quando o código
-- desta demanda for publicado.

ALTER TABLE public.mentoria_sessoes
  ADD COLUMN IF NOT EXISTS cancelamento_motivo text;
