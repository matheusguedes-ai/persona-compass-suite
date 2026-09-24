-- #289 — Assistente do Método Intenção, NÍVEL 1: o aluno conversa sobre o PRÓPRIO relatório.
--
-- Seis tabelas novas. Todas nascem com dono (regra 2): `user_id` é o aluno — o dono de verdade do
-- que ele escreve — e `conta_id` é a conta (tenant) do cadastro dele, para o dia em que houver mais
-- de uma conta na plataforma. Nenhuma aponta para `people`: a conversa é do LOGIN do aluno, então a
-- unificação de cadastros (`fundir_pessoas`) não precisa conhecê-las (o login passa para o cadastro
-- que fica, e as conversas vão junto sem ninguém mexer).
--
-- A REGRA QUE MAIS IMPORTA: O MENTOR NÃO LÊ AS CONVERSAS. Nenhuma policy daqui menciona `conta_id`,
-- `acting_account()`, `can_see_person()` ou equipe — o ÚNICO caminho de leitura é
-- `user_id = auth.uid()`. Ninguém insere pela API: quem grava é o servidor (service role), depois de
-- conferir quem está logado. A prévia "ver como aluno" roda com o login do MENTOR, então também não
-- enxerga nada daqui.
--
-- Aditiva (regra 5): nada do que está no ar procura estas tabelas. Os REVOKE/GRANT ficam no arquivo
-- seguinte (`..._acesso.sql`), sem corpo de função no meio — ver a memória "REVOKE precisa de PUBLIC".

-- ---------------------------------------------------------------------------------------------
-- 1. O TERMO, VERSIONADO. O texto é do dono do produto e entra por script
--    (`scripts/conteudo_termo_assistente.py`), nunca escrito aqui.
-- ---------------------------------------------------------------------------------------------
create table public.assistente_termos (
  id uuid primary key default gen_random_uuid(),
  versao integer not null unique check (versao > 0),
  texto text not null,
  rotulo_aceite text not null,
  status text not null default 'pendente' check (status in ('pendente', 'publicado')),
  -- NULL = termo da plataforma, vale para todas as contas (como os modelos de teste).
  conta_id uuid references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  publicado_em timestamptz
);

comment on table public.assistente_termos is
  '#289 — termo de consentimento da assistente, versionado. Publicado não se edita: versão nova.';

-- "Versão 3" tem de significar sempre o mesmo texto: é assim que se sabe o que cada pessoa aceitou.
-- Despublicar pode (é o jeito de tirar a assistente do ar); reescrever o que já foi publicado, não.
create or replace function public.assistente_termo_imutavel()
returns trigger language plpgsql set search_path = public as $fn$
begin
  if old.status = 'publicado' and (
       new.texto is distinct from old.texto
    or new.rotulo_aceite is distinct from old.rotulo_aceite
    or new.versao is distinct from old.versao) then
    raise exception 'assistente: termo publicado não se edita — cadastre uma versão nova'
      using errcode = '22023';
  end if;
  return new;
end;
$fn$;

create trigger assistente_termos_imutavel
  before update on public.assistente_termos
  for each row execute function public.assistente_termo_imutavel();

-- ---------------------------------------------------------------------------------------------
-- 2. QUEM TEM A ASSISTENTE LIBERADA. Enquanto o dono do produto valida a qualidade, ela fica
--    FECHADA para a turma: só abre para quem estiver aqui — por grupo ou por login (o mesmo desenho
--    dos destinos da Academy). SEM LINHA = FECHADA, de propósito o oposto das áreas do grupo
--    (`groups.areas_aluno` NULL = tudo liberado): lá, área nova nasce aberta; aqui não pode nascer.
-- ---------------------------------------------------------------------------------------------
create table public.assistente_liberacoes (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  check ((group_id is null) <> (user_id is null)),
  unique (group_id),
  unique (user_id)
);

comment on table public.assistente_liberacoes is
  '#289 — grupos ou logins com a assistente liberada. Sem linha = fechada.';

-- ---------------------------------------------------------------------------------------------
-- 3. CONSENTIMENTO: quando, qual versão e o texto exato que a pessoa aceitou. Revogar não apaga a
--    linha — ela é o registro de que houve autorização (e de quando acabou); o que se apaga é o
--    histórico de conversas.
-- ---------------------------------------------------------------------------------------------
create table public.assistente_consentimentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conta_id uuid not null references auth.users(id) on delete cascade,
  termo_id uuid not null references public.assistente_termos(id),
  termo_versao integer not null,
  texto_aceito text not null,
  rotulo_aceito text not null,
  aceito_em timestamptz not null default now(),
  revogado_em timestamptz
);

create unique index assistente_consentimento_ativo
  on public.assistente_consentimentos (user_id) where revogado_em is null;

comment on table public.assistente_consentimentos is
  '#289 — aceite do termo (versão + cópia do texto). Só o próprio aluno lê.';

-- O que fica registrado é o que o TERMO diz, não o que o cliente mandou: o banco copia versão e texto
-- da linha do termo, e recusa termo não publicado ou já superado por versão mais nova.
create or replace function public.assistente_confere_termo()
returns trigger language plpgsql set search_path = public as $fn$
declare
  t public.assistente_termos%rowtype;
begin
  select * into t from public.assistente_termos where id = new.termo_id;
  if t.id is null or t.status <> 'publicado' then
    raise exception 'assistente: termo não publicado' using errcode = '22023';
  end if;
  if exists (select 1 from public.assistente_termos o where o.status = 'publicado' and o.versao > t.versao) then
    raise exception 'assistente: existe versão mais nova do termo' using errcode = '22023';
  end if;
  new.termo_versao := t.versao;
  new.texto_aceito := t.texto;
  new.rotulo_aceito := t.rotulo_aceite;
  new.aceito_em := now();
  new.revogado_em := null;
  return new;
end;
$fn$;

create trigger assistente_consentimentos_confere_termo
  before insert on public.assistente_consentimentos
  for each row execute function public.assistente_confere_termo();

-- ---------------------------------------------------------------------------------------------
-- 4. CONVERSAS E MENSAGENS.
-- ---------------------------------------------------------------------------------------------
create table public.assistente_conversas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conta_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null default 'Nova conversa',
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  unique (id, user_id, conta_id)
);

create index assistente_conversas_do_aluno on public.assistente_conversas (user_id, atualizada_em desc);

create table public.assistente_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  conta_id uuid not null references auth.users(id) on delete cascade,
  papel text not null check (papel in ('aluno', 'assistente')),
  conteudo text not null check (length(conteudo) > 0),
  criada_em timestamptz not null default now(),
  -- A mensagem só entra numa conversa DO MESMO aluno — nem um servidor com defeito consegue pendurar
  -- mensagem na conversa de outra pessoa.
  foreign key (conversa_id, user_id, conta_id)
    references public.assistente_conversas (id, user_id, conta_id) on delete cascade
);

create index assistente_mensagens_da_conversa on public.assistente_mensagens (conversa_id, criada_em);

comment on table public.assistente_conversas is '#289 — conversas com a assistente. Só o próprio aluno lê.';
comment on table public.assistente_mensagens is '#289 — mensagens das conversas. Só o próprio aluno lê.';

-- Sem consentimento ativo, nada é guardado — nem por engano do servidor.
create or replace function public.assistente_exige_consentimento()
returns trigger language plpgsql set search_path = public as $fn$
begin
  if not exists (
    select 1 from public.assistente_consentimentos c
     where c.user_id = new.user_id and c.revogado_em is null) then
    raise exception 'assistente: sem consentimento ativo' using errcode = '42501';
  end if;
  return new;
end;
$fn$;

create trigger assistente_conversas_exige_consentimento
  before insert on public.assistente_conversas
  for each row execute function public.assistente_exige_consentimento();

create trigger assistente_mensagens_exige_consentimento
  before insert on public.assistente_mensagens
  for each row execute function public.assistente_exige_consentimento();

-- ---------------------------------------------------------------------------------------------
-- 5. CUSTO: uma linha por chamada ao modelo — só contagem, nenhum texto. Sobrevive quando a
--    conversa é apagada (vira "conversa removida") e perde o `user_id` quando o aluno revoga: o custo
--    da conta continua medido, sem ficar ligado à pessoa.
-- ---------------------------------------------------------------------------------------------
create table public.assistente_uso (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  conta_id uuid not null references auth.users(id) on delete cascade,
  conversa_id uuid references public.assistente_conversas(id) on delete set null,
  modelo text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_creation_input_tokens integer not null default 0,
  cache_read_input_tokens integer not null default 0,
  stop_reason text,
  duracao_ms integer,
  erro text,
  criado_em timestamptz not null default now()
);

create index assistente_uso_da_conta on public.assistente_uso (conta_id, criado_em);
create index assistente_uso_da_conversa on public.assistente_uso (conversa_id);

comment on table public.assistente_uso is
  '#289 — uma linha por chamada ao modelo (tokens, sem texto). Ninguém lê pela API.';

-- ---------------------------------------------------------------------------------------------
-- 6. RLS. Ligada em todas; as únicas leituras abertas são do PRÓPRIO aluno.
-- ---------------------------------------------------------------------------------------------
alter table public.assistente_termos enable row level security;
alter table public.assistente_liberacoes enable row level security;
alter table public.assistente_consentimentos enable row level security;
alter table public.assistente_conversas enable row level security;
alter table public.assistente_mensagens enable row level security;
alter table public.assistente_uso enable row level security;

create policy atermo_read on public.assistente_termos
  for select to authenticated using (status = 'publicado');

create policy aconsent_read on public.assistente_consentimentos
  for select to authenticated using (user_id = auth.uid());

create policy aconversa_read on public.assistente_conversas
  for select to authenticated using (user_id = auth.uid());

create policy aconversa_delete on public.assistente_conversas
  for delete to authenticated using (user_id = auth.uid());

create policy amensagem_read on public.assistente_mensagens
  for select to authenticated using (user_id = auth.uid());

-- assistente_liberacoes e assistente_uso: sem policy nenhuma — ninguém lê nem escreve pela API.

-- ---------------------------------------------------------------------------------------------
-- 7. FUNÇÕES QUE O ALUNO CHAMA. Sempre sobre `auth.uid()` — não recebem id de ninguém.
-- ---------------------------------------------------------------------------------------------

-- A assistente está liberada para quem está logado? O próprio login, ou um grupo dele.
create or replace function public.assistente_liberada()
returns boolean language sql stable security definer set search_path = public as $fn$
  select auth.uid() is not null and (
    exists (select 1 from public.assistente_liberacoes l where l.user_id = auth.uid())
    or exists (
      select 1
        from public.assistente_liberacoes l
        join public.group_members gm on gm.group_id = l.group_id
        join public.people p on p.id = gm.person_id
       where p.user_id = auth.uid())
  );
$fn$;

-- Tudo o que o menu e a tela precisam saber, numa chamada. "Relatório" segue a MESMA regra da tela de
-- resultados do aluno (`tr_student_read`): resposta própria, enviada, e a área de resultados liberada.
create or replace function public.assistente_situacao()
returns jsonb language sql stable security definer set search_path = public as $fn$
  select jsonb_build_object(
    'liberada', public.assistente_liberada(),
    'tem_relatorio', auth.uid() is not null and public.aluno_pode('resultados') and exists (
      select 1 from public.test_responses tr
       where tr.person_id in (select public.my_person_ids())
         and tr.kind = 'self'
         and tr.submitted_at is not null
         and tr.canceled_at is null),
    'termo_publicado', exists (select 1 from public.assistente_termos t where t.status = 'publicado'),
    'consentimento_ativo', exists (
      select 1 from public.assistente_consentimentos c
       where c.user_id = auth.uid() and c.revogado_em is null),
    'tem_historico', exists (select 1 from public.assistente_conversas cv where cv.user_id = auth.uid())
  );
$fn$;

-- Revogar é UMA operação: marca a revogação, apaga o histórico e desliga o registro de custo da
-- pessoa. Em partes, uma falha no meio deixaria autorização retirada com conversa guardada.
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
  update public.assistente_uso set user_id = null where user_id = auth.uid();
end;
$fn$;
