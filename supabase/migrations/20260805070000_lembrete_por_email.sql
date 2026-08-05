-- Lembrete por e-mail antes da sessão de mentoria (#266).
--
-- POR QUE ISTO PRECISA DE CRON (diferente do sino, #20260730330000)
--
-- O sino é calculado na leitura: só grava aviso para quem abre a plataforma,
-- e não faz mal nenhum acumular sem ninguém olhar. E-mail é o oposto — tem
-- de SAIR mesmo com a pessoa longe do computador. Isso exige algo que roda
-- sozinho, sem ninguém abrir nada: pg_cron.
--
-- pg_cron, pg_net e a extensão http já estavam disponíveis neste projeto
-- Supabase (conferido antes de escrever esta migração) e nenhuma instalada.
--
-- A PONTE ENTRE O BANCO E O RESEND
--
-- O e-mail sai pelo Resend, chamado por email.server.ts — código da
-- aplicação, não do banco. pg_cron mora no banco. A ponte escolhida foi
-- (a): pg_cron + pg_net chamando uma rota HTTP da própria aplicação
-- (/api/cron/lembretes), que roda o código de sempre (monta o e-mail com
-- montarHtml, envia com enviarEmail). Descartei a alternativa de pg_cron
-- gravar uma fila no banco para a aplicação consumir depois: isso duplica a
-- infraestrutura (mais uma tabela, mais um mecanismo de "puxar trabalho
-- pendente" que este projeto não tem hoje) sem ganhar nada — a rota HTTP já
-- é o único lugar que sabe montar e enviar o e-mail. Um problema, um lugar
-- para olhar quando falhar às 3h da manhã.
--
-- A CHAVE ÚNICA É O CORAÇÃO DESTA DEMANDA
--
-- E-mail duplicado é muito pior que sino duplicado: o sino some quando a
-- pessoa lê, o e-mail fica na caixa dela para sempre. Por isso a trava mora
-- no BANCO (a constraint UNIQUE abaixo), não só na lógica da rota — se o
-- cron rodar duas vezes por qualquer motivo (deploy no meio do minuto,
-- retry de rede, dois cron jobs por engano), o segundo INSERT falha e o
-- e-mail não sai duas vezes. A rota grava a linha ANTES de mandar o e-mail:
-- se o envio falhar depois de gravada, o lembrete se perde — pior um
-- perdido que dois enviados.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Quantas horas antes avisar, por link — não fixo no código (decisão do
-- Matheus, 05/08). '{24}' = um aviso, 24h antes (mesmo comportamento de
-- hoje, que é nenhum — só passa a valer quando a rotina existir). '{}' =
-- nenhum aviso neste link.
ALTER TABLE public.mentoria_links
  ADD COLUMN lembrete_horas int[] NOT NULL DEFAULT '{24}';

-- O ledger que impede o reenvio. sessao_id + horas + destinatario identifica
-- de forma única "este aviso, desta sessão, para esta pessoa" — mesmo
-- raciocínio do índice único do sino, só que aqui é tabela própria porque
-- precisamos de uma coluna nova (horas) que notificacoes não tem.
CREATE TABLE public.lembretes_enviados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid NOT NULL REFERENCES public.mentoria_sessoes(id) ON DELETE CASCADE,
  horas int NOT NULL,
  destinatario text NOT NULL CHECK (destinatario IN ('aluno', 'mentor')),
  enviado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sessao_id, horas, destinatario)
);

-- RLS ligada, sem policy nenhuma: só o service role (a rota do cron) lê e
-- escreve aqui. Nem mentor nem aluno têm necessidade de consultar este
-- ledger pela plataforma — é controle interno, não dado de produto.
ALTER TABLE public.lembretes_enviados ENABLE ROW LEVEL SECURITY;

-- A cada 15 minutos: frequência o bastante para um lembrete "1h antes" não
-- atrasar mais que 15 minutos, sem virar ruído. A rota decide o que está
-- devido; rodar mais vezes que o necessário é barato (a maioria das
-- chamadas não encontra nada a fazer).
--
-- O segredo abaixo mora em dois lugares de propósito: aqui (só quem tem
-- acesso ao SQL editor deste projeto vê) e na variável de ambiente
-- CRON_SECRET da aplicação. A rota compara os dois; sem bater, devolve 404.
SELECT cron.schedule(
  'enviar-lembretes-mentoria',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://assessment.metodointencao.com.br/api/cron/lembretes',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'ca1e9f56d76f9b8c1d3ae613f1f2ef94b5b4363a086b6fff2bd8d73002f1cfd6'),
    body := '{}'::jsonb
  );
  $$
);
