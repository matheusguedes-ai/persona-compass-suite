-- O QR rotativo prova QUANDO. Isto passa a provar ONDE.
--
-- O FURO
--
-- O codigo do QR muda a cada minuto, e vale o minuto atual mais o anterior. Isso
-- impede o codigo de virar credencial guardada, mas nao impede o obvio: quem
-- esta na sala fotografa o telao e manda no grupo do WhatsApp. Quem esta em casa
-- abre em quarenta segundos e marca presenca. O unico backstop era o olho do
-- professor conferindo a lista ao vivo -- ou seja, nenhum, numa turma de 40.
--
-- Encurtar o minuto nao resolve: a foto chega em cinco segundos. Nenhum ajuste
-- de TEMPO fecha um furo que e de LUGAR.
--
-- O CONSERTO
--
-- O professor trava a aula no lugar onde ela acontece (um clique na tela de
-- check-in, que captura a coordenada do aparelho dele). A partir dai, confirmar
-- presenca exige estar dentro do raio. A foto do QR continua viajando; a
-- presenca, nao.
--
-- POR QUE E OPCIONAL, E POR QUE O RAIO E FOLGADO
--
-- GPS de celular dentro de predio erra facil 50-100 m, e turma em subsolo as
-- vezes nao fixa sinal nenhum. Uma trava obrigatoria e apertada transformaria o
-- conserto num gerador de falta injusta -- pior do que o problema. Entao:
--
--   * A trava e por aula e nasce DESLIGADA. Sem coordenada, nada muda.
--   * O raio padrao e 300 m, nao 30.
--   * A precisao que o proprio aparelho declara entra como folga (limitada, no
--     codigo, para "precisao: 5 km" nao virar passe livre).
--   * O professor sempre pode marcar a mao -- e o caminho de quem esta na sala
--     com o GPS morto, e ele ja existe.
--
-- Isto nao e a prova de fraude: quem sabe abrir o devtools falseia a coordenada.
-- E o degrau que importa -- sai de "todo mundo consegue, sem querer" para
-- "precisa querer" -- e a distancia fica GRAVADA na linha, entao a lista do
-- professor mostra o check-in que veio de 12 km sem depender do olho dele.

-- ---- Onde a aula acontece ----
ALTER TABLE public.treinamento_aulas
  -- NULL nas duas = aula sem trava. E o estado inicial de tudo que ja existe.
  ADD COLUMN IF NOT EXISTS local_lat double precision,
  ADD COLUMN IF NOT EXISTS local_lng double precision,
  ADD COLUMN IF NOT EXISTS local_raio_m integer NOT NULL DEFAULT 300,
  -- Quando foi travada, para a tela do professor dizer "travado hoje as 19:02"
  -- em vez de so "travado" -- sala trocada e a aula de semestre passado ainda
  -- travada no endereco antigo e um jeito facil de reprovar a turma inteira.
  ADD COLUMN IF NOT EXISTS local_travado_em timestamptz;

ALTER TABLE public.treinamento_aulas
  DROP CONSTRAINT IF EXISTS treinamento_aulas_raio_check;
ALTER TABLE public.treinamento_aulas
  ADD CONSTRAINT treinamento_aulas_raio_check
  CHECK (local_raio_m BETWEEN 50 AND 5000);

-- ---- De onde veio o check-in ----
ALTER TABLE public.treinamento_presencas
  -- Metros ate o ponto travado. NULL = nao houve o que comparar (aula sem
  -- trava, ou presenca marcada a mao). Guardada mesmo quando passa: e o que
  -- permite ao professor ver o padrao depois.
  ADD COLUMN IF NOT EXISTS distancia_m integer;

-- Nada de policy nova: as colunas entram em tabelas que ja tem RLS, e as
-- coordenadas da aula sao lidas por quem ja podia ler a aula. A do ALUNO nunca
-- e gravada -- so a distancia, que nao localiza ninguem.
