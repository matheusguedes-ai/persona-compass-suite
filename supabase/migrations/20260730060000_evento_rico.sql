-- O evento da agenda ganha corpo.
--
-- Item D de `docs/plano-demandas-30-07.md`. Hoje o evento é título, data e
-- destino. O Matheus quer clicar nele e ver tudo: hora de início e fim, uma
-- imagem e um link externo.

ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS termina_em timestamptz,
  ADD COLUMN IF NOT EXISTS imagem_url text,
  ADD COLUMN IF NOT EXISTS link_url text;

-- Fim antes do início é dado impossível, e a checagem no formulário não basta:
-- a server function também escreve, e um dia outra tela vai escrever também.
ALTER TABLE public.eventos DROP CONSTRAINT IF EXISTS evento_fim_depois_do_inicio;
ALTER TABLE public.eventos
  ADD CONSTRAINT evento_fim_depois_do_inicio
  CHECK (termina_em IS NULL OR termina_em > quando);

-- Balde das imagens de evento. Público na leitura, como o da marca: a imagem
-- aparece para quem tem acesso ao evento, e o nome do arquivo é aleatório.
INSERT INTO storage.buckets (id, name, public)
VALUES ('eventos', 'eventos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS eventos_img_read ON storage.objects;
CREATE POLICY eventos_img_read ON storage.objects FOR SELECT
  USING (bucket_id = 'eventos');

-- Só quem está logado envia, e cada um na sua pasta.
DROP POLICY IF EXISTS eventos_img_write ON storage.objects;
CREATE POLICY eventos_img_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'eventos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS eventos_img_delete ON storage.objects;
CREATE POLICY eventos_img_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'eventos' AND (storage.foldername(name))[1] = auth.uid()::text);
