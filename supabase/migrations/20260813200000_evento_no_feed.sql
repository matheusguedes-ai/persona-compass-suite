-- #56 — Evento da Agenda como cartão no feed da Comunidade.
--
-- Fonte única da verdade: o post NÃO copia título/data/link do evento — ele
-- guarda uma referência, e o feed lê o evento ao vivo toda vez. Muda a data
-- na Agenda, o cartão muda sozinho.
--
-- O desafio é o requisito 5: evento apagado não pode apagar o cartão (ele é
-- histórico do grupo) nem virar erro — tem que virar aviso educado. Uma FK
-- comum não resolve sozinha: ON DELETE CASCADE apagaria o post junto (errado
-- — o post é dono da própria existência, não o evento); ON DELETE SET NULL
-- numa coluna direta em community_posts apagaria também o ÚNICO sinal de que
-- aquele post UM DIA foi um cartão de evento, e o feed não teria como saber
-- se deve mostrar "não disponível" ou simplesmente não é um post de evento.
--
-- A saída: tabela própria, com o post_id como chave primária (não FK solta).
-- Apagar o POST derruba a linha inteira (ON DELETE CASCADE em post_id) — o
-- vínculo não sobrevive ao post, como já vale para as opções de enquete.
-- Apagar o EVENTO só zera a coluna evento_id (ON DELETE SET NULL) — a LINHA
-- continua existindo, e é a existência dela (não o valor de evento_id) que
-- diz "este post é um cartão de evento". Zero coluna nova em community_posts.
--
-- Reaproveita o que já existe: posso_ver_post/sou_autor_do_post (#55/#54)
-- para a mesma regra de visibilidade dos posts, e a RLS já existente de
-- `eventos` (posso_ver_evento, migração 20260730040000) barra sozinha quem
-- não tem permissão de ver o evento em si — mesmo que veja o post.

CREATE TABLE public.community_post_eventos (
  post_id uuid PRIMARY KEY REFERENCES public.community_posts(id) ON DELETE CASCADE,
  evento_id uuid REFERENCES public.eventos(id) ON DELETE SET NULL,
  /** Mesmo padrão da #271/#54: dono nasce junto, DEFAULT como rede de
      segurança — o server sempre manda o valor explícito. */
  conta_id uuid NOT NULL DEFAULT public.conta_do_autor(auth.uid())
    REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_post_eventos ENABLE ROW LEVEL SECURITY;

-- Mesma regra de quem vê o post — o cartão é um post como outro qualquer.
CREATE POLICY cpe_read ON public.community_post_eventos FOR SELECT TO authenticated
  USING (public.posso_ver_post(post_id));

-- Só nasce junto com o post (publicarPost cria o vínculo logo depois do
-- INSERT do post, mesma saída da #54 para o mesmo problema de RLS circular).
-- Sem UPDATE/DELETE nesta versão: o vínculo não é editável depois de criado.
CREATE POLICY cpe_insert ON public.community_post_eventos FOR INSERT TO authenticated
  WITH CHECK (public.sou_autor_do_post(post_id));
