-- #248: o local/link da sessão nascia sempre "online" cravado no código
-- (agendamento.functions.ts, confirmarAgendamento e agendarNoPainel), sem
-- endereço nem sala — o aluno agendava e não sabia onde era.
--
-- Decisão do Matheus (05/08): o local vem do LINK, não da sessão avulsa.
-- Configura uma vez no link, e toda sessão criada por ele já nasce certa.
--
-- Mesmos três nomes que `mentoria_sessoes` já usa (modalidade/local/link_url)
-- — nome igual para a mesma coisa poupa quem for ler isso daqui a três meses.
-- Só ADICIONA colunas: nenhum nome muda, nenhuma regra existente é alterada.
ALTER TABLE public.mentoria_links
  ADD COLUMN modalidade text NOT NULL DEFAULT 'online' CHECK (modalidade IN ('presencial', 'online')),
  ADD COLUMN local text,
  ADD COLUMN link_url text;
