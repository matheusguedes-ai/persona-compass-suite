-- Mentorias — Fatia 4b Parte 2: o aluno cancela e remarca sozinho.
--
-- Puramente aditiva: duas colunas novas em mentoria_links (regras de prazo e
-- teto) e três em mentoria_sessoes (contador de remarcações + registro de
-- quem cancelou). Nada que está publicado lê essas colunas hoje —
-- `permite_cancelar`/`permite_remarcar` já existem desde a Fatia 4a
-- (20260804020000) mas nascem `false` e nenhuma tela liga para elas ainda.

ALTER TABLE public.mentoria_links
  ADD COLUMN IF NOT EXISTS cancelamento_min_horas integer NOT NULL DEFAULT 24
    CHECK (cancelamento_min_horas >= 0),
  ADD COLUMN IF NOT EXISTS max_remarcacoes integer NOT NULL DEFAULT 2
    CHECK (max_remarcacoes >= 0);

COMMENT ON COLUMN public.mentoria_links.cancelamento_min_horas IS
  'De quantas horas antes da sessão o aluno ainda pode desmarcar/remarcar sozinho. Só lido quando permite_cancelar ou permite_remarcar está ligado.';
COMMENT ON COLUMN public.mentoria_links.max_remarcacoes IS
  'Quantas vezes a MESMA sessão pode ser remarcada pelo aluno. Só lido quando permite_remarcar está ligado.';

ALTER TABLE public.mentoria_sessoes
  ADD COLUMN IF NOT EXISTS remarcacoes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelada_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelada_por text CHECK (cancelada_por IN ('aluno', 'mentor'));

COMMENT ON COLUMN public.mentoria_sessoes.remarcacoes IS
  'Quantas vezes esta sessão já foi remarcada pelo aluno. Incrementa a cada remarcação; nunca reseta.';
COMMENT ON COLUMN public.mentoria_sessoes.cancelada_por IS
  'Quem cancelou: aluno (pela página pública /sessao/$id) ou mentor (pela tela de Mentorias). Null enquanto a sessão não foi cancelada.';
