-- #dono-central — troca SÓ a checagem de "é o dono?" nas portas que já existiam, pela definição central
-- (`is_account_owner()`, ver 20260930150000). Nada mais muda: mesmas assinaturas, mesmos nomes.
--
-- Regra 5: isto MUDA regra de funções que o código publicado chama (`whatsapp_dono`, `assistente_mentor_liberada`).
-- É seguro porque, para o dono real, o resultado é idêntico (a linha dele já está em `contas`, conferido);
-- só deixa de passar quem se fazia passar por dono cadastrando uma pessoa para si mesmo.

-- WhatsApp: dono, ponto. (Antes exigia também ter pessoa cadastrada — limitação para o dono novo do SaaS.)
create or replace function public.whatsapp_dono()
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.is_account_owner();
$fn$;

-- Assistente do mentor (#307): continua sendo "dono COM alunos" — o "com alunos" é regra de produto, não de
-- identidade —, mas o "dono" agora é o central.
create or replace function public.assistente_mentor_liberada()
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.is_account_owner()
     and exists (select 1 from public.people p where p.mentor_id = auth.uid());
$fn$;

-- O gatilho das conversas do mentor tinha a mesma checagem por dentro. Lê `contas` direto (e não
-- `is_account_owner()`) porque roda também com a chave de serviço, onde `auth.uid()` é nulo.
create or replace function public.assistente_mentor_exige_dono()
returns trigger language plpgsql set search_path = public as $fn$
begin
  if new.conta_id <> new.user_id
     or not exists (select 1 from public.contas c where c.dono_id = new.user_id)
     or not exists (select 1 from public.people p where p.mentor_id = new.user_id) then
    raise exception 'assistente do mentor: só o dono da conta, com alunos' using errcode = '42501';
  end if;
  return new;
end;
$fn$;
