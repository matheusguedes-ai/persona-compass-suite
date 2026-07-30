# Autenticação de e-mail — SPF, DKIM e DMARC

Conferido em **30/07/2026** consultando o DNS ao vivo (`dig`), não a memória de
quem configurou. Este arquivo existe porque o item estava marcado como feito e
não havia nada no repositório que provasse — zona DNS é configuração externa, e
sem registro aqui ninguém consegue dizer o que está no ar sem ir olhar.

Domínio: **metodointencao.com.br** · Zona no **Registro.br** · Envio pelo
**Resend**.

## O que está publicado hoje

| Registro | Nome | Valor |
|---|---|---|
| SPF (raiz) | `metodointencao.com.br` | `v=spf1 include:_spf.google.com ~all` |
| SPF (envio) | `send.metodointencao.com.br` | `v=spf1 include:amazonses.com ~all` |
| DKIM | `resend._domainkey.metodointencao.com.br` | chave RSA pública do Resend (`p=MIGfMA0…`) |
| DMARC | `_dmarc.metodointencao.com.br` | `v=DMARC1; p=none; rua=mailto:matheusguedes@metodointencao.com.br` |
| MX | `metodointencao.com.br` | `1 smtp.google.com.` |

De onde a plataforma envia: `Métrica Humana <contato@metodointencao.com.br>`,
gravado em `profiles.email_from` e editável na tela de Configurações
(`remetente()` em `src/lib/email.server.ts`).

## Por que isso passa, apesar de o SPF da raiz não citar o Resend

À primeira vista parece quebrado: o SPF da raiz autoriza só o Google, e o e-mail
sai de `@metodointencao.com.br` pelo Resend. Não está quebrado, e vale escrever
por quê — para ninguém "consertar" isto depois e derrubar o envio.

- **SPF autentica o envelope**, não o cabeçalho `From:`. O Resend usa
  `send.metodointencao.com.br` como Return-Path, e é o SPF *desse* nome que
  conta — o de amazonses. Ele confere.
- **Para o DMARC, o que importa é o alinhamento.** `send.metodointencao.com.br`
  é subdomínio de `metodointencao.com.br`, e o alinhamento relaxado (o padrão)
  aceita subdomínio. Alinha.
- **DKIM assina na raiz.** A chave está em
  `resend._domainkey.metodointencao.com.br`, o mesmo domínio do `From:`.
  Alinhamento direto, sem depender de SPF.

O SPF do Google na raiz continua necessário: é o que autentica o e-mail humano,
enviado pelo Workspace (o MX aponta para o Google).

## O que NÃO está protegido

**`p=none` não protege nada.** A política atual pede aos servidores que
*relatem* falhas e não que façam nada com elas. Na prática, hoje, qualquer um
consegue mandar e-mail se passando por `@metodointencao.com.br` e a mensagem cai
na caixa de entrada normalmente. Para uma plataforma que manda link de teste e
link de primeiro acesso, isso é exatamente o tipo de e-mail que compensa
falsificar.

`p=none` é o começo certo — serve para observar antes de endurecer. Mas é um
degrau, não um destino, e já está publicado há tempo suficiente.

O caminho, quando o Matheus quiser dar o passo (**é mudança de DNS no domínio
dele, e por isso não fiz por conta própria** — errar aqui derruba o envio de
verdade):

1. `p=quarantine; pct=10` por uma ou duas semanas. Se nada quebrar, sobe o `pct`.
2. `p=quarantine; pct=100`.
3. `p=reject`, quando não houver mais surpresa.

O `rua=` aponta para uma caixa pessoal, e os relatórios chegam como XML
compactado — ilegível na prática. Um serviço de leitura de DMARC (há gratuitos)
transforma isso em algo que dá para acompanhar antes de endurecer a política.

## A armadilha do Registro.br

O painel do Registro.br **escapa aspas** ao salvar TXT. Registro longo colado
COM aspas vira `\"v=spf1...\"` e para de valer sem avisar. Cole **sem aspas**.

## Como conferir de novo

```bash
dig +short TXT metodointencao.com.br
dig +short TXT _dmarc.metodointencao.com.br
dig +short TXT resend._domainkey.metodointencao.com.br
dig +short TXT send.metodointencao.com.br
```
