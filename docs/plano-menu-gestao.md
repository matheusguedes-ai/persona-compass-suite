# Menu Gestão — plano de construção

Pedido do Matheus em 29/07/2026. Três coisas dentro de um menu novo:

1. **Agenda visual**, que mostra os agendamentos de devolutiva feitos pelo aluno
   e pelo mentor, com integração ao **Google Calendar** do e-mail cadastrado.
2. **Eventos criados pelo master**, direcionados a pessoas ou grupos, que
   aparecem também na agenda do aluno.
3. **Kanban** de devolutivas: quem não agendou · quem agendou · quem já fez.

---

## A ordem, e por que não é a óbvia

A ordem natural de ler o pedido é: agenda → Google → Kanban. É a pior ordem
possível para executar.

O **Google Calendar é a única parte que depende de terceiros** — de uma
configuração sua no Google Cloud e, dependendo do uso, de uma revisão do próprio
Google que leva dias. Também é a **menos valiosa das três**: a agenda dentro da
plataforma já resolve o problema de "quando é a devolutiva"; o Google só leva
essa informação para onde você já olha.

O **Kanban é o mais barato de todos** — os dados já existem inteiros
(`devolutivas.status`, e a fila já calculada em `listarFila`). É uma tela nova
sobre dados prontos.

Então: **o que funciona sozinho primeiro, o que depende do Google por último.**
Se o Google travar, você já tem o menu inteiro funcionando.

---

## Etapa 1 — O esqueleto e o Kanban

**Construir**
- Menu **Gestão** na barra lateral, com duas abas: Agenda e Kanban.
- Aba Kanban, três colunas alimentadas pelo que já existe:
  - **Sem devolutiva** — a fila calculada (respondeu e ninguém conversou com
    ele). Já existe em `listarFila`; reaproveitar, não recontar.
  - **Agendada** — `status = 'agendada'`.
  - **Realizada** — `status = 'realizada'`.
- Cada cartão: nome, o que respondeu, há quantos dias espera. Clique abre a
  ficha da pessoa.
- Arrastar **não** move nada. Mover de coluna aqui significaria agendar ou
  registrar uma conversa que não aconteceu; o cartão leva para a ação real.

**Testar**
- Conferir que a soma das três colunas bate com o menu Devolutivas. Se
  divergir, é porque recontei em vez de reaproveitar — erro meu, e o sintoma
  aparece exatamente assim.
- Entrar como mentor: só podem aparecer os alunos dos grupos dele.
- Entrar como aluno: o menu Gestão **não** existe para ele.

**Adequação provável**
- A coluna "Realizada" cresce para sempre e vira ruído. Se acontecer, corto por
  período (últimos 90 dias) com filtro para ver o resto.

**Depende de você:** nada.

---

## Etapa 2 — Agenda visual, só com o que já é nosso

**Construir**
- Aba Agenda: visão de mês e de semana, alimentada por `devolutivas.scheduled_at`.
- Clique num compromisso abre a devolutiva.
- A **mesma agenda no painel do aluno**, mostrando só o que é dele.

**Testar**
- Marcar uma devolutiva e ver se aparece no dia certo — e conferir com o aluno
  logado, não só com você. ⚠️ Já houve bug de data aparecer um dia antes, por
  fuso: datas sem hora viram meia-noite UTC. Testar 1º e último dia do mês.
- Mentor sem `can_schedule_devolutivas` vê a agenda mas não cria nada.

**Adequação provável**
- Semana pode ser suficiente e mês virar exagero, ou o contrário. Decido depois
  de ver com dado real.

**Depende de você:** nada.

---

## Etapa 3 — Eventos criados pelo master

**Construir**
- Tabela de eventos próprios (título, quando, descrição) com destinatários por
  **pessoa ou grupo**.
- Reaproveitar a ideia do leque das notificações (`notificar()`): a regra de
  quem vê fica no banco, não na tela.
- Ao criar um evento, disparar notificação para quem vai vê-lo — o sino já
  existe.

**Testar**
- Criar evento para um grupo e conferir, logado como aluno **de outro grupo**,
  que ele não aparece. É o teste que importa: o erro perigoso aqui é vazar
  evento para quem não deveria.
- Criar evento para uma pessoa só e repetir a conferência.

**Adequação provável**
- Pode surgir a necessidade de evento recorrente (toda segunda). Não entra
  agora; recorrência é uma caixa de complexidade própria.

**Depende de você:** nada.

---

## Etapa 4 — Google Calendar

Aqui muda o tipo de trabalho: deixa de ser código e passa a depender de
configuração externa.

**O que é preciso, do seu lado**
1. No Google Cloud (o mesmo projeto do login que já funciona): **ativar a
   Google Calendar API**.
2. Adicionar o **escopo de calendário** à tela de consentimento. É uma permissão
   diferente da do login — quem já entrou vai precisar **autorizar de novo**.
3. ⚠️ O escopo de calendário é **sensível** para o Google. Enquanto o app
   estiver em modo de teste, funciona com uma lista limitada de e-mails que você
   cadastra. Para liberar a qualquer pessoa, o Google exige **verificação**, que
   leva dias e pede vídeo demonstrando o uso. **Isso pode travar a etapa** — por
   isso ela é a última.

**Construir**
- Botão "Conectar meu Google Calendar" nas Configurações, por pessoa.
- Ao agendar uma devolutiva, criar o evento no calendário de quem conectou.
- Ao remarcar ou cancelar, atualizar lá também.

**Decisão sua, antes de eu começar (ver abaixo).**

**Testar**
- Conectar, agendar, e conferir no Google Calendar de verdade.
- Remarcar e conferir se mudou lá.
- Desconectar e garantir que a plataforma continua funcionando sem erro — a
  agenda de dentro não pode depender do Google estar ligado.

**Adequação provável**
- Token do Google expira. Precisa renovar sozinho e, quando não der, avisar a
  pessoa em vez de falhar calado.

---

## Três decisões que eu preciso de você

**1. Mão única ou mão dupla?**
- **Mão única (recomendo):** o que é marcado na plataforma aparece no Google.
  Simples, previsível, e o Google nunca estraga dado nosso.
- Mão dupla: o que está no Google também aparece aqui. Dobra o trabalho e traz
  conflito (editou nos dois lados, qual vale?).

**2. Quem conecta o próprio calendário?**
- **Só você, o master (recomendo para começar):** uma conta a configurar, e o
  Google não exige verificação para uso próprio.
- Cada mentor e cada aluno conectam o deles: é o ideal no fim, mas é o cenário
  que **exige a verificação do Google**.

**3. O aluno vê o Kanban?**
- **Não (recomendo):** é ferramenta de gestão, e mostra a situação dos colegas.
- O aluno continua vendo a agenda dele, que é o que lhe interessa.

---

## Resumo

| Etapa | O que entrega | Depende de você | Risco |
|---|---|---|---|
| 1 | Menu Gestão + Kanban | não | baixo |
| 2 | Agenda na plataforma e no painel do aluno | não | baixo (cuidado com fuso) |
| 3 | Eventos do master por pessoa/grupo | não | médio (vazamento entre grupos) |
| 4 | Google Calendar | **sim** | alto (verificação do Google) |

As etapas 1 a 3 entregam o menu inteiro funcionando. A 4 é melhoria em cima de
algo que já funciona — e é a única que pode travar por motivo fora do código.
