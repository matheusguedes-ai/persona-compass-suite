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
