
## Objetivo
Resolver o bloqueio no cadastro (email de confirmação não chega) e permitir que o mentor entre/cadastre com Google na página `/auth`.

## Mudanças

### 1. Backend — Auth
- Chamar `supabase--configure_auth` com `auto_confirm_email: true` para que novas contas fiquem ativas imediatamente após o cadastro (sem depender de email).
- Chamar `supabase--configure_social_auth` com `providers: ["google"]` para ativar o Google OAuth gerenciado pela Lovable Cloud (sem necessidade de credenciais próprias).

### 2. Frontend — `src/routes/auth.tsx`
- Após `signUp` bem-sucedido, fazer login automático (a sessão já vem ativa com auto-confirm) e redirecionar para `next` em vez de mostrar a mensagem "verifique seu email".
- Adicionar botão **"Continuar com Google"** acima do formulário de email/senha, separado por um divisor sutil, usando `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })` de `@/integrations/lovable`.
  - Guardar o `next` sanitizado em `sessionStorage` antes de iniciar o OAuth; após retornar, ler e navegar para o destino salvo apenas depois que a sessão estiver hidratada.
  - `redirect_uri` fica na origem pública (não em rota protegida), conforme a regra da Lovable Cloud.
- Manter o formulário atual de email/senha e o parâmetro `next` para o fluxo OAuth/consent.

### 3. Observação para o usuário
Como o Google já valida o email da conta e o auto-confirm cobre o cadastro por senha, nenhum email de confirmação precisa chegar agora. Quando quiser voltar a exigir confirmação com sua marca, configuramos um domínio próprio de email.

## Detalhes técnicos
- `auto_confirm_email` é uma configuração de projeto no Supabase Auth — não requer migração.
- O provedor Google gerenciado da Lovable Cloud não precisa de client ID/secret próprios; funciona out-of-the-box no preview e em produção.
- O botão do Google chama diretamente `lovable.auth.signInWithOAuth` (o helper cuida do fluxo `web_message` dentro do iframe do preview).
