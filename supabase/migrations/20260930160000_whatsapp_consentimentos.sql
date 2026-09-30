-- #291 F1b — CONSENTIMENTO para receber mensagens por WhatsApp, e os códigos de confirmação.
--
-- Aditiva (regra 5): tabelas, gatilhos e índices NOVOS. Nada do que está no ar procura nada daqui.
-- As tabelas apontam para `people` COM chave estrangeira — por isso a migração seguinte ensina
-- `fundir_pessoas`/`previa_fusao` a tratá-las (sem isso toda fusão seria recusada). Aplicar as duas juntas.
--
-- O QUE É GUARDADO
--   * `whatsapp_consentimentos`: UMA LINHA POR DECISÃO. Nada é sobrescrito: desligar ou mudar de nível
--     só marca `revogado_em` na linha antiga (e, ao mudar, nasce outra). O consentimento VIGENTE é a
--     linha da pessoa com `revogado_em` nulo — e o banco garante que só pode haver UMA por pessoa.
--     Guarda a versão do termo, uma CÓPIA do texto aceito e o número MASCARADO. Nunca o telefone inteiro.
--   * `whatsapp_codigos`: o código de 6 dígitos que o aluno pediu. Só o RESUMO (hash com sal) — o código
--     em si nunca é gravado. Vale 10 minutos, 5 tentativas.
--
-- QUEM LÊ E ESCREVE
--   * Consentimentos: o aluno lê os DELE; a equipe lê o que já enxerga sobre aquela pessoa (a regra é a da
--     própria tabela `people`: a policy abaixo pergunta a `people` com a RLS de quem lê). Ninguém grava
--     pela tela — só o servidor, com a chave de serviço.
--   * Códigos: ninguém lê nem grava pela tela.

create table public.whatsapp_consentimentos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,   -- o LOGIN que aceitou
  canal text not null default 'whatsapp' check (canal = 'whatsapp'),
  nivel text not null check (nivel in ('essencial', 'completo')),
  termo_versao text not null,
  texto_aceito text not null,
  destino_mascarado text not null,
  origem text not null default 'tela_aluno' check (origem = 'tela_aluno'),
  aceito_em timestamptz not null default now(),
  revogado_em timestamptz,
  revogado_motivo text check (revogado_motivo in ('desligou', 'mudou_nivel', 'fusao', 'numero_alterado'))
);

comment on table public.whatsapp_consentimentos is
  '#291 F1b — uma linha por decisão de consentimento de WhatsApp; vigente = revogado_em nulo (no máximo uma por pessoa). Só o servidor grava.';

-- No máximo UM consentimento vigente por pessoa.
create unique index whatsapp_consentimentos_vigente_unico
  on public.whatsapp_consentimentos (person_id) where revogado_em is null;
create index whatsapp_consentimentos_conta_idx on public.whatsapp_consentimentos (conta_id, aceito_em desc);

-- A conta é SEMPRE a da pessoa: preenchida pelo banco, nunca confiada ao chamador (mesmo padrão da #305).
create or replace function public.whatsapp_consentimento_guarda()
returns trigger language plpgsql set search_path = public as $fn$
begin
  if tg_op = 'INSERT' then
    select p.mentor_id into new.conta_id from public.people p where p.id = new.person_id;
    if new.conta_id is null then raise exception 'consentimento: pessoa não encontrada'; end if;
    return new;
  end if;
  -- UPDATE: só é permitido REVOGAR (uma vez). O resto do registro é histórico e não muda.
  -- (Pessoa e conta mudam de valor só na fusão de cadastros, que religa o histórico ao cadastro mantido.)
  if old.revogado_em is not null
     and (new.revogado_em is distinct from old.revogado_em or new.revogado_motivo is distinct from old.revogado_motivo) then
    raise exception 'consentimento: uma revogação não se desfaz nem se altera';
  end if;
  if (new.id, new.conta_id, new.user_id, new.canal, new.nivel, new.termo_versao, new.texto_aceito,
      new.destino_mascarado, new.origem, new.aceito_em)
     is distinct from
     (old.id, old.conta_id, old.user_id, old.canal, old.nivel, old.termo_versao, old.texto_aceito,
      old.destino_mascarado, old.origem, old.aceito_em) then
    raise exception 'consentimento: só a revogação pode ser gravada; o registro do aceite não muda';
  end if;
  return new;
end;
$fn$;

create trigger whatsapp_consentimento_guarda_ins before insert on public.whatsapp_consentimentos
  for each row execute function public.whatsapp_consentimento_guarda();
create trigger whatsapp_consentimento_guarda_upd before update on public.whatsapp_consentimentos
  for each row execute function public.whatsapp_consentimento_guarda();

alter table public.whatsapp_consentimentos enable row level security;

create policy whatsapp_consentimentos_le on public.whatsapp_consentimentos
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.people p where p.id = whatsapp_consentimentos.person_id)
  );

revoke all on public.whatsapp_consentimentos from public, anon, authenticated;
grant select on public.whatsapp_consentimentos to authenticated;
grant all on public.whatsapp_consentimentos to service_role;

-- ---------------------------------------------------------------------------------------------
create table public.whatsapp_codigos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nivel text not null check (nivel in ('essencial', 'completo')),
  telefone_mascarado text not null,
  codigo_hash text not null,          -- resumo do código; o código NUNCA é gravado
  sal text not null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  tentativas integer not null default 0,
  enviado boolean not null default false,   -- só conta no limite de 3 por hora se a mensagem saiu
  invalidado_em timestamptz,
  consumido_em timestamptz
);

comment on table public.whatsapp_codigos is
  '#291 F1b — códigos de confirmação pedidos pelo aluno. Só o resumo (hash+sal); nunca o código. Ninguém lê nem grava pela tela.';

create index whatsapp_codigos_usuario_idx on public.whatsapp_codigos (user_id, criado_em desc);

alter table public.whatsapp_codigos enable row level security;
revoke all on public.whatsapp_codigos from public, anon, authenticated;
grant all on public.whatsapp_codigos to service_role;
