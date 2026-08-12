-- #271 — dono direto na Comunidade.
--
-- A auditoria docs/auditoria-dono-do-dado.md (demanda #214) apontou
-- community_posts como o único ponto realmente frágil entre as 60 tabelas:
-- author_id diz QUEM escreveu, mas não A QUAL CONTA o post pertence — e há
-- dois caminhos possíveis até a conta (colaborador via team_members, aluno
-- via people) que se excluem, e nenhum JOIN único resolve os dois.
--
-- Esta migração acrescenta a coluna direta, seguindo o mesmo padrão de nome
-- já usado em eventos.conta_id e notificacoes.conta_id. community_comments,
-- community_reactions e community_post_groups NÃO recebem coluna própria —
-- continuam herdando o dono por post_id, como já auditado.
--
-- A lógica de resolução espelha contaDaPessoa() (src/lib/pontos.functions.ts),
-- já usada neste mesmo fluxo de publicação para escopar pontos e notificações:
-- primeiro o cadastro de avaliado (people.mentor_id, o mais antigo), senão
-- acting_account() (colaborador/mentor convidado ativo via team_members,
-- senão o próprio usuário — cobre o dono, e também o dono que também é
-- avaliado em outra conta). Reaproveitar essa lógica, em vez de inventar uma
-- nova, garante que conta_id nunca discorda do mentor_id que o mesmo post já
-- grava em `pontos` na hora de publicar.

-- 1. Coluna nasce sem regra — o ALTER não pode travar em nenhuma linha
--    existente (hoje são zero, mas o método vale igual se não forem).
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS conta_id uuid;

-- 2. Função de resolução: mesma lógica de contaDaPessoa(), generalizada para
--    um autor qualquer (contaDaPessoa() só resolve o do próprio chamador,
--    via auth.uid() implícito).
CREATE OR REPLACE FUNCTION public.conta_do_autor(p_author_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT mentor_id FROM public.people
      WHERE user_id = p_author_id
      ORDER BY created_at LIMIT 1),
    (SELECT tm.owner_id FROM public.team_members tm
      WHERE tm.user_id = p_author_id AND tm.status = 'ativo' AND tm.user_id <> tm.owner_id
      ORDER BY tm.created_at LIMIT 1),
    p_author_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.conta_do_autor(uuid) TO authenticated;

-- 3. Preenche quem já existe. author_id é NOT NULL, então o COALESCE de
--    dentro de conta_do_autor sempre tem para onde cair — zero nulos ao fim.
UPDATE public.community_posts
SET conta_id = public.conta_do_autor(author_id)
WHERE conta_id IS NULL;

-- 4. A partir daqui a coluna é obrigatória — mas o código publicado HOJE
--    insere em community_posts sem mencionar conta_id. Sem um valor-padrão,
--    o próximo post feito por esse código (antes do deploy novo chegar)
--    quebraria com "null value in column conta_id violates not-null
--    constraint". O DEFAULT abaixo fecha essa janela: usa a mesma função,
--    aplicada a quem está autenticado no momento do INSERT — que é sempre
--    quem publica (a policy cp_insert já exige author_id = auth.uid()).
ALTER TABLE public.community_posts
  ALTER COLUMN conta_id SET DEFAULT public.conta_do_autor(auth.uid());

ALTER TABLE public.community_posts
  ALTER COLUMN conta_id SET NOT NULL;
