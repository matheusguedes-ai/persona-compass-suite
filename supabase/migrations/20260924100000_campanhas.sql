-- #301: invite_links vira "Campanha" — container com nome, testes, grupo,
-- período e limite. A estrutura já existia (title, version_ids, group_id,
-- expires_at, max_responses, response_count, is_active); esta migração é
-- puramente aditiva (regra 5): duas colunas novas + dois índices, e o
-- preenchimento do que já existe.
--
-- ⚠️ POR QUE NÃO HÁ invite_link_id EM test_responses/assessment_responses HOJE
-- Nunca existiu. `startResponse`/`startAssessment` (envio individual) nunca
-- tocaram em invite_links; nem o próprio `/convite` (#300) grava de onde a
-- resposta veio. Sem essa coluna, "quantas respostas esta campanha teve" é
-- impossível de responder com exatidão — é o problema central desta demanda.

ALTER TABLE public.invite_links ADD COLUMN starts_at timestamptz;
ALTER TABLE public.test_responses ADD COLUMN invite_link_id uuid REFERENCES public.invite_links(id) ON DELETE SET NULL;
ALTER TABLE public.assessment_responses ADD COLUMN invite_link_id uuid REFERENCES public.invite_links(id) ON DELETE SET NULL;

CREATE INDEX test_responses_invite_link ON public.test_responses (invite_link_id) WHERE invite_link_id IS NOT NULL;
CREATE INDEX assessment_responses_invite_link ON public.assessment_responses (invite_link_id) WHERE invite_link_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Nome provisório para os 9 links existentes (item 4 — "NENHUM tem nome hoje,
-- a tela nunca ofereceu esses campos"). Deduzido de data + testes incluídos.
-- O dono renomeia depois; nada aqui é definitivo.
UPDATE public.invite_links SET title = 'Campanha de 28/07/2026 — Big Five, DISC, MBTI, Temperamentos, VAK e Valores' WHERE id = '9b2eef2e-9244-43fc-a024-18d59e1de6e1';
UPDATE public.invite_links SET title = 'Campanha de 29/07/2026 — DISC' WHERE id = '4df14574-98c4-4507-a151-060622ac0774';
UPDATE public.invite_links SET title = 'Campanha de 30/07/2026 — DISC, MBTI e Valores' WHERE id = 'f3c41c61-968a-43cd-ab2c-dab0045812b3';
-- O único teste deste link foi excluído depois — não dá para nomear pelo conteúdo.
UPDATE public.invite_links SET title = 'Campanha de 21/08/2026 — teste removido depois' WHERE id = 'f5b7f614-6d33-493e-925c-d1500495174c';
UPDATE public.invite_links SET title = 'Campanha de 24/08/2026 — Cadastro de novos alunos' WHERE id = '7e8f1a24-7419-4348-8289-82a6de1cf510';
UPDATE public.invite_links SET title = 'Campanha de 24/08/2026 — Mapa da Intenção' WHERE id = '844e1065-c3eb-4bd5-a18e-3337472ff66f';
UPDATE public.invite_links SET title = 'Campanha de 04/09/2026 — DISC' WHERE id = '25509b87-39fe-4c78-ae47-91de8eeea845';
UPDATE public.invite_links SET title = 'Campanha de 22/09/2026 — DISC, MBTI, Temperamentos e Valores' WHERE id = 'd0a6f07d-5c23-4489-b5e7-75074d7d9e75';
UPDATE public.invite_links SET title = 'Campanha de 22/09/2026 — DISC, MBTI, Temperamentos e Valores (2)' WHERE id = '3b99575b-3bcb-46d1-a8e9-8c09e4650065';

-- ---------------------------------------------------------------------------
-- Preenchimento do invite_link_id em respostas JÁ EXISTENTES (item 4 —
-- "NENHUMA resposta pode se desligar do seu link de origem").
--
-- ⚠️ POR QUE ISTO É POR ID EXATO, E NÃO UMA REGRA GERAL
-- Conferido linha a linha antes de escrever isto (23/09): `people.invite_link_id`
-- (a única pista que existia até agora) só marca a origem do CADASTRO da
-- pessoa, não de CADA resposta dela. A maioria destas 10 pessoas se cadastrou
-- em agosto pelo link "Mapa da Intenção" (844e1065) e respondeu de novo na
-- aula de 22/09 por um link DIFERENTE (d0a6f07d) — uma regra geral por
-- `people.invite_link_id` teria atribuído a bateria da aula ao link errado.
-- A reconstrução abaixo usa o sinal que sobra: quais testes o link continha
-- e quando cada resposta foi criada (a bateria só pode ser de um link que já
-- existia). Mesmo assim NÃO bate com o `response_count` de d0a6f07d (12) nem
-- de 3b99575b (8) — 15 batterias foram encontradas para as duas, não 20: a
-- diferença é o próprio bug que a #300 corrigiu (falha A: e-mail já
-- cadastrado consumia a vaga e travava ANTES de criar a resposta, sem
-- `release_invite_link`, que não existia ainda). Não é erro desta migração;
-- é o registro exato do que aconteceu. Links sem NENHUMA resposta rastreável
-- (4df14574, f3c41c61, 25509b87, f5b7f614) ficam com histórico vazio de
-- propósito — não existe resposta real para atribuir a eles.

-- 9b2eef2e — Gabriela, único uso deste link, mesmo dia.
UPDATE public.assessment_responses SET invite_link_id = '9b2eef2e-9244-43fc-a024-18d59e1de6e1'
 WHERE id IN ('cceac7d1-d3be-4717-b2d7-4cb36b3491f7', 'f75b6ede-397f-49b0-81a5-159b371472f9');

-- 7e8f1a24 — Andressa, único uso deste link, mesmo dia.
UPDATE public.test_responses SET invite_link_id = '7e8f1a24-7419-4348-8289-82a6de1cf510'
 WHERE id = '7702d137-3bf1-4a49-accf-51d5856a2907';

-- 844e1065 (Mapa da Intenção) — as 10 respostas SOLO de DISC, uma por pessoa,
-- todas anteriores à aula de 22/09 (a única coisa que este link continha).
UPDATE public.test_responses SET invite_link_id = '844e1065-c3eb-4bd5-a18e-3337472ff66f'
 WHERE id IN (
   'e3041fb3-a475-424c-a4a5-646726a2b808', '4e0a9b7d-83c7-4975-a156-634b6e20fd39',
   '0fd53df1-9e5a-4c6c-bcc0-57c210515849', 'd542ed64-8bbd-46e3-86ae-9fa864b75399',
   'd80c2de2-c877-4e09-a280-96605346dbfe', '7998220f-b129-41a5-8692-b3ad95cae087',
   'e45a8d3b-c8c3-4fb9-b890-6def9f1640f2', '4dff8c04-2153-49b8-ba9c-afcfbb2c7ae9',
   'a56e9115-8155-4276-9359-8d4796440c2d', '38794455-cece-4abf-9ddd-27c6ace6bb94'
 );

-- d0a6f07d (aula 22/09, link 1) — as 14 baterias criadas antes do link 2 existir.
UPDATE public.assessment_responses SET invite_link_id = 'd0a6f07d-5c23-4489-b5e7-75074d7d9e75'
 WHERE id IN (
   '871fa813-8b72-498c-9c12-853ec5f63e53', 'dd635bc9-03b3-4be8-bd21-2475f75f6fce',
   '2c2ce296-7692-4fbd-9abd-e06e2fb6ffd8', '73e0dcfe-48c4-45b1-8be0-7292477a89ee',
   '3ef09e07-e538-4203-931e-9c3256d293dc', '06914fa4-575d-4f52-b5b3-8e091da23bf8',
   'f4d52ad5-ea60-4e97-83b8-e461aabaad5e', 'e230951e-c07b-4762-bd71-11823d6359a0',
   '567bc374-699e-4e0b-8035-80b1572fde32', 'dd250881-3bf1-40e5-b4bc-38690d43a1eb',
   '2f6a23dc-3fff-44aa-ab98-0ffdab86f64c', 'e63acdaf-1b85-4940-926e-86a211803e21',
   'bef0aebc-20b8-46d6-b71a-af266fe8c5cf', '48e13165-0c1c-47a6-95c1-8ab1f764e3b5'
 );

-- 3b99575b (aula 22/09, link 2) — a bateria criada depois que o 1º encheu.
UPDATE public.assessment_responses SET invite_link_id = '3b99575b-3bcb-46d1-a8e9-8c09e4650065'
 WHERE id = '824a5153-bdc5-4396-ab41-08d1770f0124';

-- As etapas (test_responses) de toda bateria acima herdam o mesmo link do pai —
-- pra uma consulta direta em test_responses (sem passar por assessment_responses)
-- também achar a campanha certa.
UPDATE public.test_responses t
   SET invite_link_id = a.invite_link_id
  FROM public.assessment_responses a
 WHERE t.assessment_response_id = a.id
   AND a.invite_link_id IS NOT NULL
   AND t.invite_link_id IS NULL;
