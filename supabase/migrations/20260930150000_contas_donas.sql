-- #dono-central — UMA definição de "esta pessoa é a DONA da conta", no banco, num lugar só.
--
-- O PROBLEMA (provado em 30/09/2026 com um aluno real, em transação desfeita): `member_kind()` responde
-- 'owner' para QUALQUER login que não está em `team_members` — inclusive aluno — e as checagens novas
-- ("dono = quem tem pessoas sob gestão") se satisfazem cadastrando UMA pessoa para si mesmo, porque toda
-- tabela aceita escrita na "conta própria" de qualquer login. Resultado: um aluno vira "dono" em segundos.
--
-- A DEFINIÇÃO: dono = tem uma linha em `contas` E age pela própria conta. A linha NÃO nasce por nada que
-- a própria pessoa faça: só a service role a cria (função `registrar_conta_dona`), quando o dono da
-- plataforma cria uma conta nova. Aluno e colaborador nunca entram aqui.
--
-- Aditiva (regra 5): tabela e funções NOVAS; nada do que está no ar procura nada daqui.
-- A linha do dono atual foi inserida À MÃO, conferindo o e-mail dele no Auth (não por UUID copiado).

create table public.contas (
  dono_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  origem text not null default 'admin'
);

comment on table public.contas is
  'Quem é DONO de conta. Uma linha por dono (dono_id = o próprio login). Só a service role grava; nunca por ação da própria pessoa.';

alter table public.contas enable row level security;

-- Cada login só vê a PRÓPRIA linha (serve para a função abaixo e para nada mais). Sem policy de escrita.
create policy contas_ve_a_propria on public.contas
  for select to authenticated using (dono_id = auth.uid());

revoke all on public.contas from public, anon, authenticated;
grant select on public.contas to authenticated;
grant all on public.contas to service_role;

-- A checagem central. Reaproveitada pelo e-mail, pelo WhatsApp, pela equipe, pela assistente.
create or replace function public.is_account_owner()
returns boolean language sql stable security definer set search_path = public as $fn$
  select auth.uid() is not null
     and public.acting_account() = auth.uid()
     and exists (select 1 from public.contas c where c.dono_id = auth.uid());
$fn$;

comment on function public.is_account_owner() is
  'Dono de conta: está em `contas` e age pela própria conta. Aluno e colaborador: sempre false. Única definição — use esta.';

-- Conta nova = o dono da plataforma cria o login (Auth) e chama esta função com a chave de serviço.
create or replace function public.registrar_conta_dona(p_user uuid, p_origem text default 'admin')
returns void language sql security definer set search_path = public as $fn$
  insert into public.contas (dono_id, origem) values (p_user, coalesce(nullif(btrim(p_origem), ''), 'admin'))
  on conflict (dono_id) do nothing;
$fn$;

comment on function public.registrar_conta_dona(uuid, text) is
  'Só service role. Marca um login como dono de conta. NUNCA ligar a cadastro feito pela própria pessoa.';

-- FROM PUBLIC, não só anon/authenticated (ver 20260730340000).
revoke execute on function public.is_account_owner() from public, anon;
grant execute on function public.is_account_owner() to authenticated, service_role, postgres;
revoke execute on function public.registrar_conta_dona(uuid, text) from public, anon, authenticated;
grant execute on function public.registrar_conta_dona(uuid, text) to service_role, postgres;
