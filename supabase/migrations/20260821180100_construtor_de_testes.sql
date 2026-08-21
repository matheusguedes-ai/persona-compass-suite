-- #212 Fase 4, Fatia 1 — construtor mínimo de testes próprios do mentor.
--
-- A OFICINA em cima do motor que já existe (test_versions/test_questions/
-- test_answers). Não é motor novo — é a primeira porta de entrada em branco:
-- hoje só dá para "Duplicar" um template (que já vem com dimensões e
-- pontuação prontas); esta fatia cria um teste do ZERO, sem interpretação.

-- Instrumento próprio para testes personalizados (coleta pura, sem
-- metodologia por trás) — os 7 que já existem são todos uma metodologia
-- específica (DISC, Big Five, ...). Tabela-catálogo, insert aditivo puro.
--
-- `category` tinha uma lista fechada de 3 valores (nenhum servia — não é
-- comportamental, psicométrico nem cognitivo); a constraint ganha um 4º
-- valor. Aditivo: só ALARGA quem já era aceito, nenhuma linha existente muda.
ALTER TABLE public.instruments DROP CONSTRAINT instruments_category_check;
ALTER TABLE public.instruments ADD CONSTRAINT instruments_category_check
  CHECK (category = ANY (ARRAY['comportamental'::text, 'psicometrico'::text, 'cognitivo'::text, 'personalizado'::text]));

INSERT INTO public.instruments (id, name, short_name, category, duration_min, description)
VALUES (
  'personalizado', 'Teste personalizado', 'Personalizado', 'personalizado', 10,
  'Um teste seu, do jeito que você organizar — sem metodologia por trás.'
)
ON CONFLICT (id) DO NOTHING;

-- has_interpretation: existe para a Fatia 3 não atropelar esta aqui (#212
-- pede a regra EXPLÍCITA, não implícita por "tem dimensão"). Um teste criado
-- nesta fatia nasce SEMPRE false — não produz perfil, é coleta pura. Os 7
-- templates (e qualquer cópia deles) têm interpretação de verdade: back-fill
-- abaixo.
--
-- is_anonymous: escolha do mentor NA CRIAÇÃO (não editável depois — ver
-- updateTestVersion, que nunca aceita este campo). Combinada com a trava de
-- test_responses.person_id nullable, mais embaixo.
--
-- forked_from_id: a cadeia do versionamento (#212, item 6). Uma mudança
-- ESTRUTURAL em versão já respondida não edita em cima — cria uma linha nova
-- apontando para de onde veio. A versão antiga nunca muda, então quem já
-- respondeu continua com o que respondeu.
ALTER TABLE public.test_versions
  ADD COLUMN IF NOT EXISTS has_interpretation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS forked_from_id uuid REFERENCES public.test_versions(id) ON DELETE SET NULL;

UPDATE public.test_versions SET has_interpretation = true WHERE is_template = true;

-- Anônimo só é permitido SEM interpretação (#212, item 5b) — trava de banco,
-- não checagem de tela. Todas as linhas de hoje têm is_anonymous = false (a
-- coluna acabou de nascer), então a constraint entra sem violar nada.
ALTER TABLE public.test_versions
  ADD CONSTRAINT test_versions_anonimo_sem_interpretacao
  CHECK (NOT is_anonymous OR NOT has_interpretation);

-- Teste anônimo não GRAVA quem respondeu (#212, item 5a) — não é esconder na
-- tela, é o vínculo nunca existir na linha. Isso exige que person_id aceite
-- NULL; o insert de resposta (startResponse, startAssessment, o link aberto)
-- é quem decide gravar NULL quando a versão é anônima. Toda resposta de HOJE
-- já tem person_id preenchido — soltar o NOT NULL não muda nem uma linha
-- existente, só passa a aceitar o caso novo.
ALTER TABLE public.test_responses ALTER COLUMN person_id DROP NOT NULL;
