-- Fecha os buckets 'marca', 'eventos' e 'comunidade' — mesma cirurgia do
-- commit c03134c (biblioteca e avatares).
--
-- URL pública direta = quem guarda o link continua vendo o arquivo depois de
-- qualquer trancamento na tela. Os três buckets viram privados; toda leitura
-- já passa a pedir o link ao servidor (service role), que decide antes se a
-- pessoa pode ver aquele arquivo, com prazo curto — ver
-- src/lib/storage-assinado.server.ts.
--
-- ⚠️ REGRA 5 DA CONSTITUIÇÃO: esta migração REMOVE acesso público que o
-- código publicado usa hoje (toda tela que desenha <img src={url_crua}>).
-- SÓ RODAR DEPOIS de o código novo (que já assina o link pelo servidor)
-- estar publicado e confirmado no ar — nunca antes, senão toda imagem destas
-- três áreas quebra em produção até o deploy chegar.
--
-- Mesmo motivo do commit de referência: só trocar o bucket para privado NÃO
-- fecha sozinho. As três policies de SELECT abaixo não checavam QUEM estava
-- pedindo, só o bucket_id — com a chave pública do projeto (a mesma que já
-- vai embutida no navegador de qualquer visitante) e SEM SESSÃO NENHUMA, dava
-- para pedir ao Storage para ASSINAR (createSignedUrl) qualquer caminho
-- destes três buckets pelo Console do navegador. Fechar só o bucket sem
-- derrubar a policy deixaria a porta dos fundos aberta.
--
-- Nomes conferidos no banco (não adivinhados): marca_leitura_publica,
-- eventos_img_read, comunidade_leitura.

UPDATE storage.buckets SET public = false WHERE id IN ('marca', 'eventos', 'comunidade');

DROP POLICY IF EXISTS marca_leitura_publica ON storage.objects;
DROP POLICY IF EXISTS eventos_img_read ON storage.objects;
DROP POLICY IF EXISTS comunidade_leitura ON storage.objects;

-- Conferir depois de rodar (deve devolver zero linhas):
--   SELECT policyname, qual FROM pg_policies
--    WHERE schemaname = 'storage' AND tablename = 'objects' AND cmd = 'SELECT'
--      AND (qual ILIKE '%marca%' OR qual ILIKE '%eventos%' OR qual ILIKE '%comunidade%');
