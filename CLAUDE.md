# Thrive Profiler — contexto do projeto

Plataforma de assessments comportamentais (Método Intenção / Métrica Humana).
Mentores cadastram pessoas e grupos, enviam inventários por link e recebem
relatórios detalhados. Metodologias de **domínio público**: DISC (Marston, 1928),
Tipos Psicológicos (Jung, 1921), Valores (Spranger, 1914), Big Five, VAK.

- Produção: https://persona-compass-suite.lovable.app
- Editor/hospedagem: Lovable (projeto `7ec78bd4-7fd4-4894-a726-db340b8544a3`)
- Repositório: `matheusguedes-ai/persona-compass-suite` (sync bidirecional com o Lovable)

---

## Constituição — as quatro regras que valem em toda demanda

Matheus é leigo em programação. Ele decide o **quê**; o agente decide o **como**
e responde pelo resultado. Estas quatro regras não são preferências de estilo:
cada uma nasceu de um prejuízo real.

### 1. Ponto de retorno antes de começar

Antes de tocar em qualquer coisa numa demanda nova, criar um commit com nome
claro em português — `versão estável antes de mexer nas mentorias`, não
`wip`. É o único jeito de o Matheus dizer "me leva de volta pra aquele ponto"
sem precisar entender git.

Se ele pedir "salva um ponto de retorno", é isso. Se pedir "me leva de volta pra
aquele ponto", achar o commit pelo nome e voltar — e explicar o que se perde.

### 2. Todo registro de dado nasce com dono

Toda tabela nova, toda coluna que guarda algo de alguém, nasce com a
identificação do proprietário (`mentor_id`, `owner_id`, ou o que a tabela já
usar — seguir o padrão de `acting_account()`).

Hoje o dono é sempre o Matheus e não há segundo cliente, então **isto não é
urgente — é preparação**. A plataforma vai virar SaaS. Cada tabela criada sem
dono é uma cirurgia a mais depois. Cobrança, planos e escala plugam sem dor
mais tarde; o isolamento por dono, não.

Nunca perguntar se deve incluir o campo de dono. Incluir.

### 3. Uma feature por vez

Nunca amontoar duas demandas grandes na mesma entrega. Constrói, testa,
funcionou, próxima.

E o inverso também é regra: **quando o Matheus pedir demais de uma vez, avisar.**
Ele sabe que tem essa tendência e pediu explicitamente para ser freado. Dizer
qual pedaço vem primeiro e por quê, e perguntar se pode deixar o resto para
depois. Isso não é insubordinação — é o combinado.

### 4. Explicar em português simples ao terminar

Ao final de toda demanda, sem ser pedido:

- **o que foi feito**, em português de quem não lê código;
- **o que pode ter quebrado** — que telas encostam nisso, que papéis (dono,
  mentor convidado, colaborador, aluno) são afetados, o que vale conferir.

Nunca responder mandando ele ler código ou diff. Explicar o mapa.

### Antes de pedir algo ao Matheus, tentar sozinho

Já aconteceu duas vezes em 31/07: o agente pediu ao Matheus que fizesse à mão
algo que ele mesmo alcançava — fechar bucket (era chamada de API com a chave de
serviço) e aplicar migração (o editor SQL do Supabase é um Monaco, e dá para
escrever nele pelo Chrome com `window.monaco.editor.getModels()[0].setValue()`,
como registrado na memória do projeto).

Antes de escrever "preciso que você faça isto", conferir nesta ordem:

1. dá pela REST com a chave de serviço do `.env.local`?
2. dá pelo Chrome dele, que fica conectado pela extensão?
3. a sessão que expirou antes pode ter voltado — ele entra no painel o tempo
   todo. Testar de novo em vez de assumir que continua caída.

Só depois disso, pedir. E ao pedir, dizer **qual pedaço** exige ele — não
transferir o trabalho inteiro.

### O que fazer sozinho, e o que trazer

Regra dele: **problema identificado, conserte no mesmo trabalho e conte depois.**
Não perguntar "quer que eu conserte?" — consertar e relatar. Parar e perguntar só
quando o risco for alto (dado que sai da plataforma, mudança irreversível,
decisão de produto que muda o que a feature é).

Antes de dar algo como entregue, **abrir a plataforma e conferir nos papéis
afetados.** "Concluído" que ninguém exercitou é "precisa de melhorias" com nome
bonito — cinco demandas do kanban já provaram isso.

### Quem faz o quê

O planejamento acontece **no chat** (Cowork/claude.ai), onde o Matheus pensa,
decide e recebe o prompt pronto. A construção acontece **no Claude Code**, onde
ele cola o prompt. Arquiteto e pedreiro.

Combinado com ele em 30/07:

- Documento de planejamento (roadmap, spec, regra, caderno de dores) o **chat
  escreve direto no repositório** — ele não copia nem cola nada. Mas o chat
  **avisa sempre o que tocou**, senão o Code trabalha em cima de arquivo que
  mudou sem ele saber.
- Demanda vai para o Code **um prompt por vez**, no ritmo dele. Nunca um lote:
  pilha de prompt vira vontade de mandar tudo junto, que é exatamente o que a
  regra 3 existe para impedir.
- O chat **não constrói feature**. Se der vontade de já corrigir o código
  enquanto planeja, o lugar disso é o prompt, não o commit.
- Quando o Matheus disser que o Code terminou, o chat **confere por conta
  própria** antes de mover o kanban: lê o commit, o código que mudou e o banco.
  Ele não precisa colar a resposta do Code — basta dizer "terminou". Entrega dada
  como pronta sem alguém olhar já voltou como "precisa de melhorias" dez vezes.

### Onde ficam as decisões e a fila

- **Notion — [Thrive Profiler — Kanban de demandas](https://app.notion.com/p/bd5f0a8df66e47c6a6ec6c0afff46393)**
  é o quadro que o Matheus olha. Data source `c9814506-a2ca-408e-ac82-0bf42de6d2fb`.
  **Ao fechar qualquer demanda, o chat atualiza o Notion na mesma hora** —
  status, prova e fase. Não deixar para depois: kanban desatualizado é pior que
  kanban nenhum, e a cópia velha no Google Drive já provou isso.
- **Demanda grande ganha checklist de etapas no corpo da página do Notion**, e o
  chat vai marcando conforme os commits aparecem. Assim o Matheus acompanha sem
  precisar perguntar ao Code em que pé está — e sem interromper no meio.
- `scripts/kanban_dados.json` — a fonte versionada, para o histórico ficar no
  git. `scripts/kanban_planilha.py` gera o `.xlsx`, que hoje é só um retrato.
- `docs/roadmap-fases.md` — a ordem das fases e o que trava o quê.
- `docs/dores-plano-comercial.md` — as dores de coach que a plataforma resolve.

## Stack

TanStack Start (SSR) + React 19 + TypeScript + Tailwind v4 + shadcn/ui.
Banco: Supabase (PostgreSQL) com RLS. Server functions do TanStack com validação Zod.
Build: `npx vite build` · Typecheck: `npx tsc --noEmit -p tsconfig.json`

Scripts de conteúdo e verificação (Python puro, sem dependência):
- `scripts/conteudo_*.py` — perguntas e textos de relatório, com os asserts
- `scripts/aplicar_conteudo.py <modulo>` — grava no banco **via REST**. O editor
  SQL do Supabase já cortou script no meio dizendo "Success" e já mostrou o
  resultado da execução anterior; pela REST cada passo devolve o que gravou.
  Recusa rodar se a versão já tiver resposta enviada.
- `scripts/simular_resposta.py <versao> primeira|ultima|coerente` — responde o
  teste pelo endpoint público e mostra o resultado. **"primeira" e "ultima"
  precisam dar empate e selo "baixa"**; se saírem com perfil dominante, o teste
  está fabricando resultado pela posição da alternativa.

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
| `devolutivas` | a conversa de resultado: fila, agendamento e o que ficou combinado |

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
  Três montadores: DISC (seções por perfil composto), MBTI (por eixo) e
  dimensional (Valores/Temperamentos/VAK/Big Five, 9 seções).
- `src/lib/derivations.ts` — pesos das derivações do DISC (Jung, 4 estilos de
  liderança, 16 competências, 4 índices), sobrescritíveis por `derived_config`.
- `src/components/report/sections.tsx` — blocos visuais compartilhados.
- `/relatorio/$responseId` — relatório de um teste.
- `/relatorio-bateria/$assessmentId` — unificado: uma seção por teste respondido.

**Regra de honestidade (importante):** nada aparece a partir de teste não
respondido. Empate também não vira resultado: com menos de 10 pontos entre a
maior e a menor dimensão, o relatório diz "sem predominância clara" em vez de
cravar uma letra vinda do desempate da lista. No MBTI, eixo abaixo de 55% é
declarado em aberto e sai das seções.
Selo de confiabilidade em toda resposta (`computed_scores.qualidade`): mede
contradição entre itens equivalentes, respostas sem variação e ritmo. Liderança/competências/índices levam o selo "Derivado do seu DISC".
Tipos Psicológicos usam o MBTI real quando respondido; senão vão como
"Estimativa derivada do seu DISC", com ressalva explícita no texto.

## Conteúdo

Todo texto do relatório é **original** — as metodologias são de domínio público,
mas os textos de relatórios comerciais (CIS Assessment etc.) são protegidos.
Nunca copiar. Conteúdo vive em `report_content` e `test_result_bands`, não no código.

Templates populados (revisados em 28/07/2026, ver `scripts/conteudo_*.py`):
DISC 28 blocos · Valores 30 · Temperamentos 28 · VAK 24 · MBTI 40 · Big Five 50
itens de escala · QI 20 questões com gabarito (não revisado).

Regras que o conteúdo precisa respeitar, verificadas por `assert` nos scripts:
- alternativas de **peso social parecido** — se uma delas é visivelmente a
  "resposta de líder", o teste mede vaidade;
- **ordem embaralhada** com equilíbrio exato por posição. A ordem fixa D,I,S,C
  fazia quem clicava na primeira alternativa sair com perfil D puro;
- **pares de checagem** (`config.check_group`): dois blocos equivalentes,
  afastados, e com ordens diferentes entre si — senão o par não pega nada;
- Big Five: metade dos itens **invertidos** (`config.reverse`) por traço.

## Estado atual e próximos passos

Feito: correção de ~31 bugs; `forced_choice`; relatório completo (Fases 1–3);
360° com observadores; plano de ação interativo; bateria com link único;
relatório unificado com rótulos de derivação.

Backlog: seleção pergunta a
pergunta ao montar a bateria (com ajuste da normalização); alpha de Cronbach na
tela de Estatísticas quando houver amostra; calibração dos pesos de derivação
com dados reais; revisão do QI.

## Convenções

- Interface e conteúdo em **pt-BR**; código e comentários técnicos em inglês ou pt-BR conciso.
- Toda server function: middleware `requireSupabaseAuth` + validação Zod + checagem de ownership.
- Sempre checar `error` de queries Supabase — erros silenciados já causaram corrupção de dados aqui.
- Exclusões destrutivas exigem `AlertDialog` de confirmação.
- Endpoints públicos: devolver o mínimo necessário (sem e-mail, `mentor_id` ou scores alheios).
