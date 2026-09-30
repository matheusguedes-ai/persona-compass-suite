-- #316, fatia A — as quatro CHAVES de privacidade da assistente, na mão do aluno, e o registro que diz
-- quem aceitou QUAL versão do termo e COM QUAIS chaves.
--
-- As chaves (aprovadas pelo dono do produto em 28/09/2026) são INDEPENDENTES, não uma escala:
--   1. lembrar_conversas    "Lembrar das nossas conversas"             — fica entre o aluno e a assistente
--   2. aprender_plataforma  "Aprender com o que eu faço na plataforma" — fica entre o aluno e a assistente
--   3. mentor_acompanha     "Meu mentor acompanha meu progresso"       — SAI do aluno (para o mentor)
--   4. melhorar_assistente  "Ajudar a melhorar a assistente"           — SAI do aluno (despersonalizado)
--
-- Regras que moram AQUI, no banco, e não na tela:
--   - tudo começa DESLIGADO: sem linha = tudo desligado, e nenhuma função liga chave por conta própria;
--   - a 3 só liga com a 1 ligada, e desliga JUNTO quando a 1 desliga (CHECK + `assistente_gravar_chaves`);
--   - desligar exige a ESCOLHA, chave por chave, do que acontece com o que ela guardou: apagar ou manter
--     em espera — a função recusa desligar sem a escolha;
--   - chave só liga sob um termo que as EXPLICA (`assistente_termos.explica_chaves`): sob o texto de
--     19/09, que não fala delas, nenhuma liga — desligar, sim, sempre pode;
--   - toda mudança vira uma linha no registro, com a versão do termo em vigor para aquela pessoa.
--
-- Esta fatia NÃO liga função nenhuma: a memória (fatia B), o aprendizado com a plataforma, o resumo ao
-- mentor (fatia D) e a calibragem ainda não existem. Quando nascerem, leem o estado daqui, e cada uma
-- acrescenta em `assistente_apagar_guardado` o que guarda — a ÚNICA porta por onde "apagar" chega aos
-- dados de uma chave (desligar com "apagar", "apagar tudo" e revogar passam todos por ela).
--
-- Donos (regra 2): `user_id` é o LOGIN do aluno (o dono de verdade da escolha) e `conta_id` a conta do
-- cadastro dele — o mesmo par das outras tabelas da assistente. Nenhuma aponta para `people`, então a
-- unificação de cadastros (`fundir_pessoas`) não precisa conhecê-las.
--
-- Regra 5 — o que isto muda no que já está no ar: nada é removido nem renomeado. Muda regra em três
-- pontos, e nos três o resultado para o código publicado continua o mesmo, porque dependem de aceite
-- SUBSTITUÍDO, que só o código novo cria (quando o aluno aceita uma versão mais nova do termo):
--   (a) o índice "um consentimento ativo por aluno" passa a ignorar os substituídos;
--   (b) `assistente_exige_consentimento` e `assistente_situacao().consentimento_ativo`, idem;
--   (c) `assistente_revogar` passa também a desligar as chaves e registrar — o que já fazia, faz igual.
-- Os acessos (REVOKE/GRANT) ficam no arquivo seguinte, sem corpo de função no meio.

-- ============================================================================ 1. o termo sabe se explica as chaves
alter table public.assistente_termos
  add column if not exists explica_chaves boolean not null default false;

comment on column public.assistente_termos.explica_chaves is
  '#316A: este texto explica as quatro chaves. Só sob um termo assim a tela mostra chaves e o banco aceita ligar alguma.';

-- Publicado não se edita — agora também a marca de que explica as chaves.
create or replace function public.assistente_termo_imutavel()
returns trigger language plpgsql set search_path = public as $fn$
begin
  if old.status = 'publicado' and (
       new.texto is distinct from old.texto
    or new.rotulo_aceite is distinct from old.rotulo_aceite
    or new.versao is distinct from old.versao
    or new.explica_chaves is distinct from old.explica_chaves) then
    raise exception 'assistente: termo publicado não se edita — cadastre uma versão nova'
      using errcode = '22023';
  end if;
  return new;
end;
$fn$;

-- ============================================================================ 2. aceite substituído por versão nova
-- Aceitar uma versão mais nova não APAGA o aceite anterior — ele é o registro do que a pessoa aceitou
-- antes — nem o REVOGA (revogar apaga o histórico de conversas; mudar de versão, não).
alter table public.assistente_consentimentos
  add column if not exists substituido_em timestamptz;

comment on column public.assistente_consentimentos.substituido_em is
  '#316A: quando o aluno aceitou uma versão MAIS NOVA do termo. A linha fica. Vigente = não revogada e não substituída.';

drop index if exists public.assistente_consentimento_ativo;
create unique index if not exists assistente_consentimento_vigente
  on public.assistente_consentimentos (user_id) where revogado_em is null and substituido_em is null;

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
  new.substituido_em := null;
  return new;
end;
$fn$;

-- Sem consentimento VIGENTE, nada é guardado — nem por engano do servidor.
create or replace function public.assistente_exige_consentimento()
returns trigger language plpgsql set search_path = public as $fn$
begin
  if not exists (
    select 1 from public.assistente_consentimentos c
     where c.user_id = new.user_id and c.revogado_em is null and c.substituido_em is null) then
    raise exception 'assistente: sem consentimento ativo' using errcode = '42501';
  end if;
  return new;
end;
$fn$;

-- ============================================================================ 3. as chaves e o registro
create table if not exists public.assistente_chaves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  conta_id uuid not null references auth.users(id) on delete cascade,
  lembrar_conversas boolean not null default false,
  aprender_plataforma boolean not null default false,
  mentor_acompanha boolean not null default false,
  melhorar_assistente boolean not null default false,
  atualizado_em timestamptz not null default now(),
  constraint achave_mentor_precisa_da_memoria check (not mentor_acompanha or lembrar_conversas)
);

comment on table public.assistente_chaves is
  '#316A: o estado ATUAL das quatro chaves de privacidade do aluno. Sem linha = todas desligadas. Só o próprio aluno lê; só as funções da assistente gravam.';

create table if not exists public.assistente_chaves_registro (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conta_id uuid not null references auth.users(id) on delete cascade,
  -- O aceite em vigor naquele momento (a versão e o TEXTO que valiam) — NULL só em "apagar tudo" e
  -- revogação de quem já não tinha aceite vigente.
  consentimento_id uuid references public.assistente_consentimentos(id) on delete cascade,
  termo_versao integer,
  evento text not null check (evento in ('aceite', 'mudanca', 'apagar_tudo', 'revogacao')),
  -- O estado das quatro chaves DEPOIS do evento.
  lembrar_conversas boolean not null,
  aprender_plataforma boolean not null,
  mentor_acompanha boolean not null,
  melhorar_assistente boolean not null,
  -- As que estavam ligadas e desligaram neste evento, e a escolha feita para cada uma
  -- ({"lembrar_conversas": "manter", ...}).
  desligadas text[] not null default '{}',
  ao_desligar jsonb,
  -- Quantas linhas "apagar" removeu (conversas, e o que as chaves guardavam).
  apagados integer not null default 0,
  -- A hora do RELÓGIO, não a do início da transação: dois eventos numa mesma operação ficam em ordem.
  criado_em timestamptz not null default clock_timestamp(),
  constraint achreg_aceite_tem_termo
    check (evento not in ('aceite', 'mudanca') or (consentimento_id is not null and termo_versao is not null)),
  constraint achreg_desligar_tem_escolha check (cardinality(desligadas) = 0 or ao_desligar is not null),
  constraint achreg_mentor_precisa_da_memoria check (not mentor_acompanha or lembrar_conversas)
);

create index if not exists assistente_chaves_registro_do_aluno
  on public.assistente_chaves_registro (user_id, criado_em);

comment on table public.assistente_chaves_registro is
  '#316A: histórico das escolhas — cada aceite, mudança de chave, "apagar tudo" e revogação, com a versão do termo em vigor e o estado das chaves depois do evento. Não se edita. Só o próprio aluno lê.';

-- O registro é a prova do que cada pessoa escolheu: não se reescreve. (Apagar a linha continua possível
-- só em cascata, quando o próprio login é apagado — um gatilho de DELETE bloquearia isso também.)
create or replace function public.assistente_registro_imutavel()
returns trigger language plpgsql set search_path = public as $fn$
begin
  raise exception 'assistente: o registro das chaves não se edita' using errcode = '22023';
end;
$fn$;

drop trigger if exists assistente_chaves_registro_imutavel on public.assistente_chaves_registro;
create trigger assistente_chaves_registro_imutavel
  before update on public.assistente_chaves_registro
  for each row execute function public.assistente_registro_imutavel();

alter table public.assistente_chaves enable row level security;
alter table public.assistente_chaves_registro enable row level security;

drop policy if exists achave_read on public.assistente_chaves;
create policy achave_read on public.assistente_chaves
  for select to authenticated using (user_id = auth.uid());

drop policy if exists achreg_read on public.assistente_chaves_registro;
create policy achreg_read on public.assistente_chaves_registro
  for select to authenticated using (user_id = auth.uid());
-- Sem policy de escrita: quem grava são as funções abaixo, sempre sobre `auth.uid()`.

-- ============================================================================ 4. peças internas (ninguém chama de fora)

-- O estado das quatro chaves de alguém, com as que não existem na tabela valendo "desligada".
create or replace function public.assistente_chaves_de(_user_id uuid)
returns jsonb language sql stable set search_path = public as $fn$
  select jsonb_build_object(
    'lembrar_conversas', coalesce(k.lembrar_conversas, false),
    'aprender_plataforma', coalesce(k.aprender_plataforma, false),
    'mentor_acompanha', coalesce(k.mentor_acompanha, false),
    'melhorar_assistente', coalesce(k.melhorar_assistente, false))
    from (select 1) um
    left join public.assistente_chaves k on k.user_id = _user_id;
$fn$;

-- A ÚNICA porta por onde "apagar" chega ao que uma chave guardou. Hoje nenhuma chave guarda nada — as
-- funções que elas ligam ainda não existem —, então ela devolve 0. Cada fatia que nascer (B: memória,
-- chave lembrar_conversas; o aprendizado, aprender_plataforma; D: o resumo ao mentor, mentor_acompanha;
-- a calibragem, melhorar_assistente) acrescenta AQUI o DELETE do que guarda para `_user_id` quando a sua
-- chave estiver em `_chaves`, somando em `v_total`.
create or replace function public.assistente_apagar_guardado(_user_id uuid, _chaves text[])
returns integer language plpgsql set search_path = public as $fn$
declare
  v_total integer := 0;
begin
  if _user_id is null or _chaves is null then
    return 0;
  end if;
  return v_total;
end;
$fn$;

-- Grava a escolha e o registro. Só é chamada de dentro das funções do aluno, que já conferiram quem é
-- e com qual aceite. Devolve {"mudou", "apagados", "desligadas"}.
create or replace function public.assistente_gravar_chaves(
  _user_id uuid, _conta_id uuid, _consentimento_id uuid, _termo_versao integer, _evento text,
  _lembrar_conversas boolean, _aprender_plataforma boolean, _mentor_acompanha boolean,
  _melhorar_assistente boolean, _ao_desligar jsonb)
returns jsonb language plpgsql set search_path = public as $fn$
declare
  v_antes public.assistente_chaves%rowtype;
  v_lembrar boolean := coalesce(_lembrar_conversas, false);
  v_aprender boolean := coalesce(_aprender_plataforma, false);
  v_mentor boolean := coalesce(_mentor_acompanha, false);
  v_melhorar boolean := coalesce(_melhorar_assistente, false);
  v_desligadas text[] := '{}';
  v_escolhas jsonb := '{}'::jsonb;
  v_apagar text[] := '{}';
  v_apagados integer := 0;
  v_chave text;
begin
  select * into v_antes from public.assistente_chaves where user_id = _user_id;

  -- A 3 só com a 1. Desligar a 1 desliga a 3 junto; pedir a 3 com a 1 desligada, sem que ela já
  -- estivesse ligada, é pedido impossível — recusa, em vez de ligar pela metade.
  if v_mentor and not v_lembrar then
    if coalesce(v_antes.mentor_acompanha, false) then
      v_mentor := false;
    else
      raise exception 'assistente: “Meu mentor acompanha meu progresso” só liga com “Lembrar das nossas conversas” ligada'
        using errcode = '22023';
    end if;
  end if;

  if coalesce(v_antes.lembrar_conversas, false) and not v_lembrar then
    v_desligadas := v_desligadas || 'lembrar_conversas'::text;
  end if;
  if coalesce(v_antes.aprender_plataforma, false) and not v_aprender then
    v_desligadas := v_desligadas || 'aprender_plataforma'::text;
  end if;
  if coalesce(v_antes.mentor_acompanha, false) and not v_mentor then
    v_desligadas := v_desligadas || 'mentor_acompanha'::text;
  end if;
  if coalesce(v_antes.melhorar_assistente, false) and not v_melhorar then
    v_desligadas := v_desligadas || 'melhorar_assistente'::text;
  end if;

  -- Desligar pede a escolha, chave por chave: apagar o que ela guardou, ou manter em espera.
  foreach v_chave in array v_desligadas loop
    if coalesce(_ao_desligar ->> v_chave, '') not in ('apagar', 'manter') then
      raise exception 'assistente: ao desligar “%”, escolha entre apagar o que foi guardado ou manter em espera', v_chave
        using errcode = '22023';
    end if;
    v_escolhas := v_escolhas || jsonb_build_object(v_chave, _ao_desligar ->> v_chave);
    if _ao_desligar ->> v_chave = 'apagar' then
      v_apagar := v_apagar || v_chave;
    end if;
  end loop;
  if cardinality(v_apagar) > 0 then
    v_apagados := public.assistente_apagar_guardado(_user_id, v_apagar);
  end if;

  -- Mudança que não muda nada (clique repetido) não vira registro.
  if _evento = 'mudanca'
     and coalesce(v_antes.lembrar_conversas, false) = v_lembrar
     and coalesce(v_antes.aprender_plataforma, false) = v_aprender
     and coalesce(v_antes.mentor_acompanha, false) = v_mentor
     and coalesce(v_antes.melhorar_assistente, false) = v_melhorar then
    return jsonb_build_object('mudou', false, 'apagados', 0, 'desligadas', '[]'::jsonb);
  end if;

  insert into public.assistente_chaves (user_id, conta_id, lembrar_conversas, aprender_plataforma,
                                        mentor_acompanha, melhorar_assistente, atualizado_em)
  values (_user_id, _conta_id, v_lembrar, v_aprender, v_mentor, v_melhorar, now())
  on conflict (user_id) do update set
    conta_id = excluded.conta_id,
    lembrar_conversas = excluded.lembrar_conversas,
    aprender_plataforma = excluded.aprender_plataforma,
    mentor_acompanha = excluded.mentor_acompanha,
    melhorar_assistente = excluded.melhorar_assistente,
    atualizado_em = excluded.atualizado_em;

  insert into public.assistente_chaves_registro (
    user_id, conta_id, consentimento_id, termo_versao, evento,
    lembrar_conversas, aprender_plataforma, mentor_acompanha, melhorar_assistente,
    desligadas, ao_desligar, apagados)
  values (
    _user_id, _conta_id, _consentimento_id, _termo_versao, _evento,
    v_lembrar, v_aprender, v_mentor, v_melhorar,
    v_desligadas, case when cardinality(v_desligadas) > 0 then v_escolhas end, v_apagados);

  return jsonb_build_object('mudou', true, 'apagados', v_apagados, 'desligadas', to_jsonb(v_desligadas));
end;
$fn$;

-- ============================================================================ 5. o que o aluno chama (sempre sobre auth.uid())

-- Aceitar o termo em vigor, junto com a escolha das chaves. Quem já tinha aceitado uma versão anterior
-- tem o aceite antigo marcado como substituído (fica guardado) e um novo registrado — as conversas não
-- mudam. `_ao_desligar` só importa se o aluno desligou, nesta tela, alguma chave que estava ligada.
create or replace function public.assistente_aceitar(
  _termo_id uuid,
  _lembrar_conversas boolean default false,
  _aprender_plataforma boolean default false,
  _mentor_acompanha boolean default false,
  _melhorar_assistente boolean default false,
  _ao_desligar jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_user uuid := auth.uid();
  v_termo public.assistente_termos%rowtype;
  v_vigente public.assistente_consentimentos%rowtype;
  v_novo public.assistente_consentimentos%rowtype;
  v_conta uuid;
begin
  if v_user is null then
    raise exception 'assistente: sem login' using errcode = '42501';
  end if;
  if not public.assistente_liberada() then
    raise exception 'assistente: não liberada' using errcode = '42501';
  end if;
  select * into v_termo from public.assistente_termos where id = _termo_id and status = 'publicado';
  if v_termo.id is null then
    raise exception 'assistente: termo não publicado' using errcode = '22023';
  end if;

  select * into v_vigente from public.assistente_consentimentos
   where user_id = v_user and revogado_em is null and substituido_em is null;
  -- Duplo clique, ou a mesma versão aceita em duas abas: já está em dia, nada muda.
  if v_vigente.id is not null and v_vigente.termo_versao >= v_termo.versao then
    return jsonb_build_object('ok', true, 'ja_aceito', true, 'termo_versao', v_vigente.termo_versao);
  end if;

  v_conta := public.conta_do_autor(v_user);
  if v_vigente.id is not null then
    update public.assistente_consentimentos set substituido_em = now() where id = v_vigente.id;
  end if;
  -- O gatilho copia versão e texto da linha do termo e recusa versão superada — o que fica registrado é
  -- o que o TERMO diz, não o que veio do cliente.
  insert into public.assistente_consentimentos (user_id, conta_id, termo_id, termo_versao, texto_aceito, rotulo_aceito)
  values (v_user, v_conta, v_termo.id, v_termo.versao, v_termo.texto, v_termo.rotulo_aceite)
  returning * into v_novo;

  -- Termo que não explica as chaves não liga nenhuma: o aceite fica registrado com todas desligadas.
  perform public.assistente_gravar_chaves(
    v_user, v_conta, v_novo.id, v_novo.termo_versao, 'aceite',
    v_termo.explica_chaves and coalesce(_lembrar_conversas, false),
    v_termo.explica_chaves and coalesce(_aprender_plataforma, false),
    v_termo.explica_chaves and coalesce(_mentor_acompanha, false),
    v_termo.explica_chaves and coalesce(_melhorar_assistente, false),
    _ao_desligar);

  return jsonb_build_object('ok', true, 'ja_aceito', false, 'termo_versao', v_novo.termo_versao);
end;
$fn$;

-- Mudar as chaves depois do aceite. LIGAR pede o aceite em dia com um termo que explica as chaves;
-- DESLIGAR vale sempre (é direito, não depende de aceitar texto novo).
create or replace function public.assistente_definir_chaves(
  _lembrar_conversas boolean,
  _aprender_plataforma boolean,
  _mentor_acompanha boolean,
  _melhorar_assistente boolean,
  _ao_desligar jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_user uuid := auth.uid();
  v_vigente public.assistente_consentimentos%rowtype;
  v_antes public.assistente_chaves%rowtype;
  v_explica boolean;
  v_atual integer;
  v_liga boolean;
  v_resultado jsonb;
begin
  if v_user is null then
    raise exception 'assistente: sem login' using errcode = '42501';
  end if;
  select * into v_vigente from public.assistente_consentimentos
   where user_id = v_user and revogado_em is null and substituido_em is null;
  if v_vigente.id is null then
    raise exception 'assistente: sem consentimento ativo' using errcode = '42501';
  end if;

  select * into v_antes from public.assistente_chaves where user_id = v_user;
  v_liga := (coalesce(_lembrar_conversas, false) and not coalesce(v_antes.lembrar_conversas, false))
         or (coalesce(_aprender_plataforma, false) and not coalesce(v_antes.aprender_plataforma, false))
         or (coalesce(_mentor_acompanha, false) and not coalesce(v_antes.mentor_acompanha, false))
         or (coalesce(_melhorar_assistente, false) and not coalesce(v_antes.melhorar_assistente, false));
  if v_liga then
    select max(t.versao) into v_atual from public.assistente_termos t where t.status = 'publicado';
    if v_vigente.termo_versao < coalesce(v_atual, 0) then
      raise exception 'assistente: o termo mudou — leia e aceite a versão nova antes de ligar uma chave'
        using errcode = '22023';
    end if;
    select t.explica_chaves into v_explica from public.assistente_termos t where t.id = v_vigente.termo_id;
    if not coalesce(v_explica, false) then
      raise exception 'assistente: o termo que você aceitou não explica as chaves' using errcode = '22023';
    end if;
  end if;

  v_resultado := public.assistente_gravar_chaves(
    v_user, v_vigente.conta_id, v_vigente.id, v_vigente.termo_versao, 'mudanca',
    _lembrar_conversas, _aprender_plataforma, _mentor_acompanha, _melhorar_assistente, _ao_desligar);
  return v_resultado || jsonb_build_object('chaves', public.assistente_chaves_de(v_user));
end;
$fn$;

-- Apagar TUDO o que o aluno informou à assistente: as conversas e o que as chaves guardaram (inclusive o
-- que estava em espera). Não revoga nem mexe nas chaves — é o dado que some, não a escolha. Os números de
-- uso perdem o vínculo com a pessoa. O aceite e o registro das chaves ficam: são a prova do que ele
-- autorizou, e ganham a linha "apagar_tudo".
create or replace function public.assistente_apagar_tudo()
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_user uuid := auth.uid();
  v_vigente public.assistente_consentimentos%rowtype;
  v_conversas integer := 0;
  v_outros integer := 0;
  v_chaves jsonb;
begin
  if v_user is null then
    raise exception 'assistente: sem login' using errcode = '42501';
  end if;
  with apagadas as (
    delete from public.assistente_conversas where user_id = v_user returning 1
  )
  select count(*) into v_conversas from apagadas;
  update public.assistente_uso set user_id = null where user_id = v_user and escopo = 'aluno';
  v_outros := public.assistente_apagar_guardado(
    v_user, array['lembrar_conversas', 'aprender_plataforma', 'mentor_acompanha', 'melhorar_assistente']);

  select * into v_vigente from public.assistente_consentimentos
   where user_id = v_user and revogado_em is null and substituido_em is null;
  v_chaves := public.assistente_chaves_de(v_user);
  insert into public.assistente_chaves_registro (
    user_id, conta_id, consentimento_id, termo_versao, evento,
    lembrar_conversas, aprender_plataforma, mentor_acompanha, melhorar_assistente, apagados)
  values (
    v_user, coalesce(v_vigente.conta_id, public.conta_do_autor(v_user)), v_vigente.id, v_vigente.termo_versao,
    'apagar_tudo',
    (v_chaves ->> 'lembrar_conversas')::boolean, (v_chaves ->> 'aprender_plataforma')::boolean,
    (v_chaves ->> 'mentor_acompanha')::boolean, (v_chaves ->> 'melhorar_assistente')::boolean,
    v_conversas + v_outros);

  return jsonb_build_object('conversas', v_conversas, 'outros', v_outros);
end;
$fn$;

-- Revogar é UMA operação: marca a revogação (de toda a cadeia de aceites), apaga o histórico, desliga o
-- registro de custo da pessoa e — #316A — desliga as quatro chaves e apaga o que elas guardaram
-- (inclusive o que estava em espera), deixando a linha "revogacao" no registro.
create or replace function public.assistente_revogar()
returns void language plpgsql security definer set search_path = public as $fn$
declare
  v_user uuid := auth.uid();
  v_vigente public.assistente_consentimentos%rowtype;
  v_antes public.assistente_chaves%rowtype;
  v_desligadas text[] := '{}';
  v_apagados integer := 0;
begin
  if v_user is null then
    raise exception 'assistente: sem login' using errcode = '42501';
  end if;
  select * into v_vigente from public.assistente_consentimentos
   where user_id = v_user and revogado_em is null and substituido_em is null;
  update public.assistente_consentimentos
     set revogado_em = now()
   where user_id = v_user and revogado_em is null;
  delete from public.assistente_conversas where user_id = v_user;
  update public.assistente_uso set user_id = null where user_id = v_user and escopo = 'aluno';

  v_apagados := public.assistente_apagar_guardado(
    v_user, array['lembrar_conversas', 'aprender_plataforma', 'mentor_acompanha', 'melhorar_assistente']);
  select * into v_antes from public.assistente_chaves where user_id = v_user;
  if v_antes.user_id is null and v_vigente.id is null then
    return;
  end if;
  if coalesce(v_antes.lembrar_conversas, false) then v_desligadas := v_desligadas || 'lembrar_conversas'::text; end if;
  if coalesce(v_antes.aprender_plataforma, false) then v_desligadas := v_desligadas || 'aprender_plataforma'::text; end if;
  if coalesce(v_antes.mentor_acompanha, false) then v_desligadas := v_desligadas || 'mentor_acompanha'::text; end if;
  if coalesce(v_antes.melhorar_assistente, false) then v_desligadas := v_desligadas || 'melhorar_assistente'::text; end if;
  if v_antes.user_id is not null then
    update public.assistente_chaves
       set lembrar_conversas = false, aprender_plataforma = false, mentor_acompanha = false,
           melhorar_assistente = false, atualizado_em = now()
     where user_id = v_user;
  end if;
  insert into public.assistente_chaves_registro (
    user_id, conta_id, consentimento_id, termo_versao, evento,
    lembrar_conversas, aprender_plataforma, mentor_acompanha, melhorar_assistente,
    desligadas, ao_desligar, apagados)
  values (
    v_user, coalesce(v_vigente.conta_id, v_antes.conta_id, public.conta_do_autor(v_user)),
    v_vigente.id, v_vigente.termo_versao, 'revogacao',
    false, false, false, false,
    v_desligadas,
    case when cardinality(v_desligadas) > 0
         then (select jsonb_object_agg(d, 'apagar'::text) from unnest(v_desligadas) as d) end,
    v_apagados);
end;
$fn$;

-- A situação que a tela e o menu pedem: a mesma de antes (corpo conferido por pg_get_functiondef em
-- 30/09) com `consentimento_ativo` ignorando aceite substituído, e cinco chaves a mais — quem não as lê
-- não percebe nada.
create or replace function public.assistente_situacao()
returns jsonb language sql stable security definer set search_path = public as $fn$
  with vigente as (
    select c.termo_id, c.termo_versao
      from public.assistente_consentimentos c
     where c.user_id = auth.uid() and c.revogado_em is null and c.substituido_em is null
  ), atual as (
    select max(t.versao) as versao from public.assistente_termos t where t.status = 'publicado'
  )
  select jsonb_build_object(
    'liberada', public.assistente_liberada(),
    'tem_relatorio', auth.uid() is not null and public.aluno_pode('resultados') and exists (
      select 1 from public.test_responses tr
       where tr.person_id in (select public.my_person_ids())
         and tr.kind = 'self'
         and tr.submitted_at is not null
         and tr.canceled_at is null),
    'termo_publicado', exists (select 1 from public.assistente_termos t where t.status = 'publicado'),
    'consentimento_ativo', exists (select 1 from vigente),
    'tem_historico', exists (select 1 from public.assistente_conversas cv where cv.user_id = auth.uid()),
    'categorias', to_jsonb(public.assistente_categorias()),
    -- #316A
    'termo_versao', (select a.versao from atual a),
    'consentimento_versao', (select v.termo_versao from vigente v),
    'consentimento_em_dia', exists (select 1 from vigente v, atual a where v.termo_versao >= a.versao),
    'chaves_disponiveis', coalesce((
      select t.explica_chaves from vigente v join public.assistente_termos t on t.id = v.termo_id), false),
    'chaves', public.assistente_chaves_de(auth.uid())
  );
$fn$;
