-- #212 Fase 4, Fatia 1 — construtor mínimo de testes próprios.
--
-- O enum question_type ganha 'short_text' (texto livre). Em migração própria,
-- separada de qualquer coisa que já USE o valor novo — Postgres não deixa
-- usar um valor de enum recém-adicionado na MESMA transação em que ele foi
-- criado.
ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'short_text';
