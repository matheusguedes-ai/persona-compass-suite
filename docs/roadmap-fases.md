# Roadmap por fases — Thrive Profiler

Escrito em 30/07/2026, em cima do que já existe: 211 demandas no kanban, sendo
118 concluídas. Mais as cinco ideias que nasceram no C1 (lembretes do iPhone,
30/07 21:39–22:24) e nunca entraram na planilha.

Este documento decide **ordem**, não conteúdo. O que cada item é já está escrito
no kanban; aqui só se resolve o que vem antes do quê, e por quê.

---

## O que a fila realmente tem

O kanban diz 83 planejadas. Não são 83.

| | |
|---|---|
| Planejadas na planilha | 83 |
| — decisões já tomadas, registradas com status errado | −19 |
| **Trabalho planejado de verdade** | **64** |
| Precisa de melhorias | 10 |
| **Aberto de verdade** | **74** |
| + demandas novas do C1 | +5 |
| **Total a distribuir** | **79** |

As 19 linhas que começam com "Decisão:" (`Decisão: ranking visível para o grupo
todo`, `Decisão: presença manual pelo professor entra`…) descrevem escolhas que
você já fez. Estão em "Planejado" porque nasceram junto com a demanda que elas
governam. Não são trabalho — são a memória de por que a plataforma é como é.
**Primeira providência: tirar as 19 de Planejado.** Uma fila que mente sobre o
próprio tamanho não serve para priorizar.

---

## As três regras que decidem a ordem

1. **Dívida que sangra vem antes de feature.** Se o custo de não fazer cresce
   sozinho — dado exposto, arquivo aberto — não disputa espaço com ideia nova.
2. **Decisão antes da construção que ela governa.** Construir 12 telas de
   devolutiva e depois decidir que devolutiva virou Mentoria é jogar 12 fora.
3. **Estrutura antes do visual.** Regra sua, já registrada no kanban (#74).

E uma regra de tamanho, vinda dos seus lembretes: **uma feature grande por fase.**
Fase com duas features grandes não termina — vira duas fases mal feitas.

---

## Fase 0 — Fechar o que está aberto

**Por que primeiro:** é o único bloco onde esperar custa mais caro a cada dia.
Não tem nada de novo aqui, só verdade.

| Item | O que é |
|---|---|
| #1 | Mentor afiliado enxerga resultado de quem não é cliente dele — **único P1 aberto** |
| #111 | Bucket `biblioteca` é público: o cadeado esconde a linha, não o arquivo. Quem tem a URL continua baixando |
| #99 | Mesmo defeito no bucket `avatares`: o caminho deixou de ser adivinhável, mas o bucket segue público |
| #16 | Material Aula01_Slides segue visível aos alunos |
| #63 | 'Confirm email' ligado no projeto novo |
| #70 | `.env` commitado — avaliar gitignorar |
| #15 | Limpeza de versões '(cópia)' e dados da Ana Teste |
| — | **Gravar as 4 regras de ouro no `CLAUDE.md`** (ponto de retorno · dono do dado · uma feature por vez · explicar em português) |

#111 e #99 são o mesmo bug em dois lugares — bucket público — e se resolvem com
a mesma cirurgia: bucket privado com URL assinada. Fazer juntos.

O último item não é bug, mas é Fase 0 por consequência: enquanto as regras não
estiverem no `CLAUDE.md`, elas valem quando você conversa comigo e **não valem
quando o Claude Code trabalha sozinho**. Toda fase seguinte roda sem rede.

**Sprint:** 1. **Depende de você:** #16 (fechar o material), #63 (painel do Supabase).

---

## Fase 1 — Fazer a fila dizer a verdade

**Por que agora:** três funcionalidades entregues nunca foram exercitadas no
papel que mais importa. "Concluído" que ninguém testou é "Precisa de melhorias"
com nome bonito.

**Cinco itens, um só teste.** #18 (Classroom), #19 (abas de Testes), #98 (regras
de quem vê o quê), #102 (mentor afiliado promovido de verdade) e #105 (o botão
de PDF some mesmo?) têm todos a mesma ressalva escrita de cinco jeitos: *ninguém
nunca entrou como colaborador ou mentor convidado*. Uma sessão com uma conta de
terceiro fecha os cinco. Duas delas já nasceram quebradas uma vez — não é
paranoia, é histórico.

| Item | O que é |
|---|---|
| — | Reclassificar as 19 "Decisão:" |
| #18 #19 #98 #102 #105 | Provar os papéis com uma conta de colaborador de verdade |
| #8 | **Revisão do teste de QI** — único instrumento sem revisão; gabarito errado entrega resultado errado a quem responde |
| #20 | Exportação de Pessoas não conferida no Excel nem no Sheets |
| #10 | BUG: select 'Dimensão pontuada' abre vazio |
| #14 | Migrar o mentor já convidado sem duplicar |
| #24 | Generalizar `/aluno/criar-senha` para `/criar-senha` |
| #6 | Aviso ao mudar horário de aula que já tem presença |
| #23 | Limite de tamanho e recorte de capas e banners |
| #21 #22 | Rastro da exportação e decisão do que vai no arquivo |
| #97 | Anotar o que ainda incomoda na plataforma (ver abaixo) |

**Sobre o #97:** a demanda diz "correção de ~31 bugs", mas não existe lista
nenhuma do que foi corrigido — ninguém consegue dizer quais eram, se todos
saíram, ou se algum voltou. Não dá para auditar o que não foi escrito. O único
caminho honesto é você abrir a plataforma e anotar o que ainda incomoda hoje.
É trabalho seu, de meia hora, e vale mais que qualquer varredura minha.

**Sprint:** 1. **Depende de você:** a senha de colaborador (sem ela os cinco
itens continuam sendo suposição) e a lista do #97.

---

## Fase 2 — Destravar a Agenda

**Por que aqui:** treze demandas de Agenda estão paradas atrás de trinta minutos
seus no console do Google. É a maior alavanca de itens fechados por hora gasta
do roadmap inteiro — e não custa nada além do seu tempo.

**Primeiro, você (uma sessão):** #25 ativar a Calendar API e o escopo · #26
autorizar o URI de retorno · #27 colar CLIENT_ID e CLIENT_SECRET · #61 tela de
consentimento sai de Internal · #17 apagar os dois eventos órfãos.

**Depois, eu:** #28 renovação automática do token · #29 mandar o fim real do
evento · #30 notificar ao criar · #34 cortar a coluna Realizada por período ·
#92 agenda visual em mês e semana.

**Fica de fora por decisão:** #73 evento recorrente · #62 abrir o Calendar para
alunos e mentores (depende do #61 estar resolvido e de você querer).

**Sprint:** 1–2.

---

## Fase 3 — Mentorias

**A maior ideia do C1, e o maior nó do kanban.** Dezesseis demandas de
Relatórios (#35–#49) descrevem um *painel de devolutiva*. O seu lembrete de
ontem diz para aposentar esse painel e construir um menu **Mentorias** —
agendamento + pós-mentoria com registro permanente que o aluno acessa para
sempre.

**Não dá para fazer os dois.** Esta fase começa com uma decisão, não com código:

> **O painel de devolutiva vira Mentorias, ou Mentorias é outra coisa e a
> devolutiva continua?**

Da resposta dependem 16 itens. Se vira, morrem ou são reescritos: #39 tabela
`devolutiva_itens` · #40 cronômetro de sessão · #41 nota rápida · #42 aba Medos ·
#43 aba Pontos a desenvolver · #44 aba Competências-alvo · #45 aba SWOT ·
#46 exportar o painel em PDF com a marca · #47 enviar o painel por e-mail ·
#49 design dos relatórios. E #38 (o plano de ação é questionário respondido
sozinho — o problema que a referência CIS já apontou) resolve-se sozinho, porque
o plano passa a ser construído durante a conversa. Se não vira, Mentorias é uma
feature nova e o painel segue como está.

Decisões que travam junto: #35 destino do plano de ação de 6 perguntas · #36 a
devolutiva cobre bateria ou teste avulso · #37 fonte do conteúdo de medos e
pontos · #48 aba Livros por competência.

**Construção, depois de decidido — e só o coração:** agendar a mentoria (o aluno
vê, reaproveita a agenda do Classroom que já tem check-in) e o pós-mentoria
(resumo, desafios em checklist, materiais). Check-in, gamificação e integração
com a agenda do aluno **orbitam depois** — mandar tudo junto para o Claude Code
trava, e você já escreveu isso no próprio lembrete.

**Sprint:** 2–3. **Depende de você:** a decisão. Sem ela a fase não abre.

---

## Fase 4 — Construtor de testes

**O que muda de patamar.** Hoje a plataforma tem seis testes fixos. O construtor
transforma o menu Testes num Google Forms: seções, tipos de resposta variados,
interpretação **opcional** por chavinha (com peso e relatório) ou coleta pura
(pesquisa de satisfação, "obrigado por participar"), e painel de respostas com
visão agregada e individual.

Arquitetura já decidida por você: **reaproveitar o menu existente**. DISC, MBTI
e os outros viram templates; botão "criar novo teste" ao lado. Nada de menu novo.

Absorve #68 (seleção pergunta a pergunta ao montar a bateria) e depende de #10
estar resolvido na Fase 1.

**Por que depois de Mentorias:** as duas são grandes, e a regra é uma por vez.
Mentorias vem antes porque destrava 16 itens parados; o construtor não destrava
nada — ele abre território novo. Destravar antes de expandir.

**Sprint:** 2–3.

---

## Fase 5 — Academy e Comunidade

Engajamento. Nada aqui sangra, e nada aqui destrava outra coisa — por isso vem
depois, mesmo sendo o que mais aparece para o aluno.

**Academy:** #9 layout em fileiras · #110 'Continue assistindo' e progresso ·
#113 prateleiras sem seta · #50 link do teste levando ao painel · #51 mentor vê
pontuação e ranking · #52 perfil do aluno com empresa, banner e redes.

**Comunidade:** #53 publicar resultado do teste · #54 enquete · #55 menções com
@ · #56 evento no feed. As quatro decisões que governam isso já estão tomadas.

**Notificações:** #31 (decidir o escopo — você) · #32 agrupar por natureza e
tempo · #33 preferências por pessoa · #67 Web Push.

**Acabamento:** #108 selo da empresa nas telas que faltam — a tela que mais
importa (`/responder`) já está feita, o resto é polimento.

**Assistente de IA:** #57 decidir quem paga e qual o teto · #58 construir. Fica
por último dentro da fase de propósito: **é o único item da plataforma inteira
com custo por uso**, e sem teto definido vira surpresa na fatura. A decisão é
sua e trava a construção.

**Sprint:** 2–3.

---

## Fase 6 — Preparar o SaaS

Do C1: **auditar a plataforma e padronizar o dono do dado.** Hoje o dono é
sempre você, então não há risco de vazamento entre clientes — não é urgente. Mas
cada feature construída sem campo de dono é uma cirurgia a mais depois. Por isso
a regra entra no `CLAUDE.md` já na Fase 0, e a auditoria do que já existe vem
aqui, fatiada.

Junto: #59 escopo por chave, uso e revogação · #60 menu Integrações via API ·
#64 domínio personalizado · #65 nome da marca · #66 DMARC para `p=quarantine` ·
#69 testes automatizados (hoje o lint só acusa formatação).

**Sprint:** contínuo, um pedaço por vez, sem parar o resto.

---

## Fora de fase

**Depende de dados reais, não de trabalho:** #71 comparar aplicações de reteste
(gráfico de evolução) · #72 alpha de Cronbach na tela de Estatísticas · calibrar
os pesos da derivação Jung. Nenhum destes faz sentido antes de existir amostra —
com 20 respostas na base, qualquer estatística mente.

**A testar quando você for mexer:** a ponte Claude Design → Claude Code. Não é
demanda da plataforma, é do seu fluxo de trabalho (cabeça → chat → design →
construção). Fazer ao vivo, com um design real na mão, não teorizar antes.

---

## O caminho, em uma linha

```
Fase 0  fechar o que sangra          →  1 sprint
Fase 1  fila honesta + papéis        →  1 sprint
Fase 2  destravar a Agenda           →  1–2 sprints   (30 min seus destravam 13 itens)
Fase 3  Mentorias                    →  2–3 sprints   ⚠ abre com uma decisão sua
Fase 4  Construtor de testes         →  2–3 sprints
Fase 5  Academy e Comunidade         →  2–3 sprints
Fase 6  preparar o SaaS              →  contínuo
```

## O que precisa de você, e quando

| Quando | O que |
|---|---|
| Fase 0 | Fechar o material Aula01_Slides · desligar 'Confirm email' |
| Fase 1 | Uma senha de colaborador de verdade, para provar #18 e #19 |
| Fase 2 | Uma sessão no console do Google (#25 #26 #27 #61) |
| **Fase 3** | **A decisão: Mentorias substitui o painel de devolutiva, ou não?** |
| Fase 5 | Escopo das notificações do dono (#31) |
| Fase 6 | Nome da marca (#65) |

Seis intervenções suas no roadmap inteiro. A da Fase 3 é a única que não pode
ser adiada sem custo — as outras cinco atrasam uma fase; essa decide se dezesseis
itens existem.
