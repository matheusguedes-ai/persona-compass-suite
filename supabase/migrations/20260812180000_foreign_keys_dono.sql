-- #272 — chave estrangeira nas colunas de dono que ainda não tinham.
--
-- A auditoria docs/auditoria-dono-do-dado.md (#214) apontou 9 colunas com
-- dono direto mas sem FOREIGN KEY aplicada — a policy de RLS já barra o
-- acesso errado, mas o banco aceitava em silêncio um mentor_id/owner_id/
-- conta_id apontando para ninguém. A décima (community_posts.conta_id)
-- nasceu assim de propósito na #271, mesmo padrão de eventos/notificacoes.
--
-- Levantamento ANTES desta migração (as 10 colunas, sem exceção):
-- zero nulos (todas já eram NOT NULL) e zero valores órfãos — nenhuma
-- aponta para um auth.users que não existe. Todas entram na chave.
--
-- Tabela alvo e regra de ON DELETE: auth.users(id) com CASCADE, o MESMO
-- padrão já usado sem exceção nas 20 colunas mentor_id/owner_id que já
-- tinham FK no projeto (people, groups, mentors, team_members,
-- learning_tracks, mentorias, mentoria_*, pontos, email_logs,
-- google_agendas_criadas, dominios_conta, test_versions, test_responses).
-- Nenhum padrão novo criado.

ALTER TABLE public.academy_banners
  ADD CONSTRAINT academy_banners_mentor_id_fkey
  FOREIGN KEY (mentor_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.assessment_responses
  ADD CONSTRAINT assessment_responses_mentor_id_fkey
  FOREIGN KEY (mentor_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.biblioteca_materiais
  ADD CONSTRAINT biblioteca_materiais_mentor_id_fkey
  FOREIGN KEY (mentor_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.biblioteca_pastas
  ADD CONSTRAINT biblioteca_pastas_mentor_id_fkey
  FOREIGN KEY (mentor_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.eventos
  ADD CONSTRAINT eventos_conta_id_fkey
  FOREIGN KEY (conta_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.export_logs
  ADD CONSTRAINT export_logs_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.invite_links
  ADD CONSTRAINT invite_links_mentor_id_fkey
  FOREIGN KEY (mentor_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.notificacoes
  ADD CONSTRAINT notificacoes_conta_id_fkey
  FOREIGN KEY (conta_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.treinamentos
  ADD CONSTRAINT treinamentos_mentor_id_fkey
  FOREIGN KEY (mentor_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_conta_id_fkey
  FOREIGN KEY (conta_id) REFERENCES auth.users(id) ON DELETE CASCADE;
