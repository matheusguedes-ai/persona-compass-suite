-- Menu Mensagens — M1b: a plataforma RESPONDE (SAIR, resposta automática) e avisa o mentor.
--
-- Regra 5: só AMPLIA. (1) a revogação de consentimento ganha um motivo novo, 'pediu_sair' (o aluno escreveu SAIR no
-- WhatsApp) — o que está no ar só grava os motivos antigos, que continuam valendo; (2) `mensagens_recebidas` ganha a
-- coluna `tratamento` (o que a plataforma fez com cada mensagem: sair, resposta_automatica, mentor_avisado), que o
-- código no ar não conhece e ninguém lê ainda.

alter table public.whatsapp_consentimentos drop constraint whatsapp_consentimentos_revogado_motivo_check;
alter table public.whatsapp_consentimentos add constraint whatsapp_consentimentos_revogado_motivo_check
  check (revogado_motivo in ('desligou', 'mudou_nivel', 'fusao', 'numero_alterado', 'pediu_sair'));

alter table public.mensagens_recebidas add column tratamento text;
comment on column public.mensagens_recebidas.tratamento is
  'M1b — o que a plataforma fez com a mensagem (lista separada por vírgula): sair, resposta_automatica, mentor_avisado.';
