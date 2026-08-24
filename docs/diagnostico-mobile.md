# Diagnóstico mobile — #279 Fatia 0

> Este documento é só um raio-x. Nenhum código, nenhuma tela, nenhuma migração foi
> alterada para produzi-lo — é o mapa que vem antes de decidir o que consertar
> primeiro. Testamos com a largura de um iPhone comum (390px).

**Como ler:** a tabela de resumo logo abaixo dá o retrato geral. Depois vem a
parte que mais importa — as **causas que explicam várias telas quebradas ao
mesmo tempo**, porque consertar uma causa dessas custa muito menos que
consertar tela por tela. Só depois vem o inventário completo, tela a tela,
para quem quiser conferir uma em especial.

---

## Resumo

| Área | ✅ Já funciona | ⚠️ Funciona com incômodo | ❌ Quebrada | Total |
|---|---|---|---|---|
| Mentor (e colaborador) | 8 | 4 | 9 | 21 |
| Aluno | 8 | 3 | 0 | 11 |
| Público | 6 | 4 | 2 | 12 |
| **Total** | **22** | **11** | **11** | **44** |

**O retrato em uma frase:** o conteúdo das telas (cards, formulários, gráficos)
quase sempre já é responsivo — o time claramente pensou em mobile nesses
pontos, e o painel do **aluno não tem nenhuma tela quebrada**. O que quebra
está concentrado quase todo do lado do **mentor**, e é sistemático: **poucas
peças reaproveitadas em dezenas de lugares** — uma tabela que virou padrão
copiado (inclusive vazando para duas telas públicas), um componente de abas
sem rolagem, e a área do mentor não ter absolutamente nenhuma navegação no
celular. Ver a seção abaixo.

---

## A parte mais importante: causas compartilhadas

Ordenado do maior para o menor impacto — quantas telas cada causa derruba de
uma vez.

### 1. 🔴 A área do mentor não tem nenhuma navegação no celular — afeta as 21 telas do mentor

O cabeçalho do painel do mentor (`src/components/app-header.tsx`) não tem
botão de menu/hambúrguer nenhum. O menu lateral (`src/components/app-sidebar.tsx`)
está corretamente escondido abaixo de 1024px (`hidden ... lg:flex`) — mas
nada o substitui. Testamos ao vivo: com a tela no tamanho de um iPhone, o
mentor abre a plataforma, vê o Dashboard, e **não existe nenhum jeito de
chegar a Pessoas, Grupos, Envios, Configurações ou qualquer outra área**. É
como entrar num prédio e a porta de todas as outras salas ter sumido.

Isso sozinho já seria a prioridade máxima mesmo se todo o resto estivesse
perfeito — porque não é uma tela ruim, é a plataforma inteira do mentor
inacessível por navegação no celular.

**Bônus confirmado na mesma captura de tela:** a barra de busca do cabeçalho
tem largura fixa (`w-96` = 384px) e o e-mail do usuário fica ao lado dela sem
espaço — no celular, a caixa de sugestões da busca aparece aberta por cima do
e-mail, cortando o texto. Ver a comparação com o painel do aluno, que já
resolveu exatamente este problema (próxima seção).

### 2. 🔴 Tabela crua dentro de `overflow-hidden` (em vez de `overflow-auto`) — confirmado em 7 telas, em duas áreas diferentes

Sete telas montam sua própria tabela HTML em vez de usar o componente de
tabela pronto da plataforma (`src/components/ui/table.tsx`), que já rola para
o lado sem cortar nada. Nessas sete, a tabela fica dentro de uma `<div>` com
a classe `overflow-hidden` — que **corta** o que não cabe, em vez de deixar
rolar. É pior do que não ter proteção nenhuma, porque a pessoa nem percebe
que falta informação; ela simplesmente não existe na tela.

Afeta, no painel do mentor: **Dashboard** (atividade recente),
**Colaboradores**, **Lista de Grupos**, **Lista de Pessoas**, **Lista de
Envios**. E, de forma independente — mesmo erro, escrito em outro lugar do
código —, afeta também as telas **públicas de relatório**: a tabela "Como o
meio percebe você" (comparação com percepção externa) em
`src/components/report/sections.tsx`, compartilhada pelo **Relatório de um
teste** e pelo **Relatório de uma bateria**. Só aparece quando o teste tem
observadores registrados, mas quando aparece, os números somem sem rolagem.

Como o mesmo engano foi escrito em pelo menos dois lugares distintos do
código de forma independente, vale além do conserto pontual (trocar
`overflow-hidden` por `overflow-x-auto` nas sete, ou migrar para o componente
de tabela pronto) uma busca única por `overflow-hidden` perto de `<table`
em todo o projeto, para checar se não existe um oitavo lugar que este
diagnóstico não alcançou.

### 3. 🟠 A tela mais usada de toda a plataforma tem três pontos de toque imprecisos — 2 telas, mas são as de maior volume

**Responder um teste** e **Responder uma bateria** dividem o mesmo formulário
(`src/components/response-form.tsx`) — é a porta de entrada de praticamente
todo mundo que já foi convidado para um teste, então mesmo afetando "só" 2
telas, o volume de gente que passa por aqui é o maior de toda a plataforma.
Três tipos de pergunta têm atrito real de toque no celular:

- **Perguntas tipo "escolha forçada"** (comuns no DISC): os botões "Mais"/
  "Menos" não têm um `<label>` envolvendo a coluna inteira — só o círculo
  nativo do navegador responde ao toque (~16-20px), não a área de 64px que
  visualmente parece clicável.
- **Perguntas de ordenar/arrastar**: as setas de mover para cima/baixo somam
  ~20×20px de área de toque — metade do recomendado.
- **Perguntas de escala linear**: os números da escala ficam numa fileira que
  não quebra linha; em escalas configuradas com mais pontos (comum em 1–7 ou
  0–10), cada botão fica espremido a ~23px de largura numa tela de 390px.

Nada corta ou soma conteúdo escondido — por isso é ⚠️, não ❌ — mas é
justamente onde qualquer atrito custa mais caro: gente respondendo pelo
celular, às vezes com pressa, decidindo entre duas opções parecidas.

### 4. 🟡 O componente de abas (usado em várias telas) não rola nem quebra linha — confirmado em 3 telas

O componente compartilhado de abas (`src/components/ui/tabs.tsx`) não tem
rolagem lateral nem permite que as abas quebrem em duas linhas — quando a
soma da largura das abas passa da largura da tela, as últimas simplesmente
saem para fora, sem nenhuma pista visual de que dá para rolar até elas.

Afeta: **Configurações** (6 abas — a mais grave: as abas "Emails" e "Agenda"
ficam totalmente inacessíveis no celular), **Detalhe de Grupo** (5 abas —
"Acesso" e "Ranking" ficam fora da tela), **Detalhe de Pessoa** (3 abas —
mais discreto, mas mesma causa).

Um conserto no componente de abas (por exemplo, deixando a fileira rolar de
lado) resolve as três de uma vez — e protege qualquer tela nova que usar abas
no futuro.

**Relacionado, mas não o mesmo conserto:** em pelo menos três outros lugares
(a lista de testes, o editor de um teste, e a barra "Conteúdo/Presença/
Conclusão" dentro de um treinamento do Classroom) alguém desenhou à mão uma
fileira de abas parecida (visualmente idêntica, mas escrita do zero em cada
tela, não usando o componente acima) com a mesma fragilidade — sem rolagem,
sem quebra de linha. Hoje nenhuma dessas três quebra porque têm poucas abas
curtas, mas não têm proteção nenhuma se ganharem mais uma no futuro. Como não
compartilham código com o componente de abas, consertar o componente não
resolve essas três — precisam do mesmo ajuste feito à mão, cada uma na sua
vez.

### 5. 🟡 Botões pequenos demais para o dedo — espalhado por quase toda a plataforma

O componente de botão padrão (`src/components/ui/button.tsx`) tem os tamanhos
`sm` (32px de altura) e `default` (36px) — os dois abaixo dos ~40px que
costumam ser recomendados como alvo de toque confortável. Só o tamanho `lg`
(40px) chega lá. Multiplicam esse problema vários botões que usam apenas um
ícone sem nenhum espaçamento ao redor — o dedo tem uma área ainda menor para
acertar. Encontramos essa combinação em: Comunidades (curtir, apagar
publicação/comentário — 5 ocorrências), Colaboradores (remover colaborador),
Detalhe de Grupo (remover pessoa do grupo), Detalhe de Pessoa (excluir
pessoa), Mentorias do aluno (estrelas de avaliação coladas umas nas outras),
Comunidade do aluno (curtir, apagar), carrossel de banners da Academy, calendário de agendamento público (células
de ~38px) e a grade de horários da mesma tela (~32px de altura).

Não é uma tela quebrada — é possível tocar, só que exige mais precisão do
que deveria, e em uso apressado (no ônibus, andando) aumenta toque errado.
Como o `sm`/`default` do componente `Button` é usado em praticamente toda a
plataforma, subir esses dois tamanhos em alguns pixels é um ajuste de design
system, não tela por tela.

### 6. 🟡 O calendário (visão Mês) força rolagem horizontal — confirmado em 3 telas

O componente de agenda (`src/components/agenda.tsx`) tem duas visões: Semana
já ganhou uma versão dedicada para celular (lista empilhada por dia, com
`md:hidden`/`md:block` corretos) — funciona bem. Mês não recebeu o mesmo
cuidado: é uma grade de 672px de largura mínima dentro de um `overflow-x-auto`,
que no celular vira uma faixa estreita rolando de lado, difícil de ler o mês
inteiro. Como Mês é a visão que abre por padrão, é a primeira coisa que a
pessoa vê.

Afeta: **Agenda do mentor**, **Agenda do aluno**, e **Mentorias do aluno**
(que reaproveita o mesmo componente de agenda dentro da tela). Um só ajuste
no componente (aplicar à visão Mês a mesma ideia que já existe para Semana)
resolve as três.

### 7. 🟢 `<main className="p-8">` do painel do mentor não diminui no celular — afeta as 21 telas do mentor, como agravante

O contêiner que envolve todo o conteúdo do painel do mentor
(`src/routes/_app.tsx`) usa `p-8` (32px de respiro de cada lado) fixo, sem
uma versão menor para telas pequenas. Numa tela de 390px, isso sozinho já
consome 64px — sobra menos de 330px de largura útil real antes mesmo de
qualquer tabela ou grade entrar em cena. Não quebra nada sozinho, mas **piora
todas as outras causas desta lista**, porque encolhe o espaço disponível bem
na hora em que ele mais falta. Um ajuste simples (`p-4 sm:p-8`, por exemplo)
devolve esse espaço em todas as 21 telas do mentor de uma vez.

---

## O que já está pronto (não precisa mexer)

Vale registrar — porque mostra que a base é sólida e o trabalho que falta é
pontual, não uma reconstrução:

- **O app já é "mobile-first" na maioria dos lugares.** O padrão
  `grid-cols-1 md:grid-cols-2 lg:grid-cols-3/4` (uma coluna no celular, mais
  colunas só a partir de telas maiores) aparece corretamente na imensa
  maioria das telas dos dois painéis. `flex flex-wrap` nas fileiras de botões
  e badges também é a norma, não a exceção.
- **O painel do aluno já tem menu de celular funcionando** — gaveta lateral
  com botão de abrir/fechar, fundo escurecido, tudo escondido corretamente
  atrás de `lg:hidden`/`lg:flex`. É o contraste mais forte com o painel do
  mentor (causa nº 1 acima): o time já resolveu esse exato problema de um
  lado só.
- **Os componentes de caixa de diálogo (modal) já são seguros por padrão** —
  `Dialog` e `AlertDialog` (usados em praticamente toda a plataforma) usam
  `w-full max-w-lg`, nunca uma largura fixa em pixels. Nenhuma das dezenas de
  diálogos investigados teve problema de largura.
- **O componente de tabela pronto (`ui/table.tsx`) já resolve rolagem** —
  quem o usa ganha `overflow-auto` de graça. O problema (causa nº 2 acima)
  é que sete telas com tabela não usam esse componente, usam uma tabela
  montada à mão.
- **O seletor de data/horário (`SeletorDeHorario`/`SeletorDeData`) é o
  componente mais bem pensado para celular de toda a plataforma** — esconde
  a faixa de 7 dias no mobile em vez de espremer, usa grade de 2 colunas que
  vira 3 só em telas maiores. Reaproveitado sem alteração em três lugares
  bem diferentes (Agendar horário público, gerenciar uma Sessão marcada
  — pública — e Remarcar dentro do Detalhe de mentoria do mentor), sempre
  com o mesmo resultado bom.
- **O recorte de foto do perfil do aluno já funciona por toque** — usa a
  biblioteca `react-easy-crop`, que suporta gesto de toque nativamente (não
  é uma ferramenta pensada só para mouse), dentro de um contêiner de largura
  fluida.
- **O padrão de "prateleira horizontal" (carrossel por toque) já é bom e
  consistente** — usado em Classroom e Academy, tanto no mentor quanto no
  aluno, com o mesmo código reaproveitado corretamente e até um comentário no
  código explicando a decisão de evitar hover porque "metade do uso é pelo
  celular".
- **Menus que antes dependeriam de hover já usam clique** — o menu "Criar" da
  Academy é um exemplo citado no próprio código como decisão consciente.
- **Nenhuma tela usa ação que só funcione por hover sem alternativa de
  clique/toque** — checamos ativamente e não achamos nenhum caso real (o que
  parecia um caso, em cards de Classroom/Academy, é só reforço visual sobre
  um cartão que já é clicável inteiro).

---

## PWA — o que já existe e o que falta

**Já existe, e é bem mais do que o esperado — a maior surpresa positiva deste
diagnóstico:**

- Um manifesto de app de verdade e funcionando, gerado sob demanda em
  `/api/manifest` (arquivo `src/routes/api.manifest.ts`, da demanda #235) —
  nome, cor e ícone **puxados da marca de cada conta** (não é um manifesto
  genérico fixo), com os campos que os celulares exigem para oferecer
  "Instalar aplicativo": `name`, `short_name`, `start_url`, `display:
  standalone`, `theme_color`, `background_color`, e `icons` nos dois tamanhos
  padrão (192px e 512px).
- **Confirmado:** o `<head>` do site (`src/routes/__root.tsx`) já liga tudo
  isso em toda página da plataforma — `<link rel="manifest"
  href="/api/manifest">`, `<meta name="viewport" ...>` correto (sem travar o
  pinça-para-zoom, que é o certo), e `<meta name="theme-color">`.
- **Já existe até um ícone dedicado para iPhone** —
  `<link rel="apple-touch-icon" href="/api/icone/apple">` — não é um
  reaproveitamento do favicon pequeno, é uma rota própria pensada
  especificamente para esse tamanho. Isso quer dizer que, hoje, um aluno no
  iPhone que abrir a plataforma e usar "Adicionar à Tela de Início" pelo
  menu do Safari **já ganha um ícone bonito e um app com nome e cor da
  marca da conta** — o iPhone não pede service worker para isso funcionar.

**O que falta:**

- **Nenhum service worker.** Não há `vite-plugin-pwa`, `workbox` nem
  qualquer registro manual de service worker no projeto (conferido em
  `package.json` e `vite.config.ts`). Isso não afeta o iPhone (ver acima),
  mas no Android/Chrome é o que falta para o navegador oferecer sozinho o
  banner "Instalar aplicativo" — hoje, no Android, dá para instalar pelo
  menu do navegador, só não aparece o convite automático. Um service worker
  também abriria a porta para funcionar com internet ruim ou offline, o que
  hoje não existe.

**Resumindo:** a parte mais trabalhosa de um PWA (o manifesto dinâmico com
marca por conta, ligado corretamente em toda página, com ícone próprio até
para iPhone) já está pronta e funcionando. Falta uma peça só, mecânica: o
service worker — e ele importa mais para o Android do que para o iPhone.

---

## Problemas invisíveis (só aparecem testando, não só olhando a largura)

- **Alvos de toque pequenos** — ver causa compartilhada nº 5 acima. É o
  problema invisível mais espalhado da plataforma.
- **Tabela com muitas colunas** — a Lista de presença (dentro do detalhe de
  um treinamento no Classroom, `src/components/lista-de-presenca.tsx`) tem 9
  colunas, mas — diferente das 7 telas da causa nº 2 — está corretamente
  dentro de `overflow-x-auto`. Não quebra, mas exige rolar de lado para ver
  cada aluno; classificamos como ⚠️, não ❌, exatamente por causa dessa
  diferença.
- **Dependência de hover** — checamos ativamente (ver "O que já está
  pronto") e não encontramos nenhum caso real na plataforma.
- **Teclado do celular cobrindo o botão de salvar** — nenhum formulário
  revisado (incluindo Configurações e o editor de teste, os dois mais
  longos da plataforma) usa botão fixo flutuando por cima do conteúdo — tudo
  fica no fluxo normal da página, rolável até o botão. O risco clássico
  (teclado sobe, botão "Salvar" fica encoberto sem dar para rolar até ele)
  não apareceu em nenhuma das 44 telas revisadas.
- **Altura fixa de janela** — não encontramos nenhuma tela travando uma
  altura fixa (`h-screen` sem `overflow-auto` correspondente, por exemplo)
  que pudesse cortar conteúdo em celulares com barra de endereço ocupando
  espaço. Uma inconsistência menor, sem quebrar nada: as telas públicas que
  centralizam conteúdo na vertical usam medidas diferentes — Check-in e
  Criar senha usam `dvh` (altura que acompanha a barra de endereço do
  celular abrindo/fechando, a certa); Login usa `screen` (fixa, pode
  "pular" quando a barra do navegador muda de tamanho). Vale padronizar em
  `dvh`.
- **Links secundários pequenos** — em várias telas públicas (troca de modo
  no Login, "Já tenho conta" no convite de equipe, "Sair e entrar com outra
  conta" no check-in), o link de uma ação secundária/rara é texto pequeno
  sem nenhum espaçamento ao redor — mesma família do problema de alvo de
  toque (causa nº 5), só que em ações que a pessoa raramente precisa tocar.

---

## Inventário completo — Mentor e Colaborador

*(Telas somente de navegação, sem conteúdo próprio — `_app.envios.tsx`,
`_app.grupos.tsx`, `_app.pessoas.tsx`, `_app.mentorias.tsx`, `_app.testes.tsx`
— não entram na contagem por não serem telas de verdade. `_app.mentores.tsx`
também não entra: é um redirecionamento antigo que nunca mostra nada.)*

| Tela | Situação | Por quê |
|---|---|---|
| Dashboard | ❌ Quebrada | Tabela de "Atividade recente" cortada por `overflow-hidden` (causa nº 2) |
| Agenda | ⚠️ Incômodo | Visão Mês força rolagem horizontal (causa nº 5) |
| Colaboradores | ❌ Quebrada | Mesma tabela + `overflow-hidden` (causa nº 2); fileira de até 4 botões de ação sem quebrar linha |
| Comunidades | ⚠️ Incômodo | Layout bom, mas 5 botões-ícone sem espaçamento (curtir, apagar post/comentário, remover anexo/enquete) |
| Configurações | ❌ Quebrada | Abas sem rolagem (causa nº 3) — com 6 abas, "Emails" e "Agenda" ficam inacessíveis |
| Mentorias (lista) | ✅ Já funciona | Fileiras com `truncate`/`shrink-0` corretos, sem tabela, sem grid problemático |
| Mentorias — Agendamento automático | ❌ Quebrada | Na aba Disponibilidade, dois campos de horário de largura fixa + rótulo + interruptor não quebram linha e não cabem |
| Grupos (lista) | ❌ Quebrada | Tabela + `overflow-hidden` (causa nº 2) |
| Grupos (detalhe) | ❌ Quebrada | Abas sem rolagem (causa nº 3) — 5 abas, duas ficam fora da tela |
| Pessoas (lista) | ❌ Quebrada | Tabela + `overflow-hidden` (causa nº 2); e-mail sem `truncate` pode sozinho estourar a coluna |
| Pessoas (detalhe) | ❌ Quebrada | Abas sem rolagem (causa nº 3, mais leve com 3 abas) + fileira de 5 botões de ação sem quebrar linha |
| Envios (lista) | ❌ Quebrada | Tabela de 6 colunas + `overflow-hidden` (causa nº 2) |
| Envios (assistente de novo envio) | ✅ Já funciona | Grade mobile-first correta; tela de resultado usa o padrão certo de truncar texto e manter botões visíveis |
| Academy (catálogo de trilhas) | ✅ Já funciona | Prateleira horizontal por toque, já pensada para celular |
| Classroom (catálogo de treinamentos) | ✅ Já funciona | Mesma prateleira horizontal, reaproveitada corretamente |
| Testes (lista de instrumentos) | ✅ Já funciona | Cards em grade mobile-first, botões de ação com `flex-wrap` |
| Testes (editor de um teste) | ⚠️ Incômodo | Barra do topo (voltar + abas + status "Publicado") sem `flex-wrap` fica apertada; campos Mínimo/Máximo de escala linear ficam justos em `grid-cols-2` sem quebrar |
| Testes (respostas/estatísticas) | ✅ Já funciona | Rótulos com `truncate` + `title`, diálogo de resposta com `overflow-y-auto` |
| Detalhe de uma mentoria | ✅ Já funciona | Cabeçalho e sessões com `flex-wrap`; reaproveita o seletor de horário (o componente mais bem pensado do lote) |
| Treinamento (visão do mentor, com edição) | ⚠️ Incômodo | UI extra só do mentor: abas "Conteúdo/Presença/Conclusão" à mão sem rolagem (mesma família da causa nº 4); botões do diálogo de aula não quebram linha e só rolam sem indicação visual |
| Trilha (visão do mentor, com edição) | ✅ Já funciona | UI extra do mentor (botões de editar, lista de quem concluiu) quebra linha corretamente e não aperta |

---

## Inventário completo — Aluno

*(O aluno usa a plataforma quase só pelo celular — este é o grupo que mais
importa. O menu do aluno já funciona no celular, ver "O que já está
pronto"; as linhas abaixo avaliam só o conteúdo de cada tela.)*

| Tela | Situação | Por quê |
|---|---|---|
| Meus resultados (painel principal) | ✅ Já funciona | Lista e gráficos em uma coluna no celular, botões isolados |
| Agenda | ⚠️ Incômodo | Mesmo problema da visão Mês do mentor (causa nº 5) |
| Classroom (lista de treinamentos) | ✅ Já funciona | Prateleira horizontal por toque |
| Classroom (um treinamento) | ✅ Já funciona* | Componente grande e compartilhado com o mentor, aqui só em modo leitura. As únicas fricções encontradas nesse componente (abas de edição, diálogo de aula) só aparecem para o mentor — nada disso chega ao aluno. *Ressalva: o componente inteiro (64 KB) não foi lido linha a linha, só os trechos amostrados, que não mostraram problema. |
| Comunidade | ⚠️ Incômodo | Vários botões-ícone sem espaçamento (curtir, apagar) — mesma causa nº 5 |
| Academy (lista de trilhas) | ✅ Já funciona | Prateleira horizontal + biblioteca em grade mobile-first |
| Academy (uma trilha) | ✅ Já funciona* | Mesma situação da linha "Classroom (um treinamento)" — componente compartilhado de 43 KB, sem fricção encontrada na parte que o aluno vê. *Mesma ressalva de amostragem. |
| Grupos (só para quem também é mentor) | ✅ Já funciona | Lista simples, sem grid nem tabela |
| Mentorias | ⚠️ Incômodo | Estrelas de avaliação coladas (causa nº 5) + herda o problema da Agenda (causa nº 6) |
| Ranking | ✅ Já funciona | Lista única, sem grid, texto explicativo em `<details>` (clicável, não depende de hover) |
| Meu perfil | ✅ Já funciona | Formulário em coluna única; até o recorte de foto (`react-easy-crop`) responde bem ao toque, em contêiner de largura fluida |

---

## Inventário completo — Público

*(Sem login, acessado por link direto — quem responde um teste, aceita um
convite, faz check-in por QR code, agenda um horário.)*

| Tela | Situação | Por quê |
|---|---|---|
| Responder um teste/inventário | ⚠️ Incômodo | A tela mais usada da plataforma — 3 pontos de toque imprecisos (causa nº 3) |
| Responder uma bateria | ⚠️ Incômodo | Usa o mesmo formulário da linha acima, herda os mesmos 3 pontos (causa nº 3) |
| Aceitar convite (link de pessoa) | ✅ Já funciona | Card `max-w-lg`, formulário em coluna única, botão `w-full` |
| Aceitar convite de equipe/colaborador | ✅ Já funciona | Mesmo padrão de card responsivo; atalho de Enter no campo de senha |
| Check-in por QR code numa aula | ✅ Já funciona | Usa `min-h-dvh` (altura de tela correta para celular); ação principal é botão `w-full` |
| Agendar horário | ⚠️ Incômodo | Células do calendário ~38-39px e botões de horário ~32px, na borda do alvo de toque (causa nº 5) |
| Login | ⚠️ Incômodo | Usa `min-h-screen` fixo (não `dvh`) para centralizar; links secundários pequenos sem espaçamento |
| Criar senha (primeiro acesso) | ✅ Já funciona | `min-h-dvh` correto; atalho de Enter para enviar |
| Ver relatório de um teste | ❌ Quebrada | Tabela de comparação com percepção externa cortada por `overflow-hidden` (causa nº 2) — só aparece quando há observadores registrados |
| Ver relatório de uma bateria | ❌ Quebrada | Mesma causa raiz da linha acima (componente compartilhado) |
| Tela de consentimento (integração com o editor Lovable) | ✅ Já funciona | Confirmada a existência; card `max-w-md`, lista de permissões em coluna única, 2 botões finais |
| Sessão marcada (`/sessao/$id`) | ✅ Já funciona | Confirmada: é pública de propósito (o link em si é o acesso, sem exigir login — mesmo padrão do Agendar). Cancelar/remarcar em grade mobile-first, reaproveita o seletor de horário |

---

## Fora de escopo — bugs que não são de mobile

Encontramos, sem procurar, alguns pontos que não têm relação com celular —
registramos aqui sem mexer em nada, como pedido:

- Em `_app.grupos.index.tsx`, o diálogo "Novo grupo" tem uma classe repetida
  sem efeito (`justify-between sm:justify-between`) — cosmético, sem impacto
  para quem usa.
- Em `_app.configuracoes.tsx`, um comentário no código está posicionado acima
  do bloco errado (fala de "Emails" mas está colado na aba "Agenda") — só
  confunde quem for mexer no arquivo depois, não afeta a tela.
- Em `aluno.grupos.tsx`, o botão "Mentorias" usa um link comum (recarrega a
  página inteira) em vez do link interno do sistema — pode ser proposital,
  já que leva para uma área de fora do menu do aluno; não temos certeza
  suficiente para chamar de bug.
- Em `criar-conta-no-fim.tsx` (tela de responder teste), o campo Telefone
  mostra um formato de exemplo (`(11) 99999-0000`) mas não valida esse
  formato antes de enviar — só o Nome tem validação no próprio navegador.
  Pode ser proposital (validação só no servidor); baixa confiança para
  chamar de bug.

*(Lista não é exaustiva — são só os pontos que apareceram no caminho
enquanto líamos as 44 telas para este diagnóstico, sem procurar de propósito
por bugs fora do escopo de mobile.)*

---

## Proposta de fatiamento

A ordem abaixo pesa dois fatores: quantas telas cada causa resolve de uma
vez, e quem usa mais o quê — o aluno é quase só celular, o mentor é quase só
computador.

1. **Navegação do mentor no celular** (causa nº 1) — sozinha, é pré-requisito
   para qualquer outro conserto do lado do mentor fazer diferença: de nada
   adianta arrumar a tela de Pessoas se ninguém consegue chegar nela pelo
   celular. Prioridade máxima mesmo sendo "só" uma causa, porque bloqueia
   literalmente as outras 20 telas do mentor.
2. **A tela de responder teste/bateria** (causa nº 3) — não é a que mais
   telas resolve (2), mas é a de maior volume de gente de toda a
   plataforma, e quem responde é o convidado, não o mentor — vale tratar
   cedo mesmo com poucas telas envolvidas.
3. **As sete tabelas com `overflow-hidden`** (causa nº 2) — conserto
   pequeno e mecânico, resolve 7 telas de uma vez, incluindo o Dashboard e
   os dois relatórios públicos.
4. **Abas sem rolagem** (causa nº 4) — um só componente, resolve 3 telas.
5. **Alvo de toque dos botões, geral** (causa nº 5) — ajuste de design
   system, melhora a plataforma inteira de uma vez; prioridade mais alta no
   lado do aluno e nas telas públicas (majoritariamente celular) do que no
   lado do mentor.
6. **Visão Mês da Agenda** (causa nº 6) — resolve 3 telas, com o padrão que
   a própria Semana já usa como modelo dentro do mesmo componente.
7. **`p-8` fixo do painel do mentor** (causa nº 7) — ajuste de uma linha,
   mas como agrava tudo mais, vale fazer junto com o item 1 ou 3.
8. **PWA — service worker** — depois do conteúdo em si estar confortável no
   celular; instalar como app um site que ainda incomoda por dentro adianta
   pouco. Vale menos urgência que o resto porque o iPhone (o aparelho que o
   aluno mais usa) já ganha um bom "Adicionar à Tela de Início" sem essa
   peça — quem mais ganha com o service worker é o Android.

**Um candidato a fatia própria, fora da lista acima:** o editor de um teste
(`_app.testes.$versionId.editar.tsx`) é, na prática, a tela mais complexa de
toda a plataforma — não tem um problema grande, mas tem dois pontos de
aperto específicos dela (a barra do topo e os campos de escala linear) que
não se resolvem por nenhuma das 7 causas acima. Vale tratar à parte, sem
pressa — hoje ela funciona, só incomoda.
