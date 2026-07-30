-- Classroom etapa 4: o check-in por QR rotativo.
--
-- UMA tabela, e nenhum segredo no banco.
--
-- A primeira versao disto guardava um segredo por aula, do qual o codigo do QR
-- seria derivado. Estava errado por dois lados. Como coluna de
-- treinamento_aulas, o segredo VAZA: a policy aula_read entrega a linha inteira
-- a quem passa por posso_ver_treinamento, e o aluno tem token para bater na API
-- do Supabase direto -- um select e ele gera codigo valido de casa, para
-- sempre, em todas as aulas dele. E em tabela propria, o segredo so sobrevive
-- porque uma policy nova esta escrita certa, mais criacao preguicosa num
-- caminho de leitura, mais corrida entre duas abas do professor (a segunda
-- rotacionaria o segredo e mataria o QR projetado).
--
-- O codigo passa a ser derivado da chave de assinatura do app (a mesma que
-- assina o `state` do OAuth do Google, em src/lib/google.server.ts) sobre a
-- mensagem "aula + minuto". Zero tabela, zero escrita, zero corrida, e nada
-- secreto no banco para vazar por RLS errada.
--
-- O QUE ESTA TABELA GUARDA, e o que ela deliberadamente NAO guarda:
-- atraso, situacao calculada e frequencia NAO entram -- saem do horario da aula
-- na hora de mostrar. Guardar cada um criaria tres lugares para o mesmo fato
-- divergirem: mudar a hora da aula deixaria o atraso mentindo.

CREATE TABLE IF NOT EXISTS public.treinamento_presencas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id uuid NOT NULL REFERENCES public.treinamento_aulas(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  -- O grupo que autorizou o check-in, GRAVADO e nao derivado. Lista de presenca
  -- e documento que circula: se o grupo fosse calculado de group_members, um
  -- remanejamento de turma mudaria a lista de meses atras. Nulo no manual.
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  -- 'qr' = o aluno confirmou pelo codigo. 'manual' = o professor marcou.
  -- Sem esta coluna a lista mente por omissao: presenca anotada a mao fica
  -- identica a confirmada.
  origem text NOT NULL DEFAULT 'qr' CHECK (origem IN ('qr', 'manual')),
  -- A hora do SCAN, nao a do clique: entre um e outro o aluno pode passar pelo
  -- login. Quem escaneia as 19:00 e leva tres minutos para entrar chegou as
  -- 19:00 -- e o atraso e calculado daqui.
  escaneado_em timestamptz,
  -- A hora em que a linha nasceu. Fica como auditoria, nao como regua.
  registrado_em timestamptz NOT NULL DEFAULT now(),
  -- Quem marcou, quando foi manual.
  registrado_por uuid,
  observacao text,
  -- A situacao normal e CALCULADA do atraso. Preenchida aqui, ela vence o
  -- calculo -- e o que permite ao professor corrigir um caso a mao (etapa 5).
  situacao text CHECK (situacao IS NULL OR situacao IN ('presente', 'atrasado', 'ausente', 'justificado')),
  -- O passe usado. UNICO no banco porque e o que impede um scan de virar a
  -- turma inteira: com um celular emprestado daria para logar como A, confirmar,
  -- sair, logar como B... O passe vale por UMA presenca.
  passe_nonce text UNIQUE,
  -- Uma presenca por pessoa por aula. Tambem e a trava contra dois cliques
  -- simultaneos: a corrida termina em chave duplicada, nao em linha dobrada.
  UNIQUE (aula_id, person_id)
);

CREATE INDEX IF NOT EXISTS trein_pres_aula_idx ON public.treinamento_presencas (aula_id, registrado_em);
CREATE INDEX IF NOT EXISTS trein_pres_pessoa_idx ON public.treinamento_presencas (person_id);

/**
 * Quem pode CONDUZIR uma aula: abrir o check-in, ver a lista e marcar presenca.
 *
 * Nao e o mesmo que "ver o treinamento" (posso_ver_treinamento) nem
 * "e o dono da conta". Quem esta com o projetor na frente da turma
 * frequentemente e um mentor atribuido ao grupo, ou um colaborador da conta --
 * escrever `t.mentor_id = auth.uid()` faria a tela de check-in nascer morta
 * justamente para quem esta dando a aula.
 *
 * SECURITY DEFINER pela mesma razao de posso_ver_treinamento: depende de
 * team_members e group_members, que tem RLS propria.
 */
CREATE OR REPLACE FUNCTION public.posso_dar_aula(p_aula uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT EXISTS (
    -- A conta dona do treinamento. acting_account() cobre o dono e os
    -- colaboradores dele.
    SELECT 1
      FROM public.treinamento_aulas a
      JOIN public.treinamento_modulos m ON m.id = a.modulo_id
      JOIN public.treinamentos t ON t.id = m.treinamento_id
     WHERE a.id = p_aula AND t.mentor_id = public.acting_account()
  ) OR EXISTS (
    -- O mentor atribuido a um grupo do treinamento.
    SELECT 1
      FROM public.treinamento_aulas a
      JOIN public.treinamento_modulos m ON m.id = a.modulo_id
      JOIN public.treinamento_grupos tg ON tg.treinamento_id = m.treinamento_id
      JOIN public.team_member_groups tmg ON tmg.group_id = tg.group_id
      JOIN public.team_members tm ON tm.id = tmg.team_member_id
     WHERE a.id = p_aula
       AND tm.user_id = auth.uid() AND tm.status = 'ativo'
  );
$fn$;

GRANT EXECUTE ON FUNCTION public.posso_dar_aula(uuid) TO authenticated;

ALTER TABLE public.treinamento_presencas ENABLE ROW LEVEL SECURITY;

-- Quem da a aula ve a lista toda e marca presenca a mao.
DROP POLICY IF EXISTS pres_professor ON public.treinamento_presencas;
CREATE POLICY pres_professor ON public.treinamento_presencas FOR ALL TO authenticated
  USING (public.posso_dar_aula(aula_id))
  WITH CHECK (public.posso_dar_aula(aula_id));

-- O aluno ve a PROPRIA presenca -- e so ve.
--
-- Deliberadamente SO SELECT: se ele pudesse inserir, marcaria presenca sem QR
-- nenhum, porque a RLS nao tem como saber se o codigo foi lido. Quem grava o
-- check-in e o servidor, com service role, DEPOIS de validar codigo, janela,
-- passe e vinculo de grupo.
DROP POLICY IF EXISTS pres_minha ON public.treinamento_presencas;
CREATE POLICY pres_minha ON public.treinamento_presencas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.people p
     WHERE p.id = person_id AND p.user_id = auth.uid()));

-- O e-mail de presenca confirmada precisa de um `kind` valido, senao o registro
-- do envio falha calado e a tela de historico mente.
ALTER TABLE public.email_logs DROP CONSTRAINT IF EXISTS email_logs_kind_check;
ALTER TABLE public.email_logs ADD CONSTRAINT email_logs_kind_check
  CHECK (kind IN ('convite', 'lembrete', 'resultado', 'teste', 'presenca'));
