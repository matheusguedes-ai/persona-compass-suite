-- #264 URGENTE: o dono pode virar mentor da própria conta e se derrubar
--
-- O QUE ACONTECEU: às 12:16 de 05/08, o Matheus usou "promover a mentor" em
-- "Fulado de Tal" — um cadastro de pessoa que é ELE MESMO (mesmo email, mesmo
-- user_id). Isso criou uma linha em team_members com owner_id = user_id =
-- Matheus, kind = 'mentor'. A partir daí, member_kind() passou a responder
-- 'mentor' em vez de 'owner', e toda política/checagem que testa
-- member_kind() <> 'mentor' passou a barrar o próprio dono da própria conta.
-- Reproduzido nesta sessão via simulação SQL (transação com rollback): com a
-- linha reativada, member_kind() responde 'mentor' — deveria responder
-- 'owner'. A linha 119c29ac-f8b2-4f1d-af8a-7fa23b433b94 já foi desativada
-- como conserto de emergência (status='inativo') e continua assim — é a
-- evidência do incidente, não é tocada por esta migração.
--
-- DUAS DEFESAS:
--
-- Defesa 1 (a porta): promover_a_mentor() recusa quando a pessoa promovida
-- já é o próprio dono (people.user_id = quem está promovendo). Fecha o
-- caminho que causou o incidente.
--
-- Defesa 2 (o piso, mais importante): acting_account(), member_kind() e
-- claim_team_membership() passam a IGNORAR qualquer linha de team_members
-- onde user_id = owner_id — um estado que nunca deveria existir, tratado
-- como se a linha não existisse. Protege contra QUALQUER caminho, inclusive
-- os que ninguém previu ainda.
--
-- Achado durante a investigação (não pedido, mesma causa raiz): a função
-- accept_team_invite() tinha o mesmo buraco — nenhuma checagem contra
-- owner_id = user_id. Um convite antigo (de mentor OU de colaborador,
-- inclusive um endereçado por engano ao próprio email do dono) aceito depois
-- entraria pela mesma porta. Mesmo conserto trivial, incluído aqui.
--
-- REGRA 5: esta migração só torna a resolução do PRÓPRIO dono mais
-- permissiva (ele volta a se ver como 'owner' em vez de travado como
-- 'mentor') — não remove nem renomeia nada que o código publicado usa. As
-- assinaturas (nome, parâmetros, tipo de retorno) de acting_account(),
-- member_kind(), claim_team_membership(), promover_a_mentor() e
-- accept_team_invite() continuam idênticas; só a lógica interna muda.
-- Pode ir antes do código, sem janela de quebra — é o oposto de uma
-- migração arriscada: ela conserta um estado quebrado. A condição usada é
-- EXATAMENTE user_id = owner_id, nada mais amplo (não "user_id não nulo",
-- não "kind = mentor") — para não excluir por engano um mentor convidado
-- de verdade, cujo owner_id é sempre diferente do seu próprio user_id.

CREATE OR REPLACE FUNCTION public.acting_account()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT tm.owner_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'ativo' AND tm.user_id <> tm.owner_id
      ORDER BY tm.created_at LIMIT 1),
    auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.member_kind()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT tm.kind FROM public.team_members tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'ativo' AND tm.user_id <> tm.owner_id
      ORDER BY tm.created_at LIMIT 1),
    'owner'
  );
$function$;

CREATE OR REPLACE FUNCTION public.claim_team_membership()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_n integer;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;

  UPDATE public.team_members tm
     SET user_id = v_uid, status = 'ativo', accepted_at = COALESCE(accepted_at, now())
   WHERE tm.kind = 'mentor'
     AND tm.user_id IS NULL
     AND tm.owner_id <> v_uid
     AND tm.person_id IN (SELECT id FROM public.people WHERE user_id = v_uid);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$;

CREATE OR REPLACE FUNCTION public.promover_a_mentor(p_person_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dono uuid := public.acting_account();
  v_pessoa record;
  v_id uuid;
BEGIN
  IF v_dono IS NULL OR v_dono <> auth.uid() THEN
    RAISE EXCEPTION 'Só o dono da conta pode promover alguém a mentor.';
  END IF;

  SELECT id, full_name, email, user_id, mentor_id INTO v_pessoa
    FROM public.people WHERE id = p_person_id AND mentor_id = v_dono;
  IF v_pessoa.id IS NULL THEN
    RAISE EXCEPTION 'Pessoa não encontrada nesta conta.';
  END IF;

  IF v_pessoa.user_id IS NOT NULL AND v_pessoa.user_id = v_dono THEN
    RAISE EXCEPTION 'Você já é o dono desta conta. Não dá para promover a si mesmo a mentor convidado.';
  END IF;

  -- 1) Já existe team_members ligado a ESTA pessoa: reaproveita.
  SELECT id INTO v_id FROM public.team_members WHERE person_id = p_person_id;
  IF v_id IS NOT NULL THEN
    UPDATE public.team_members SET kind = 'mentor', status = 'ativo' WHERE id = v_id;
    RETURN v_id;
  END IF;

  -- 2) Convite solto do modelo antigo (sem person_id), mesmo e-mail desta
  --    pessoa: liga nele em vez de duplicar -- o cuidado do Anexo 3.
  SELECT id INTO v_id FROM public.team_members
   WHERE owner_id = v_dono AND person_id IS NULL AND lower(email) = lower(v_pessoa.email);
  IF v_id IS NOT NULL THEN
    UPDATE public.team_members
       SET kind = 'mentor', status = 'ativo', person_id = p_person_id,
           user_id = v_pessoa.user_id, accepted_at = COALESCE(accepted_at, now())
     WHERE id = v_id;
    RETURN v_id;
  END IF;

  -- 3) Nada existente: cria do zero, como já era.
  INSERT INTO public.team_members (owner_id, person_id, name, email, kind, status, user_id, accepted_at)
  VALUES (
    v_dono, p_person_id, v_pessoa.full_name, lower(v_pessoa.email), 'mentor',
    CASE WHEN v_pessoa.user_id IS NULL THEN 'convidado' ELSE 'ativo' END,
    v_pessoa.user_id,
    CASE WHEN v_pessoa.user_id IS NULL THEN NULL ELSE now() END
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_team_invite(_token uuid)
 RETURNS TABLE(id uuid, kind text, owner_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_row public.team_members%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'É preciso estar logado para aceitar o convite.';
  END IF;

  SELECT tm.* INTO v_row FROM public.team_members tm WHERE tm.invite_token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;
  IF v_row.invite_expires_at IS NOT NULL AND v_row.invite_expires_at < now() THEN
    RAISE EXCEPTION 'Este convite expirou. Peça um novo.';
  END IF;
  IF v_row.status = 'inativo' THEN
    RAISE EXCEPTION 'Este convite foi desativado.';
  END IF;
  -- Já aceito por outra pessoa: não deixa trocar o dono do vínculo.
  IF v_row.user_id IS NOT NULL AND v_row.user_id <> v_uid THEN
    RAISE EXCEPTION 'Este convite já foi usado.';
  END IF;
  -- Achado durante o #264: o convite é para a própria conta (owner_id = quem
  -- está aceitando). Mesmo estado inválido do incidente, por outra porta.
  IF v_row.owner_id = v_uid THEN
    RAISE EXCEPTION 'Você já é o dono desta conta. Não dá para aceitar um convite para o seu próprio papel de dono.';
  END IF;

  -- O convite é nominal: vale para o email convidado, não para quem receber o link.
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
  IF lower(COALESCE(v_email, '')) <> lower(v_row.email) THEN
    RAISE EXCEPTION 'Este convite foi enviado para %. Entre com esse email para aceitar.', v_row.email;
  END IF;

  UPDATE public.team_members tm
     SET user_id = v_uid, status = 'ativo', accepted_at = COALESCE(tm.accepted_at, now())
   WHERE tm.id = v_row.id;

  RETURN QUERY SELECT v_row.id, v_row.kind, v_row.owner_id;
END;
$function$;
