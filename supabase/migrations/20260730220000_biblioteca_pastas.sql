-- Biblioteca: pastas de material, e cadeado por pasta e por material.
--
-- Pedido dele: criar uma pasta e por dentro varios materiais (PDFs, planilhas,
-- imagens), separados por formato na tela. Material solto continua existindo.
-- E, como nas trilhas, escolher para quais pessoas/grupos cada coisa aparece
-- liberada ou trancada.
--
-- A REGRA DO ENCADEAMENTO -- e a decisao que nao e obvia:
--
-- "sem destino = aberto" NAO compoe entre pasta e material. Aplicada crua nos
-- dois niveis, um material sem destino proprio dentro de uma pasta trancada
-- ficaria ABERTO A TODOS: vazaria da pasta fechada. Aqui vale INTERSECAO --
-- a pasta manda:
--
--   ve o material  <=>  (esta solto OU a pasta esta liberada)
--                   E   (o material nao tem destino OU o destino casa)
--
-- Ou seja: o destino do material pode restringir MAIS que a pasta, nunca
-- liberar mais. Sem isso o cadeado da pasta seria decoracao.
--
-- pasta_id NULL e o material solto que ja existe. Todo predicado carrega o
-- `pasta_id IS NULL OR ...` explicito: NOT EXISTS nao casa com NULL, e uma
-- policy escrita como JOIN sumiria com todo material antigo no dia do deploy.

-- ============================================================
-- 1. Pastas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.biblioteca_pastas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- auth.uid() e nao acting_account(), igual a biblioteca_materiais: material
  -- solto e curadoria do dono. Misturar os dois faria o colaborador criar
  -- pasta sem poder criar material dentro dela.
  mentor_id uuid NOT NULL,
  titulo text NOT NULL,
  descricao text,
  capa_url text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bib_pasta_conta_idx
  ON public.biblioteca_pastas (mentor_id, ordem, created_at);

-- ON DELETE SET NULL: apagar a pasta devolve os materiais a raiz. CASCADE
-- apagaria material junto (perda calada, e o arquivo ficaria orfao no bucket,
-- porque excluirMaterial ja nao apaga o objeto); RESTRICT travaria a exclusao
-- sem explicar o motivo.
ALTER TABLE public.biblioteca_materiais
  ADD COLUMN IF NOT EXISTS pasta_id uuid
  REFERENCES public.biblioteca_pastas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bib_material_pasta_idx
  ON public.biblioteca_materiais (pasta_id);

-- 'imagem' faltava. Ele citou imagens no pedido, e sem isto o insert volta
-- 23514 do Postgres depois do Zod ja ter aceitado -- o usuario so descobre no
-- toast de erro.
ALTER TABLE public.biblioteca_materiais
  DROP CONSTRAINT IF EXISTS biblioteca_materiais_kind_check;
ALTER TABLE public.biblioteca_materiais
  ADD CONSTRAINT biblioteca_materiais_kind_check
  CHECK (kind IN ('link', 'pdf', 'planilha', 'imagem', 'video', 'audio', 'outro'));


-- ============================================================
-- 2. Destinos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.biblioteca_pasta_destinos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pasta_id uuid NOT NULL REFERENCES public.biblioteca_pastas(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.people(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Linha vazia deixaria a pasta "restrita para ninguem": ja existe destino
  -- (some da lista de abertas) e nao casa com pessoa alguma.
  CONSTRAINT bpd_um_ou_outro CHECK ((group_id IS NULL) <> (person_id IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS bpd_grupo_uk
  ON public.biblioteca_pasta_destinos (pasta_id, group_id) WHERE group_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bpd_pessoa_uk
  ON public.biblioteca_pasta_destinos (pasta_id, person_id) WHERE person_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.biblioteca_material_destinos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.biblioteca_materiais(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.people(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bmd_um_ou_outro CHECK ((group_id IS NULL) <> (person_id IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS bmd_grupo_uk
  ON public.biblioteca_material_destinos (material_id, group_id) WHERE group_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bmd_pessoa_uk
  ON public.biblioteca_material_destinos (material_id, person_id) WHERE person_id IS NOT NULL;


-- ============================================================
-- 3. Quem abre o que
-- ============================================================
-- Uma PESSOA especifica abre esta pasta? Usada pela previa "ver como aluno".
CREATE OR REPLACE FUNCTION public.bib_pasta_liberada_para(_pasta_id uuid, _person_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT _pasta_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.biblioteca_pasta_destinos d
                      WHERE d.pasta_id = _pasta_id)
      OR EXISTS (
           SELECT 1 FROM public.biblioteca_pasta_destinos d
            WHERE d.pasta_id = _pasta_id
              AND (d.person_id = _person_id
                   OR d.group_id IN (SELECT gm.group_id FROM public.group_members gm
                                      WHERE gm.person_id = _person_id)));
$fn$;

CREATE OR REPLACE FUNCTION public.bib_material_liberado_para(_material_id uuid, _person_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    -- A pasta manda: material dentro de pasta trancada fica trancado.
    public.bib_pasta_liberada_para(
      (SELECT m.pasta_id FROM public.biblioteca_materiais m WHERE m.id = _material_id),
      _person_id)
    AND (
      NOT EXISTS (SELECT 1 FROM public.biblioteca_material_destinos d
                   WHERE d.material_id = _material_id)
      OR EXISTS (
           SELECT 1 FROM public.biblioteca_material_destinos d
            WHERE d.material_id = _material_id
              AND (d.person_id = _person_id
                   OR d.group_id IN (SELECT gm.group_id FROM public.group_members gm
                                      WHERE gm.person_id = _person_id)))
    );
$fn$;

-- Quem esta pedindo abre esta pasta?
--
-- SECURITY DEFINER porque depende de people e group_members, que tem RLS
-- propria: sem isso o resultado mudaria conforme o papel de quem pergunta em
-- vez de conforme o destino.
CREATE OR REPLACE FUNCTION public.bib_pasta_liberada(_pasta_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    _pasta_id IS NULL
    -- A equipe da conta abre tudo: a tranca e para o aluno. Precisa vir
    -- primeiro, senao o dono perde de vista o proprio material trancado e nao
    -- tem como destrancar o que sumiu.
    OR EXISTS (SELECT 1 FROM public.biblioteca_pastas p
                WHERE p.id = _pasta_id AND p.mentor_id = public.acting_account())
    OR NOT EXISTS (SELECT 1 FROM public.biblioteca_pasta_destinos d
                    WHERE d.pasta_id = _pasta_id)
    OR EXISTS (
         SELECT 1 FROM public.biblioteca_pasta_destinos d
          WHERE d.pasta_id = _pasta_id
            AND (
              d.person_id IN (SELECT p.id FROM public.people p WHERE p.user_id = auth.uid())
              OR d.group_id IN (
                   SELECT gm.group_id FROM public.group_members gm
                     JOIN public.people p ON p.id = gm.person_id
                    WHERE p.user_id = auth.uid())
              OR d.group_id IN (
                   SELECT tmg.group_id FROM public.team_member_groups tmg
                     JOIN public.team_members tm ON tm.id = tmg.team_member_id
                    WHERE tm.user_id = auth.uid() AND tm.status = 'ativo')
            ));
$fn$;

CREATE OR REPLACE FUNCTION public.bib_material_liberado(_material_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT
    EXISTS (SELECT 1 FROM public.biblioteca_materiais m
             WHERE m.id = _material_id AND m.mentor_id = public.acting_account())
    OR (
      public.bib_pasta_liberada(
        (SELECT m.pasta_id FROM public.biblioteca_materiais m WHERE m.id = _material_id))
      AND (
        NOT EXISTS (SELECT 1 FROM public.biblioteca_material_destinos d
                     WHERE d.material_id = _material_id)
        OR EXISTS (
             SELECT 1 FROM public.biblioteca_material_destinos d
              WHERE d.material_id = _material_id
                AND (
                  d.person_id IN (SELECT p.id FROM public.people p WHERE p.user_id = auth.uid())
                  OR d.group_id IN (
                       SELECT gm.group_id FROM public.group_members gm
                         JOIN public.people p ON p.id = gm.person_id
                        WHERE p.user_id = auth.uid())
                  OR d.group_id IN (
                       SELECT tmg.group_id FROM public.team_member_groups tmg
                         JOIN public.team_members tm ON tm.id = tmg.team_member_id
                        WHERE tm.user_id = auth.uid() AND tm.status = 'ativo')
                ))
      )
    );
$fn$;

-- As pastas que eu abro, de uma vez -- a tela precisa da lista inteira, e
-- perguntar pasta a pasta seria uma ida ao banco por card.
CREATE OR REPLACE FUNCTION public.bib_pastas_liberadas(_person_id uuid DEFAULT NULL)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT p.id FROM public.biblioteca_pastas p
   WHERE CASE
           WHEN _person_id IS NULL THEN public.bib_pasta_liberada(p.id)
           -- Previa: so o dono da conta daquela pessoa pode perguntar pelo
           -- acesso dela. Sem esta trava, qualquer aluno leria o acesso alheio.
           WHEN EXISTS (SELECT 1 FROM public.people pe
                         WHERE pe.id = _person_id
                           AND pe.mentor_id = public.acting_account())
             THEN public.bib_pasta_liberada_para(p.id, _person_id)
           ELSE false
         END;
$fn$;

CREATE OR REPLACE FUNCTION public.bib_materiais_liberados(_person_id uuid DEFAULT NULL)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT m.id FROM public.biblioteca_materiais m
   WHERE CASE
           WHEN _person_id IS NULL THEN public.bib_material_liberado(m.id)
           WHEN EXISTS (SELECT 1 FROM public.people pe
                         WHERE pe.id = _person_id
                           AND pe.mentor_id = public.acting_account())
             THEN public.bib_material_liberado_para(m.id, _person_id)
           ELSE false
         END;
$fn$;

GRANT EXECUTE ON FUNCTION public.bib_pasta_liberada(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bib_material_liberado(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bib_pastas_liberadas(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bib_materiais_liberados(uuid) TO authenticated;
-- As `_para` NAO recebem grant, pelo mesmo motivo de track_liberada_para:
-- perguntar pelo acesso de OUTRA pessoa so pode passar pelas funcoes que
-- conferem antes se quem pergunta e o dono da conta dela.
REVOKE EXECUTE ON FUNCTION public.bib_pasta_liberada_para(uuid, uuid) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.bib_material_liberado_para(uuid, uuid) FROM authenticated, anon;


-- ============================================================
-- 4. RLS
-- ============================================================
ALTER TABLE public.biblioteca_pastas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biblioteca_pasta_destinos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biblioteca_material_destinos ENABLE ROW LEVEL SECURITY;

-- A PASTA continua legivel mesmo trancada: e ela que desenha o card com
-- cadeado. O que a tranca esconde e o conteudo.
DROP POLICY IF EXISTS bibp_read ON public.biblioteca_pastas;
CREATE POLICY bibp_read ON public.biblioteca_pastas FOR SELECT TO authenticated
  USING (
    mentor_id = public.acting_account()
    OR (
      mentor_id IN (SELECT p.mentor_id FROM public.people p WHERE p.user_id = auth.uid())
      AND public.aluno_pode('academy')
    )
  );

DROP POLICY IF EXISTS bibp_write ON public.biblioteca_pastas;
CREATE POLICY bibp_write ON public.biblioteca_pastas FOR ALL TO authenticated
  USING (mentor_id = auth.uid()) WITH CHECK (mentor_id = auth.uid());

-- So quem edita le os destinos: a lista crua diria ao aluno quais grupos
-- existem na conta e quem esta em cada um.
DROP POLICY IF EXISTS bpd_rw ON public.biblioteca_pasta_destinos;
CREATE POLICY bpd_rw ON public.biblioteca_pasta_destinos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.biblioteca_pastas p
                  WHERE p.id = pasta_id AND p.mentor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.biblioteca_pastas p
                       WHERE p.id = pasta_id AND p.mentor_id = auth.uid()));

DROP POLICY IF EXISTS bmd_rw ON public.biblioteca_material_destinos;
CREATE POLICY bmd_rw ON public.biblioteca_material_destinos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.biblioteca_materiais m
                  WHERE m.id = material_id AND m.mentor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.biblioteca_materiais m
                       WHERE m.id = material_id AND m.mentor_id = auth.uid()));

-- A tranca de verdade. bib_read e a UNICA porta de leitura da tabela: se ela
-- nao mudar, o cadeado e enfeite -- listarBiblioteca devolveria url e capa_url
-- de tudo e bastaria abrir o console.
--
-- A porta do DONO vem primeiro na expressao, de proposito.
DROP POLICY IF EXISTS bib_read ON public.biblioteca_materiais;
CREATE POLICY bib_read ON public.biblioteca_materiais FOR SELECT TO authenticated
  USING (
    mentor_id = public.acting_account()
    OR (
      mentor_id IN (SELECT p.mentor_id FROM public.people p WHERE p.user_id = auth.uid())
      AND public.aluno_pode('academy')
      AND public.bib_material_liberado(id)
    )
  );

COMMENT ON COLUMN public.biblioteca_materiais.pasta_id IS
  'Pasta da biblioteca. NULL = material solto na raiz. A pasta manda no acesso: material dentro de pasta trancada fica trancado.';


-- ============================================================
-- 5. De passagem: os banners nao checavam a area
-- ============================================================
-- Grupo com a Academy trancada (migracao 20260730210000) continuava recebendo
-- os banners do topo. Nao e vazamento grave -- e imagem de divulgacao --, mas
-- e a mesma tela dizendo duas coisas diferentes.
DROP POLICY IF EXISTS banner_read ON public.academy_banners;
CREATE POLICY banner_read ON public.academy_banners FOR SELECT TO authenticated
  USING (
    mentor_id = public.acting_account()
    OR (
      mentor_id IN (SELECT p.mentor_id FROM public.people p WHERE p.user_id = auth.uid())
      AND public.aluno_pode('academy')
    )
  );
