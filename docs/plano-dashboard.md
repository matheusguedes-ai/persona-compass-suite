# Dashboard — o retrato da plataforma inteira

Escrito em 01/08/2026 com o Matheus. Demandas `#237` e `#220`.

**O problema:** o Dashboard responde hoje apenas sobre testes — respondidos,
pendentes, por instrumento, por mês. Era coerente quando a plataforma era um
disparador de inventários. Virou hub: tem Mentorias, Classroom, Academy e
Comunidade, e a primeira tela não sabe que elas existem.

---

## As três decisões do Matheus

**O engajamento mora dentro do menu Dashboard.** Não é tela separada nem bloco
solto no meio dos números: é uma função própria dentro do mesmo menu. `#220`
deixa de ser demanda independente e passa a ser parte desta.

**Recalcula toda vez que abre.** Nada de cache. Com dezenas de registros isso é
instantâneo, e um número que mente por cinco minutos numa tela de decisão vale
menos que meio segundo de espera. Quando a base crescer para milhares, troca-se
por cache sem mexer na tela — a decisão é reversível de propósito.

**Cada um vê só o que pode abrir.** O dono vê tudo. O colaborador vê apenas as
áreas em que tem permissão: sem `mentorias`, nenhum número de mentoria aparece
para ele — nem o card, nem o total.

> Isto não é preferência estética. Sem esse recorte, o Dashboard vira a porta
> dos fundos que mostra em número o que as outras telas passaram 48 horas
> aprendendo a esconder. Um card "12 mentorias ativas" já entrega quantos
> clientes a conta tem para quem não deveria saber.

**Ponto derivado, não dado:** o mentor convidado segue o mesmo princípio — vê o
recorte dos grupos dele. O Matheus falou de si e do colaborador; o mentor foi
deduzido por coerência. Se ele quiser o mentor fora, é uma linha.

---

## O que cada área mostra

Proposta para o Matheus revisar antes do prompt. Regra que vale para todas:
**número que precisa de contexto vem com o contexto** — "4,5 (2 avaliações)",
nunca "4,5" sozinho, como já foi decidido na Fatia 2 do Mentorias.

| Área | O que responde |
|---|---|
| **Mentorias** | sessões desta semana · quantas faltam agendar · satisfação média com a contagem |
| **Classroom** | próxima aula · presença da última · frequência do mês |
| **Academy** | pessoas com trilha em andamento · conclusões no mês |
| **Testes** | o que já existe: respondidos, pendentes, por instrumento, por mês |
| **Comunidade** | posts na semana · quantos membros participaram |
| **Engajamento** | quem está sumindo (ver abaixo) |

## O bloco de engajamento

O que o `#220` pedia: *o mentor perceber que alguém está sumindo ANTES de perder
a pessoa*.

**Critério proposto:** pessoa sem nenhuma atividade há mais de 14 dias — sem
login, sem responder teste, sem presença em aula, sem progresso em trilha, sem
mentoria realizada. Quatorze dias porque é o intervalo em que ainda dá para
retomar sem constrangimento; um mês já é conversa difícil.

Mostra o nome, há quanto tempo sumiu, e o que a pessoa tem pendente. Ordenado
pelo mais antigo.

**Ressalva honesta:** com poucos alunos na base, esse bloco vai apontar quase
todo mundo ou ninguém. Ele só fica útil com volume — mas nasce agora porque o
dado já é coletado e não custa.

---

## Ordem e dependência

**Esta demanda vem DEPOIS da Fatia 3 do Mentorias (`#229`).** A Fatia 3 já
calcula satisfação média, média de duração e quantas faltam agendar. Se o
Dashboard for construído antes, esses números são calculados em dois lugares —
e no dia em que uma conta mudar, um dos dois passa a mentir sem avisar.

A Fatia 3 constrói a conta; o Dashboard consome.

---

## Como saber que ficou pronto

- dono abre e vê as seis áreas com números que batem com cada tela;
- **colaborador SEM a permissão `mentorias` não vê nenhum número de mentoria** —
  nem card, nem total agregado. Este é o teste que decide;
- colaborador com `mentorias` e sem `educacao`: vê mentoria, não vê Academy;
- mentor convidado vê o recorte dos grupos dele;
- todo número conferido contra a tela de origem — se o Dashboard diz 3 mentorias
  ativas, a tela de Mentorias mostra 3;
- a tela abre em menos de um segundo com a base atual.
