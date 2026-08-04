-- #249: lembrar a agenda que a plataforma já criou no Google do professor,
-- para reconectar não criar uma agenda nova toda vez.
--
-- google_conexoes é apagada por completo ao desconectar (de propósito, ver a
-- migração 20260804010000 -- o DELETE ali precisou sair de dentro de uma
-- policy de RLS por causa de um bug do planejador do Postgres) -- então o
-- calendar_id se perde nesse momento. Já eram três agendas órfãs criadas hoje,
-- uma por reconexão.
--
-- Esta tabela é a memória que SOBREVIVE a desconectar/reconectar: guarda o
-- calendar_id uma vez, na primeira vez que a plataforma cria a agenda no
-- Google de alguém, e nunca é apagada por essa rotina. `calendar.app.created`
-- não permite listar as agendas que a própria plataforma criou (conferido na
-- documentação oficial do Google -- só calendar.readonly/calendar/
-- calendar.calendarlist entram na lista de escopos aceitos por
-- CalendarList: list), então guardar por conta própria é a única saída sem
-- pedir mais permissão ao Google.
--
-- Só o servidor (service role) toca aqui -- RLS ativa, sem nenhuma policy
-- para authenticated: mesmo desenho já usado em mentoria_links para o
-- público, bloquear por padrão é mais seguro que abrir e esquecer.
--
-- Puramente aditiva: tabela nova, nada que está publicado lê ou depende dela.
CREATE TABLE IF NOT EXISTS public.google_agendas_criadas (
  mentor_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_id text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_agendas_criadas ENABLE ROW LEVEL SECURITY;
