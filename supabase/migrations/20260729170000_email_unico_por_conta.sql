-- Impede duas pessoas com o mesmo e-mail na mesma conta.
--
-- A Gabriela acabou cadastrada duas vezes com o mesmo endereço: uma com a
-- bateria concluída, outra com um envio novo. Consequências reais:
--
-- 1. `claim_student_profile()` casa por e-mail. No primeiro acesso dela, os
--    DOIS cadastros seriam ligados ao mesmo usuário, e o painel mostraria
--    tudo em dobro.
-- 2. A fila de devolutivas listaria a mesma pessoa duas vezes.
-- 3. O mentor não teria como saber qual dos dois é "a" Gabriela.
--
-- A importação por planilha já deduplicava; o cadastro manual e o envio, não.
-- Resolver caso a caso não adianta — a regra tem de estar no banco, que é o
-- único lugar por onde todos os caminhos passam.
--
-- Índice em minúsculas: "Maria@x.com" e "maria@x.com" são o mesmo e-mail para
-- qualquer servidor de correio, e precisam ser o mesmo aqui.
--
-- Por conta (`mentor_id`), não global: dois mentores diferentes podem
-- legitimamente ter a mesma pessoa cadastrada, cada um com o seu histórico.

CREATE UNIQUE INDEX IF NOT EXISTS people_email_unico_por_conta
  ON public.people (mentor_id, lower(email))
  WHERE email IS NOT NULL AND email <> '';
