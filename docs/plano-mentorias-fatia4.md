# Menu Mentorias — Fatia 4: link de auto-agendamento

Escrito em 04/08/2026 com o Matheus, revisto no mesmo dia depois de ele mapear
a tela de "Agendamento de horários com reserva" do Google Calendar.

**O que é:** o professor define quando atende e cria links de agendamento. O
aluno abre o link, escolhe um horário livre e marca sozinho.

---

## As decisões

**Só quem já está cadastrado agenda.** Reverte a ideia anterior de link aberto
ao público. Resolve de graça o problema de abuso: robô não conhece a lista de
e-mails dos alunos.

**Vários links, cada um com sua duração.** Um de 1 hora, outro de 2 horas, e
quantos mais fizerem sentido — cada um com regras próprias.

**Intervalo configurável entre compromissos.** O professor escolhe quanto tempo
de respiro fica entre uma sessão e a seguinte.

**O Google pessoal bloqueia sem revelar.** Compromisso marcado direto no Google
— dentista, BNI, café — não aparece na agenda da plataforma. Aparece apenas
como horário indisponível. É exatamente o que a API `freebusy` devolve: ocupado
ou livre, sem título, sem local, sem participante. Não precisa de ida e volta.

---

## Como "só cadastrado" funciona sem exigir login

O aluno informa o e-mail na página. Se ele existir em `people` na conta do
professor, o agendamento segue; se não, a página diz que aquele e-mail não está
cadastrado e oferece o contato do professor.

Sem senha, sem conta, sem atrito — e ninguém de fora entra. Os seus alunos hoje
são sete, e só dois têm login: exigir conta travaria cinco.

**Consequência boa:** como a pessoa é identificada, a sessão já nasce ligada ao
pacote dela, e a conta de "quantas faltam" continua fechando sozinha.

---

## O que o Google tem e vale ter aqui

Mapeado das telas que o Matheus mandou. Nem tudo entra na primeira fatia.

| Função do Google | Entra em |
|---|---|
| Duração dos horários | 4a |
| Disponibilidade geral (por dia, com faixas) | 4a |
| Janela de programação (antecedência mínima e máxima) | 4a |
| Intervalo entre horários | 4a |
| Máximo de agendamentos por dia | 4a |
| Título e descrição do link | 4a |
| Bloqueio pela agenda pessoal | **4b** |
| Cancelar e remarcar pelo aluno | **4b** |
| Foto e nome na página | 4c |
| Local e videoconferência | 4c |
| Formulário de reserva personalizável | 4c |
| Lembretes por e-mail antes da sessão | 4c |

**Sobre videoconferência:** criar sala do Meet automaticamente exige outro
escopo do Google, além do `freebusy`. Na 4c, começar por campo de link colado à
mão — resolve 90% e não pede permissão nova.

---

## Modelo de dados

### `mentoria_disponibilidade` — quando o professor atende

`mentor_id` · `dia_semana` (0–6) · `hora_inicio` · `hora_fim` · `ativo`

Uma linha por faixa. Segunda das 9h às 12h e das 14h às 18h são duas linhas —
como no Google, que permite mais de uma faixa por dia.

### `mentoria_links` — os links

| Campo | O que é |
|---|---|
| `id` · `mentor_id` | dono |
| `slug` · `titulo` · `descricao` | o endereço e o que o aluno lê |
| `duracao_min` | 60, 120, o que for — é o que diferencia um link do outro |
| `intervalo_min` | respiro depois de cada sessão |
| `antecedencia_min_horas` / `antecedencia_max_dias` | a janela de programação |
| `teto_por_dia` | máximo de agendamentos aceitos num dia |
| `usa_google_freebusy` | 4b |
| `permite_cancelar` / `permite_remarcar` | 4b |
| `ativo` | desligar sem apagar |

### `mentoria_sessoes` ganha

`origem` (`manual` · `link`), `link_id`, `confirmado_em`.

---

## As telas

**Professor — `/mentorias/agendamento`:** a grade da semana com as faixas de
disponibilidade, e a lista de links criados. Cada link com suas regras, o
endereço para copiar, e a chave de ligar e desligar.

**Aluno — `/agendar/$slug`:** sem login. Pede o e-mail, confere se está
cadastrado, mostra os dias com horários livres, ele escolhe e confirma. Recebe
e-mail com o compromisso.

---

## Por que tem de ser fatiado

Do jeito que está desenhado, isto é **maior que a Fatia 1**, que levou um dia
inteiro. E a 4b depende de uma ação do Matheus que ninguém pode fazer por ele.

**4a — o que faz existir.** Disponibilidade, múltiplos links, página do aluno
com verificação por e-mail cadastrado, janela, intervalo e teto. Bloqueia pelo
que está na plataforma.

**4b — o Google pessoal e o desfazer.** Consulta `freebusy` (exige o Matheus
reconectar o Google com o escopo novo) e as chaves de cancelar e remarcar.

**4c — o acabamento.** Foto e nome na página, local ou link de chamada,
formulário personalizável, lembretes.

---

## O que a 4b virou, na prática (05/08)

A 4b acabou fatiada em duas, e ganhou uma vizinha.

**4b Parte 1 — o Google pessoal.** Já no ar. `freebusy` consultado, compromisso
particular vira buraco na grade sem revelar o que é.

**4b Parte 2 — o desfazer (`#254`).** Decidido com o Matheus em 05/08:

- **prazo de cancelamento por link, não global.** O link de 1h pode aceitar até
  4h antes; o de 2h, até 24h. Um campo por link;
- **teto de remarcações configurável por link.** Também escolhido ao criar;
- **aviso duplo ao professor:** e-mail e notificação na plataforma;
- **acesso sem login**, pelo endereço da própria sessão no e-mail de
  confirmação. Cinco dos sete alunos não têm conta — exigir login travaria a
  maioria justo na hora de desmarcar;
- **remarcar escolhe o novo antes de soltar o velho**, para o aluno não ficar
  alguns segundos sem horário nenhum e perder o dele para outra pessoa.

O que **não** precisou mudar: a conta do pacote. `faltam = contratadas −
realizadas − agendadas` já ignora sessão cancelada, então a vaga volta sozinha.

**4b-bis — agendar por dentro (`#255`).** Pedido do Matheus no mesmo dia: um
botão **Agendar mentoria** no painel do aluno, que abre a mesma escolha de dia e
hora, sem pedir e-mail, porque quem está logado já foi identificado.

- **o pacote aponta o link.** O professor escolhe, ao criar o pacote da pessoa,
  qual link ela usa. Assim o pacote de 2h não abre a grade de 1h, e o aluno não
  escolhe formato nenhum;
- **o botão só funciona com saldo** (`faltam > 0`), e **sem saldo fica
  desabilitado explicando** — não some. Vale o mesmo para pacote sem link
  apontado e para link desativado: três recusas, três frases;
- **o aluno logado também cancela e remarca por ali**, com as regras da `#254`.

**Por que a 4b-bis vem depois da Parte 2, e não antes:** as regras de prazo e
teto nascem na Parte 2. Construir o caminho de dentro primeiro significaria
escrever a mesma regra em dois lugares — e no dia em que uma mudar, a outra
passa a mentir sem avisar. É o mesmo motivo pelo qual o Dashboard espera a
Fatia 3.

---

## Como saber que a 4a ficou pronta

- professor define segunda das 9h às 12h e cria dois links: um de 1h e um de 2h;
- o link de 2h **não** mostra 11h30, porque não caberia antes do meio-dia;
- com intervalo de 30 min, agendar às 9h faz o próximo livre ser 10h30 no link
  de 1h;
- **um e-mail que não está cadastrado é recusado com mensagem clara** — este é o
  teste que decide, porque é o que substitui a trava de abuso;
- um e-mail cadastrado agenda, e a sessão entra no pacote daquele aluno;
- o horário agendado some dos dois links, não só daquele que foi usado;
- o teto por dia barra o agendamento seguinte;
- desativar o link faz a página parar de aceitar, sem apagar o que já foi
  marcado;
- a sessão aparece na agenda do professor e no painel do aluno.
