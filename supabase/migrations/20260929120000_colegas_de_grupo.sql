-- #319 — o aluno não enxergava os colegas do próprio grupo em Comunidade → Membros nem no Ranking.
--
-- A CAUSA (achada antes de mexer em qualquer coisa, como pedido): `membrosDosGrupos` e
-- `rankingDoGrupo` (src/lib/comunidade.functions.ts, src/lib/pontos.functions.ts) leem `people`
-- DIRETO, por um nested select dentro de `group_members` (`.select("...people(...)...")`). A RLS
-- de `people` só libera a própria linha (`people_self_read`) ou quem o MENTOR cadastrou
-- (`mentor_id = acting_account()`) — não existe regra de "mesmo grupo". Para um aluno, o embed de
-- `people` de qualquer colega volta nulo, e as duas telas filtram fora quem veio nulo. Sobra só o
-- próprio aluno — exatamente o relato (Luis Felipe sozinho, 80 pontos, 1º lugar porque é o único
-- que aparece).
--
-- `perfil_do_colega` (20260812220000) já resolve isto para UMA pessoa — é a função que o cartão de
-- perfil do colega usa, com a mesma regra de grupo (EXISTS group_members meu JOIN dele) e o corte de
-- contato pela chavinha `perfil_visivel`. Só que a lista de membros e o ranking precisam de MUITAS
-- pessoas de uma vez, e nenhuma tela chamava essa função — daí o gatilho reaproveitar exatamente a
-- mesma regra de elegibilidade (`posso_ver_grupo`, já usada pela RLS de `group_members`), em lote.
--
-- POR QUE NÃO UMA POLICY NOVA EM `people`: as colunas sensíveis (email, telefone, profissão) são
-- protegidas SÓ pela ausência de row — não existe corte por coluna em RLS do Postgres. Cerca de 15
-- lugares do código já fazem `people(...)` embutido pedindo essas colunas, sempre confiando que quem
-- está logado só enxerga a própria conta (`exigirPermissao` do lado do mentor). Abrir uma policy
-- "mesmo grupo" em `people` abriria a tabela inteira — inclusive email e telefone — para QUALQUER
-- consulta que uma sessão de aluno alcançasse, não só as duas desta demanda. A regra fica numa
-- função só, que devolve apenas as colunas de identidade (nunca contato), e que RECONFERE a
-- elegibilidade do grupo por dentro (SECURITY DEFINER não herda a RLS de quem chamou, e não confia
-- no array de group_ids que veio do navegador — mesmo cuidado que `perfil_do_colega` já tinha).
CREATE OR REPLACE FUNCTION public.colegas_de_grupo(p_group_ids uuid[])
RETURNS TABLE (
  group_id uuid,
  person_id uuid,
  full_name text,
  avatar_url text,
  role_at_company text,
  user_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT gm.group_id, p.id, p.full_name, p.avatar_url, p.role_at_company, p.user_id
    FROM public.group_members gm
    JOIN public.people p ON p.id = gm.person_id
   WHERE gm.group_id = ANY(p_group_ids)
     AND public.posso_ver_grupo(gm.group_id)
   ORDER BY gm.group_id, p.id;
$fn$;

COMMENT ON FUNCTION public.colegas_de_grupo(uuid[]) IS
  '#319 — identidade (nome, foto, cargo) de quem está nos grupos informados, só dos grupos que quem chama pode ver. Nunca e-mail, telefone ou profissão — isso é `perfil_do_colega`, pessoa a pessoa, com a chavinha.';
