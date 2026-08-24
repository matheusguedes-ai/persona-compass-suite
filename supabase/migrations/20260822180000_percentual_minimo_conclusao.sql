-- #221 Fatia 1 — a régua de conclusão.
--
-- Decisão do dono do produto (22/08): cada treinamento do Classroom e cada
-- trilha da Academy ganha um "percentual mínimo para concluir", com PADRÃO
-- 100%. Migração puramente ADITIVA — coluna nova, com default, em tabela que
-- já existe. Nada que está no ar hoje procura este nome, então pode ir antes
-- do código publicado (regra 5 da constituição).
--
-- Nenhuma tabela nova, nenhuma função SECURITY DEFINER nova: a leitura da
-- lista de quem concluiu usa exatamente as policies que já existem —
-- `lp_owner_read` (learning_progress), `pres_professor`/`tconcl_read`
-- (Classroom) já entregam ao dono tudo que a régua precisa enxergar.

ALTER TABLE public.treinamentos
  ADD COLUMN percentual_minimo integer NOT NULL DEFAULT 100
    CHECK (percentual_minimo BETWEEN 1 AND 100);

ALTER TABLE public.learning_tracks
  ADD COLUMN percentual_minimo integer NOT NULL DEFAULT 100
    CHECK (percentual_minimo BETWEEN 1 AND 100);

COMMENT ON COLUMN public.treinamentos.percentual_minimo IS
  '#221 F1 — percentual de aulas cumpridas (presença válida ou conclusão de aula gravada) para a régua considerar concluído. Padrão 100%.';
COMMENT ON COLUMN public.learning_tracks.percentual_minimo IS
  '#221 F1 — percentual de aulas da trilha registradas em learning_progress para a régua considerar concluído. Padrão 100%.';
