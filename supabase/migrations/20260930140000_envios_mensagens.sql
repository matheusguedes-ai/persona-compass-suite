-- #291 F1a — o REGISTRO de todo envio de mensagem, de qualquer canal (WhatsApp hoje, e-mail depois).
--
-- Aditiva (regra 5): tabela e função NOVAS. Nada do que está no ar procura nada daqui.
--
-- O QUE GUARDA E O QUE NÃO GUARDA
--   * Dono: `conta_id` = a conta (o dono), no padrão de `notificacoes` e `acting_account()`.
--   * Destinatário: `person_id` (quando houver) OU só `destino_mascarado`. O telefone completo
--     NUNCA entra aqui — o repositório é público e este registro é histórico. Número inválido
--     digitado pelo dono também entra só mascarado.
--   * O texto da mensagem não é guardado nesta fatia (o de teste é fixo). Quando houver aviso a
--     aluno (F1c) decide-se o que guardar, com o consentimento na mesa.
--   * `person_id` NÃO tem chave estrangeira DE PROPÓSITO: uma FK para `people` faria toda fusão de
--     cadastros ser RECUSADA até `fundir_pessoas` aprender esta tabela (ver CLAUDE.md). Nesta fatia
--     nenhuma linha usa a coluna. ⚠️ PENDENTE para a F1b/F1c: ensinar `fundir_pessoas` e
--     `previa_fusao` a religar este `person_id` quando a coluna passar a ser preenchida.
--
-- QUEM LÊ E QUEM ESCREVE
--   * Lê: só o dono da conta, e só as linhas da própria conta (policy abaixo).
--   * Escreve: ninguém pela tela. Não há policy de INSERT/UPDATE/DELETE, e os privilégios de
--     escrita são revogados: só o servidor, com a chave de serviço.

-- Quem é o DONO da conta, agindo pela própria conta. `acting_account()` sozinha não separa dono
-- de aluno (devolve o próprio login para quem não é da equipe) — o que separa é ter pessoas sob a
-- gestão dele (`people.mentor_id`), mesma regra provada de `assistente_mentor_liberada()` (#307).
-- Limite conhecido: um dono que ainda não cadastrou ninguém não passa. Hoje não é caso real.
create or replace function public.whatsapp_dono()
returns boolean language sql stable security definer set search_path = public as $fn$
  select auth.uid() is not null
     and public.acting_account() = auth.uid()
     and exists (select 1 from public.people p where p.mentor_id = auth.uid());
$fn$;

comment on function public.whatsapp_dono() is
  '#291 — o usuário logado é o DONO da conta (com alunos cadastrados)? Colaborador, mentor convidado e aluno: false.';

create table public.envios_mensagens (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references auth.users(id) on delete cascade,
  criado_por uuid references auth.users(id) on delete set null,
  person_id uuid,
  canal text not null check (canal in ('whatsapp', 'email')),
  tipo text not null,
  destino_mascarado text,
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'falhou')),
  motivo_falha text,
  fornecedor text,
  fornecedor_msg_id text,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz
);

comment on table public.envios_mensagens is
  '#291 F1a — registro de todo envio (whatsapp/email). Dono = conta_id. Sem telefone completo. Só o servidor grava; só o dono lê.';
comment on column public.envios_mensagens.person_id is
  'Sem FK de propósito (ver cabeçalho da migração): pendente ensinar fundir_pessoas antes de preencher.';

create index envios_mensagens_conta_idx on public.envios_mensagens (conta_id, criado_em desc);
-- O limite de testes por dia conta por conta + tipo + data.
create index envios_mensagens_tipo_idx on public.envios_mensagens (conta_id, tipo, criado_em desc);

alter table public.envios_mensagens enable row level security;

create policy envios_mensagens_dono_le on public.envios_mensagens
  for select to authenticated
  using (conta_id = auth.uid() and public.whatsapp_dono());

revoke all on public.envios_mensagens from public, anon, authenticated;
grant select on public.envios_mensagens to authenticated;
grant all on public.envios_mensagens to service_role;

-- FROM PUBLIC, não só anon/authenticated (ver 20260730340000).
revoke execute on function public.whatsapp_dono() from public, anon;
grant execute on function public.whatsapp_dono() to authenticated, service_role, postgres;
