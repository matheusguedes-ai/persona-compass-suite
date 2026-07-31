-- Fecha o buraco que só trocar o bucket para privado NÃO fecha sozinho.
--
-- Testado na prática antes de escrever esta migração: com a chave pública do
-- projeto (a mesma que já vai embutida no navegador de qualquer visitante) e
-- SEM SESSÃO NENHUMA, dava para pedir ao Storage para ASSINAR
-- (createSignedUrl) qualquer caminho dos buckets 'biblioteca' e 'avatares'.
-- A policy de SELECT em storage.objects para esses dois buckets não checava
-- QUEM estava pedindo, só o bucket_id.
--
-- Isso sobrevive à troca do bucket para privado: quem guarda a URL antiga
-- também guarda o CAMINHO (ele vem embutido na própria URL,
-- .../object/public/biblioteca/<caminho>), e o caminho é exatamente o que dá
-- para assinar de novo pelo Console do navegador -- sem passar pela checagem
-- de `liberado` que agora mora nas funções do servidor
-- (`src/lib/storage-assinado.server.ts`). Ou seja: o cadeado do bucket
-- tranca a porta da frente, mas essa policy deixava a dos fundos aberta.
--
-- A partir de agora, o app inteiro já assina pelo SERVIDOR (service role,
-- que ignora RLS por definição) depois de decidir se a pessoa pode ver
-- aquele arquivo -- não sobra nenhum motivo para o navegador assinar por
-- conta própria. Remove-se as duas policies permissivas; não entra nenhuma
-- no lugar, porque RLS sem policy aplicável já nega por padrão.
--
-- Nomes conferidos no banco (não adivinhados): os dois SELECT abertos eram
-- `biblioteca_read` e `avatares_leitura_publica`. Sem `$$` de propósito --
-- ver a anotação sobre o editor SQL cortar bloco com dollar-quoting no meio.

DROP POLICY IF EXISTS biblioteca_read ON storage.objects;
DROP POLICY IF EXISTS avatares_leitura_publica ON storage.objects;

-- Conferir depois de rodar (deve devolver zero linhas):
--   SELECT policyname, qual FROM pg_policies
--    WHERE schemaname = 'storage' AND tablename = 'objects' AND cmd = 'SELECT'
--      AND (qual ILIKE '%biblioteca%' OR qual ILIKE '%avatares%');
