# Thrive Profiler — contexto do projeto

Plataforma de assessments comportamentais (Método Intenção / Métrica Humana).
Mentores cadastram pessoas e grupos, enviam inventários por link e recebem
relatórios detalhados. Metodologias de **domínio público**: DISC (Marston, 1928),
Tipos Psicológicos (Jung, 1921), Valores (Spranger, 1914), Big Five, VAK.

- Produção: https://persona-compass-suite.lovable.app
- Editor/hospedagem: Lovable (projeto `7ec78bd4-7fd4-4894-a726-db340b8544a3`)
- Repositório: `matheusguedes-ai/persona-compass-suite` (sync bidirecional com o Lovable)

## Stack

TanStack Start (SSR) + React 19 + TypeScript + Tailwind v4 + shadcn/ui.
Banco: Supabase (PostgreSQL) com RLS. Server functions do TanStack com validação Zod.
Build: `npx vite build` · Typecheck: `npx tsc --noEmit -p tsconfig.json`

## Fluxo de trabalho

1. Editar o código localmente (Claude Code / Cowork).
2. `npx tsc --noEmit` e `npx vite build` para validar.
3. `git push` → o Lovable sincroniza automaticamente e reconstrói o preview.
4. Publicar pelo botão **Publish** no editor do Lovable (ou via MCP do Lovable).

**Não reescrever histórico já publicado** (nada de force push / rebase / amend em
commits já enviados) — quebra o histórico do lado do Lovable.

O agente de IA do Lovable consome créditos; editar o código por aqui, não.
Migrations e seeds de conteúdo são aplicados direto no banco via SQL (sem créditos),
e o arquivo `.sql` correspondente é commitado em `supabase/migrations/`.

## Modelo de dados (principais tabelas)

| Tabela | Papel |
|---|---|
| `instruments` | catálogo de testes (id texto: `disc`, `bigfive`, `valores`…) |
| `test_versions` | versão de um teste; `is_template` (global, `mentor_id` NULL) ou cópia do mentor; `derived_config` jsonb opcional |
| `test_dimensions` | dimensões da versão (`key`: D/I/S/C, ECO/TEO/…, E/I/S/N/T/F/J/P) |
| `test_questions` | `type`: `multiple_choice`, `checkboxes`, `linear_scale`, `ranking`, `drag_order`, `forced_choice`; `config` jsonb |
| `test_options` / `option_scores` | opções e pontuação opção→dimensão |
| `test_result_bands` | textos por faixa; `dimension_id` (NULL = geral) e `mode` (`natural`/`adaptado`) |
| `people`, `groups`, `group_members`, `group_instruments`, `mentors`, `profiles` | cadastros do mentor |
| `test_responses` | uma resposta de um teste. `kind` (`self`/`observer`), `parent_response_id`, `rater_name`, `assessment_response_id`, `assessment_sort`, `computed_scores` jsonb, `started_at`, `submitted_at` |
| `assessment_responses` | **bateria**: agrupa várias `test_responses` num único link |
| `report_content` | blocos de texto do relatório (208 registros globais, `version_id` NULL) |
| `action_plans` | respostas do plano de ação (1 por response) |

RLS ativa em todas. Padrão: mentor vê o que é seu (`mentor_id = auth.uid()`).
Endpoints públicos usam **service role** e o UUID do link como token.

⚠️ As policies de teste usam funções `SECURITY DEFINER` (`owns_test_version`,
`test_version_is_template`, `question_version_id`, `option_version_id`,
`response_mentor_id`). Elas **precisam** de `GRANT EXECUTE ... TO authenticated`.
O scanner de segurança do Lovable já revogou isso uma vez e derrubou o app inteiro.

## Motor de pontuação

`src/routes/api.public.response.$id.ts` → `computeAndStore`:

- Valida por tipo, deduplica ids, confere que pergunta/opção pertencem à versão.
- `forced_choice` (DISC/Valores/Temperamentos/VAK): +pontos do `most`,
  −pontos do `least`. Gera `natural` (só most) e `adaptado` (most − least).
- Demais tipos: `adaptado = natural`.
- `normalized` 0–100 por dimensão, com mín/máx teóricos derivados das perguntas.
- Persistido em `computed_scores`: `{ total, natural, adaptado, normalized }`.

## Relatórios

- `src/lib/report.server.ts` — `buildReport(responseId)`, compartilhado.
- `src/lib/derivations.ts` — pesos das derivações do DISC (Jung, 4 estilos de
  liderança, 16 competências, 4 índices), sobrescritíveis por `derived_config`.
- `src/components/report/sections.tsx` — blocos visuais compartilhados.
- `/relatorio/$responseId` — relatório de um teste.
- `/relatorio-bateria/$assessmentId` — unificado: uma seção por teste respondido.

**Regra de honestidade (importante):** nada aparece a partir de teste não
respondido. Liderança/competências/índices levam o selo "Derivado do seu DISC".
Tipos Psicológicos usam o MBTI real quando respondido; senão vão como
"Estimativa derivada do seu DISC", com ressalva explícita no texto.

## Conteúdo

Todo texto do relatório é **original** — as metodologias são de domínio público,
mas os textos de relatórios comerciais (CIS Assessment etc.) são protegidos.
Nunca copiar. Conteúdo vive em `report_content` e `test_result_bands`, não no código.

Templates populados: DISC (24 blocos), Valores (12), Big Five (30 itens likert),
MBTI (28 pares), Temperamentos (12), VAK (12), QI (20 questões com gabarito).

## Estado atual e próximos passos

Feito: correção de ~31 bugs; `forced_choice`; relatório completo (Fases 1–3);
360° com observadores; plano de ação interativo; bateria com link único;
relatório unificado com rótulos de derivação.

Backlog: seleção pergunta a pergunta ao montar a bateria (com ajuste da
normalização); alpha de Cronbach na tela de Estatísticas quando houver amostra;
calibração dos pesos de derivação com dados reais.

## Convenções

- Interface e conteúdo em **pt-BR**; código e comentários técnicos em inglês ou pt-BR conciso.
- Toda server function: middleware `requireSupabaseAuth` + validação Zod + checagem de ownership.
- Sempre checar `error` de queries Supabase — erros silenciados já causaram corrupção de dados aqui.
- Exclusões destrutivas exigem `AlertDialog` de confirmação.
- Endpoints públicos: devolver o mínimo necessário (sem e-mail, `mentor_id` ou scores alheios).
