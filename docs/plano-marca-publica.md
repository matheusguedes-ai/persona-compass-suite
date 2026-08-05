# Marca nas telas públicas

Escrito em 05/08/2026 com o Matheus. Demandas `#261` e `#262`.

**O que ele pediu:** *"eu quero alterar no menu de configurações e ele já
refletir para todas as páginas e lugares que possuem a minha logo ou que
precisa ter."*

Isso não é uma tela — é um mecanismo. O plano abaixo separa as duas coisas.

---

## O problema que só existe nas telas públicas

Toda tela **depois do login** já sabe de quem é a marca: a pessoa está
autenticada, e `profiles` é consultado com o id dela. Funciona hoje.

As telas **antes do login** não sabem. Login, criar senha, check-in, página de
agendamento — todas abrem para quem a plataforma ainda não identificou. Elas
precisam descobrir a marca por outro caminho.

Hoje a tela de login resolve isso do pior jeito possível: **está tudo cravado no
código**. O quadradinho com "M", o nome "Métrica Humana", a frase sobre
assessment, o rodapé "Analytical Workspace" e o fundo `bg-zinc-900` são
literais em `src/routes/auth.tsx:130-141`.

---

## A decisão do Matheus: a marca vem do endereço

Escolhido em 05/08, entre três opções.

`assessment.metodointencao.com.br` mostra a marca dele. Quando existir um
segundo cliente, ele ganha o próprio endereço e a própria cara — **sem refazer
nada**. É o que Calendly e Notion fazem.

**Por que não "uma conta dona da instalação":** seria mais simples hoje e viraria
cirurgia no dia do segundo cliente, porque a tela passaria a ter de decidir algo
que hoje nem pergunta. É exatamente o tipo de dívida que a regra 2 existe para
evitar — e custa uma tabela com uma linha para não acontecer.

### `dominios_conta` — a tabela nova

| Campo | O que é |
|---|---|
| `dominio` | o host, sem protocolo (`assessment.metodointencao.com.br`) |
| `owner_id` | de quem é |
| `padrao` | qual conta responde quando o host não está na lista |

Hoje nasce com **uma linha**. É a preparação inteira.

**Fallback obrigatório:** host desconhecido (o preview do Lovable, um domínio
novo ainda sem cadastro) cai na conta marcada como `padrao`. Sem isso, o dia em
que o Lovable mudar a URL de preview a tela de login fica sem marca nenhuma — e
ninguém vai saber por quê.

---

## O que passa a ser editável

Em `profiles`, três campos novos:

| Campo | O que é | Hoje está cravado como |
|---|---|---|
| `login_imagem_url` | a imagem do painel lateral | não existe — é fundo cinza liso |
| `login_frase` | a frase grande | "Ferramentas de assessment que revelam o comportamento por trás de cada decisão." |
| `login_rodape` | a linha pequena embaixo | "Analytical Workspace" |

Os que **já existem** e só precisam ser usados: `logo_url`, `brand_color`,
`brand_accent_color`, `company_name`.

**Todos opcionais.** Sem imagem, o painel volta ao fundo sólido na cor da marca
— não fica quebrado nem mostra um vazio branco.

---

## ⚠️ O ponto que decide a segurança

O endpoint que serve a marca é **público, sem autenticação**. Ele não pode
devolver `profiles` inteiro.

`profiles` guarda `company_cnpj`, `support_email`, `email_from`, `site_url`,
`report_hidden_blocks`. Um endpoint aberto que devolva a linha toda entrega o
CNPJ da empresa e os e-mails internos para qualquer um que abra a tela de login.

**Devolver apenas:** `company_name`, `logo_url`, `brand_color`,
`brand_accent_color`, `login_imagem_url`, `login_frase`, `login_rodape`.
Lista fechada, nunca `select("*")`.

Este é o teste que decide a demanda: abrir o endpoint sem sessão e conferir,
campo a campo, que nada além dessa lista sai.

### O bucket `marca` é privado

A logo e a imagem lateral vivem num bucket privado — fechado de propósito na
`#111`, depois de terem nascido públicos. URL assinada tem prazo, e uma tela
pública não pode depender de link que expira.

**Já existe a solução no projeto:** `src/routes/api.icone.$tamanho.ts` resolve
exatamente isso para o ícone do app. Seguir o mesmo padrão — rota pública
dedicada que lê com service role e devolve os bytes — em vez de inventar outro.

---

## As duas fatias

### `#261` — o mecanismo, provado no login

Tabela de domínios, endpoint público de marca, componente compartilhado, os
três campos novos em Configurações, e a tela de login consumindo tudo.

**Uma tela só, de propósito.** É a que tem mais elementos cravados, então prova
o mecanismo inteiro. Se funcionar ali, funciona em qualquer uma.

### `#262` — espalhar para as demais

`/criar-senha`, `/aluno/criar-senha`, `/convite-equipe`, `/checkin`,
`/agendar/$slug`, `/sessao/$id`.

Depois que a `#261` existir, cada tela é trocar o texto cravado pelo componente.
Trabalho pequeno — e só é pequeno porque a `#261` veio antes.

**Encosta na `#108`** (selo da empresa no rodapé das públicas), que lista quase
as mesmas telas. Ao fazer a `#262`, resolver as duas juntas em vez de passar
duas vezes pelos mesmos arquivos.

**Encosta na `#248`** (Fatia 4c), que prevê foto e nome do professor na página
de agendamento. Se a `#262` vier antes, a 4c herda pronto.

---

## Como saber que a `#261` ficou pronta

- trocar a logo em Configurações e ela aparecer no login **sem republicar nada**;
- trocar a cor da marca e o login acompanhar;
- subir uma imagem lateral e ela aparecer; remover e o painel voltar ao fundo
  sólido, sem quebrar;
- editar a frase e o rodapé e os dois mudarem;
- **este é o teste que decide:** abrir o endereço da marca sem sessão nenhuma e
  conferir que CNPJ, e-mails e qualquer outro campo de `profiles` **não saem**;
- abrir o preview do Lovable (host que não está na tabela) e a marca padrão
  aparecer, em vez de tela sem identidade.
