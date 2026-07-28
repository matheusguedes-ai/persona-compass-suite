-- Foto de perfil para todo mundo + o aluno editando os próprios dados
-- ============================================================

ALTER TABLE public.people   ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- ============================================================
-- 1. Espaço de arquivos das fotos
-- ============================================================
-- Leitura pública porque a foto aparece em página que o avaliado abre sem
-- login. Escrita só na própria pasta: avatares/<user_id>/...
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatares', 'avatares', true, 2097152,
        ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 2097152,
      allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp'];

DROP POLICY IF EXISTS avatares_leitura_publica ON storage.objects;
CREATE POLICY avatares_leitura_publica ON storage.objects
  FOR SELECT USING (bucket_id = 'avatares');

DROP POLICY IF EXISTS avatares_envio_proprio ON storage.objects;
CREATE POLICY avatares_envio_proprio ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatares' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS avatares_troca_propria ON storage.objects;
CREATE POLICY avatares_troca_propria ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatares' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS avatares_remove_propria ON storage.objects;
CREATE POLICY avatares_remove_propria ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatares' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- 2. O aluno editando os próprios dados
-- ============================================================
-- Via função, e não por policy de UPDATE em `people`: a RLS decide por LINHA,
-- não por coluna. Se o aluno pudesse dar UPDATE na própria linha, poderia
-- também mexer em `mentor_id`, `role` ou `notes` do mentor. Aqui só os três
-- campos que são dele passam.
CREATE OR REPLACE FUNCTION public.update_my_person(
  _full_name text,
  _phone text DEFAULT NULL,
  _avatar_url text DEFAULT NULL
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

  -- Atribuição direta, sem COALESCE: a tela manda o formulário inteiro, então
  -- campo vazio quer dizer "apagar" — com COALESCE não daria para remover a foto.
  -- Vale para todos os cadastros da pessoa: quem é aluno de dois mentores
  -- atualiza os dois de uma vez, que é o que ela espera.
  UPDATE public.people p
     SET full_name  = btrim(_full_name),
         phone      = NULLIF(btrim(COALESCE(_phone, '')), ''),
         avatar_url = NULLIF(btrim(COALESCE(_avatar_url, '')), '')
   WHERE p.user_id = v_uid;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_my_person(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_person(text, text, text) TO authenticated;

-- ============================================================
-- 3. Email do login refletindo no cadastro que o mentor vê
-- ============================================================
-- Trocar o email de acesso passa por confirmação do Supabase. Em vez de gravar
-- na hora do pedido (e arriscar deixar o mentor com um email que nunca foi
-- confirmado), sincronizamos no acesso seguinte: se o email da conta mudou, o
-- cadastro acompanha.
CREATE OR REPLACE FUNCTION public.claim_student_profile()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_n integer;
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
  IF v_email IS NULL THEN RETURN 0; END IF;

  UPDATE public.people p
     SET user_id = v_uid
   WHERE lower(p.email) = lower(v_email)
     AND p.user_id IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- Já vinculado e com email diferente: o de acesso é o que vale.
  UPDATE public.people p
     SET email = v_email
   WHERE p.user_id = v_uid
     AND lower(p.email) <> lower(v_email);

  RETURN v_n;
END;
$$;

-- ============================================================
-- 4. Ver a foto de quem é da mesma conta
-- ============================================================
-- A `profiles` guarda a foto de quem tem login. Sem isto, a lista de Mentores e
-- Colaboradores mostraria a foto de ninguém além da própria.
DROP POLICY IF EXISTS profiles_equipe_read ON public.profiles;
CREATE POLICY profiles_equipe_read ON public.profiles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    -- o dono vê quem ele convidou
    OR user_id IN (
      SELECT tm.user_id FROM public.team_members tm
       WHERE tm.owner_id = auth.uid() AND tm.user_id IS NOT NULL
    )
    -- e o convidado vê o dono da conta em que trabalha
    OR user_id IN (
      SELECT tm.owner_id FROM public.team_members tm
       WHERE tm.user_id = auth.uid() AND tm.status = 'ativo'
    )
  );
