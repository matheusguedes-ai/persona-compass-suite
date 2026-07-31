-- Os limites da migracao 300000 nao batiam com o que as telas oferecem.
--
-- Eu apertei os buckets sem conferir o que a interface promete. Resultado: tres
-- descasamentos, todos falhando do mesmo jeito -- o Supabase recusa e a tela
-- repassa `error.message` cru, em ingles, sem dizer qual e o limite.
--
--   1. Comunidade oferece PDF ("Imagem ou PDF" no botao, accept com
--      application/pdf, e o feed ate RENDERIZA file_kind='pdf") e o bucket
--      recusava PDF.
--   2. Comunidade avisa 8 MB na tela (LIMITE_MB) e o bucket cortava em 5.
--   3. Foto de iPhone (.heic) e imagem, as telas aceitam "image/*", e o bucket
--      recusava.
--
-- Fecho pelo lado do BUCKET onde a tela esta certa, e pelo lado da TELA onde o
-- bucket esta certo (os inputs de material ganharam `accept`, no mesmo commit).
--
-- Nenhum dos tipos abaixo executa script servido de bucket publico -- que era a
-- razao declarada da 300000 para excluir text/html, image/svg+xml e javascript.
-- Essa razao continua valendo, e esses tres continuam de fora.

-- ---- Comunidade: PDF de volta, HEIC junto, e 8 MB como a tela promete ----
UPDATE storage.buckets
   SET file_size_limit = 8388608,  -- 8 MB, o numero que LIMITE_MB ja mostrava
       allowed_mime_types = ARRAY[
         'image/png','image/jpeg','image/webp','image/gif','image/heic','image/heif',
         'application/pdf'
       ]
 WHERE id = 'comunidade';

-- ---- Eventos: capa de evento, so imagem ----
UPDATE storage.buckets
   SET allowed_mime_types = ARRAY[
         'image/png','image/jpeg','image/webp','image/heic','image/heif'
       ]
 WHERE id = 'eventos';

-- ---- Biblioteca: HEIC entra; video e audio NAO ----
--
-- A tela agrupa material por formato e tem categoria "video" e "audio". Ficaram
-- FORA do bucket de proposito: 50 MB nao segura gravacao de aula de verdade, e
-- o Classroom ja aceita link do YouTube, que e o caminho certo para video. O
-- `accept` do input passa a dizer isso em vez de deixar a pessoa descobrir
-- arrastando um mp4 de 300 MB.
UPDATE storage.buckets
   SET allowed_mime_types = allowed_mime_types || ARRAY['image/heic','image/heif']
 WHERE id = 'biblioteca'
   AND NOT ('image/heic' = ANY(allowed_mime_types));
