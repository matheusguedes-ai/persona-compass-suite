-- #284 — check-in que não trava na porta da sala.
--
-- Aditiva: só AMPLIA o CHECK de treinamento_presencas.origem (hoje só aceita
-- 'qr'/'manual') para também aceitar 'qr_sem_local' — o aluno confirmou pelo
-- QR, a aula exige localização, mas o aparelho negou/não respondeu e a pessoa
-- escolheu registrar mesmo assim, para o professor decidir depois. Nada que
-- já está gravado muda; nada que está no ar hoje procura este valor até o
-- código novo publicar.
alter table public.treinamento_presencas
  drop constraint if exists treinamento_presencas_origem_check;
alter table public.treinamento_presencas
  add constraint treinamento_presencas_origem_check
  check (origem in ('qr', 'manual', 'qr_sem_local'));
