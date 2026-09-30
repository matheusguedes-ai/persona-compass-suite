-- Menu Mensagens — M1a: a plataforma passa a OUVIR o WhatsApp (webhook da Zapster).
--
-- Aditiva (regra 5): tabela nova, duas colunas novas e um gatilho novo. Nada do que está no ar procura nada daqui.
--
-- `mensagens_recebidas`: uma linha por mensagem que chega. É COMPROVANTE: nunca se apaga registro real.
--   * O telefone COMPLETO fica aqui de propósito (é o endereço da conversa), mas só o dono da conta lê; nunca em log.
--   * Mídia (áudio, imagem, documento…): só o tipo. O arquivo não é baixado nem guardado.
--   * `person_id` SEM chave estrangeira (mesmo motivo de `envios_mensagens`): a fusão de cadastros religa — ver a
--     migração seguinte. `candidatos` guarda quem era o dono do número quando ele está em mais de um cadastro.
--   * UNIQUE (conta_id, zapster_id): o mesmo evento chegando duas vezes (reenvio) nunca vira duas linhas.
--   * Lê: só o dono da conta (colaborador e aluno não). Escreve: só o servidor, com a chave de serviço.

create table public.mensagens_recebidas (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references auth.users(id) on delete cascade,
  zapster_id text not null,
  telefone text not null,
  remetente text not null check (remetente in ('pessoa', 'equipe', 'desconhecido', 'ambiguo')),
  person_id uuid,
  remetente_nome text,
  candidatos jsonb,
  tipo text not null,
  texto text,
  botao_id text,
  botao_rotulo text,
  citada_texto text,
  recebida_em timestamptz not null,
  criado_em timestamptz not null default now(),
  unique (conta_id, zapster_id)
);

comment on table public.mensagens_recebidas is
  'M1a — mensagens recebidas pelo WhatsApp (webhook da Zapster). Comprovante: não se apaga registro real. Só o dono lê; só o servidor grava.';

create index mensagens_recebidas_conta_idx on public.mensagens_recebidas (conta_id, recebida_em desc);
create index mensagens_recebidas_pessoa_idx on public.mensagens_recebidas (person_id) where person_id is not null;

alter table public.mensagens_recebidas enable row level security;

create policy mensagens_recebidas_dono_le on public.mensagens_recebidas
  for select to authenticated
  using (conta_id = auth.uid() and public.is_account_owner());

revoke all on public.mensagens_recebidas from public, anon, authenticated;
grant select on public.mensagens_recebidas to authenticated;
grant all on public.mensagens_recebidas to service_role;

-- Status dos NOSSOS envios: entregue e lido. Nunca voltam atrás (o gatilho devolve o valor antigo se alguém tentar).
alter table public.envios_mensagens
  add column entregue_em timestamptz,
  add column lido_em timestamptz;

create or replace function public.envios_mensagens_status_nao_volta()
returns trigger language plpgsql set search_path = public as $fn$
begin
  if old.entregue_em is not null then new.entregue_em := old.entregue_em; end if;
  if old.lido_em is not null then new.lido_em := old.lido_em; end if;
  return new;
end;
$fn$;

create trigger envios_mensagens_status_nao_volta before update on public.envios_mensagens
  for each row execute function public.envios_mensagens_status_nao_volta();

-- A prova de origem do webhook: a Zapster NÃO assina as chamadas (o cadastro só aceita endereço, nome, eventos e
-- ligado/desligado), então o endereço leva um segredo longo. Ele nasce AQUI, no cofre, e ninguém o vê escrito.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'zapster_webhook_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'zapster_webhook_secret',
      'Segredo que vai no endereço do webhook da Zapster (/api/webhook/zapster/<segredo>); a mesma coisa em ZAPSTER_WEBHOOK_SEGREDO'
    );
  end if;
end
$$;
