-- Menu Mensagens — M1c-3: o aluno usa "Responder" no WhatsApp; guardamos QUAL mensagem ele citou (o identificador que a
-- Zapster mandar), para que OK / REMARCAR / CANCELAR valham para a sessão daquele lembrete.
-- Regra 5: só ACRESCENTA uma coluna; nada que está no ar procura por ela.
alter table public.mensagens_recebidas add column if not exists citada_id text;
comment on column public.mensagens_recebidas.citada_id is
  'M1c-3 — identificador da mensagem citada ("Responder"), como a Zapster mandou. Nulo = sem citação (ou a Zapster não mandou).';
