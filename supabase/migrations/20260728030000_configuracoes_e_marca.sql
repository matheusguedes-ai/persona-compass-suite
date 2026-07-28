-- Configurações do mentor: marca aplicada de verdade, textos prontos e
-- controle do relatório
-- ============================================================
-- Até aqui `profiles` guardava nome/logo/cor, mas nada no app lia esses campos.
-- Esta migração amplia o que dá para configurar e cria o espaço de arquivos
-- para o logo — o campo antigo exigia colar uma URL de imagem já hospedada.

ALTER TABLE public.profiles
  -- Marca
  ADD COLUMN IF NOT EXISTS brand_accent_color text,
  ADD COLUMN IF NOT EXISTS support_email text,
  ADD COLUMN IF NOT EXISTS site_url text,
  -- Textos prontos (o mentor escreve uma vez, reusa em todo envio)
  ADD COLUMN IF NOT EXISTS invite_message text,
  ADD COLUMN IF NOT EXISTS reminder_message text,
  ADD COLUMN IF NOT EXISTS result_message text,
  -- Controle do relatório
  ADD COLUMN IF NOT EXISTS report_allow_pdf boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS report_show_brand boolean NOT NULL DEFAULT true,
  -- Blocos desligados: 'fatores' | 'narrativas' | 'derivados' | 'plano_acao' | 'observadores'
  ADD COLUMN IF NOT EXISTS report_hidden_blocks text[] NOT NULL DEFAULT '{}';

-- ============================================================
-- Espaço de arquivos para o logo
-- ============================================================
-- Público na leitura de propósito: o logo aparece em página que o avaliado
-- abre sem login (relatório, convite, teste). Escrita continua restrita.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('marca', 'marca', true, 2097152,
        ARRAY['image/png','image/jpeg','image/webp','image/svg+xml'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 2097152,
      allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/svg+xml'];

-- Cada mentor só mexe na própria pasta: marca/<user_id>/...
DROP POLICY IF EXISTS "marca_leitura_publica" ON storage.objects;
CREATE POLICY "marca_leitura_publica" ON storage.objects
  FOR SELECT USING (bucket_id = 'marca');

DROP POLICY IF EXISTS "marca_envio_proprio" ON storage.objects;
CREATE POLICY "marca_envio_proprio" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'marca' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "marca_troca_propria" ON storage.objects;
CREATE POLICY "marca_troca_propria" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'marca' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "marca_remove_propria" ON storage.objects;
CREATE POLICY "marca_remove_propria" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'marca' AND (storage.foldername(name))[1] = auth.uid()::text);
