-- Menu Mensagens M1a — diagnóstico do webhook: uma linha por chamada VÁLIDA (segredo certo) que a Zapster faz.
-- Guarda só o TIPO do evento, o RESULTADO e (quando o evento é de outra linha) o FIM dos números — nunca o corpo, o
-- texto, o telefone inteiro nem o segredo. Serve para a tela mostrar "a Zapster chamou e a plataforma fez X".
-- Aditiva (regra 5). Só o dono da conta lê; só o servidor grava.

create table public.webhook_eventos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references auth.users(id) on delete cascade,
  recebido_em timestamptz not null default now(),
  tipo text not null,
  acao text not null,
  detalhe text
);
comment on table public.webhook_eventos is 'M1a — diagnóstico do webhook da Zapster: uma linha por chamada VÁLIDA (segredo certo). Só tipo, resultado e o fim de números. Nunca o corpo. Só o dono lê; só o servidor grava.';
create index webhook_eventos_conta_idx on public.webhook_eventos (conta_id, recebido_em desc);
alter table public.webhook_eventos enable row level security;
create policy webhook_eventos_dono_le on public.webhook_eventos for select to authenticated
  using (conta_id = auth.uid() and public.is_account_owner());
revoke all on public.webhook_eventos from public, anon, authenticated;
grant select on public.webhook_eventos to authenticated;
grant all on public.webhook_eventos to service_role;
