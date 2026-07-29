-- Biblioteca: enviar o arquivo, não só colar link. E capa para o material.
--
-- Falha do que entreguei: o formulário só aceitava URL. Escolher "pdf" não
-- servia para nada — não havia como enviar o PDF. O tipo virava rótulo sem
-- função, que é pior que não existir.

ALTER TABLE public.biblioteca_materiais
  ADD COLUMN IF NOT EXISTS capa_url text;

-- Balde dos arquivos. Público na leitura: o material da biblioteca é para
-- todos da conta, e o nome do arquivo é aleatório.
INSERT INTO storage.buckets (id, name, public)
VALUES ('biblioteca', 'biblioteca', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS biblioteca_read ON storage.objects;
CREATE POLICY biblioteca_read ON storage.objects FOR SELECT
  USING (bucket_id = 'biblioteca');

-- Envia e apaga quem está logado, cada um na sua pasta. Quem pode CADASTRAR o
-- material continua sendo só o dono — isso é a RLS da tabela, não daqui.
DROP POLICY IF EXISTS biblioteca_write ON storage.objects;
CREATE POLICY biblioteca_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'biblioteca' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS biblioteca_delete ON storage.objects;
CREATE POLICY biblioteca_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'biblioteca' AND (storage.foldername(name))[1] = auth.uid()::text);
