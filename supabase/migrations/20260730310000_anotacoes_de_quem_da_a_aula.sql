-- As anotacoes da aula so o DONO da conta conseguia escrever.
--
-- `anot_rw` fechava em `t.mentor_id = auth.uid()`. Quem esta com o projetor na
-- frente da turma frequentemente nao e o dono: e um mentor atribuido ao grupo,
-- ou um colaborador da casa. Ele conduz a aula, abre o check-in, fecha a lista
-- de presenca -- e a caixa de anotacoes da propria aula respondia vazia, sem
-- dizer por que.
--
-- Pior que o vazio: `FOR ALL` sem policy de leitura para ele significa que uma
-- anotacao escrita pelo dono some da tela de quem esta dando a aula. O
-- combinado da turma anterior nao chega a quem precisa dele.
--
-- `posso_dar_aula()` existe exatamente para esta pergunta, e o comentario dela
-- ja dizia: "escrever `t.mentor_id = auth.uid()` faria a tela de check-in
-- nascer morta justamente para quem esta dando a aula". A tela de check-in foi
-- corrigida na epoca; as anotacoes ficaram para tras.
--
-- O ALUNO CONTINUA DE FORA, que era o ponto da policy original: `posso_dar_aula`
-- cobre dono, mentor do grupo e colaborador -- e nenhum avaliado. O vazamento
-- que ela fechava segue fechado.

DROP POLICY IF EXISTS anot_rw ON public.treinamento_anotacoes;
CREATE POLICY anot_rw ON public.treinamento_anotacoes FOR ALL TO authenticated
  USING (public.posso_dar_aula(aula_id))
  WITH CHECK (public.posso_dar_aula(aula_id));
