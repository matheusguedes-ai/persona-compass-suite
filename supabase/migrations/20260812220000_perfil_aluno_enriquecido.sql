-- #52 — perfil do aluno enriquecido: empresa, banner de capa, redes sociais.
--
-- Primeira de uma leva de quatro sobre Comunidade/perfil (#52 → #55 → #54 →
-- #56). Três campos novos, todos OPCIONAIS — quem não preenche nada continua
-- com o perfil exatamente como hoje.
--
-- Sem bucket novo: o banner reaproveita 'avatares', o mesmo bucket e as
-- mesmas policies (leitura/escrita só na própria pasta) que avatar_url já
-- usa — só muda o prefixo do arquivo (banner-... em vez de foto-...), e as
-- policies checam a PASTA (o user_id), não o nome do arquivo.

-- 1. As 5 colunas — sem NOT NULL, sem default. Aditivo puro.
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS site_url text;

-- 2. update_my_person ganha 5 parâmetros, todos com DEFAULT NULL.
--
--    ACHADO ao aplicar: CREATE OR REPLACE com parâmetros NOVOS no fim, mesmo
--    com DEFAULT, não troca a função em vigor — Postgres cria uma SEGUNDA
--    sobrecarga (outro OID), e a de 3 argumentos continua existindo, intacta,
--    do lado da nova de 8. Isso é o que o código publicado HOJE ainda chama
--    (3 argumentos nomeados), então continua funcionando sem mudança — mas a
--    função nova nasce com o grant padrão do Postgres (PUBLIC, logo também
--    `anon`), diferente do original (só `authenticated`). Corrigido abaixo,
--    reaplicando explicitamente o mesmo REVOKE/GRANT do original.
--
--    A de 3 argumentos fica órfã, mas viva, até o código novo (que passa os
--    8 argumentos nomeados) publicar — só então uma migração seguinte apaga
--    a antiga. Mesmo passo a passo da Regra 5: aditivo primeiro, código
--    depois, remoção da forma antiga por último.
CREATE OR REPLACE FUNCTION public.update_my_person(
  _full_name text,
  _phone text DEFAULT NULL,
  _avatar_url text DEFAULT NULL,
  _company_name text DEFAULT NULL,
  _banner_url text DEFAULT NULL,
  _linkedin_url text DEFAULT NULL,
  _instagram_url text DEFAULT NULL,
  _site_url text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_n integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'É preciso estar logado.';
  END IF;
  IF length(btrim(COALESCE(_full_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Informe o seu nome.';
  END IF;

  UPDATE public.people p
     SET full_name     = btrim(_full_name),
         phone         = NULLIF(btrim(COALESCE(_phone, '')), ''),
         avatar_url    = NULLIF(btrim(COALESCE(_avatar_url, '')), ''),
         company_name  = NULLIF(btrim(COALESCE(_company_name, '')), ''),
         banner_url    = NULLIF(btrim(COALESCE(_banner_url, '')), ''),
         linkedin_url  = NULLIF(btrim(COALESCE(_linkedin_url, '')), ''),
         instagram_url = NULLIF(btrim(COALESCE(_instagram_url, '')), ''),
         site_url      = NULLIF(btrim(COALESCE(_site_url, '')), '')
   WHERE p.user_id = v_uid;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- Mesmo REVOKE/GRANT do original (20260729020000) — sem isto a sobrecarga
-- nova nasce aberta a PUBLIC/anon, como o achado do comentário acima explica.
REVOKE EXECUTE ON FUNCTION public.update_my_person(text,text,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_person(text,text,text,text,text,text,text,text) TO authenticated;

-- 3. perfil_do_colega passa a devolver as 5 colunas novas. Postgres não
--    deixa trocar o "shape" de retorno de uma função TABLE com CREATE OR
--    REPLACE (mesma situação da #273) — precisa de DROP antes. Seguro:
--    o único chamador (perfilDoColega, em comunidade.functions.ts) já lê o
--    resultado por um cast manual com um tipo local, não pelo tipo gerado —
--    colunas extras não quebram nada enquanto o código velho ainda estiver
--    no ar.
--
--    Visibilidade: EXATAMENTE a mesma regra de hoje, sem nenhuma mudança —
--    company_name e banner_url seguem o padrão de role_at_company/
--    avatar_url (sempre visíveis, identificam a pessoa); os 3 links de rede
--    social seguem o padrão de profession/email/phone (só quem já pode ver
--    o contato, ou seja `perfil_visivel OR mentor_id = auth.uid()`, a MESMA
--    condição, copiada, não uma nova).
DROP FUNCTION IF EXISTS public.perfil_do_colega(uuid);

CREATE FUNCTION public.perfil_do_colega(p_person uuid)
RETURNS TABLE (
  id uuid, full_name text, avatar_url text, role_at_company text,
  company_name text, banner_url text,
  profession text, email text, phone text,
  linkedin_url text, instagram_url text, site_url text,
  autorizou boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    p.id, p.full_name, p.avatar_url, p.role_at_company,
    p.company_name, p.banner_url,
    CASE WHEN p.perfil_visivel OR p.mentor_id = auth.uid() THEN p.profession END,
    CASE WHEN p.perfil_visivel OR p.mentor_id = auth.uid() THEN p.email END,
    CASE WHEN p.perfil_visivel OR p.mentor_id = auth.uid() THEN p.phone END,
    CASE WHEN p.perfil_visivel OR p.mentor_id = auth.uid() THEN p.linkedin_url END,
    CASE WHEN p.perfil_visivel OR p.mentor_id = auth.uid() THEN p.instagram_url END,
    CASE WHEN p.perfil_visivel OR p.mentor_id = auth.uid() THEN p.site_url END,
    p.perfil_visivel OR p.mentor_id = auth.uid()
  FROM public.people p
  WHERE p.id = p_person
    AND (
      -- O dono da conta.
      p.mentor_id = auth.uid()
      -- Ou alguém que divide grupo com ela.
      OR EXISTS (
        SELECT 1
          FROM public.group_members meu
          JOIN public.group_members dele ON dele.group_id = meu.group_id
          JOIN public.people eu ON eu.id = meu.person_id
         WHERE eu.user_id = auth.uid() AND dele.person_id = p.id)
    );
$fn$;
GRANT EXECUTE ON FUNCTION public.perfil_do_colega(uuid) TO authenticated;
