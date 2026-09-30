-- #291 F1c — o lembrete de mentoria também pelo WhatsApp (para quem autorizou).
--
-- A tabela `lembretes_enviados` já impede o e-mail de sair duas vezes (UNIQUE sessão + horas + destinatário).
-- O WhatsApp usa a MESMA trava com um destinatário novo, `aluno_whatsapp`: a linha existir = este lembrete desta
-- sessão já foi tratado pelo WhatsApp e nunca sai de novo, mesmo que o relógio rode outra vez ou a rota seja
-- chamada duas vezes ao mesmo tempo.
--
-- Regra 5: isto só AMPLIA o que a restrição aceita ('aluno', 'mentor' continuam valendo). Nada que está no ar
-- escreve ou lê o valor novo — pode ir antes do código.

alter table public.lembretes_enviados drop constraint lembretes_enviados_destinatario_check;
alter table public.lembretes_enviados add constraint lembretes_enviados_destinatario_check
  check (destinatario in ('aluno', 'mentor', 'aluno_whatsapp'));

comment on column public.lembretes_enviados.destinatario is
  'aluno / mentor = e-mail (como sempre). aluno_whatsapp (#291 F1c) = o lembrete do aluno pelo WhatsApp: a linha existir impede o reenvio.';
