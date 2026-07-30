-- Classroom etapa 5: o que faltava para a lista de presenca nao mentir.
--
-- Nenhuma coluna aqui guarda calculo. Atraso, situacao e frequencia continuam
-- saindo do horario da aula e dos check-ins, como decidido. O que entra sao
-- FATOS que ninguem tem como derivar:
--
-- 1. A lista foi FECHADA? Sem isso, "ninguem escaneou" e "a turma toda faltou"
--    sao a mesma coisa no banco -- e o segundo e uma afirmacao que nega
--    reembolso, feita pelo silencio de quem nunca abriu a tela. Enquanto a lista
--    esta aberta, quem nao tem registro fica "sem registro", nao "ausente", e a
--    aula nao entra no denominador da frequencia.
--
-- 2. A aula foi CANCELADA? Aula cancelada sai da conta dos dois lados. Sem a
--    coluna, ela viraria falta para a turma inteira.
--
-- 3. O NOME do grupo e de quem marcou, em texto, no momento do registro.
--    Guardar so o id parece mais limpo e nao e: renomear "Turma A" reescreve o
--    historico de listas antigas, apagar o grupo esvazia a celula
--    (ON DELETE SET NULL), e colaborador desativado apaga o rastro justamente na
--    linha mais contestavel. Lista de presenca e documento de arquivo: o que
--    estava escrito nela precisa continuar escrito.

ALTER TABLE public.treinamento_aulas
  ADD COLUMN IF NOT EXISTS fechada_em timestamptz,
  ADD COLUMN IF NOT EXISTS fechada_por uuid,
  ADD COLUMN IF NOT EXISTS cancelada boolean NOT NULL DEFAULT false;

ALTER TABLE public.treinamento_presencas
  ADD COLUMN IF NOT EXISTS group_nome text,
  ADD COLUMN IF NOT EXISTS marcado_por_nome text;

-- Preenche o nome do grupo do que ja existe, para as linhas antigas nao nascerem
-- com a celula vazia.
UPDATE public.treinamento_presencas p
   SET group_nome = g.name
  FROM public.groups g
 WHERE p.group_id = g.id AND p.group_nome IS NULL;
