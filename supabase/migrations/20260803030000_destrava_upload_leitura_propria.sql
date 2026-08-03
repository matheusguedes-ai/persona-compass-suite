-- #245 — destrava o upload dos 6 buckets privados (marca, avatares,
-- biblioteca, eventos, comunidade, mentorias).
--
-- CAUSA: o Storage do Supabase, ao confirmar um envio, faz um
-- INSERT ... RETURNING * para devolver os dados do arquivo. Sem uma policy de
-- SELECT cobrindo a linha recém-criada, o RETURNING falha — com a MESMA
-- mensagem de erro do RLS ("new row violates row-level security policy"),
-- mesmo o INSERT em si estando certo. É um problema documentado do próprio
-- Supabase (guia de troubleshooting oficial), não relacionado às chaves novas
-- do projeto (JWT Signing Keys) — Storage já sabe validá-las.
--
-- As duas migrações que fecharam os buckets públicos (20260731050000 e
-- 20260801020000) derrubaram de propósito a policy de leitura ANTIGA — essa
-- sim era a brecha real: liberava QUALQUER PESSOA, sem sessão nenhuma, a
-- assinar qualquer caminho. Certo ter tirado. Só que nada foi recolocado no
-- lugar, e essa mesma policy de leitura é a que o Storage precisa por dentro
-- para confirmar o envio.
--
-- Conferido no código (todo `.storage.from(<bucket>).upload(...)` do app,
-- 10 pontos de envio) antes de escrever isto: TODO envio, em TODOS os
-- buckets — dono, colaborador, mentor ou aluno — sobe para
-- `${sessao.user.id}/...`, a PRÓPRIA pasta de quem está enviando. Não existe
-- caso em que alguém envia na pasta de outra pessoa. Por isso uma única regra,
-- igual em todos os buckets, cobre 100% dos casos sem exceção.
--
-- Aditiva só: nenhum DROP. Não reabre a brecha original — a regra nova exige
-- sessão autenticada E pasta própria; a antiga não exigia nenhuma das duas.

CREATE POLICY "marca_leitura_propria" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'marca' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatares_leitura_propria" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatares' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "biblioteca_leitura_propria" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'biblioteca' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "eventos_img_leitura_propria" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'eventos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "comunidade_leitura_propria" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'comunidade' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "mentorias_leitura_propria" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'mentorias' AND (storage.foldername(name))[1] = auth.uid()::text);
