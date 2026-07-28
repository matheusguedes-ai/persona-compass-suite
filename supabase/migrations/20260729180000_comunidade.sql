-- Comunidade do grupo.
--
-- Um feed POR GRUPO, não um feed da plataforma. Quem publica e quem lê são as
-- pessoas daquele grupo: os avaliados, os mentores afiliados atribuídos a ele e
-- o dono da conta. Ninguém de fora do grupo vê nada, e é isso que torna a
-- comunidade utilizável numa empresa cliente — o grupo do RH da Empresa A não
-- se mistura com o da Empresa B.
--
-- Por decisão do Matheus (28/07/2026), **resultado de teste não entra aqui**.
-- Só texto, imagem, PDF e link. Publicar perfil comportamental entre colegas
-- de trabalho é assunto separado, com risco próprio, e fica para depois.

-- Grupos de quem está lendo, pelo lado do AVALIADO. O equivalente do lado da
-- equipe é `visible_group_ids()`, que já existe.
CREATE OR REPLACE FUNCTION public.meus_grupos_como_avaliado()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT gm.group_id
    FROM public.group_members gm
   WHERE gm.person_id IN (SELECT public.my_person_ids());
$fn$;

GRANT EXECUTE ON FUNCTION public.meus_grupos_como_avaliado() TO authenticated;

/**
 * Um grupo é meu se eu sou avaliado dele, ou se sou a conta dona, ou se sou
 * membro da equipe com acesso a ele. As três portas numa função só, para as
 * policies não repetirem a mesma lógica quatro vezes.
 */
CREATE OR REPLACE FUNCTION public.posso_ver_grupo(p_group_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    -- Lado da equipe: o grupo é da conta, e o mentor convidado só enxerga os
    -- grupos atribuídos a ele. Parênteses explícitos de propósito: sem eles a
    -- precedência entre AND e OR ainda dá o resultado certo, mas ninguém
    -- consegue conferir isso de bater o olho.
    (
      EXISTS (SELECT 1 FROM public.groups g
               WHERE g.id = p_group_id AND g.mentor_id = public.acting_account())
      AND (
        public.member_kind() <> 'mentor'
        OR p_group_id IN (SELECT public.visible_group_ids())
      )
    )
    -- Lado do avaliado: estou nesse grupo.
    OR (p_group_id IN (SELECT public.meus_grupos_como_avaliado()));
$fn$;

GRANT EXECUTE ON FUNCTION public.posso_ver_grupo(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  /** Quem escreveu, pelo usuário. Serve para autor apagar o próprio post. */
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  /** Nome exibido, congelado na hora de publicar — se a pessoa sair, o post
      continua legível em vez de virar "desconhecido". */
  author_name text NOT NULL,
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  /** Anexo opcional: imagem ou PDF no bucket, ou um link externo. */
  file_url text,
  file_kind text CHECK (file_kind IS NULL OR file_kind IN ('imagem', 'pdf')),
  link_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_posts_grupo_idx
  ON public.community_posts (group_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_comments_post_idx
  ON public.community_comments (post_id, created_at);

CREATE TABLE IF NOT EXISTS public.community_reactions (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;

-- Leitura: quem está no grupo. Escrita: quem está no grupo, em nome próprio.
DROP POLICY IF EXISTS cp_read ON public.community_posts;
CREATE POLICY cp_read ON public.community_posts FOR SELECT TO authenticated
  USING (public.posso_ver_grupo(group_id));

DROP POLICY IF EXISTS cp_insert ON public.community_posts;
CREATE POLICY cp_insert ON public.community_posts FOR INSERT TO authenticated
  WITH CHECK (public.posso_ver_grupo(group_id) AND author_id = auth.uid());

-- Editar só o próprio. Apagar: o próprio autor OU a conta dona, que precisa
-- poder tirar do ar o que não deveria estar lá.
DROP POLICY IF EXISTS cp_update ON public.community_posts;
CREATE POLICY cp_update ON public.community_posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS cp_delete ON public.community_posts;
CREATE POLICY cp_delete ON public.community_posts FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.groups g
                WHERE g.id = group_id AND g.mentor_id = public.acting_account())
  );

DROP POLICY IF EXISTS cc_read ON public.community_comments;
CREATE POLICY cc_read ON public.community_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.community_posts p
                  WHERE p.id = post_id AND public.posso_ver_grupo(p.group_id)));

DROP POLICY IF EXISTS cc_insert ON public.community_comments;
CREATE POLICY cc_insert ON public.community_comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.community_posts p
                 WHERE p.id = post_id AND public.posso_ver_grupo(p.group_id))
  );

DROP POLICY IF EXISTS cc_delete ON public.community_comments;
CREATE POLICY cc_delete ON public.community_comments FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.community_posts p
                JOIN public.groups g ON g.id = p.group_id
               WHERE p.id = post_id AND g.mentor_id = public.acting_account())
  );

DROP POLICY IF EXISTS cr_read ON public.community_reactions;
CREATE POLICY cr_read ON public.community_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.community_posts p
                  WHERE p.id = post_id AND public.posso_ver_grupo(p.group_id)));

DROP POLICY IF EXISTS cr_insert ON public.community_reactions;
CREATE POLICY cr_insert ON public.community_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.community_posts p
                 WHERE p.id = post_id AND public.posso_ver_grupo(p.group_id))
  );

DROP POLICY IF EXISTS cr_delete ON public.community_reactions;
CREATE POLICY cr_delete ON public.community_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS community_posts_set_updated_at ON public.community_posts;
CREATE TRIGGER community_posts_set_updated_at
  BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Bucket dos anexos. Leitura pública porque a URL é longa e imprevisível, e o
-- controle de quem vê está no post; escrita só na própria pasta.
INSERT INTO storage.buckets (id, name, public)
VALUES ('comunidade', 'comunidade', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS comunidade_leitura ON storage.objects;
CREATE POLICY comunidade_leitura ON storage.objects FOR SELECT
  USING (bucket_id = 'comunidade');

DROP POLICY IF EXISTS comunidade_envio ON storage.objects;
CREATE POLICY comunidade_envio ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comunidade' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS comunidade_remocao ON storage.objects;
CREATE POLICY comunidade_remocao ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'comunidade' AND (storage.foldername(name))[1] = auth.uid()::text);
