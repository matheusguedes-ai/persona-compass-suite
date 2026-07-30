-- Classroom: treinamentos presenciais. Etapa 1 de docs/analise-classroom.md.
--
-- ESTRUTURA PROPRIA, e nao reaproveitando as tabelas da Academy. Decisao dele,
-- e a certa: o check-in nao tem paralelo na Academy, e "marcar se e presencial"
-- numa coluna obrigaria toda consulta da Academy a lembrar de filtrar. Um
-- esquecimento e o aluno ve o curso presencial na lista de trilhas online.

CREATE TABLE IF NOT EXISTS public.treinamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL,
  titulo text NOT NULL,
  descricao text,
  capa_url text,
  publicado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.treinamento_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treinamento_id uuid NOT NULL REFERENCES public.treinamentos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  ordem integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.treinamento_aulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id uuid NOT NULL REFERENCES public.treinamento_modulos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  -- Anotacoes do professor. Separadas da descricao de proposito: descricao o
  -- aluno le, anotacao e roteiro de quem da a aula.
  anotacoes text,
  -- Janela da aula presencial. E o que o check-in usa para validar horario e
  -- para calcular atraso.
  comeca_em timestamptz,
  termina_em timestamptz,
  local text,
  ordem integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.treinamento_materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id uuid NOT NULL REFERENCES public.treinamento_aulas(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  url text NOT NULL,
  kind text NOT NULL DEFAULT 'link'
    CHECK (kind IN ('link', 'pdf', 'slide', 'roteiro', 'planilha', 'video', 'audio', 'outro')),
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Quem tem acesso. Selecao MANUAL de grupos, porque e presencial: nao ha como
-- inferir quem esta na sala.
CREATE TABLE IF NOT EXISTS public.treinamento_grupos (
  treinamento_id uuid NOT NULL REFERENCES public.treinamentos(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  PRIMARY KEY (treinamento_id, group_id)
);

CREATE INDEX IF NOT EXISTS trein_conta_idx ON public.treinamentos (mentor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trein_mod_idx ON public.treinamento_modulos (treinamento_id, ordem);
CREATE INDEX IF NOT EXISTS trein_aula_idx ON public.treinamento_aulas (modulo_id, ordem);
CREATE INDEX IF NOT EXISTS trein_mat_idx ON public.treinamento_materiais (aula_id, ordem);


/**
 * Quem enxerga um treinamento.
 *
 * SECURITY DEFINER: a resposta depende de people e group_members, que tem RLS
 * propria. Sem isso o resultado mudaria conforme o papel de quem pergunta em vez
 * de conforme o acesso do treinamento.
 */
CREATE OR REPLACE FUNCTION public.posso_ver_treinamento(p_trein uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT EXISTS (
    -- O dono da conta ve os proprios, publicados ou nao.
    SELECT 1 FROM public.treinamentos t
     WHERE t.id = p_trein AND t.mentor_id = auth.uid()
  ) OR EXISTS (
    -- O aluno ve so o que foi PUBLICADO para um grupo dele. Rascunho e do
    -- professor: aparecer antes da hora estraga a surpresa e mostra material
    -- incompleto.
    SELECT 1
      FROM public.treinamentos t
      JOIN public.treinamento_grupos tg ON tg.treinamento_id = t.id
      JOIN public.group_members gm ON gm.group_id = tg.group_id
      JOIN public.people p ON p.id = gm.person_id
     WHERE t.id = p_trein AND t.publicado AND p.user_id = auth.uid()
  ) OR EXISTS (
    -- O mentor atribuido a um grupo do treinamento tambem ve.
    SELECT 1
      FROM public.treinamento_grupos tg
      JOIN public.team_member_groups tmg ON tmg.group_id = tg.group_id
      JOIN public.team_members tm ON tm.id = tmg.team_member_id
     WHERE tg.treinamento_id = p_trein
       AND tm.user_id = auth.uid() AND tm.status = 'ativo'
  );
$fn$;

GRANT EXECUTE ON FUNCTION public.posso_ver_treinamento(uuid) TO authenticated;

ALTER TABLE public.treinamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treinamento_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treinamento_aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treinamento_materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treinamento_grupos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trein_read ON public.treinamentos;
CREATE POLICY trein_read ON public.treinamentos FOR SELECT TO authenticated
  USING (public.posso_ver_treinamento(id));

DROP POLICY IF EXISTS trein_write ON public.treinamentos;
CREATE POLICY trein_write ON public.treinamentos FOR ALL TO authenticated
  USING (mentor_id = auth.uid()) WITH CHECK (mentor_id = auth.uid());

-- Modulo, aula, material e grupo seguem o treinamento. Uma regra so, herdada.
DROP POLICY IF EXISTS mod_read ON public.treinamento_modulos;
CREATE POLICY mod_read ON public.treinamento_modulos FOR SELECT TO authenticated
  USING (public.posso_ver_treinamento(treinamento_id));
DROP POLICY IF EXISTS mod_write ON public.treinamento_modulos;
CREATE POLICY mod_write ON public.treinamento_modulos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.treinamentos t
                  WHERE t.id = treinamento_id AND t.mentor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.treinamentos t
                       WHERE t.id = treinamento_id AND t.mentor_id = auth.uid()));

DROP POLICY IF EXISTS aula_read ON public.treinamento_aulas;
CREATE POLICY aula_read ON public.treinamento_aulas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.treinamento_modulos m
                  WHERE m.id = modulo_id AND public.posso_ver_treinamento(m.treinamento_id)));
DROP POLICY IF EXISTS aula_write ON public.treinamento_aulas;
CREATE POLICY aula_write ON public.treinamento_aulas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.treinamento_modulos m
                  JOIN public.treinamentos t ON t.id = m.treinamento_id
                 WHERE m.id = modulo_id AND t.mentor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.treinamento_modulos m
                       JOIN public.treinamentos t ON t.id = m.treinamento_id
                      WHERE m.id = modulo_id AND t.mentor_id = auth.uid()));

DROP POLICY IF EXISTS mat_read ON public.treinamento_materiais;
CREATE POLICY mat_read ON public.treinamento_materiais FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.treinamento_aulas a
                  JOIN public.treinamento_modulos m ON m.id = a.modulo_id
                 WHERE a.id = aula_id AND public.posso_ver_treinamento(m.treinamento_id)));
DROP POLICY IF EXISTS mat_write ON public.treinamento_materiais;
CREATE POLICY mat_write ON public.treinamento_materiais FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.treinamento_aulas a
                  JOIN public.treinamento_modulos m ON m.id = a.modulo_id
                  JOIN public.treinamentos t ON t.id = m.treinamento_id
                 WHERE a.id = aula_id AND t.mentor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.treinamento_aulas a
                       JOIN public.treinamento_modulos m ON m.id = a.modulo_id
                       JOIN public.treinamentos t ON t.id = m.treinamento_id
                      WHERE a.id = aula_id AND t.mentor_id = auth.uid()));

DROP POLICY IF EXISTS tg_read ON public.treinamento_grupos;
CREATE POLICY tg_read ON public.treinamento_grupos FOR SELECT TO authenticated
  USING (public.posso_ver_treinamento(treinamento_id));
DROP POLICY IF EXISTS tg_write ON public.treinamento_grupos;
CREATE POLICY tg_write ON public.treinamento_grupos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.treinamentos t
                  WHERE t.id = treinamento_id AND t.mentor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.treinamentos t
                       WHERE t.id = treinamento_id AND t.mentor_id = auth.uid()));
