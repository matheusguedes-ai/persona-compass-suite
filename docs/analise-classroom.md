# Classroom — o que é possível, e onde o desenho quebra

Análise do pedido do Matheus (29/07/2026). Nada construído ainda.

**Resumo:** 9 das 12 partes saem exatamente como pedidas. Três precisam de
decisão dele antes, e uma delas é o que faz o controle de presença valer ou não
valer nada.

---

## Sai exatamente como pedido

| Parte | Observação |
|---|---|
| Botão "Novo treinamento", módulos e aulas | Mesma estrutura da Academy |
| Materiais por aula (slides, roteiros, documentos) | Já existe upload; só apontar para cá |
| Anotações e descrição da aula | Campo de texto |
| Escolher manualmente os grupos com acesso | Mesma mecânica dos eventos |
| Gerar QR ao clicar em "Check-in" | Trivial |
| Câmera nativa do celular abre o link | Funciona em qualquer aparelho |
| Pop-up com botão de confirmar presença | — |
| E-mail de boas-vindas ao confirmar | Resend já está ligado e enviando |
| Tabela de quem confirmou e quem não | — |
| Aula com ✅ verde no painel do aluno | — |
| Pontos no check-in somando ao ranking | `darPonto` já existe; é só uma ação nova |

---

## ⚠️ 1. O QR code, como descrito, não impede fraude

**O problema:** um QR fixo na tela é uma imagem. O primeiro aluno fotografa e
manda no grupo do WhatsApp. Quem está em casa abre, faz login, confirma
presença. **O controle vira teatro** — e pior que não ter controle é ter um que
todos sabem que dá para burlar.

Isso não é hipótese: é o que acontece em toda faculdade que tenta lista de
presença por código.

**A correção é barata e conhecida:** o QR **muda a cada 20 ou 30 segundos**, como
o do WhatsApp Web. Quem não está olhando a tela na hora não consegue usar — a
foto vence antes de chegar ao grupo.

Somando mais duas travas simples:
- **Janela de validade**: só funciona entre o início e o fim da aula.
- **Só quem tem acesso**: aluno de grupo que não recebeu o treinamento é
  recusado, mesmo com o QR correto.

**Isso muda o trabalho?** Pouco — a tela do professor passa a recarregar o QR
sozinha. Vale muito a pena.

---

## ⚠️ 2. O aluno que nunca criou senha trava na porta

**O problema:** hoje o primeiro acesso do aluno exige um link enviado por
e-mail. Se ele nunca fez isso, no meio da aula ele escaneia, cai na tela de
login e **não consegue entrar** — não tem senha. O professor fica com um aluno
presente e sem como registrar.

Em turma de 20, sempre haverá dois ou três nessa situação.

**Três saídas, e eu recomendo a terceira:**
1. Avisar antes que todos precisam ter login pronto — depende de disciplina.
2. Deixar confirmar só com o e-mail, sem senha — abre a porta que fechamos: quem
   souber o e-mail marca presença por outro.
3. **O professor marca presença manualmente**, pela tabela. Resolve este caso e
   todos os outros (celular sem bateria, sem internet, aluno sem smartphone).

A opção 3 é necessária de qualquer jeito. Ver o item 3 abaixo.

---

## ⚠️ 3. O leitor de QR dentro do app é o pedaço mais frágil — e talvez desnecessário

**O problema:** ler QR pela câmera *dentro* do navegador precisa de uma
funcionalidade que **o Safari do iPhone não tem**. Daria para contornar com uma
biblioteca extra, mas ela é pesada e o resultado é pior que a câmera nativa.

**E aqui está o ponto:** no seu próprio fluxo, o aluno já escaneia com a
**câmera do celular**, que funciona em todos os aparelhos. O botão "fazer
check-in" dentro do app faria a mesma coisa, pior.

**Sugestão:** o botão existe, mas em vez de abrir um leitor, ele abre a câmera
do próprio telefone. Um toque a menos de risco e zero peso a mais.

---

## O que eu acrescentaria na tabela de presença

Você perguntou. Além de nome, grupo, data e hora:

**Essencial:**
- **Como foi registrada** — QR pelo aluno ou marcada pelo professor. Sem isso,
  a tabela mente por omissão: uma presença anotada à mão parece igual a uma
  confirmada.
- **Quem marcou**, quando foi manual.
- **Marcar presença manualmente** — não é coluna, é botão, e sem ele o primeiro
  celular descarregado deixa o professor sem saída.

**Muito útil:**
- **Atraso** — diferença entre a hora do check-in e a hora de início da aula.
  Numa turma corporativa, isso costuma valer mais que a presença em si.
- **Frequência acumulada** no treinamento (ex.: "4 de 6 aulas"). É o número que
  responde à pergunta que o RH sempre faz.

**Se fizer sentido para você:**
- Observação do professor por aluno ("saiu mais cedo").
- Exportar a lista — você já tem exportação em Pessoas; o mesmo caminho serve.

---

## Uma decisão de estrutura que muda o tamanho da obra

O Classroom é **quase igual** à Academy: trilha → módulo → aula → material.

**Duas saídas:**

**A. Reaproveitar as tabelas da Academy**, com uma marca dizendo se é presencial
ou online. Metade do trabalho, e as duas telas evoluem juntas.
⚠️ Risco: toda consulta da Academy passa a precisar filtrar o presencial. Um
esquecimento e o aluno vê o curso presencial na lista de trilhas online.

**B. Estrutura própria.** Mais trabalho agora, nenhuma chance de vazamento entre
os dois mundos, e liberdade para o Classroom crescer no seu ritmo (check-in não
tem paralelo na Academy).

**Recomendo a B.** O check-in já é uma diferença grande, e a experiência do
projeto mostra que reaproveitar tabela "parecida" cobra depois — foi o mesmo
raciocínio que me fez criar tabela própria para a biblioteca.

---

## O que eu preciso de você

1. **QR rotativo** (recomendo) ou QR fixo, aceitando o risco de fraude?
2. **Presença manual pelo professor** — confirma que entra? (recomendo muito)
3. **Botão de check-in do aluno**: abre a câmera do telefone (recomendo) ou
   insisto num leitor dentro do app?
4. **Estrutura própria** (recomendo) ou reaproveitar a da Academy?
5. Das sugestões de tabela, quais você quer?

Com essas respostas eu escrevo o plano por etapas, como fizemos com o Gestão.

---

# Decisões do Matheus — 29/07/2026

1. **QR rotativo**, com **janela de validade escolhida por ele** (data e hora de
   início e fim da aula). São duas travas somadas: o código muda sozinho E só
   funciona dentro do horário.
2. **Presença manual pelo professor: entra.**
3. Botão do aluno: **abre a câmera do telefone** (foi o recomendado — o Safari
   do iPhone não tem leitor nativo no navegador).
4. **Estrutura própria**, separada da Academy.
5. Colunas da tabela: ver a lista abaixo.
6. Aluno sem senha **cria pelo primeiro acesso com validação por e-mail** — a
   estrutura já existe. A presença manual cobre o imprevisto do dia.

## A tabela de presença — definitiva

Ele aprovou TODAS as sugestões, inclusive as que eu tinha marcado como
opcionais. A tabela leva:

| Coluna | Origem | Por que existe |
|---|---|---|
| **Aluno** | cadastro | Com link para o perfil |
| **Grupo** | `group_members` | Se estiver em vários, o do treinamento |
| **Data e hora** | do check-in | — |
| **Como foi registrada** | QR · manual | Sem isso a tabela mente por omissão: presença anotada à mão fica idêntica a confirmada |
| **Atraso** | calculado | Minutos depois do início da aula |
| **Situação** | presente · atrasado · ausente · justificado | Derivada do atraso, ajustável à mão |
| **Frequência acumulada** | calculada | "4 de 6 aulas" — o número que o RH pergunta |
| **Observação** | do professor | "saiu mais cedo" |
| **Quem marcou** | quando manual | Vale quando houver colaborador com acesso |

**Calculadas, não guardadas:** atraso, situação e frequência saem do horário da
aula e dos check-ins. Guardar cada uma criaria três lugares para o mesmo fato
divergirem — mudar a hora da aula deixaria o atraso mentindo.

**Deliberadamente FORA:** resultado de teste e perfil comportamental. Lista de
presença é documento que circula — vai para o RH, para o cliente, para o
arquivo. Perfil não pode circular junto.

---

# Plano por etapas

| # | Etapa | Peso | Depende |
|---|---|---|---|
| 1 | Estrutura: treinamento → módulo → aula, com materiais e grupos | médio | — |
| 2 | Menu Classroom do master, com o CRUD | médio | 1 |
| 3 | Menu Classroom do aluno (trilha liberada por grupo) | leve | 1, 2 |
| 4 | Check-in: QR rotativo + janela + confirmação + e-mail | **pesado** | 1–3 |
| 5 | Tabela de presença, com marcação manual | médio | 4 |
| 6 | ✅ verde nas aulas e pontos no ranking | leve | 4 |

**A etapa 4 é o coração e a mais delicada.** Ela tem três partes que falham de
formas diferentes:

- **O QR rotativo** exige a tela do professor renovando o código sozinha e o
  servidor aceitando só o código da vez. Um código antigo tem de ser recusado
  mesmo que a janela ainda esteja aberta.
- **A volta do login** precisa devolver o aluno ao check-in certo. Quem faz
  primeiro acesso passa por e-mail e volta noutra aba — o destino tem de
  sobreviver a isso, senão ele loga e cai no painel, sem entender.
- **O e-mail de confirmação** não pode derrubar o check-in se o Resend falhar. A
  presença fica registrada de qualquer forma; o e-mail é aviso, não prova.

**Sugestão de ordem de entrega:** 1 → 2 → 3 entregam o Classroom utilizável
(estrutura de treinamento visível para o aluno) mesmo sem check-in. Depois 4 → 5
→ 6. Assim, se a etapa 4 demorar, o que já existe funciona.
