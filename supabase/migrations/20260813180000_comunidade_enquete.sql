-- #54 — Enquete no feed da Comunidade.
--
-- Um post pode nascer com uma enquete: a pergunta é o próprio `body` do post
-- (não precisa de coluna nova em community_posts — "é uma enquete" já se
-- deduz de ter opções), e as opções ficam numa tabela própria. Nenhuma coluna
-- nova em community_posts, nenhum flag: um post TEM uma enquete quando existe
-- ao menos uma linha em community_poll_options apontando para ele.
--
-- VOTO IDENTIFICADO é decisão consciente do dono do produto (#76 do kanban),
-- não default deste código. Por isso o voto guarda quem votou (voter_id +
-- voter_name, congelado como author_name já faz em post/comentário) e a
-- policy de leitura deixa QUALQUER MEMBRO DO GRUPO ler a lista de votos — não
-- só o próprio autor da enquete.
--
-- Dono nasce junto (conta_id em ambas as tabelas, mesmo padrão da #271) e as
-- travas de integridade são chave estrangeira de verdade (mesmo padrão da
-- #272: ON DELETE CASCADE até auth.users, igual às 10 colunas já migradas) —
-- não coluna solta.
--
-- Reaproveita duas peças que já existem e já resolveram a armadilha de RLS
-- circular deste mesmo desenho (community_post_groups, migração
-- 20260729200000): `posso_ver_post(post_id)` para leitura (mesma regra de
-- quem vê o post) e `sou_autor_do_post(post_id)` para a escrita das opções no
-- instante da publicação, sem depender do vínculo de grupo já existir.

CREATE TABLE public.community_poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  texto text NOT NULL CHECK (length(btrim(texto)) > 0),
  ordem smallint NOT NULL,
  /** Mesma função já usada para preencher community_posts.conta_id (#271) —
      o DEFAULT é rede de segurança; o server sempre manda o valor explícito. */
  conta_id uuid NOT NULL DEFAULT public.conta_do_autor(auth.uid())
    REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX community_poll_options_post_idx
  ON public.community_poll_options (post_id, ordem);

CREATE TABLE public.community_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.community_poll_options(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  /** Nome exibido, congelado no instante do voto — mesmo motivo do
      author_name em post/comentário: se a pessoa sair do grupo depois, o voto
      continua legível em vez de virar "desconhecido". Recalculado a cada
      troca de voto, então nunca fica mais desatualizado que o último voto. */
  voter_name text NOT NULL,
  conta_id uuid NOT NULL DEFAULT public.conta_do_autor(auth.uid())
    REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Um voto por pessoa por enquete. Trocar de opção é um UPDATE nesta mesma
  -- linha (UPSERT por post_id+voter_id), não uma segunda linha.
  UNIQUE (post_id, voter_id)
);

CREATE INDEX community_poll_votes_post_idx ON public.community_poll_votes (post_id);
CREATE INDEX community_poll_votes_option_idx ON public.community_poll_votes (option_id);

DROP TRIGGER IF EXISTS community_poll_votes_set_updated_at ON public.community_poll_votes;
CREATE TRIGGER community_poll_votes_set_updated_at
  BEFORE UPDATE ON public.community_poll_votes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Só vejo os votos alheios se eu mesmo já votei nesta enquete — é o que torna
-- a regra de honestidade ("quem não votou não vê resultado") uma trava real
-- de banco, não só uma tela que esconde. Sem isto, dava para ler
-- community_poll_votes direto pela API e ver o resultado sem votar.
--
-- Função separada (em vez de inline na policy) por dois motivos: mesmo idioma
-- de posso_ver_post/sou_autor_do_post já usados neste arquivo, e para não
-- misturar a checagem "linha por linha" com a de "já votei nesta enquete,
-- em qualquer opção" dentro do mesmo USING.
CREATE OR REPLACE FUNCTION public.ja_votei_na_enquete(p_post_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.community_poll_votes
     WHERE post_id = p_post_id AND voter_id = auth.uid()
  );
$fn$;

GRANT EXECUTE ON FUNCTION public.ja_votei_na_enquete(uuid) TO authenticated;

ALTER TABLE public.community_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_poll_votes ENABLE ROW LEVEL SECURITY;

-- As opções em si nunca são segredo — aparecem para quem vê o post, tenha
-- votado ou não (requisito da demanda: quem não votou vê as opções, só não
-- vê o resultado).
CREATE POLICY cpo_read ON public.community_poll_options FOR SELECT TO authenticated
  USING (public.posso_ver_post(post_id));

-- Só nasce junto com o post (publicarPost cria as opções logo depois do
-- INSERT do post). Sem UPDATE/DELETE nesta versão: a enquete não é editável
-- depois de publicada, e apagar o post já leva as opções em cascata.
CREATE POLICY cpo_insert ON public.community_poll_options FOR INSERT TO authenticated
  WITH CHECK (public.sou_autor_do_post(post_id));

CREATE POLICY cpv_read ON public.community_poll_votes FOR SELECT TO authenticated
  USING (
    public.posso_ver_post(post_id)
    AND (voter_id = auth.uid() OR public.ja_votei_na_enquete(post_id))
  );

CREATE POLICY cpv_insert ON public.community_poll_votes FOR INSERT TO authenticated
  WITH CHECK (
    voter_id = auth.uid()
    AND public.posso_ver_post(post_id)
    AND EXISTS (SELECT 1 FROM public.community_poll_options o
                 WHERE o.id = option_id AND o.post_id = community_poll_votes.post_id)
  );

-- Trocar de voto: mesma linha, option_id novo. voter_id não muda (USING
-- confere a linha ANTES da troca; WITH CHECK confere o que ela vira DEPOIS).
CREATE POLICY cpv_update ON public.community_poll_votes FOR UPDATE TO authenticated
  USING (voter_id = auth.uid())
  WITH CHECK (
    voter_id = auth.uid()
    AND public.posso_ver_post(post_id)
    AND EXISTS (SELECT 1 FROM public.community_poll_options o
                 WHERE o.id = option_id AND o.post_id = community_poll_votes.post_id)
  );
