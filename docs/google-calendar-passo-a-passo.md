# Google Calendar — o que você precisa fazer

Etapa 4 do menu Gestão. É a única parte que eu não consigo fazer sozinho: mexer
no Google Cloud exige a sua conta e a sua senha.

Decisões já tomadas: **mão única** (o que é marcado na plataforma vai para o
Google, nada volta) e **só você conecta**, por enquanto.

---

## Antes de começar, o que esperar

Você já tem um projeto no Google Cloud — é o que faz o "Entrar com Google"
funcionar. **Vamos usar o mesmo projeto**, só acrescentando uma permissão.

Duas coisas que costumam assustar e são normais:

- A tela do Google Cloud muda de nome e de lugar com frequência. Se um botão
  estiver com outro nome, procure pelo sentido, não pela palavra exata.
- Vai aparecer aviso de "escopo sensível" e de "app não verificado". Enquanto
  o app estiver em modo de **teste** e só você usar, isso é esperado e não
  impede nada.

---

## Passo 1 — Ligar a API do Calendar

1. Abra <https://console.cloud.google.com>
2. No topo, confira se o projeto selecionado é **o mesmo do login** (o nome
   aparece na barra de cima; se tiver mais de um, é o que você criou quando
   configuramos o "Entrar com Google").
3. No menu lateral, vá em **APIs e serviços → Biblioteca**.
4. Pesquise por **Google Calendar API**.
5. Clique nela e depois em **Ativar**.

Pronto quando: a página passa a mostrar "API ativada" ou um botão **Gerenciar**
no lugar de Ativar.

---

## Passo 2 — Pedir a permissão de calendário

1. Ainda em **APIs e serviços**, vá em **Tela de permissão OAuth**
   (em versões novas pode estar como **Acesso a dados**).
2. Procure a lista de **escopos** (às vezes dentro de "Editar app" → "Escopos").
3. Clique em **Adicionar ou remover escopos**.
4. Na caixa de filtro, cole:

   ```
   https://www.googleapis.com/auth/calendar.app.created
   ```

5. Marque a caixa dele e clique em **Atualizar** e depois em **Salvar**.

**Por que esse e não outro:** esse escopo deixa a plataforma criar um calendário
próprio e mexer **só nos eventos que ela mesma criou**. Ela não lê nem apaga
nada do seu calendário pessoal. É o mais estreito que serve para o que você
pediu — e quanto mais estreito, menos exigência o Google faz.

⚠️ Se por algum motivo esse escopo não aparecer na busca, me avise antes de
escolher outro. O parecido (`calendar.events`) dá acesso a **todos** os seus
eventos, e eu prefiro não pedir isso sem você saber.

---

## Passo 3 — Colocar você como usuário de teste

1. Na mesma tela de permissão OAuth, procure **Público-alvo** ou
   **Usuários de teste**.
2. Se o app estiver como **Em produção**, mude para **Teste**.
3. Clique em **Adicionar usuários** e ponha
   `matheusguedes@metodointencao.com.br`.

Enquanto estiver em Teste, **só os e-mails dessa lista** conseguem conectar o
calendário. É de propósito: evita a verificação do Google agora.

---

## Passo 4 — Autorizar o endereço de retorno

1. Vá em **APIs e serviços → Credenciais**.
2. Clique no **ID do cliente OAuth** que já existe (o do login).
3. Em **URIs de redirecionamento autorizados**, clique em **Adicionar URI** e
   cole:

   ```
   https://persona-compass-suite.lovable.app/api/google/callback
   ```

4. **Salvar**.

Esse é o endereço para onde o Google devolve você depois de autorizar. Sem ele,
o Google recusa a conexão com erro de "redirect_uri_mismatch".

---

## Passo 5 — Guardar a chave (você faz, eu não vejo)

Nesta mesma tela de Credenciais aparecem o **ID do cliente** e a **Chave secreta
do cliente**.

**Não me mande esses valores por mensagem.** Eu vou deixar a plataforma
preparada para lê-los de duas variáveis, e você mesmo cola os valores no painel
de segredos:

| Nome da variável | O que colar |
|---|---|
| `GOOGLE_CLIENT_ID` | o ID do cliente |
| `GOOGLE_CLIENT_SECRET` | a chave secreta do cliente |

É o mesmo caminho que usamos com a chave do Resend. Assim os valores ficam só
com você e com o servidor — não passam por mim nem ficam no histórico da
conversa.

---

## Quando você terminar

Me avise. Aí eu construo:

- o botão **"Conectar meu Google Calendar"** nas Configurações;
- o envio automático: agendou uma devolutiva ou criou um evento → aparece no seu
  Google Calendar;
- remarcou ou cancelou → atualiza lá também;
- e a garantia de que, se o Google cair ou você desconectar, **a agenda de dentro
  da plataforma continua funcionando** — ela nunca depende do Google estar ligado.

---

## Se der errado

- **"App não verificado"** → normal em modo Teste. Clique em "Avançado" e
  "Acessar (não seguro)". Só vale para os e-mails da lista de teste.
- **"redirect_uri_mismatch"** → o endereço do Passo 4 está diferente. Tem que
  ser idêntico, inclusive o `https://` e sem barra no final.
- **"acesso bloqueado"** → seu e-mail não está na lista de usuários de teste
  (Passo 3).
- **Nada acontece ao conectar** → me chame; provavelmente é a API do Passo 1 que
  não ficou ativada.

---

## Depois, quando abrir para alunos e mentores

Você pediu para não esquecer disso, e não vou esquecer. Só que aí muda uma
coisa importante: para qualquer pessoa conectar, o app precisa sair do modo
Teste — e aí o Google **exige verificação**, que leva dias e pede um vídeo
mostrando como o app usa o calendário.

Por isso começamos só com você: dá para ter a coisa funcionando e decidir depois
se o trabalho da verificação vale a pena.
