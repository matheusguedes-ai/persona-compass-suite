-- PARTE 2 de 2 -- a guarda dentro de notificar().
--
-- A parte 1 (20260730340000) tirou o EXECUTE de PUBLIC e anon. Sobrou
-- `authenticated`, que NAO da para revogar: as server functions de comunidade,
-- devolutivas, classroom e gestao chamam notificar com o cliente do PROPRIO
-- usuario. Sem esta guarda, qualquer pessoa com uma conta de aluno ainda
-- escreveria no sino de qualquer outra conta.
--
-- O corpo abaixo e o mesmo de 20260730030000, sem uma virgula mudada, mais o
-- bloco IF no topo. Foi montado a partir do arquivo do repositorio por script,
-- e nao redigitado -- redigitar corpo de funcao para inserir tres linhas e como
-- se perde comentario e acento.

CREATE OR REPLACE FUNCTION public.notificar(
  p_conta uuid,
  p_tipo text,
  p_titulo text,
  p_corpo text DEFAULT NULL,
  p_link text DEFAULT NULL,
  p_ator uuid DEFAULT NULL,
  p_ator_nome text DEFAULT NULL,
  p_grupos uuid[] DEFAULT NULL,
  p_pessoa_user uuid DEFAULT NULL,
  p_para_alunos boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_destinos uuid[];
BEGIN
  -- ---- QUEM PODE ESCREVER NO SINO DE QUEM (guarda nova, 30/07/2026) ----
  --
  -- Ate hoje esta funcao aceitava qualquer chamador. Combinada com o EXECUTE
  -- que estava concedido a PUBLIC, isso significava: qualquer pessoa da
  -- internet escrevia uma notificacao com titulo e LINK arbitrarios no sino de
  -- qualquer conta -- e ela chega com a cara do sistema. A migracao
  -- 20260730340000 revogou o acesso anonimo; esta guarda fecha o resto.
  --
  -- auth.uid() NULO = service role. E o caminho dos endpoints publicos
  -- (avisarQueRespondeu, no envio de resposta), que ja passou pela sua propria
  -- checagem antes de chegar aqui. `anon` nao cai mais neste ramo porque o
  -- EXECUTE dele foi revogado -- as duas coisas juntas e que fecham.
  --
  -- LOGADO: so escreve na conta a que ele pertence. Tres portas, as mesmas do
  -- resto da plataforma: o dono, quem e da equipe, e quem e avaliado ali.
  -- Levanta excecao em vez de devolver 0 em silencio: o TypeScript ja engole a
  -- falha (notificacao nunca derruba a acao), entao um aviso legitimo nunca ve
  -- este erro, e um ilegitimo fica registrado no log do banco.
  IF auth.uid() IS NOT NULL AND NOT (
       auth.uid() = p_conta
       OR EXISTS (SELECT 1 FROM public.team_members tm
                   WHERE tm.user_id = auth.uid()
                     AND tm.owner_id = p_conta
                     AND tm.status = 'ativo')
       OR EXISTS (SELECT 1 FROM public.people pe
                   WHERE pe.user_id = auth.uid()
                     AND pe.mentor_id = p_conta)
     ) THEN
    RAISE EXCEPTION 'Sem permissao para notificar nesta conta.';
  END IF;
  SELECT array_agg(DISTINCT u) INTO v_destinos FROM (
    -- 1. O MASTER vê tudo que acontece na conta dele.
    SELECT p_conta AS u

    UNION
    -- 2. MENTORES. Duas portas: o grupo é dele, ou é novidade do master
    --    (`p_grupos IS NULL` = anúncio da conta inteira).
    SELECT tm.user_id
      FROM public.team_members tm
      LEFT JOIN public.team_member_groups tmg ON tmg.team_member_id = tm.id
     WHERE tm.owner_id = p_conta
       AND tm.status = 'ativo'
       AND tm.kind IN ('mentor', 'colaborador')
       AND tm.user_id IS NOT NULL
       AND (p_grupos IS NULL OR tmg.group_id = ANY(p_grupos))

    UNION
    -- 3. O ALUNO DE QUEM O EVENTO TRATA. Sempre, mesmo fora de grupo: é sobre
    --    ele. É o "referente a ele mesmo" da regra.
    SELECT p_pessoa_user WHERE p_pessoa_user IS NOT NULL

    UNION
    -- 4. OS DEMAIS ALUNOS dos grupos, só quando o evento é de comunidade.
    SELECT pe.user_id
      FROM public.people pe
      JOIN public.group_members gm ON gm.person_id = pe.id
     WHERE p_para_alunos
       AND p_grupos IS NOT NULL
       AND gm.group_id = ANY(p_grupos)
       AND pe.user_id IS NOT NULL
  ) alvos(u)
  WHERE u IS NOT NULL AND u IS DISTINCT FROM p_ator;

  IF v_destinos IS NULL OR array_length(v_destinos, 1) IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.notificacoes (user_id, conta_id, tipo, titulo, corpo, link, ator_nome)
  SELECT d, p_conta, p_tipo, p_titulo, p_corpo, p_link, p_ator_nome
    FROM unnest(v_destinos) AS d;

  RETURN array_length(v_destinos, 1);
END;
$fn$;
