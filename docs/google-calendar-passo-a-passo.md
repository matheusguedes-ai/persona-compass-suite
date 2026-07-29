# Google Calendar — passo a passo, com as telas que você realmente tem

Escrito depois de abrir o seu Google Cloud e olhar cada tela. A primeira versão
deste documento estava errada: descrevi de memória e o Google reorganizou essa
área inteira. O que vale é o que está aqui.

**Seu projeto:** `metrica-humana` · **Seu cliente OAuth:** "Cliente Web 1"

---

## O que mudou em relação ao que eu tinha dito

| Eu disse | Na verdade |
|---|---|
| "APIs e serviços → Tela de permissão OAuth" | Agora é uma seção separada, **Google Auth Platform** |
| "Adicione você como usuário de teste" | **Não existe** no seu caso — seu app é **Interno** |
| "Vai precisar de verificação do Google" | **Não precisa**, enquanto for Interno |

**Por que:** seu app está configurado como **Interno**, ou seja, só funciona para
contas do seu Google Workspace (`@metodointencao.com.br`). App interno **não
passa por verificação** e não tem lista de usuários de teste. Isso simplifica
tudo agora — e é a razão de a etapa 4 ter deixado de ser a arriscada.

⚠️ **A consequência aparece depois:** aluno com Gmail pessoal **não vai
conseguir** conectar o calendário enquanto o app for Interno. Quando você quiser
abrir para alunos e mentores, aí sim será preciso torná-lo Externo e passar pela
verificação. Fica anotado.

---

## Passo 1 — Ativar a API do Calendar

**Abra direto este endereço** (já vai no projeto certo):

```
https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=metrica-humana
```

Você vai ver o título **Google Calendar API** com o ícone azul do calendário, o
número 31.

Logo abaixo da descrição há dois botões: **Ativar** (azul, à esquerda) e
**Testar esta API**.

👉 Clique em **Ativar**. Espere alguns segundos.

**Deu certo quando:** o botão "Ativar" some e a página passa a mostrar
**Gerenciar** no lugar dele.

---

## Passo 2 — Adicionar a permissão de calendário

**Abra direto:**

```
https://console.cloud.google.com/auth/scopes?project=metrica-humana
```

O título da página é **Acesso a dados**. Você verá um botão
**Adicionar ou remover escopos**.

👉 Clique nele. Abre um painel do lado direito.

Nesse painel há uma caixa escrita **Digite o nome, a descrição ou o código do
escopo** (ou "Filtrar"). Cole exatamente isto:

```
calendar.app.created
```

Vai aparecer uma linha com a API **Google Calendar API**. 👉 Marque a caixinha
dessa linha.

Desça até o fim do painel e clique em **Atualizar**.

De volta à página "Acesso a dados", desça e clique em **Salvar**.

**Deu certo quando:** o escopo aparece listado na página, numa das tabelas
(provavelmente em "Seus escopos confidenciais").

> **Por que esse escopo e não outro:** `calendar.app.created` deixa a plataforma
> criar um calendário próprio e mexer **só nos eventos que ela mesma criou**.
> Ela não lê, não edita e não apaga nada do seu calendário pessoal. Existe um
> parecido, `calendar.events`, que dá acesso a **todos** os seus compromissos —
> e eu não quero pedir isso.

---

## Passo 3 — Autorizar o endereço de retorno

**Abra direto:**

```
https://console.cloud.google.com/auth/clients?project=metrica-humana
```

O título é **Clientes**. Há uma tabela **IDs do cliente OAuth 2.0** com uma
linha só: **Cliente Web 1**, do tipo "Aplicativo da Web".

👉 Clique no nome **Cliente Web 1** (é um link azul).

Na página que abre, desça até a seção **URIs de redirecionamento autorizados**.
Já deve haver um endereço lá (o do login). 👉 Clique em **+ Adicionar URI** e
cole:

```
https://persona-compass-suite.lovable.app/api/google/callback
```

👉 Clique em **Salvar**, no fim da página.

**Deu certo quando:** o novo endereço aparece na lista junto com o que já
existia. **Não apague o que já estava lá** — é o que faz o login funcionar.

---

## Passo 4 — As chaves (você guarda, eu não vejo)

Na mesma página do **Cliente Web 1**, do lado direito, aparecem:

- **ID do cliente** — algo como `370969471029-10h0...apps.googleusercontent.com`
- **Chave secreta do cliente** — precisa clicar num olho ou em "mostrar"

**Não me mande esses valores por mensagem.** Eu deixo a plataforma preparada
para lê-los de duas variáveis, e **você mesmo cola** os valores no painel de
segredos, como fizemos com a chave do Resend:

| Nome da variável | O que colar |
|---|---|
| `GOOGLE_CLIENT_ID` | o ID do cliente |
| `GOOGLE_CLIENT_SECRET` | a chave secreta |

Assim os valores ficam só com você e com o servidor — não passam por mim nem
ficam guardados no histórico desta conversa.

---

## Se travar

- **Não acho o projeto certo** → confira o nome na barra de cima; tem que estar
  escrito **Metrica Humana**. Se estiver outro, clique nele e troque.
- **"redirect_uri_mismatch"** quando for conectar → o endereço do Passo 3 está
  diferente. Tem que ser idêntico: `https://`, sem barra no final.
- **O escopo não aparece na busca** → confira se o Passo 1 foi concluído. O
  Google só oferece os escopos de APIs já ativadas.
- **Qualquer outra coisa** → me manda um print da tela que eu te digo onde
  clicar.

---

## Quando terminar, me avise

Aí eu construo o botão "Conectar meu Google Calendar" nas Configurações, o envio
automático (agendou → aparece no Google; remarcou → atualiza lá) e a garantia de
que, se o Google cair ou você desconectar, a agenda de dentro da plataforma
continua funcionando igual. Ela nunca depende do Google estar ligado.
