-- Menu Mensagens — M1c: botões [OK] e [Remarcar] no lembrete de mentoria pelo WhatsApp.
--
-- Regra 5: só ACRESCENTA colunas e um índice; nada do que está no ar procura nada daqui.
--   * mentoria_sessoes: a confirmação do aluno — quando, por onde (botao | texto) e quem (person_id, sem chave
--     estrangeira de propósito: a fusão de cadastros religa — ver a migração seguinte). O dono do registro é a própria
--     linha (mentor_id = conta).
--   * envios_mensagens.sessao_id: de qual sessão é o lembrete (é por ele que o "OK" achar a sessão certa).
--   * mensagens_recebidas.sessao_id: a qual sessão a mensagem respondeu (clique ou "ok" digitado).

alter table public.mentoria_sessoes
  add column confirmada_pelo_aluno_em timestamptz,
  add column confirmada_via text check (confirmada_via in ('botao', 'texto')),
  add column confirmada_por_person_id uuid;

comment on column public.mentoria_sessoes.confirmada_pelo_aluno_em is
  'M1c — quando o aluno confirmou a mentoria pelo WhatsApp (botão OK ou "ok" digitado). Nulo = aguardando confirmação.';

alter table public.envios_mensagens
  add column sessao_id uuid references public.mentoria_sessoes(id) on delete set null;
create index envios_mensagens_sessao_idx on public.envios_mensagens (sessao_id) where sessao_id is not null;

alter table public.mensagens_recebidas
  add column sessao_id uuid references public.mentoria_sessoes(id) on delete set null;
