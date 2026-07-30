-- Tres buckets publicos aceitavam QUALQUER arquivo, de QUALQUER tamanho.
--
-- `comunidade`, `biblioteca` e `eventos` nasceram com
-- `INSERT INTO storage.buckets (id, name, public)` e mais nada. Sem
-- `file_size_limit` e sem `allowed_mime_types`, o que a policy de envio
-- autoriza e: qualquer pessoa logada manda o que quiser.
--
-- Duas consequencias, e a segunda e a que preocupa:
--
-- 1. TAMANHO. Um aluno arrasta um arquivo de 4 GB para um post e a conta do
--    mentor paga. Nao precisa de ma fe -- basta um video.
-- 2. TIPO. Bucket publico serve o arquivo pelo dominio do Supabase com o
--    Content-Type que o upload declarou. HTML e SVG carregam script; servidos
--    assim, viram pagina executando no dominio do projeto. Ninguem precisa
--    disso para postar foto de turma.
--
-- O bucket `avatares` ja nasceu certo (2 MB, tres formatos de imagem). Estes
-- tres passam a seguir o mesmo padrao.
--
-- O QUE ISTO **NAO** CONSERTA, e vale dizer em vez de deixar implicito
--
-- Bucket publico e publico: quem tem a URL le o arquivo, mesmo depois de o
-- cadeado da Academy fechar para ele. O caminho e `{user_id}/{uuid}`, entao a
-- URL nao e adivinhavel -- o cadeado controla quem DESCOBRE o material, e nao
-- quem consegue reabrir um link que ja recebeu. Fechar isso de verdade exige
-- bucket privado com URL assinada a cada leitura, o que muda como todo arquivo
-- ja cadastrado e servido. Fica registrado aqui como decisao consciente, nao
-- como esquecimento.

-- ---- Comunidade: foto de post ----
UPDATE storage.buckets
   SET file_size_limit = 5242880,  -- 5 MB
       allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/gif']
 WHERE id = 'comunidade';

-- ---- Eventos: imagem de capa ----
UPDATE storage.buckets
   SET file_size_limit = 5242880,
       allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp']
 WHERE id = 'eventos';

-- ---- Biblioteca: o material de estudo ----
-- Lista larga de proposito: a demanda que criou as pastas fala em "10 livros em
-- PDF, 5 planilhas e 4 imagens". 50 MB porque livro em PDF passa de 20 com
-- facilidade.
--
-- Fora da lista, e de proposito: text/html, image/svg+xml e qualquer coisa
-- application/javascript. Sao os que executam quando servidos de um bucket
-- publico. Material de estudo nao precisa deles.
UPDATE storage.buckets
   SET file_size_limit = 52428800,  -- 50 MB
       allowed_mime_types = ARRAY[
         'application/pdf',
         'image/png','image/jpeg','image/webp','image/gif',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.ms-excel',
         'text/csv',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'application/vnd.ms-powerpoint',
         'text/plain',
         'application/zip'
       ]
 WHERE id = 'biblioteca';
