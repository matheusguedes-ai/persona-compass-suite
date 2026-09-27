-- #313, etapa 2 — a regra velha da Biblioteca passa a obedecer à nova.
--
-- A etapa 1 (20260927120000_biblioteca_menu_proprio.sql) criou a função única `bib_decide` e as
-- portas por login (`bib_pode_ver_material`, `bib_pode_ver_pasta`, `bib_visiveis`). A tela nova já
-- pergunta só a elas. Mas três caminhos ainda usavam a regra antiga ("sem destino = aberto a todos"):
--
--   1. a RLS de `biblioteca_materiais` e `biblioteca_pastas` (leitura direta pela API);
--   2. `bib_materiais_liberados` / `bib_pastas_liberadas` — é por aí que a assistente do aluno lê;
--   3. `bib_material_liberado`, `bib_pasta_liberada` e as versões `_para` (prévia "ver como aluno").
--
-- Aqui os três passam a perguntar à MESMA regra. As assinaturas não mudam (nada do código publicado
-- quebra); muda a resposta: o que a tela nova não mostra, nenhum outro caminho entrega — "a negação
-- sempre vence, em qualquer caminho de acesso".
--
-- Regra 5 da constituição: isto MUDA REGRA (permissão). Só roda DEPOIS de o código novo estar
-- publicado — o código velho ainda mostrava a Biblioteca dentro da Academy pela regra antiga.
--
-- Efeito esperado em 27/09/2026: nenhum grupo tem o menu Biblioteca e nada foi liberado, então os
-- alunos deixam de ver os 9 materiais (antes viam todos, pela regra "sem destino = aberto"). Liberar =
-- o dono dá o menu a um grupo na tela da Biblioteca. A equipe da conta continua vendo tudo.

-- 1) As funções antigas, mesmas assinaturas, agora só perguntam à regra única.
CREATE OR REPLACE FUNCTION public.bib_material_liberado(_material_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.bib_pode_ver_material(_material_id);
$$;

CREATE OR REPLACE FUNCTION public.bib_pasta_liberada(_pasta_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  -- Sem pasta = "a pasta não tranca nada" (o significado antigo, mantido para quem ainda chama assim).
  SELECT _pasta_id IS NULL OR public.bib_pode_ver_pasta(_pasta_id);
$$;

CREATE OR REPLACE FUNCTION public.bib_material_liberado_para(_material_id uuid, _person_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.bib_decide_pessoa(NULL, _material_id, _person_id) d
                  WHERE d.resultado = 've');
$$;

CREATE OR REPLACE FUNCTION public.bib_pasta_liberada_para(_pasta_id uuid, _person_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _pasta_id IS NULL
      OR EXISTS (SELECT 1 FROM public.bib_decide_pessoa(_pasta_id, NULL, _person_id) d
                  WHERE d.resultado = 've');
$$;

-- `_person_id` nulo = quem está logado; preenchido = prévia, só para a conta daquela pessoa
-- (`bib_visiveis` já confere). É por aqui que a assistente do aluno lê a Biblioteca.
CREATE OR REPLACE FUNCTION public.bib_materiais_liberados(_person_id uuid DEFAULT NULL)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT v.id FROM public.bib_visiveis(_person_id) v WHERE v.tipo = 'material';
$$;

CREATE OR REPLACE FUNCTION public.bib_pastas_liberadas(_person_id uuid DEFAULT NULL)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT v.id FROM public.bib_visiveis(_person_id) v WHERE v.tipo = 'pasta';
$$;

-- Estavam abertas a quem nem login tem (anon). Fecha — e PUBLIC junto, senão o REVOKE não pega
-- (memória "REVOKE precisa de PUBLIC"). Quem precisa (authenticated, service_role, postgres) fica.
REVOKE EXECUTE ON FUNCTION public.bib_material_liberado(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bib_pasta_liberada(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bib_materiais_liberados(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bib_pastas_liberadas(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bib_material_liberado_para(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bib_pasta_liberada_para(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bib_material_liberado(uuid) TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.bib_pasta_liberada(uuid) TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.bib_materiais_liberados(uuid) TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.bib_pastas_liberadas(uuid) TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.bib_material_liberado_para(uuid, uuid) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.bib_pasta_liberada_para(uuid, uuid) TO service_role, postgres;

-- 2) Leitura direta das tabelas: a equipe da conta vê tudo; o resto, só o que a regra única libera.
--    Sai o `aluno_pode('academy')`: a Biblioteca não é mais parte da Academy — tem liberação própria.
ALTER POLICY bib_read ON public.biblioteca_materiais
  USING (mentor_id = public.acting_account() OR public.bib_pode_ver_material(id));
ALTER POLICY bibp_read ON public.biblioteca_pastas
  USING (mentor_id = public.acting_account() OR public.bib_pode_ver_pasta(id));
