
# Editor de Testes + Resposta + Resultado

Vamos transformar cada teste em um formulário editável (estilo Google Forms), permitir que o aluno responda, e calcular o resultado somando pontos por dimensão (D/I/S/C, E/I-S/N-T/F-J/P, etc).

## Modelo de dados (nova migração)

Templates globais vêm prontos por seed; cada mentor pode **duplicar** para gerar sua própria versão editável.

```text
test_versions          → uma "versão" editável de um instrumento
  id, instrument_id, mentor_id (null = template global),
  title, is_template, is_published, created_at, updated_at

test_dimensions        → dimensões de resultado (D, I, S, C / E, I / ...)
  id, version_id, key, label, description, color, sort_order

test_questions         → perguntas do formulário
  id, version_id, sort_order, type, prompt, required, config (jsonb)
  type ∈ multiple_choice | checkboxes | linear_scale | ranking | drag_order

test_options           → opções/itens de cada pergunta
  id, question_id, sort_order, label, value (jsonb)

option_scores          → pontos que cada opção soma em cada dimensão
  id, option_id, dimension_id, points (int)
  # para linear_scale, "opções" = níveis 1..N; pontos multiplicam pelo nível
  # para ranking/drag_order, points são aplicados por posição (config define pesos)

test_results           → faixas/rótulos de resultado por dimensão dominante
  id, version_id, dimension_id (nullable p/ score total),
  min_score, max_score, title, description

test_responses         → resposta de um aluno a uma versão
  id, version_id, person_id, group_id (nullable),
  started_at, submitted_at, computed_scores (jsonb),
  dominant_dimension_id, result_id
test_answers           → resposta item a item
  id, response_id, question_id, payload (jsonb)  // opções marcadas, escala, ordem
```

Todas as tabelas com RLS: templates globais (`mentor_id IS NULL`) legíveis por todos autenticados; versões próprias do mentor visíveis/editáveis apenas por ele; respostas visíveis ao mentor dono da versão e à pessoa que respondeu. GRANTs para authenticated + service_role em cada tabela.

Seed inicial: uma `test_version` template para cada instrumento existente (DISC, MBTI, Big Five, Temperamentos, VAK, QI) com dimensões corretas e 2–3 perguntas de exemplo, para o mentor duplicar.

## Server functions (`src/lib/tests.functions.ts`)

- `listTestVersions({ instrument_id })` — templates + versões do mentor
- `getTestVersion({ id })` — versão + dimensões + perguntas + opções + scores + resultados
- `duplicateTemplate({ template_version_id })` — cria versão editável do mentor
- `updateTestVersion`, `deleteTestVersion`, `publishTestVersion`
- `upsertDimension`, `deleteDimension`
- `upsertQuestion`, `deleteQuestion`, `reorderQuestions`
- `upsertOption`, `deleteOption`, `setOptionScores` (batch de `option_scores`)
- `upsertResultBand`, `deleteResultBand`
- `startResponse({ version_id, person_id, group_id? })`
- `submitResponse({ response_id, answers })` — valida required, calcula `computed_scores` e resolve `dominant_dimension_id` + `result_id`

Cálculo (server-side, autoritativo):
- `multiple_choice`/`checkboxes`: soma `option_scores` das opções marcadas.
- `linear_scale`: `points_per_dimension × nível escolhido`.
- `ranking`/`drag_order`: peso por posição definido em `config` (ex: 1º=N, 2º=N-1…), multiplicado pelos `option_scores`.
- Dimensão dominante = maior soma; `result_id` = faixa cujo intervalo cobre o score.

## UI — Editor (Google Forms-like)

Nova rota `/_app/testes/$versionId/editar` (a lista de testes vira `/_app/testes` reformada; mantemos o catálogo atual mostrando template + botão **Duplicar para editar**).

Layout em duas colunas:
- **Esquerda (canvas)**: lista de perguntas arrastáveis (`@dnd-kit/sortable`, já compatível). Cada card:
  - Campo do enunciado, toggle "obrigatória", seletor de tipo, botão excluir/duplicar.
  - Editor específico por tipo:
    - Múltipla escolha / Caixas de seleção: lista de opções com "+", cada opção mostra chips com as **dimensões** e um input numérico de pontos.
    - Escala linear: min/max (1–5, 1–7…), rótulos das pontas, pontos por dimensão por nível (padrão: nível × peso).
    - Classificação (ranking): lista de itens, pesos por posição.
    - Arrastar para ordenar: lista de itens com destino/dimensão para cada item.
- **Direita (painel)**:
  - Aba **Dimensões**: criar/editar/remover dimensões (chave, rótulo, cor).
  - Aba **Resultados**: faixas por dimensão (ex: "Dominância alta = 60–100").
  - Aba **Publicar**: valida (todas as perguntas têm pontuação? faixas cobrem intervalos?) e publica.

Barra superior: título editável, status (rascunho/publicado), botão **Pré-visualizar** e **Salvar** (salva com debounce por campo, evitando perder trabalho).

Salvamento: cada mutação chama a server fn correspondente; invalidamos a query da versão. Nada de "salvar tudo" — mudanças são atômicas por entidade.

## UI — Preview e resposta do aluno

- `/_app/testes/$versionId/preview` — usa os mesmos componentes de renderização em modo "sem persistência" para o mentor testar.
- `/responder/$responseId` — rota pública (sem `_app`), acessada pelo link gerado no envio. Renderiza uma pergunta por vez (ou tudo em uma página, configurável), valida obrigatórias, e submete via `submitResponse`. Ao finalizar, mostra tela de conclusão; se a versão permitir, mostra também o resultado resumido.

Componentes de campo reutilizáveis em `src/components/test-fields/`: `MultipleChoiceField`, `CheckboxesField`, `LinearScaleField`, `RankingField`, `DragOrderField`.

## Integração com o resto do app

- **Grupos**: `group_instruments` passa a poder referenciar uma `test_version_id` específica (opcional; se nulo, usa o template global). Sem quebrar o schema atual — adicionamos coluna nullable.
- **Envios (`/_app/envios/novo`)**: cria `test_responses` com status "pendente" e gera o link `/responder/$id` por pessoa selecionada.
- **Dashboard do grupo**: substituímos a lógica determinística mock por leitura real de `test_responses.computed_scores`; se ainda não houver respostas, mostra estado vazio.

## Ordem de implementação

1. Migração + seed dos templates.
2. Server functions de CRUD do editor.
3. Rota do editor com todos os tipos de pergunta e painel de dimensões/resultados.
4. Rota de resposta do aluno + `submitResponse` com cálculo.
5. Integração com envios (link real) e dashboard do grupo (dados reais).

## Detalhes técnicos

- `@dnd-kit/core` + `@dnd-kit/sortable` para arrastar perguntas, ranking e drag-order.
- Validação com `zod` em todas as server fns.
- RLS: `has_group_access(person_id, version_id)` como função `SECURITY DEFINER` para a rota pública de resposta autenticar o aluno via token de resposta (o `response_id` é o token; UUID longo, gerado no `startResponse`).
- Fontes/estilo: mantemos os tokens atuais (Analytical Workspace); nada de cores hardcoded.
