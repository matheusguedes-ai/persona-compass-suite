# Área do aluno: onboarding, comunidade e pontuação

Cinco demandas do Matheus, 28/07/2026. Viabilidade e plano de execução de cada.

**Resumo:** quatro das cinco são viáveis e claras. Duas têm problemas que
precisam de decisão antes de virar código — não técnicos, de consequência. Estão
marcados com ⚠️ e detalhados nas seções 3 e 4.

---

## 1. Aluno entra pelo painel, não direto no teste

### Viabilidade: alta. Boa parte da máquina já existe.

**Hoje:** o link do teste (`/responder/<id>`) abre o teste direto, sem login. O
link da bateria (`/bateria/<id>`) idem, e já sabe retomar de onde parou.

**O que muda:** o link passa a levar ao painel do aluno, com os testes listados
lá dentro.

### O que já existe
- Área do aluno com login (`/aluno`), listando testes e baterias
- `people.user_id` ligando avaliado a usuário
- `claim_student_profile()` casando por e-mail no primeiro login
- Bateria com "Continuar de onde parei" e etapas

### O que falta
1. **Cadastro pelo link** — quem chega por link sem conta cria uma com nome,
   telefone, e-mail e senha. A pessoa já existe em `people` (o mentor cadastrou);
   o cadastro só cria o usuário e liga os dois.
2. **Link leva ao painel**, não ao teste. O teste passa a ser aberto de dentro.
3. **Bateria etapa a etapa, com saída** — hoje ela encadeia. Ao terminar uma
   etapa: *"Fazer o próximo agora"* ou *"Voltar ao meu painel"*.
4. **Painel com gráficos do que acabou de responder** — os componentes de
   relatório já existem; é montar a vista resumida.

### Risco
O link deixa de ser "clique e responda" e passa a exigir cadastro. **Isso derruba
a taxa de resposta** — todo passo a mais derruba. Vale manter a opção de
responder sem conta e oferecer o cadastro no fim, quando a pessoa já investiu o
tempo e quer ver o resultado.

---

## 2. Aluno já cadastrado entra com o e-mail e cria a senha

### Viabilidade: alta — mas ⚠️ **não pode ser feito como está descrito**

**O problema:** "entra com o e-mail e é direcionado para criar uma senha", ao pé
da letra, significa que **qualquer pessoa que saiba o e-mail de um aluno define a
senha dele e entra na conta**. Não é detalhe de implementação: é a definição de
sequestro de conta. Os resultados de teste de todos os avaliados ficariam a um
palpite de distância.

**Como se faz com segurança**, sem perder a simplicidade:

1. Aluno digita o e-mail
2. Sistema envia um link para aquele e-mail (o Resend já está ligado e
   autenticado)
3. Aluno clica no link **e só então** define a senha

O passo 2 é o que prova que o e-mail é dele. É um clique a mais e não tem como
pular.

**Detalhe:** a tela não deve dizer "e-mail não encontrado". Isso deixa qualquer
um descobrir quem é avaliado seu, testando e-mails. A resposta é sempre a mesma:
"se este e-mail estiver cadastrado, você vai receber um link".

---

## 3. ⚠️ Comunidade com compartilhamento de resultados

### Viabilidade técnica: alta. Viabilidade prática: precisa de decisão sua.

O feed em si é simples: posts, curtidas, comentários, escopo por grupo. Uma
tarde de trabalho. **O problema não é técnico.**

### O que me preocupa

**Resultado de teste comportamental é dado sensível.** "Amabilidade baixa",
"Neuroticismo alto", "Colérico dominante" — dito assim, entre colegas de
trabalho, cola na pessoa. E diferente de uma foto ou de um texto, **o avaliado
não escolheu esses adjetivos: um algoritmo escolheu por ele.**

Três consequências concretas:

1. **Pressão para compartilhar.** Se metade do grupo publica, quem não publica
   fica marcado. "Opcional" num grupo de trabalho raramente é opcional de
   verdade.
2. **Uso contra a pessoa.** Numa empresa cliente, o gestor vê que o subordinado
   tem baixa Conformidade. Isso volta na avaliação de desempenho, e você não vai
   saber.
3. **LGPD.** Dado de personalidade tratado em contexto de trabalho pede
   consentimento específico e informado. Publicar num feed interno é
   compartilhamento com terceiros. Não sou advogado e você deve ouvir um — mas o
   risco existe e é seu, não da plataforma.

### O que eu proponho construir

O feed, sim. Mas com o compartilhamento desenhado assim:

- **Desligado por padrão**, ligado pelo mentor **por grupo**. Uma turma de
  desenvolvimento pessoal é uma coisa; o RH de uma empresa cliente é outra.
- **O aluno escolhe o que publica**, e nunca o relatório inteiro: um cartão
  simples, tipo "meu perfil é SC" ou "meu valor mais forte é Social".
  Nunca pontos de atenção, nunca receios, nunca o texto interpretativo.
- **Aviso claro na hora de publicar**, dizendo quem vai ver.
- **Poder apagar depois**, com o post sumindo de verdade.

### Alternativa que resolve boa parte do objetivo sem o risco

Se o que você quer é **engajamento**, o feed não precisa de resultado de teste.
Post livre, foto, comentário sobre a aula, marco alcançado — isso engaja igual e
não expõe ninguém. **Sugiro começar por aí** e ligar o compartilhamento de
resultado depois, se fizer falta.

---

## 4. ⚠️ Pontuação e ranking

### Viabilidade técnica: alta. Mas há um conflito direto com o que acabamos de construir.

### O conflito

**Dar ponto por "responder teste" paga a pessoa para clicar rápido.**

Passamos os últimos dias construindo defesa contra exatamente isso: as
alternativas de peso equilibrado, a ordem embaralhada, os pares de checagem, o
selo de confiabilidade. Tudo para que respondia-no-automático não vire perfil.

Um ranking que sobe quando você responde é um incentivo para responder mais e
mais rápido. E como o ranking é público no grupo, o incentivo tem plateia.

**Não é hipótese.** A primeira avaliada real levou 80 segundos por bloco. Um
ranking a olhando teria feito ela ir mais rápido.

### Como fazer sem estragar o instrumento

1. **Ponto por teste concluído só vale com selo "alta".** Respondeu no
   automático, não pontua. Isso inverte o incentivo: passa a pagar por ler com
   atenção. É a única versão que eu recomendo.
2. **Ponto fixo por teste, nunca por quantidade.** Sem "responda mais para subir".
3. **Devolutiva pontua para o aluno por comparecer**, não por realizar — quem
   realiza é você.
4. **Ranking dentro do grupo, e opcional.** Grupo de empresa com ranking de
   participação vira constrangimento rápido.

### Ações que pontuam bem, sem efeito colateral

Concluir aula, comparecer à devolutiva, publicar na comunidade, comentar,
completar o perfil. Nenhuma delas piora se for feita rápido.

---

## 5. Tudo visível para aluno e mentor

### Viabilidade: alta, sem ressalva.

O padrão já existe: `acting_account()` para o mentor, `my_person_ids()` para o
aluno, e a mesma tabela servindo os dois com policies diferentes. Foi assim que
a devolutiva ganhou lado do aluno.

Para o mentor: pontuação e ranking do grupo dentro da tela do grupo; posts da
comunidade com moderação (apagar o que não deve estar lá).

---

## Ordem de execução sugerida

| # | O quê | Por quê primeiro |
|---|---|---|
| 1 | **Login e criação de senha com verificação por e-mail** | Sem isso, nada do resto tem dono. E hoje o aluno pré-cadastrado não tem caminho para entrar. |
| 2 | **Link leva ao painel + bateria etapa a etapa com saída** | É a demanda que melhora a experiência de quem responde, e não depende de decisão sua. |
| 3 | **Painel do aluno com gráficos do resultado** | Dá motivo para o aluno voltar. Componentes já existem. |
| 4 | **Cadastro pelo link** | Depende do 1. |
| 5 | **Comunidade sem resultado de teste** | Engajamento sem exposição. |
| 6 | **Pontuação, com ponto condicionado ao selo** | Depois da comunidade, senão sobra pouca ação para pontuar. |
| 7 | **Compartilhar resultado no feed** | Só se ainda fizer falta, e com os limites da seção 3. |

---

## Decisões — respondidas pelo Matheus em 28/07/2026

1. **Responder sem conta: SIM.** Ao fim de cada teste, dois caminhos: "fazer o
   próximo teste" ou "ir para o meu painel". Sem conta, dá para responder a
   bateria inteira de uma vez e ver o relatório no fim. Para responder **aos
   poucos**, o aluno precisa entrar no painel — é lá que as respostas ficam
   guardadas e os testes liberados aparecem. ✅ **FEITO**
2. **Comunidade começa SEM resultado de teste.** Só foto, texto, PDF e link.
3. **Ranking visível para o grupo todo**, como menu dentro do painel do aluno.
4. **Pontos NÃO ligados aos testes, por enquanto.** Só as demais ações. O peso
   acompanha o esforço: assistir uma aula vale mais que engajar na comunidade.

### Tabela de pontos (proposta, a partir do critério de esforço)

| Ação | Pontos | Por quê |
|---|---|---|
| Concluir uma aula | 20 | Custa tempo e atenção |
| Comparecer à devolutiva | 15 | Compromisso agendado |
| Publicar na comunidade | 8 | Exige produzir algo |
| Completar o perfil | 5 | Uma vez só |
| Comentar num post | 2 | Barato de fazer |
| Curtir | 1 | Quase nada |

Teto diário nas ações baratas, senão curtir cem posts vira estratégia de
ranking. Responder teste fica fora, por decisão do Matheus.

---

# Anexo — Mentor afiliado (pedido em 28/07/2026, para o FIM da fila)

## O diagnóstico: por que "não está funcional"

`team_members` e `team_member_groups` existem e estão completos. O convite gera
`invite_token`, marca `status = convidado`… **e não envia e-mail nenhum.** O
mentor nunca fica sabendo que foi convidado. É só isso — a máquina toda está
pronta atrás de um envio que não acontece.

## O que já existe

| Peça | Estado |
|---|---|
| `team_members` (kind mentor/colaborador, token, status) | ✅ |
| `team_member_groups` com `can_download_reports` **por grupo** | ✅ |
| Mentor em vários grupos | ✅ a tabela é N-para-N |
| `acting_account()` dando ao mentor o acesso do dono, limitado aos grupos dele | ✅ |
| Rota de aceite `/convite-equipe/$token` | ✅ |
| Envio do convite por e-mail | ❌ **é o que falta** |
| Criação de senha | ⚠️ existe para aluno; falta reusar |
| Painel próprio do mentor | ❌ |
| Permissão de agendar devolutiva **por grupo** | ❌ |
| Devolutivas dentro do grupo | ❌ |

## Plano

### A. Fazer o convite chegar
Enviar o e-mail no `inviteTeamMember`, com a marca do mentor, pelo Resend —
igual ao primeiro acesso do aluno, que já funciona. Reenviar convite também
manda.

### B. Senha do mentor
A tela `/aluno/criar-senha` já faz exatamente isso. Generalizar para
`/criar-senha` e mandar os dois para lá.

### C. Painel do mentor afiliado
Igual ao do aluno mais o menu **Grupos**. O mentor também é uma pessoa: pode ter
respondido testes e ter devolutivas próprias. O menu extra aparece por
`member_kind() = 'mentor'`.

### D. Nova permissão por grupo
Coluna `can_schedule_devolutivas` em `team_member_groups`. Fica ao lado de
`can_download_reports`, na mesma tela em que o dono já escolhe os grupos.

### E. Devolutivas dentro do grupo
Aba **Devolutivas** na tela do grupo, idêntica à do dono — fila, agendar,
registrar, painel — filtrada por aquele grupo. Aparece para o dono sempre, e
para o mentor só quando `can_schedule_devolutivas` estiver ligado.

A RLS de `devolutivas` já usa `can_see_person()`, que limita o mentor aos grupos
dele. Falta só a checagem da permissão de agendar nas funções de escrita.

## Risco a observar

O mentor afiliado enxerga resultado de teste de gente que não é cliente dele
direto. `can_download_reports` já separa "ver na tela" de "levar embora" — e é
por isso que essa distinção existe. Vale conferir com o mentor afiliado real
antes de soltar, porque o estrago aqui é vazamento de dado de terceiro.

---

# Anexo 2 — Notificações (pedido em 28/07/2026, para a esteira)

## Quem recebe o quê

| Papel | Escopo pedido |
|---|---|
| **Dono** | tudo que acontece no sistema |
| **Aluno** | o que é dele, do grupo dele e da comunidade dele |
| **Mentor afiliado** | o que é dele e dos grupos a que pertence |
| **Colaborador** | o que cabe nas funções liberadas para ele |

## A boa notícia: o recorte já existe

Nada disso precisa de um modelo novo de permissão. A plataforma já sabe
responder "quem pode ver isto":

- `acting_account()` — sob qual conta a pessoa está agindo
- `visible_group_ids()` — os grupos do mentor afiliado
- `can_see_person()` — se pode ver aquele avaliado
- `posso_ver_grupo()` — as três portas do grupo, criada para a comunidade
- `permissions` do colaborador, por funcionalidade

**A regra de ouro:** uma notificação só é entregue se o destinatário já pudesse
ver o fato que a originou. Assim o recorte de notificação nunca vira uma porta
lateral para dado que a RLS barraria. Escrever uma segunda régua de visibilidade
seria a forma mais provável de vazar alguma coisa.

## ⚠️ O problema: "tudo" vira ruído em uma semana

"O dono é notificado de tudo" funciona com 8 avaliados. Com 200, cada curtida,
cada comentário e cada resposta vira um aviso — e a caixa de notificação passa a
ser aquilo que ninguém abre. O custo não é técnico: é o dono perder o aviso que
importava no meio de trezentos que não importavam.

**Proposta:** agrupar por natureza e por tempo.

| Tipo | Como chega ao dono |
|---|---|
| Alguém concluiu um teste | na hora |
| Devolutiva atrasada (mais de 7 dias na fila) | resumo diário |
| Publicou na comunidade | resumo diário, por grupo |
| Curtida, comentário | não notifica o dono; só o autor do post |
| Alguém pediu acesso / criou conta | na hora |
| Falha de envio de e-mail | na hora |

O aluno e o mentor recebem bem menos por natureza, então para eles "na hora"
funciona sem agrupamento.

## Plano

1. **Tabela `notificacoes`**: destinatário, tipo, texto, link, lida, criada_em.
   Uma linha por pessoa que deve receber — resolver o destinatário na hora de
   gravar é mais simples e mais rápido de ler do que calcular na consulta.
2. **Gatilhos no banco** para os fatos que já acontecem sem passar pelo código
   do app (resposta concluída, por exemplo). O resto é gravado nas funções de
   servidor que já existem.
3. **Sino no cabeçalho**, com contagem de não lidas, para os quatro papéis.
   O componente é um só; o que muda é o que chega.
4. **Preferências**: o que cada um quer receber. Sem isso, quem se incomodar vai
   simplesmente ignorar tudo.
5. **Push do navegador (Web Push)** — só depois. Precisa de service worker,
   chaves VAPID e permissão do navegador, e no iPhone só funciona se a pessoa
   instalar a plataforma como aplicativo. Vale como segunda etapa, quando a
   notificação dentro da plataforma já estiver provando o valor dela.

## Decisão que preciso do Matheus

**"Tudo" é tudo mesmo, ou tudo que importa?** Recomendo a tabela acima: curtida
e comentário não notificam o dono, e comunidade vira resumo diário. Se ele
quiser tudo na hora, dá para fazer — mas em poucas semanas a caixa vira algo que
ele para de abrir, e aí o aviso que importava se perde junto.

---

# Anexo 3 — Mentor é um aluno promovido (redesenho, 29/07/2026)

O Matheus percebeu, testando: **o mentor afiliado é um aluno com privilégios
extras**, não um tipo de usuário à parte. O que muda nele é só o que o dono
libera por grupo — ver relatório e agendar devolutiva.

## O problema que isso resolve

Hoje há dois cadastros independentes: `people` (avaliado) e `team_members`
(equipe). O mesmo e-mail cadastrado nos dois vira **duas identidades e dois
painéis**. Não é hipótese: o próprio Matheus é "Teste VAK" em `people` e dono em
`profiles`, e isso já causou o nome errado na comunidade.

E o modelo atual não tem como "promover": só como convidar de novo, duplicando.

## O desenho novo

- **Uma pessoa, um cadastro, um painel.** O painel é o do aluno.
- **Promover a mentor** vira uma ação na ficha da pessoa, em Pessoas.
- Promovido, ele ganha o menu **Grupos** dentro do painel de aluno, com os
  grupos que o dono atribuir.
- Por grupo, o dono liga ou desliga: **ver relatório** e **agendar devolutiva**
  (as duas colunas já existem em `team_member_groups`).
- **O menu Mentores some.** Não há mais "convidar mentor" — há "promover
  alguém que já está cadastrado".

## O que precisa mudar

1. `team_members` passa a apontar para `people` (`person_id`), em vez de guardar
   nome e e-mail próprios. A pessoa é a fonte da verdade.
2. `promoverAMentor(person_id)` / `rebaixar(person_id)` no lugar de
   `createTeamMember` para o tipo mentor.
3. O primeiro acesso do mentor vira o **mesmo do aluno** — link por e-mail. O
   fluxo de convite com token deixa de existir para mentor.
4. Painel: `/aluno` ganha o menu Grupos quando a pessoa é mentor.
5. **Colaborador continua como está.** Ele não é aluno — é alguém da operação,
   com permissões de funcionalidade. Os dois papéis não se confundem.

## Cuidado na migração

Já existe um mentor convidado pelo modelo antigo, com conta criada. Ao migrar,
ele precisa virar uma pessoa em `people` (ou ser ligado à que já existir com
aquele e-mail), sem perder o acesso nem duplicar. O índice único de e-mail em
`people`, criado em 28/07, ajuda: garante que o vínculo seja com uma pessoa só.
