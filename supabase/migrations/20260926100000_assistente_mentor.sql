-- #307 — ASSISTENTE DO MENTOR: o dono da conta conversa sobre os RESULTADOS e o USO da plataforma dos
-- alunos dele. É outra assistente, com outras conversas — não um modo da assistente do aluno.
--
-- AS DUAS FONTES, E A LINHA ENTRE ELAS:
--   (a) resultados de teste, perfis, índices, presença, aulas, ranking, campanhas, logins — o que o
--       mentor JÁ vê no painel. A assistente dele lê, sempre com o LOGIN dele (a RLS de cada tabela
--       decide o que volta; nada aqui usa chave de serviço para ler dado de aluno).
--   (b) as conversas dos alunos com a assistente DELES (`assistente_conversas`/`assistente_mensagens`).
--       O mentor NÃO lê — e esta migração não toca em nada daquelas tabelas nem das policies delas.
--
-- Por que tabelas próprias em vez de uma coluna "de quem é" nas conversas do aluno: (1) as do aluno
-- exigem o consentimento DELE para gravar (gatilho `assistente_exige_consentimento`) e a mensagem lá
-- é do papel 'aluno' — não servem; (2) separadas, não há consulta que misture as duas por engano:
-- uma tela, uma função e uma policy nunca olham as duas tabelas ao mesmo tempo.
--
-- Donos (regra 2): `user_id` é quem perguntou — o dono da conversa, único que lê — e `conta_id` é a
-- conta (tenant). Hoje só o DONO da conta usa (ver `assistente_mentor_liberada`), então as duas são
-- iguais; a coluna existe para o dia em que a equipe também puder.
--
-- Aditiva (regra 5): tabelas, colunas e função novas. Nada do que está no ar procura nada daqui; as
-- colunas novas de `assistente_uso` nascem com padrão ('aluno' / nulo), e o código atual grava ali
-- exatamente como antes. Permissões no arquivo seguinte (`..._acesso.sql`), sem corpo de função.

-- ---------------------------------------------------------------------------------------------
-- 1. QUEM PODE USAR: o dono da conta, agindo pela própria conta, com alunos cadastrados nela.
--    `acting_account()` sozinha não serve: ela devolve o próprio login para quem não é da equipe —
--    inclusive um ALUNO. O que separa dono de aluno (mesma regra de `membershipDoUsuario`) é ter
--    pessoas sob a sua gestão (`people.mentor_id`). Mentor convidado e colaborador agem pela conta
--    de outra pessoa (`acting_account() <> auth.uid()`): ficam de fora até o dono decidir abrir.
-- ---------------------------------------------------------------------------------------------
create or replace function public.assistente_mentor_liberada()
returns boolean language sql stable security definer set search_path = public as $fn$
  select auth.uid() is not null
     and public.acting_account() = auth.uid()
     and exists (select 1 from public.people p where p.mentor_id = auth.uid());
$fn$;

comment on function public.assistente_mentor_liberada() is
  '#307 — a assistente do mentor está liberada para quem está logado? Hoje: só o dono da conta, com alunos.';

-- ---------------------------------------------------------------------------------------------
-- 2. CONVERSAS E MENSAGENS DO MENTOR.
-- ---------------------------------------------------------------------------------------------
create table public.assistente_mentor_conversas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conta_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null default 'Nova conversa',
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  unique (id, user_id, conta_id)
);

create index assistente_mentor_conversas_do_mentor
  on public.assistente_mentor_conversas (user_id, atualizada_em desc);

create table public.assistente_mentor_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  conta_id uuid not null references auth.users(id) on delete cascade,
  papel text not null check (papel in ('mentor', 'assistente')),
  conteudo text not null check (length(conteudo) > 0),
  criada_em timestamptz not null default now(),
  -- A mensagem só entra numa conversa DO MESMO mentor e da mesma conta.
  foreign key (conversa_id, user_id, conta_id)
    references public.assistente_mentor_conversas (id, user_id, conta_id) on delete cascade
);

create index assistente_mentor_mensagens_da_conversa
  on public.assistente_mentor_mensagens (conversa_id, criada_em);

comment on table public.assistente_mentor_conversas is
  '#307 — conversas do mentor com a assistente DELE (resultados e uso da plataforma). Só quem perguntou lê.';
comment on table public.assistente_mentor_mensagens is
  '#307 — mensagens das conversas do mentor. Só quem perguntou lê.';

-- Nem um servidor com defeito grava conversa de mentor para quem não é dono de conta com alunos: a
-- mesma regra da função acima, conferida sobre a linha (o servidor grava com a chave de serviço, sem
-- `auth.uid()`). Hoje conta = o próprio dono.
create or replace function public.assistente_mentor_exige_dono()
returns trigger language plpgsql set search_path = public as $fn$
begin
  if new.conta_id <> new.user_id
     or not exists (select 1 from public.people p where p.mentor_id = new.user_id) then
    raise exception 'assistente do mentor: só o dono da conta, com alunos' using errcode = '42501';
  end if;
  return new;
end;
$fn$;

create trigger assistente_mentor_conversas_exige_dono
  before insert on public.assistente_mentor_conversas
  for each row execute function public.assistente_mentor_exige_dono();

create trigger assistente_mentor_mensagens_exige_dono
  before insert on public.assistente_mentor_mensagens
  for each row execute function public.assistente_mentor_exige_dono();

-- ---------------------------------------------------------------------------------------------
-- 3. RLS: o mentor lê e apaga as PRÓPRIAS conversas. Ninguém insere pela API — quem grava é o
--    servidor, depois de conferir quem está logado. Nenhuma policy menciona aluno.
-- ---------------------------------------------------------------------------------------------
alter table public.assistente_mentor_conversas enable row level security;
alter table public.assistente_mentor_mensagens enable row level security;

create policy amconversa_read on public.assistente_mentor_conversas
  for select to authenticated using (user_id = auth.uid());

create policy amconversa_delete on public.assistente_mentor_conversas
  for delete to authenticated using (user_id = auth.uid());

create policy ammensagem_read on public.assistente_mentor_mensagens
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- 4. CUSTO: a mesma tabela de sempre, sabendo de qual assistente veio a chamada. Continua só
--    número, nenhum texto. `conversa_id` segue apontando só para conversa de ALUNO.
-- ---------------------------------------------------------------------------------------------
alter table public.assistente_uso
  add column escopo text not null default 'aluno' check (escopo in ('aluno', 'mentor')),
  add column conversa_mentor_id uuid references public.assistente_mentor_conversas(id) on delete set null;

-- Uma linha nunca aponta para a conversa da OUTRA assistente.
alter table public.assistente_uso
  add constraint assistente_uso_conversa_do_escopo check (
    (escopo = 'aluno' and conversa_mentor_id is null) or (escopo = 'mentor' and conversa_id is null)
  );

create index assistente_uso_da_conversa_mentor on public.assistente_uso (conversa_mentor_id);

comment on column public.assistente_uso.escopo is
  '#307 — de qual assistente veio a chamada: ''aluno'' (a do aluno) ou ''mentor'' (a do painel do mentor).';
comment on column public.assistente_uso.conversa_mentor_id is
  '#307 — a conversa do MENTOR desta chamada (conversa_id continua sendo só de aluno).';

-- ---------------------------------------------------------------------------------------------
-- 5. REVOGAR a assistente DO ALUNO desliga só o custo DELA. Quem é aluno numa conta e dono de outra
--    (o coach que também estuda no Método Intenção, quando a plataforma for de várias contas) não
--    perde o registro da assistente do próprio painel ao revogar a de aluno. Para todo aluno de hoje
--    o efeito é o mesmo de antes: todas as linhas existentes são 'aluno'. Mesma assinatura, mesmas
--    permissões (create or replace as preserva).
-- ---------------------------------------------------------------------------------------------
create or replace function public.assistente_revogar()
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null then
    raise exception 'assistente: sem login' using errcode = '42501';
  end if;
  update public.assistente_consentimentos
     set revogado_em = now()
   where user_id = auth.uid() and revogado_em is null;
  delete from public.assistente_conversas where user_id = auth.uid();
  update public.assistente_uso set user_id = null where user_id = auth.uid() and escopo = 'aluno';
end;
$fn$;
