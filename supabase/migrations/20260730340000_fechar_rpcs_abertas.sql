-- PARTE 1 de 2 — os REVOKE, SOZINHOS.
--
-- Este arquivo NAO tem corpo de funcao de proposito. A memoria do projeto
-- registra que o editor SQL do Supabase corta o script no meio quando ha
-- dollar-quoting, e essa e a explicacao mais provavel para o que aconteceu:
-- QUATRO REVOKE que estao escritos no repositorio nunca chegaram ao banco,
-- todos eles a ultima linha de uma migracao que tinha funcao acima.
--
-- Conferido com a CHAVE PUBLICA, a mesma que esta no bundle em producao:
--
--   ABERTA   retrato_do_schema      <- despeja o DDL inteiro do schema
--   ABERTA   grants_faltando        <- indice de onde a autorizacao esta frouxa
--   ABERTA   reconceder_grants      <- faz o banco rodar GRANT
--   ABERTA   track_liberada_para    <- le o acesso de OUTRA pessoa
--   ABERTA   notificar              <- escreve no sino de qualquer conta
--   fechada  owns_test_version      (controle: nem todo REVOKE falhou)
--
-- O pior e `notificar`. Sondei com uma conta inexistente e a funcao rodou ate o
-- INSERT, falhando so na FK. Com um id de conta REAL, qualquer pessoa da
-- internet escreve uma notificacao com titulo e LINK arbitrarios no sino de
-- qualquer usuario -- e ela chega com a cara do sistema. E um canal de phishing
-- dentro da propria plataforma. O retorno da funcao (quantos destinatarios)
-- ainda serve de oraculo para contar mentores e alunos de uma conta.
--
-- FROM PUBLIC, e nao so anon/authenticated: `PUBLIC` e o papel que todo mundo
-- herda, e e por ele que estas funcoes estavam abertas. Revogar de anon sem
-- revogar de PUBLIC nao fecha nada -- foi o que os REVOKE originais fizeram.

-- ---- Ferramentas de manutencao: so a service role ----
-- Nenhuma delas e chamada pelo app. Sao raio-x e reparo, operadas por script.
REVOKE EXECUTE ON FUNCTION public.retrato_do_schema()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reconceder_grants()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grants_faltando()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grants_excecoes()     FROM PUBLIC, anon, authenticated;

-- ---- As "_para": respondem pelo acesso de OUTRA pessoa ----
-- Sao a versao parametrizada das funcoes de cadeado. As policies usam as SEM
-- parametro (que perguntam pelo proprio auth.uid()); estas existem so para a
-- previa "ver como aluno", que roda no servidor. Abertas, viram um jeito de
-- varrer quem tem acesso a que.
REVOKE EXECUTE ON FUNCTION public.track_liberada_para(uuid, uuid)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bib_pasta_liberada_para(uuid, uuid)    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bib_material_liberado_para(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ---- notificar: fecha para anonimo, MANTEM para logado ----
--
-- Aqui NAO da para revogar de `authenticated`. As server functions chamam
-- `notificar` com o cliente do PROPRIO usuario (comunidade, devolutivas,
-- classroom, gestao) -- revogar de authenticated mataria todos os avisos da
-- plataforma. A service role ignora GRANT, entao o caminho novo
-- (avisarQueRespondeu, no endpoint publico) continua funcionando.
--
-- O que sobra depois deste REVOKE: authenticated e service_role. Quem esta
-- logado ainda poderia inventar aviso para outra conta -- e isso a PARTE 2
-- resolve, com guarda dentro do corpo. As duas juntas fecham; nenhuma sozinha.
-- Os DEZ parametros, na ordem exata. Errei isto na primeira tentativa (esqueci
-- `p_pessoa_user`) e o Postgres respondeu "function does not exist" -- o que
-- derrubou o LOTE INTEIRO, porque o editor roda tudo numa transacao. Nenhum dos
-- REVOKE acima tinha sobrevivido. Assinatura errada num REVOKE nao falha
-- sozinha: leva junto o que ja tinha passado.
REVOKE EXECUTE ON FUNCTION
  public.notificar(uuid, text, text, text, text, uuid, text, uuid[], uuid, boolean)
  FROM PUBLIC, anon;
