-- #261: a marca da tela de login vem do ENDEREÇO, não de "a conta que existir".
--
-- `dominios_conta` nasce com UMA linha (o domínio de produção → o Matheus,
-- padrao=true) — é a preparação inteira para o dia do segundo cliente: ele
-- ganha o próprio endereço e a própria cara, sem refazer nada (regra 2 do
-- CLAUDE.md). Host que não estiver na tabela (preview do Lovable, domínio
-- novo ainda sem cadastro) cai na conta marcada `padrao` — sem isso, a tela
-- de login fica sem marca nenhuma no dia em que o Lovable mudar a URL de
-- preview.
--
-- RLS ativa, SEM nenhuma policy: só a service role lê/escreve esta tabela —
-- nenhuma tela de cliente autenticado precisa consultá-la diretamente, a
-- resolução acontece só no servidor (ver resolveContaPorHost em brand.server.ts).
--
-- Migração ADITIVA: tabela nova, 3 colunas nullable em profiles, e um INSERT.
-- Nada renomeia, remove ou muda regra do que já está publicado — o código
-- antigo continua rodando sem saber que isto existe.
create table public.dominios_conta (
  id uuid primary key default gen_random_uuid(),
  dominio text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  padrao boolean not null default false,
  created_at timestamptz not null default now()
);

-- No máximo uma linha padrao=true — índice único parcial, não uma checagem
-- de aplicação, para não depender de ninguém lembrar de checar antes de inserir.
create unique index dominios_conta_um_padrao on public.dominios_conta (padrao) where padrao;

alter table public.dominios_conta enable row level security;

-- Os três campos editáveis do painel lateral da tela de login (#261). Todos
-- opcionais: sem imagem, o painel usa a cor da marca; sem frase/rodapé, a
-- linha some — nunca um espaço vazio nem um texto cravado.
alter table public.profiles
  add column login_imagem_url text,
  add column login_frase text,
  add column login_rodape text;

insert into public.dominios_conta (dominio, owner_id, padrao)
values ('assessment.metodointencao.com.br', 'b676892d-6b3a-4bcb-8e95-8ae1d15dd08f', true);
