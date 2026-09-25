# Thrive Profiler — contexto do projeto

Plataforma de assessments comportamentais (Método Intenção / Métrica Humana).
Mentores cadastram pessoas e grupos, enviam inventários por link e recebem
relatórios detalhados. Metodologias de **domínio público**: DISC (Marston, 1928),
Tipos Psicológicos (Jung, 1921), Valores (Spranger, 1914), Big Five, VAK.

- Produção: https://persona-compass-suite.lovable.app
- Editor/hospedagem: Lovable (projeto `7ec78bd4-7fd4-4894-a726-db340b8544a3`)
- Repositório: `matheusguedes-ai/persona-compass-suite` (sync bidirecional com o Lovable)

---

## Constituição — as cinco regras que valem em toda demanda

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

### 5. Código no ar antes de banco que muda o que já existe

Local e produção usam **o mesmo banco** (demanda #217). Toda mudança de banco
atinge a produção no instante em que roda, mesmo com o código novo ainda parado
no computador. Isso derrubou a plataforma duas vezes em 24 h — imagem quebrada
em 30/07, login quebrado em 31/07.

A regra, em três casos:

- **Migração que só ADICIONA** (tabela nova, coluna nova, função nova): pode ir
  antes do código. Nada que está no ar procura o que ainda não existe.
- **Migração que RENOMEIA, REMOVE ou muda regra** (permissão, constraint,
  coluna, valor de enum): o código novo tem de estar **publicado antes**. O que
  está no ar continua procurando o nome velho até o deploy chegar.
- **Quando os dois são necessários juntos**, fatiar em três passos: aplicar a
  parte aditiva → publicar o código novo, que aguenta os dois nomes → aplicar a
  parte que remove o antigo.

Antes de rodar qualquer migração, responder por escrito: *isto remove ou renomeia
alguma coisa que o código publicado ainda usa?* Se sim, publicar primeiro. Se
não der para publicar antes, avisar o Matheus da janela de quebra **antes** de
começar, não depois.

### Quando o Matheus tiver de fazer algo, explicar passo a passo

Regra dele, 04/08: **toda vez que a explicação for de algo que ELE precisa
executar, escrever passo a passo e bem detalhado.** Numerar os passos, dizer o
que ele vai VER em cada tela, e avisar qual é o passo que as pessoas esquecem.

Não é preferência de estilo — ele é leigo em programação, e instrução vaga
custa uma ida e volta que podia não existir. "Vá em Configurações e ative"
não serve; serve "clique em X, vai abrir Y, role até Z".

Vale também dizer o que NÃO é irreversível, para ele agir sem medo, e o que é,
para ele parar e perguntar.

### Provar o caminho do meio, não os dois extremos

Erro do chat três vezes: `#245` (buckets), `#254` (elegibilidade), `#265`
(login por e-mail). O padrão é sempre o mesmo — testar o caso totalmente
liberado e o totalmente negado, ver os dois responderem como esperado, e
concluir que o meio está certo. **O meio é onde as pessoas vivem.**

Em 03/08 ficou registrado aqui que "a criação de conta dentro da plataforma
está intacta", com base em dois testes: o cadastro público recusava e o
`admin/generate_link` funcionava. Nenhum dos dois é o caminho que um
colaborador usa. O login por e-mail e senha estava desligado para **todo
mundo** havia dias, e só apareceu quando alguém tentou entrar.

Antes de dar uma verificação por concluída, responder: *qual é o caminho que a
pessoa real percorre, e eu passei por ele?*

**A assinatura do erro é útil:** a mensagem `email_provider_disabled` significa
que o e-mail inteiro está desligado (login e cadastro); `signup_disabled`
significa que só o cadastro fechou, que é o estado desejado. Confundir os dois
foi o que custou o dia.

### Prova que a limpeza apaga não é prova

Em 05/08 o prompt da varredura pediu duas coisas que se anulam: limpeza
rigorosa do que foi criado no teste, **e** prova conferível depois. O Code
cumpriu as duas na ordem errada — apagou tudo, e com isso apagou a evidência.
Restou o relato dele, que é justamente o que não bastava.

Quando o teste cria dado, o relato tem de **citar os identificadores das linhas
antes de apagá-las**, ou deixar uma de cada tipo para conferência. Limpar é
certo; limpar sem registrar o que existiu transforma verificação em confiança.

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

- **Trello — [Thrive Profiler — Demandas](https://trello.com/b/3pY49jsH/thrive-profiler-demandas)**
  é o quadro que **o Matheus olha**. Quatro listas: Planejado, Em andamento,
  Precisa de melhorias, Concluído. Regra dele, 05/08.
- **Notion — [Thrive Profiler — Kanban de demandas](https://app.notion.com/p/bd5f0a8df66e47c6a6ec6c0afff46393)**
  é onde mora o detalhe: prova, ressalva, checklist de etapas.
  Data source `c9814506-a2ca-408e-ac82-0bf42de6d2fb`.
- **ESCREVER: sempre nos dois. LER: no que for mais fácil.** Combinado com ele
  em 05/08. Ao fechar uma demanda, ao registrar uma nova, ao mudar status —
  Notion **e** Trello, na mesma hora, sem exceção. Para consultar, o chat usa a
  conexão que for mais prática (em geral o arquivo versionado, que é a fonte).
  Dois quadros só não divergem se as duas escritas forem uma coisa só; foi
  assim que a cópia velha no Google Drive apodreceu.
- `scripts/kanban_dados.json` continua sendo **a fonte de verdade** — os dois
  quadros são vistas dele. Em caso de conflito, o arquivo manda.
- **Quem registra no Notion é o chat; o Code ATUALIZA, não cria.** Em 05/08 a
  `#252` nasceu duas vezes no quadro: o chat registrou ao escrever o prompt, e o
  Code registrou de novo ao concluir, porque o prompt não avisou que a página já
  existia. Todo prompt que sai daqui precisa dizer qual demanda já está no
  Notion e pedir que o Code atualize aquela página — nunca crie outra.
- **Número de demanda não é issue do GitHub.** Em 05/08 o Code escreveu duas
  vezes links como `github.com/.../issues/254` para demandas nossas. Não existe
  issue nenhuma — o kanban é o Notion. Link que não leva a lugar nenhum faz o
  Matheus clicar, esperar e não achar nada. Citar como `#254`, sem link.
- **Demanda grande ganha checklist de etapas no corpo da página do Notion**, e o
  chat vai marcando conforme os commits aparecem. Assim o Matheus acompanha sem
  precisar perguntar ao Code em que pé está — e sem interromper no meio.
- **Decisão que apaga uma feature inteira resolve as demandas dela na mesma
  hora.** Em 03/08 uma varredura achou 36 registros errados, e a maior parte
  tinha uma causa só: o menu Mentorias substituiu Devolutivas em 31/07 e as
  demandas antigas nunca foram revisitadas. Não foi desleixo de registro — foi
  uma decisão grande que o quadro não acompanhou. Ao aposentar algo, varrer o
  kanban atrás do que ficou órfão, antes de seguir.
- **"Concluído" exige prova que aguente ser conferida.** A mesma varredura achou
  quatro demandas dadas como testadas com aluno logado quando o teste nunca
  aconteceu — a memória do projeto, escrita no mesmo dia, admitia que não tinha
  sido possível. Prova que cita commit é conferível; prova que diz "testei" e
  não diz como, não é.
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
| `suspeitas_duplicidade` | #300: par de cadastros que pode ser a mesma pessoa (telefone igual / nome parecido). Nasce no link aberto (`link_aberto`) ou quando o mentor marca "não são a mesma pessoa" (`varredura`, status `descartada`) |
| `fusoes_pessoas` | #300: registro de cada unificação — a linha inteira do cadastro absorvido, o que mudou de dono e o que foi descartado. É o que torna uma fusão desfazível à mão |
| `assistente_termos` / `assistente_consentimentos` | #289: termo da assistente, versionado (publicado não se edita — o banco recusa); aceite com versão, data e CÓPIA do texto aceito. Revogar marca `revogado_em` e apaga o histórico |
| `assistente_conversas` / `assistente_mensagens` | #289: conversas do aluno com a assistente. Dono = `user_id` (o LOGIN do aluno, não `people`) + `conta_id`. **Só o próprio aluno lê** |
| `assistente_liberacoes` / `assistente_uso` | #289: quem tem a assistente liberada (grupo ou login; SEM linha = fechada) e uma linha por chamada ao modelo (tokens, sem texto; perde o `user_id` quando o aluno revoga) |
| `assistente_observacoes` | #305: o que o mentor quer que a assistente tenha em mente sobre um aluno. Dono = `conta_id` (preenchido pelo banco, = conta do cadastro) + `person_id`. **O aluno NUNCA lê** — nenhuma policy para ele, e a da equipe exclui o próprio login. Não usar `people.notes` para isso: o aluno lê a própria linha de `people` |

⚠️ **Tabela nova que aponte para `people` precisa entrar em `fundir_pessoas`** (migração
`20260923210000_fusao_de_pessoas.sql`). A função confere, antes de apagar o cadastro absorvido,
se sobrou alguma linha apontando para ele em QUALQUER tabela com chave para `people` — e, se
sobrou, cancela a unificação inteira em vez de deixar o `ON DELETE CASCADE` apagar em silêncio o
que a tabela nova guarda. Ou seja: esquecer de tratar a tabela não perde dado, mas faz toda
unificação passar a ser recusada até alguém tratar. Mesma coisa para `previa_fusao` (as contagens).

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
- Persistido em `computed_scores`: `{ total, natural, adaptado, normalized }` — o **formato
  antigo**, mantido porque ainda há leitores: o relatório de Valores, Big Five, MBTI, QI e
  personalizados, e a tela pós-envio (`/responder`); o relatório de DISC/Temperamentos/VAK já não
  o lê (Etapa 2b-i). Sai quando o último leitor migrar. ⚠️ Ali `natural` = só os MAIS, e
  `normalized.natural`/`.adaptado` estão em réguas diferentes (média 25 × 50): nunca comparar um
  com o outro.
- **Escolha forçada é medida IPSATIVA** (#288, Etapa 2a; DISC, Temperamentos e VAK — lista em
  `INSTRUMENTOS_IPSATIVOS`, `src/lib/escolha-forcada.ts`): só vale a posição relativa entre as
  letras da mesma pessoa. A conta é uma função pura e fica em `computed_scores.ipsativo`
  (ranking + distância entre 1º e 2º; `adaptado` = vezes MAIS, `natural` = n − vezes MENOS,
  `expressao` = MAIS − MENOS; perfil combinado quando a distância é ≤ 2). Contrato completo em
  `docs/motor-ipsativo.md`. **Valores usa o mesmo tipo de pergunta e ficou de fora** (decisão
  pendente).
- **Sinal mínimo** (#292): sinal da letra = vezes que foi marcada (MAIS + MENOS). Abaixo do mínimo ela
  não ocupa o título — o ranking não muda, ela fica marcada como "pouca informação" e o título passa
  para a próxima. O limiar sai da estrutura do teste (cauda de 2% ao acaso por letra): 9 no DISC e no
  Temperamentos, 11 no VAK, 6 em Valores. Calibração: `scripts/testar_ipsativo.py sinal`.
- Todo empate se decide pela **ordem da letra no instrumento**, nunca pela ordem em que o banco
  devolveu as linhas, e toda leitura do motor tem `.order()` explícito — editar uma linha muda a
  posição física dela (já aconteceu no DISC novo). Testes: `scripts/testar_ipsativo.py`.

## Relatórios

- `src/lib/report.server.ts` — `buildReport(responseId)`, compartilhado.
  Três montadores: DISC (seções por perfil composto), MBTI (por eixo) e
  dimensional (Valores/Temperamentos/VAK/Big Five, 9 seções).
  **DISC, Temperamentos e VAK leem `computed_scores.ipsativo`** (#288, Etapa 2b-i) — ou o
  derivam das respostas cruas quando a resposta é anterior à 2a (`src/lib/ipsativo.server.ts`,
  sem gravar nada); os demais instrumentos ainda leem o formato antigo e saem idênticos.
  **Página de intensidade** (#288, Etapa 2c, `src/lib/intensidade.ts`): "PERFIL <sigla do
  NATURAL>" (1 letra, ou 2 na ordem do ranking; empate múltiplo = "sem predominância clara"),
  gráficos NATURAL e ADAPTADO separados com sigla própria — nunca comparados —, três índices e o
  texto do perfil (cadastrável; pendente vira aviso). Letra quase não marcada sai do título com a
  marca "pouca informação" e uma frase explicando (#292). O resto do relatório: seções por perfil
  (DISC) pela letra que lidera o natural; leituras por fator no conjunto adaptado, como sempre.
  Detalhe em `docs/motor-ipsativo.md`. Antes × depois: `scripts/comparar_relatorios.py`.
- **Índices do DISC** (#304, `src/lib/indices.ts`) — Positividade, Estima, Flexibilidade (na
  intensidade, cada um com a linha que diz o que significa) e Energia (bloco de índices). **Gravados**
  pelo motor em `computed_scores.ipsativo.indices` (com a versão da fórmula) e LIDOS de lá pelo
  relatório; `obterIpsativo` só completa em memória o que faltar. Respostas antigas preenchidas por
  `scripts/gravar_indices.py`. Saem do
  `ipsativo`, não dos percentuais: Positividade e Energia = fração dos MENOS que cai em D+C / S+C
  (eixos de Marston); Estima e Flexibilidade comparam a ordem do MAIS com a ACEITAÇÃO de cada estilo
  (1 − MENOS ÷ blocos em que ele ainda estava disponível). ⚠️ **Nunca** compará-las pelos dois
  gráficos: o natural é "blocos − MENOS", e o estilo marcado como MAIS não pode ser o MENOS daquele
  bloco — o que a pessoa mais mostra sobe sozinho no natural (natural ≥ MAIS, sempre), e a
  comparação mede ruído. Calibração e oráculo: `python3 scripts/testar_indices.py puro|simular|real`;
  prova de que a tela lê o gravado: `testar_indices.py prova-leitura --app URL`.
- `src/lib/derivations.ts` — pesos das derivações do DISC (Jung, 4 estilos de
  liderança, 16 competências), sobrescritíveis por `derived_config`.
- `src/components/report/sections.tsx` — blocos visuais compartilhados.
- `/relatorio/$responseId` — relatório de um teste.
- `/relatorio-bateria/$assessmentId` — unificado: uma seção por teste respondido.

**SISTEMA VISUAL do PDF** (#294) — `src/lib/pdf/sistema.ts`. A proposta que o dono do produto
aprovou em 21/09, virada em PEÇAS reutilizáveis: cabeçalho, rodapé, cartão, pílula, selo do
perfil, faixa de índices, gráfico de termômetros, caixa de nota, textura e marca d'água. O módulo
não sabe nada sobre relatório de propósito — as mesmas peças servem ao certificado (#221) e ao
PDF individual (#280). Quem montar aquelas páginas monta com elas, não do zero.
⚠️ **CONTRASTE É REQUISITO**, não estética: cinco tons da proposta não passavam no WCAG e foram
escurecidos o mínimo (matiz preservada) — ver o aviso em `marca.ts`. O Ciano #01A5FC vale como
MANCHA; como texto usa-se `CIANO_TEXTO`, e quando ele é FUNDO de texto branco, `CIANO_FUNDO`.
Conferir com `python3 scripts/testar_pdf.py contraste` antes de introduzir qualquer tom novo.
A escala do termômetro é FIXA em 0–100 porque é a régua verdadeira do motor ipsativo (as letras
dividem 100 entre si); esticar até o maior valor deixaria o gráfico bonito e mentiria sobre a
distância entre as letras.
**Acabamento (#295):** a capa quebra em linhas DENTRO de cada coluna e a lista longa (inventários
de uma bateria) desce para a largura inteira — antes ela atravessava a data. E a página de
intensidade usa `quebraSeFaltarEspaco(alturaMedida)`, não quebra fixa: pedir folha nova sempre
deixava a abertura de cada parte da bateria sozinha, com três linhas e o resto branco. Conferir
com `testar_pdf.py capa` (1 e 10 inventários) e `scripts/medir_densidade.py` (ocupação por
página). O detector de sobreposição roda em TODA página de TODO teste — texto sobre texto é
sempre defeito aqui.

**PDF gerado no SERVIDOR** (#293, fatia 1) — `src/lib/pdf/`, rotas `/api/pdf/relatorio/$id` e
`/api/pdf/bateria/$id`. "Baixar PDF" não é mais `window.print()`: o arquivo é montado e diagramado
no servidor, então a mesma entrada devolve sempre os MESMOS bytes, independente de navegador,
sistema ou margens de quem baixa. A4, capa com a marca, cabeçalho repetido, numeração, e quebras
controladas (bloco atômico não parte; título não fica órfão; parágrafo só parte deixando 2 linhas
de cada lado). `doc.ts` é o motor (duas fases: medir, depois desenhar), `relatorio.ts` monta o
conteúdo a partir do MESMO payload de `buildReport`, `marca.ts` carrega fonte e logo.
⚠️ A fonte **Publica Sans Round** é LICENCIADA (FaceType), não livre. Ela mora no bucket **privado**
`fontes` do Supabase (`publica-sans-round/`) e só é lida com a chave de serviço — nunca em
`public/`, nunca versionada: este repositório é público, e servir o arquivo da fonte pelo site
seria redistribuí-la. Embutir os glifos no PDF é uso normal de documento; servir o `.otf`, não.
O `.gitignore` barra `public/marca/*.otf`. As logos, essas sim, ficam em `public/marca/` (são
ativos do próprio método) — fora do bundle do Worker, que tem teto de tamanho. A fonte é embutida
com
`subset: false` **de propósito**: o subsetting do pdf-lib quebra as ligaduras `fi`/`fl` da família
("perfil" saía "perfl"). Textos espaçados usam o operador `Tc`, não um `drawText` por letra, senão
copiar do PDF devolve "I N T E N S I D A D E".
Testes: `python3 scripts/testar_pdf.py tudo` (determinismo, A4, fonte embutida, numeração,
conteúdo igual ao da tela, nada fora da área útil).
O PDF individual da aba Respostas (#280) **continua na impressão do navegador** — o conteúdo dele
não vem de `buildReport`, é outra fatia.

⚠️ **Os textos fixos do relatório moram em `src/components/report/textos.ts`** — fonte única da
tela e do PDF. Antes da #293 estavam dentro do JSX; duplicá-los para o servidor faria as duas
versões divergirem no primeiro ajuste. Quem mexer no texto do relatório mexe ali.

**Regra de honestidade (importante):** nada aparece a partir de teste não
respondido. Empate também não vira resultado: com menos de 10 pontos entre a
maior e a menor dimensão, o relatório diz "sem predominância clara" em vez de
cravar uma letra vinda do desempate da lista. No MBTI, eixo abaixo de 55% é
declarado em aberto e sai das seções.
Selo de confiabilidade em toda resposta (`computed_scores.qualidade`): mede
contradição entre itens equivalentes, respostas sem variação e ritmo. Liderança/competências/índices levam o selo "Derivado do seu DISC".
Tipos Psicológicos usam o MBTI real quando respondido; senão vão como
"Estimativa derivada do seu DISC", com ressalva explícita no texto.

## Assistente do Método Intenção (#289)

Nível 2 de 5: o aluno logado conversa sobre o PRÓPRIO relatório e o que ele tem na plataforma (`/aluno/assistente`). Modelo
`claude-sonnet-5`. Código em `src/lib/assistente/` + `src/lib/assistente.functions.ts`.

⚠️ **A chave da Anthropic NÃO mora no app** (25/09: o Lovable só permite Secrets em conta
Enterprise, que este projeto não tem — o app-side `ANTHROPIC_API_KEY` do Nível 1 original nunca
funcionaria em produção). Ela mora nos secrets da **Supabase Edge Function** `assistente-chat`
(`supabase/functions/assistente-chat/index.ts`, sem SDK — `fetch` puro para
`api.anthropic.com`). `src/lib/assistente/modelo.server.ts` não fala com a Anthropic: monta o
texto de sistema e chama essa edge function com o TOKEN DA SESSÃO do próprio aluno; a edge
function confere `getClaims` + `assistente_liberada()` antes de gastar a chave — verify_jwt
ligado, então quem não manda nenhum token nem passa da borda da plataforma. Trocar a chave =
Supabase → Project Settings → Edge Functions → Secrets, **nunca** pelo chat (duas chaves já
foram reveladas e revogadas por terem passado por aqui).

- **O mentor não lê as conversas — a trava é o banco.** As policies de conversa/mensagem/consentimento
  são SÓ `user_id = auth.uid()`; nenhuma menciona conta, equipe ou `acting_account()`. Não criar
  função de servidor que leia conversa com service role para ninguém além do próprio aluno. A prévia
  "ver como aluno" roda com o login do mentor e mostra só um aviso.
- **O que ela lê** = o que o aluno vê: `relatoriosDoAluno` consulta com o login dele (RLS de
  `test_responses`), filtra pelos cadastros dele e passa cada resposta por `buildReport`;
  `contexto.ts` vira texto na ordem de `ReportBody`, respeitando `hidden_blocks`. Mudou o relatório
  na tela? Confira se `contexto.ts` acompanha.
- **Como ela fala** = `instrucoes.server.ts` (consultiva, só do relatório, "leve ao mentor", CVV 188
  no risco à vida). Mexeu no texto? Rode `npx tsx scripts/avaliar_assistente.ts <resposta>` — SÓ com
  pessoa fictícia (`scripts/fixture_assistente.py criar --login`): avaliar manda o relatório para a
  Anthropic. O script entra como o aluno fictício (link mágico → token, nunca impresso), passa pela
  mesma edge function e RECUSA cadastro fora de `@exemplo.invalido`.
- **Fechada por padrão**: aparece só com linha em `assistente_liberacoes` (grupo ou login) + relatório
  concluído + termo publicado. Abrir para a turma = inserir a linha do grupo, decisão do dono.
- **Nível 2 (#305) — o que mais ela lê**: `plataforma.server.ts` lê Academy (só trilha publicada E
  liberada — trancada nem aparece), Biblioteca (só material liberado), Classroom (aulas, presença dele,
  encontros perdidos), Agenda, Mentorias (sem `mentorias.observacoes`), Comunidade (colegas SÓ por
  `perfil_do_colega`, a função que corta contato de quem não marcou `perfil_visivel`) e pontos —
  **tudo com o login do aluno**, e só das áreas de `minhas_areas()`. Nada ali usa service role. Tela
  nova do aluno ou área nova? Confira se `plataforma.server.ts` acompanha.
- **Observação do mentor** (#305): quadro na ficha da pessoa; vai para o modelo no bloco
  `<orientacao_reservada>` (única leitura com service role além dos relatórios). As orientações proíbem
  citar, atribuir ou repetir; pergunta direta recebe a verdade em termos gerais, sem confirmar nada.
- Não existe registro de acesso à plataforma (`learning_progress` é só "marcar como vista"): ela não
  sabe quem entrou nem quando.
- Termo: `scripts/conteudo_termo_assistente.py` (texto do dono do produto, conferido palavra por
  palavra contra o arquivo aprovado). Mudar o texto = versão nova, nunca editar a publicada.

## Conteúdo

Todo texto do relatório é **original** — as metodologias são de domínio público,
mas os textos de relatórios comerciais (CIS Assessment etc.) são protegidos.
Nunca copiar. Conteúdo vive em `report_content` e `test_result_bands`, não no código.
`report_content.status` (`publicado` | `pendente`): linha pendente não aparece no relatório.

Texto do perfil (página de intensidade, `<instrumento>_perfil_texto`, chave = sigla): fonte em
`scripts/conteudo_perfil_texto.py`, com trava por `assert` contra frase copiada da referência.
Em 19/09/2026: DISC S, CS e CI publicados (derivados da referência, com palavras nossas); as
outras 13 siglas do DISC e todas as de Temperamentos (16) e VAK (9) **pendentes** — o dono do
produto escreve ou aprova. Nada de inventar texto de personalidade para preencher.

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
