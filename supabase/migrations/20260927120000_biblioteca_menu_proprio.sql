-- #313 — Biblioteca com menu próprio, pastas aninhadas e permissão em três camadas.
-- ETAPA 1: SÓ ACRESCENTA (regra 5). Nada do que está no ar lê o que nasce aqui: as funções e policies
-- antigas (bib_material_liberado, bib_read…) continuam como estão até a Etapa 2 (outra migração, depois
-- do código novo publicado), quando passam a chamar a função única daqui.
--
-- O MODELO (três camadas, com herança e exceções):
--   1. MENU  — liberado por GRUPO (biblioteca_menu_grupos). Nasce FECHADO: diferente das áreas de
--              groups.areas_aluno (onde NULL = tudo e área nova nasce aberta), aqui só vale liberação
--              explícita — o mesmo motivo da assistente na #289. Quem tem o menu vê tudo, por herança.
--   2. PASTA — herda o menu; pode ser BLOQUEADA para grupo/pessoa (biblioteca_pasta_bloqueios) ou
--              LIBERADA para quem não tem o menu (biblioteca_pasta_destinos, a tabela que já existia).
--              A regra de uma pasta vale para tudo o que está dentro dela, subpastas incluídas.
--   3. MATERIAL — herda a pasta; pode ser bloqueado (biblioteca_material_bloqueios) ou liberado
--              (biblioteca_material_destinos, que já existia).
--   A NEGAÇÃO SEMPRE VENCE: bloqueio em qualquer ponto da cadeia (o material ou qualquer pasta acima
--   dele), para a pessoa ou para qualquer grupo dela, derruba qualquer liberação, direta ou herdada.
--
-- A PERMISSÃO É CALCULADA NUM LUGAR SÓ: `bib_decide`. Todo o resto chama ela — as telas (pelas funções
-- `bib_visiveis`, `bib_pode_ver_*`), "quem vê isto", o resumo, a prévia do mentor, e, na Etapa 2, as
-- policies de leitura, as funções antigas e portanto a assistente (#305/#312), que lê por elas.

-- ============================================================================ 1. pasta dentro de pasta
ALTER TABLE public.biblioteca_pastas
  ADD COLUMN IF NOT EXISTS pasta_mae_id uuid REFERENCES public.biblioteca_pastas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS biblioteca_pastas_mae_idx ON public.biblioteca_pastas (pasta_mae_id);
COMMENT ON COLUMN public.biblioteca_pastas.pasta_mae_id IS
  '#313: a pasta de cima (NULL = raiz). Até 3 níveis; sem ciclo; mesma conta — conferido por bib_pasta_confere_arvore.';

-- Limite de 3 níveis (pasta → subpasta → sub-subpasta), sem ciclo, mãe da mesma conta. Vale para criar e
-- para mover: ao mover uma pasta que já tem filhas, conta a altura dela inteira.
CREATE OR REPLACE FUNCTION public.bib_pasta_confere_arvore()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
DECLARE
  v_nivel_mae integer;
  v_ciclo boolean;
  v_altura integer;
BEGIN
  IF NEW.pasta_mae_id IS NULL THEN
    RETURN NEW;  -- ir para a raiz nunca aprofunda nada
  END IF;
  IF NEW.pasta_mae_id = NEW.id THEN
    RAISE EXCEPTION 'Uma pasta não pode ficar dentro dela mesma.' USING errcode = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.biblioteca_pastas m
                  WHERE m.id = NEW.pasta_mae_id AND m.mentor_id = NEW.mentor_id) THEN
    RAISE EXCEPTION 'A pasta de destino não existe nesta biblioteca.' USING errcode = '23503';
  END IF;

  -- Sobe da mãe até a raiz: passar pela própria pasta é ciclo; o comprimento é o nível da mãe.
  WITH RECURSIVE sobe(id, mae, nivel) AS (
    SELECT p.id, p.pasta_mae_id, 1 FROM public.biblioteca_pastas p WHERE p.id = NEW.pasta_mae_id
    UNION ALL
    SELECT p.id, p.pasta_mae_id, s.nivel + 1
      FROM public.biblioteca_pastas p JOIN sobe s ON p.id = s.mae
     WHERE s.nivel < 20
  )
  SELECT max(nivel), coalesce(bool_or(id = NEW.id), false) INTO v_nivel_mae, v_ciclo FROM sobe;
  IF v_ciclo THEN
    RAISE EXCEPTION 'Não dá para mover uma pasta para dentro de uma subpasta dela.' USING errcode = '23514';
  END IF;

  -- Altura do que está sendo posto ali: 1 = a pasta sozinha; mais, se ela já tem subpastas.
  WITH RECURSIVE desce(id, nivel) AS (
    SELECT NEW.id, 1
    UNION ALL
    SELECT p.id, d.nivel + 1
      FROM public.biblioteca_pastas p JOIN desce d ON p.pasta_mae_id = d.id
     WHERE d.nivel < 20
  )
  SELECT max(nivel) INTO v_altura FROM desce;

  IF v_nivel_mae + v_altura > 3 THEN
    RAISE EXCEPTION 'A biblioteca vai até 3 níveis de pasta (pasta, subpasta e sub-subpasta). Aqui ficaria com %.',
      v_nivel_mae + v_altura USING errcode = '23514';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS bib_pasta_confere_arvore ON public.biblioteca_pastas;
CREATE TRIGGER bib_pasta_confere_arvore
  BEFORE INSERT OR UPDATE OF pasta_mae_id ON public.biblioteca_pastas
  FOR EACH ROW EXECUTE FUNCTION public.bib_pasta_confere_arvore();

-- ============================================================================ 2. as regras novas
-- Menu por grupo (camada 1). Sem linha = o grupo não tem o menu.
CREATE TABLE IF NOT EXISTS public.biblioteca_menu_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- a conta (preenchida pelo banco)
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bmg_um_por_grupo UNIQUE (group_id)
);
COMMENT ON TABLE public.biblioteca_menu_grupos IS
  '#313: grupos com o menu Biblioteca. Nasce fechado (sem linha = sem menu), ao contrário de groups.areas_aluno.';

-- Bloqueios (a exceção NEGATIVA) — pasta e material. Grupo OU pessoa.
CREATE TABLE IF NOT EXISTS public.biblioteca_pasta_bloqueios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- a conta (preenchida pelo banco)
  pasta_id uuid NOT NULL REFERENCES public.biblioteca_pastas(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.people(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bpb_um_ou_outro CHECK ((group_id IS NULL) <> (person_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS bpb_grupo_uniq ON public.biblioteca_pasta_bloqueios (pasta_id, group_id) WHERE group_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bpb_pessoa_uniq ON public.biblioteca_pasta_bloqueios (pasta_id, person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bpb_person_idx ON public.biblioteca_pasta_bloqueios (person_id);

CREATE TABLE IF NOT EXISTS public.biblioteca_material_bloqueios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- a conta (preenchida pelo banco)
  material_id uuid NOT NULL REFERENCES public.biblioteca_materiais(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.people(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bmb_um_ou_outro CHECK ((group_id IS NULL) <> (person_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS bmb_grupo_uniq ON public.biblioteca_material_bloqueios (material_id, group_id) WHERE group_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bmb_pessoa_uniq ON public.biblioteca_material_bloqueios (material_id, person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bmb_person_idx ON public.biblioteca_material_bloqueios (person_id);

COMMENT ON TABLE public.biblioteca_pasta_bloqueios IS
  '#313: bloqueio de pasta para grupo/pessoa. VENCE qualquer liberação e vale para tudo dentro da pasta.';
COMMENT ON TABLE public.biblioteca_material_bloqueios IS
  '#313: bloqueio de material para grupo/pessoa. VENCE qualquer liberação.';

-- O dono de cada regra é a conta do que ela protege, e o grupo/pessoa precisa ser da mesma conta —
-- quem chama não escolhe o mentor_id.
CREATE OR REPLACE FUNCTION public.bib_regra_confere()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
DECLARE
  v_dono uuid;
BEGIN
  IF TG_TABLE_NAME = 'biblioteca_menu_grupos' THEN
    SELECT g.mentor_id INTO v_dono FROM public.groups g WHERE g.id = NEW.group_id;
  ELSIF TG_TABLE_NAME = 'biblioteca_pasta_bloqueios' THEN
    SELECT p.mentor_id INTO v_dono FROM public.biblioteca_pastas p WHERE p.id = NEW.pasta_id;
  ELSE
    SELECT m.mentor_id INTO v_dono FROM public.biblioteca_materiais m WHERE m.id = NEW.material_id;
  END IF;
  IF v_dono IS NULL THEN
    RAISE EXCEPTION 'Não encontrei o que esta regra protege.' USING errcode = '23503';
  END IF;
  NEW.mentor_id := v_dono;

  IF TG_TABLE_NAME <> 'biblioteca_menu_grupos' THEN
    IF NEW.group_id IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.groups g WHERE g.id = NEW.group_id AND g.mentor_id = v_dono) THEN
      RAISE EXCEPTION 'O grupo não é desta conta.' USING errcode = '23503';
    END IF;
    IF NEW.person_id IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.people p WHERE p.id = NEW.person_id AND p.mentor_id = v_dono) THEN
      RAISE EXCEPTION 'A pessoa não é desta conta.' USING errcode = '23503';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS bib_regra_confere ON public.biblioteca_menu_grupos;
CREATE TRIGGER bib_regra_confere BEFORE INSERT OR UPDATE ON public.biblioteca_menu_grupos
  FOR EACH ROW EXECUTE FUNCTION public.bib_regra_confere();
DROP TRIGGER IF EXISTS bib_regra_confere ON public.biblioteca_pasta_bloqueios;
CREATE TRIGGER bib_regra_confere BEFORE INSERT OR UPDATE ON public.biblioteca_pasta_bloqueios
  FOR EACH ROW EXECUTE FUNCTION public.bib_regra_confere();
DROP TRIGGER IF EXISTS bib_regra_confere ON public.biblioteca_material_bloqueios;
CREATE TRIGGER bib_regra_confere BEFORE INSERT OR UPDATE ON public.biblioteca_material_bloqueios
  FOR EACH ROW EXECUTE FUNCTION public.bib_regra_confere();

-- Quem lê as regras: a equipe da conta (a tela de gestão). Quem escreve: só o dono — como o resto da
-- biblioteca. O aluno não lê nenhuma das três: saber quais grupos têm o quê diria a ele o que existe.
ALTER TABLE public.biblioteca_menu_grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biblioteca_pasta_bloqueios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biblioteca_material_bloqueios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bmg_read ON public.biblioteca_menu_grupos;
CREATE POLICY bmg_read ON public.biblioteca_menu_grupos FOR SELECT TO authenticated
  USING (mentor_id = public.acting_account());
DROP POLICY IF EXISTS bmg_write ON public.biblioteca_menu_grupos;
CREATE POLICY bmg_write ON public.biblioteca_menu_grupos FOR ALL TO authenticated
  USING (mentor_id = auth.uid()) WITH CHECK (mentor_id = auth.uid());

DROP POLICY IF EXISTS bpb_read ON public.biblioteca_pasta_bloqueios;
CREATE POLICY bpb_read ON public.biblioteca_pasta_bloqueios FOR SELECT TO authenticated
  USING (mentor_id = public.acting_account());
DROP POLICY IF EXISTS bpb_write ON public.biblioteca_pasta_bloqueios;
CREATE POLICY bpb_write ON public.biblioteca_pasta_bloqueios FOR ALL TO authenticated
  USING (mentor_id = auth.uid()) WITH CHECK (mentor_id = auth.uid());

DROP POLICY IF EXISTS bmb_read ON public.biblioteca_material_bloqueios;
CREATE POLICY bmb_read ON public.biblioteca_material_bloqueios FOR SELECT TO authenticated
  USING (mentor_id = public.acting_account());
DROP POLICY IF EXISTS bmb_write ON public.biblioteca_material_bloqueios;
CREATE POLICY bmb_write ON public.biblioteca_material_bloqueios FOR ALL TO authenticated
  USING (mentor_id = auth.uid()) WITH CHECK (mentor_id = auth.uid());

-- ============================================================================ 3. A FUNÇÃO ÚNICA
-- Decide, para um conjunto de identidades (cadastros + grupos deles), se uma pasta OU um material é
-- visível, e diz por quê. É a ÚNICA implementação da regra: pessoa (prévia, "quem vê isto", resumo) e
-- login (telas, busca, link direto, download, RLS, assistente) passam por aqui com as identidades de
-- cada um. SECURITY INVOKER e sem EXECUTE para aluno: roda por dentro das funções de cima, que decidem
-- de QUEM são as identidades — um aluno não pode perguntar pelas de outro.
--
-- resultado: 've' | 'bloqueado' | 'sem_acesso' | 'inexistente'
-- como: 'bloqueio_direto' | 'bloqueio_herdado' | 'direto' | 'heranca' | 'menu' | 'sem_acesso' | 'inexistente'
CREATE OR REPLACE FUNCTION public.bib_decide(_pasta_id uuid, _material_id uuid, _pessoas uuid[], _grupos uuid[])
RETURNS TABLE(resultado text, como text, motivo text)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $fn$
DECLARE
  v_dono uuid;
  v_pasta uuid;      -- onde a cadeia de pastas começa
  v_cadeia uuid[];   -- da pasta mais próxima até a raiz
  v_quem text;
  v_titulo text;
  v_nivel integer;
BEGIN
  _pessoas := coalesce(_pessoas, '{}'::uuid[]);
  _grupos := coalesce(_grupos, '{}'::uuid[]);

  IF _material_id IS NOT NULL THEN
    SELECT m.mentor_id, m.pasta_id INTO v_dono, v_pasta
      FROM public.biblioteca_materiais m WHERE m.id = _material_id;
    IF v_dono IS NULL THEN
      RETURN QUERY SELECT 'inexistente'::text, 'inexistente'::text, 'Material não encontrado.'::text;
      RETURN;
    END IF;
  ELSE
    SELECT p.mentor_id INTO v_dono FROM public.biblioteca_pastas p WHERE p.id = _pasta_id;
    IF v_dono IS NULL THEN
      RETURN QUERY SELECT 'inexistente'::text, 'inexistente'::text, 'Pasta não encontrada.'::text;
      RETURN;
    END IF;
    v_pasta := _pasta_id;
  END IF;

  WITH RECURSIVE sobe(id, mae, n) AS (
    SELECT p.id, p.pasta_mae_id, 1 FROM public.biblioteca_pastas p WHERE p.id = v_pasta
    UNION ALL
    SELECT p.id, p.pasta_mae_id, s.n + 1
      FROM public.biblioteca_pastas p JOIN sobe s ON p.id = s.mae
     WHERE s.n < 20
  )
  SELECT coalesce(array_agg(sobe.id ORDER BY sobe.n), '{}'::uuid[]) INTO v_cadeia FROM sobe;

  -- 1. A NEGAÇÃO VENCE. No próprio material…
  IF _material_id IS NOT NULL THEN
    SELECT CASE WHEN b.group_id IS NOT NULL THEN format('o grupo "%s"', g.name) ELSE 'esta pessoa' END
      INTO v_quem
      FROM public.biblioteca_material_bloqueios b
      LEFT JOIN public.groups g ON g.id = b.group_id
     WHERE b.material_id = _material_id
       AND (b.person_id = ANY (_pessoas) OR b.group_id = ANY (_grupos))
     ORDER BY b.person_id NULLS LAST
     LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT 'bloqueado'::text, 'bloqueio_direto'::text, format('Bloqueado neste material para %s.', v_quem);
      RETURN;
    END IF;
  END IF;
  -- … e em qualquer pasta da cadeia, a mais próxima primeiro.
  SELECT CASE WHEN b.group_id IS NOT NULL THEN format('o grupo "%s"', g.name) ELSE 'esta pessoa' END,
         p.titulo, array_position(v_cadeia, b.pasta_id)
    INTO v_quem, v_titulo, v_nivel
    FROM public.biblioteca_pasta_bloqueios b
    JOIN public.biblioteca_pastas p ON p.id = b.pasta_id
    LEFT JOIN public.groups g ON g.id = b.group_id
   WHERE b.pasta_id = ANY (v_cadeia)
     AND (b.person_id = ANY (_pessoas) OR b.group_id = ANY (_grupos))
   ORDER BY array_position(v_cadeia, b.pasta_id), b.person_id NULLS LAST
   LIMIT 1;
  IF FOUND THEN
    IF _material_id IS NULL AND v_nivel = 1 THEN
      RETURN QUERY SELECT 'bloqueado'::text, 'bloqueio_direto'::text, format('Bloqueada nesta pasta para %s.', v_quem);
    ELSE
      RETURN QUERY SELECT 'bloqueado'::text, 'bloqueio_herdado'::text,
        format('Bloqueado pela pasta "%s" para %s.', v_titulo, v_quem);
    END IF;
    RETURN;
  END IF;

  -- 2. Liberação direta no próprio material.
  IF _material_id IS NOT NULL THEN
    SELECT CASE WHEN d.group_id IS NOT NULL THEN format('o grupo "%s"', g.name) ELSE 'esta pessoa' END
      INTO v_quem
      FROM public.biblioteca_material_destinos d
      LEFT JOIN public.groups g ON g.id = d.group_id
     WHERE d.material_id = _material_id
       AND (d.person_id = ANY (_pessoas) OR d.group_id = ANY (_grupos))
     ORDER BY d.person_id NULLS LAST
     LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT 've'::text, 'direto'::text, format('Liberado diretamente para %s.', v_quem);
      RETURN;
    END IF;
  END IF;

  -- 3. Liberação numa pasta da cadeia: a própria pasta = direta; uma pasta acima = herança.
  SELECT CASE WHEN d.group_id IS NOT NULL THEN format('o grupo "%s"', g.name) ELSE 'esta pessoa' END,
         p.titulo, array_position(v_cadeia, d.pasta_id)
    INTO v_quem, v_titulo, v_nivel
    FROM public.biblioteca_pasta_destinos d
    JOIN public.biblioteca_pastas p ON p.id = d.pasta_id
    LEFT JOIN public.groups g ON g.id = d.group_id
   WHERE d.pasta_id = ANY (v_cadeia)
     AND (d.person_id = ANY (_pessoas) OR d.group_id = ANY (_grupos))
   ORDER BY array_position(v_cadeia, d.pasta_id), d.person_id NULLS LAST
   LIMIT 1;
  IF FOUND THEN
    IF _material_id IS NULL AND v_nivel = 1 THEN
      RETURN QUERY SELECT 've'::text, 'direto'::text, format('Liberada diretamente para %s.', v_quem);
    ELSE
      RETURN QUERY SELECT 've'::text, 'heranca'::text,
        format('Herdado da pasta "%s", liberada para %s.', v_titulo, v_quem);
    END IF;
    RETURN;
  END IF;

  -- 4. O menu Biblioteca, liberado ao grupo — vale para tudo, por herança.
  SELECT format('o grupo "%s"', g.name)
    INTO v_quem
    FROM public.biblioteca_menu_grupos mg
    JOIN public.groups g ON g.id = mg.group_id
   WHERE mg.mentor_id = v_dono AND mg.group_id = ANY (_grupos)
   ORDER BY g.name
   LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT 've'::text, 'menu'::text, format('Pelo menu Biblioteca, liberado para %s.', v_quem);
    RETURN;
  END IF;

  RETURN QUERY SELECT 'sem_acesso'::text, 'sem_acesso'::text, 'Sem o menu Biblioteca e sem liberação.'::text;
END;
$fn$;

-- As identidades de UMA pessoa: ela e os grupos dela.
CREATE OR REPLACE FUNCTION public.bib_decide_pessoa(_pasta_id uuid, _material_id uuid, _person_id uuid)
RETURNS TABLE(resultado text, como text, motivo text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $fn$
  SELECT d.resultado, d.como, d.motivo
    FROM public.bib_decide(
      _pasta_id, _material_id, ARRAY[_person_id],
      ARRAY(SELECT gm.group_id FROM public.group_members gm WHERE gm.person_id = _person_id)) d;
$fn$;

-- Sem porta para o aluno (nem para o visitante): perguntar pelas identidades de OUTRA pessoa só pelas
-- funções abaixo, que conferem quem pergunta. Rodam por dentro delas (SECURITY DEFINER do dono).
REVOKE EXECUTE ON FUNCTION public.bib_decide(uuid, uuid, uuid[], uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bib_decide_pessoa(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bib_decide(uuid, uuid, uuid[], uuid[]) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.bib_decide_pessoa(uuid, uuid, uuid) TO service_role, postgres;

-- ============================================================================ 4. as portas (login atual)
-- "Posso ver?" para quem está logado. A equipe da conta vê tudo (a tranca é para o aluno — senão o dono
-- perde de vista o próprio material bloqueado). O aluno é a união dos cadastros dele e dos grupos deles.
CREATE OR REPLACE FUNCTION public.bib_pode_ver_material(_material_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.biblioteca_materiais m
                  WHERE m.id = _material_id AND m.mentor_id = public.acting_account())
      OR coalesce((
           SELECT d.resultado = 've'
             FROM public.bib_decide(
               NULL, _material_id,
               ARRAY(SELECT p.id FROM public.people p WHERE p.user_id = auth.uid()),
               ARRAY(SELECT gm.group_id FROM public.group_members gm
                       JOIN public.people p ON p.id = gm.person_id
                      WHERE p.user_id = auth.uid())) d), false);
$fn$;

CREATE OR REPLACE FUNCTION public.bib_pode_ver_pasta(_pasta_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.biblioteca_pastas p
                  WHERE p.id = _pasta_id AND p.mentor_id = public.acting_account())
      OR coalesce((
           SELECT d.resultado = 've'
             FROM public.bib_decide(
               _pasta_id, NULL,
               ARRAY(SELECT p.id FROM public.people p WHERE p.user_id = auth.uid()),
               ARRAY(SELECT gm.group_id FROM public.group_members gm
                       JOIN public.people p ON p.id = gm.person_id
                      WHERE p.user_id = auth.uid())) d), false);
$fn$;

-- Tudo o que um login vê (sem `_person_id`), ou o que UMA pessoa vê (prévia "ver como aluno" — só a
-- conta dona dela pergunta; qualquer outro recebe lista vazia). É a fonte das telas do aluno, da busca
-- e da prévia: nenhuma tela filtra por conta própria.
CREATE OR REPLACE FUNCTION public.bib_visiveis(_person_id uuid DEFAULT NULL)
RETURNS TABLE(tipo text, id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_pessoas uuid[];
  v_grupos uuid[];
  v_contas uuid[];
  v_equipe uuid;
BEGIN
  IF _person_id IS NULL THEN
    v_pessoas := ARRAY(SELECT p.id FROM public.people p WHERE p.user_id = auth.uid());
    v_contas := ARRAY(SELECT DISTINCT p.mentor_id FROM public.people p WHERE p.user_id = auth.uid());
    -- A equipe da conta vê tudo da conta — a mesma regra de bib_pode_ver_*.
    SELECT public.acting_account() INTO v_equipe;
    IF v_equipe IS NOT NULL AND NOT (EXISTS (SELECT 1 FROM public.biblioteca_pastas x WHERE x.mentor_id = v_equipe)
                                     OR EXISTS (SELECT 1 FROM public.biblioteca_materiais x WHERE x.mentor_id = v_equipe)) THEN
      v_equipe := NULL;
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.people p WHERE p.id = _person_id AND p.mentor_id = public.acting_account()) THEN
      RETURN;
    END IF;
    v_pessoas := ARRAY[_person_id];
    v_contas := ARRAY(SELECT p.mentor_id FROM public.people p WHERE p.id = _person_id);
    v_equipe := NULL;
  END IF;
  v_grupos := ARRAY(SELECT gm.group_id FROM public.group_members gm WHERE gm.person_id = ANY (v_pessoas));

  RETURN QUERY
    SELECT 'pasta'::text, p.id
      FROM public.biblioteca_pastas p
     WHERE p.mentor_id = v_equipe
        OR (p.mentor_id = ANY (v_contas)
            AND (SELECT d.resultado FROM public.bib_decide(p.id, NULL, v_pessoas, v_grupos) d) = 've')
    UNION ALL
    SELECT 'material'::text, m.id
      FROM public.biblioteca_materiais m
     WHERE m.mentor_id = v_equipe
        OR (m.mentor_id = ANY (v_contas)
            AND (SELECT d.resultado FROM public.bib_decide(NULL, m.id, v_pessoas, v_grupos) d) = 've');
END;
$fn$;

-- ============================================================================ 5. para a gestão (dono/equipe)
-- "Quem vê isto": cada pessoa da conta, com o resultado e o motivo — pela MESMA função que decide o
-- acesso de verdade. A tela só desenha isto; nunca recalcula.
CREATE OR REPLACE FUNCTION public.bib_quem_ve(_pasta_id uuid, _material_id uuid)
RETURNS TABLE(person_id uuid, nome text, tem_login boolean, equipe boolean, grupos text[],
              resultado text, como text, motivo text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_dono uuid;
BEGIN
  IF _material_id IS NOT NULL THEN
    SELECT m.mentor_id INTO v_dono FROM public.biblioteca_materiais m WHERE m.id = _material_id;
  ELSE
    SELECT p.mentor_id INTO v_dono FROM public.biblioteca_pastas p WHERE p.id = _pasta_id;
  END IF;
  IF v_dono IS NULL OR v_dono <> public.acting_account() THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT pe.id, pe.full_name, pe.user_id IS NOT NULL,
           (pe.user_id = v_dono OR EXISTS (SELECT 1 FROM public.team_members tm
                                            WHERE tm.user_id = pe.user_id AND tm.owner_id = v_dono AND tm.status = 'ativo')),
           ARRAY(SELECT g.name FROM public.group_members gm JOIN public.groups g ON g.id = gm.group_id
                  WHERE gm.person_id = pe.id ORDER BY g.name),
           d.resultado, d.como, d.motivo
      FROM public.people pe
     CROSS JOIN LATERAL public.bib_decide_pessoa(_pasta_id, _material_id, pe.id) d
     WHERE pe.mentor_id = v_dono
     ORDER BY (d.resultado = 've') DESC, (d.resultado = 'bloqueado') DESC, pe.full_name;
END;
$fn$;

-- Um número por pasta/material para a lista da gestão: quantas pessoas veem, quantas delas têm login,
-- quantas estão bloqueadas. "Não liberado para ninguém" = veem 0. Mesma função de novo.
CREATE OR REPLACE FUNCTION public.bib_resumo_acesso()
RETURNS TABLE(tipo text, id uuid, veem integer, veem_com_login integer, bloqueados integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  WITH conta AS (SELECT public.acting_account() AS dono),
  pessoas AS (SELECT pe.id, pe.user_id IS NOT NULL AS com_login FROM public.people pe, conta WHERE pe.mentor_id = conta.dono),
  itens AS (
    SELECT 'pasta'::text AS tipo, p.id, p.id AS pasta_id, NULL::uuid AS material_id
      FROM public.biblioteca_pastas p, conta WHERE p.mentor_id = conta.dono
    UNION ALL
    SELECT 'material'::text, m.id, NULL::uuid, m.id
      FROM public.biblioteca_materiais m, conta WHERE m.mentor_id = conta.dono)
  SELECT i.tipo, i.id,
         count(*) FILTER (WHERE d.resultado = 've')::integer,
         count(*) FILTER (WHERE d.resultado = 've' AND pe.com_login)::integer,
         count(*) FILTER (WHERE d.resultado = 'bloqueado')::integer
    FROM itens i
    LEFT JOIN pessoas pe ON true
    LEFT JOIN LATERAL public.bib_decide_pessoa(i.pasta_id, i.material_id, pe.id) d ON pe.id IS NOT NULL
   GROUP BY i.tipo, i.id;
$fn$;

-- Apagar pasta SEM mudar quem vê o que estava dentro: o conteúdo sobe para a pasta de cima (ou raiz) e
-- as regras da pasta apagada (liberações e bloqueios) passam para cada item que estava nela. Sem isso,
-- um material de pasta bloqueada para a T4 subiria para uma pasta liberada e APARECERIA para a T4 só
-- porque alguém apagou a pasta. Nenhum material é apagado. Só o dono.
CREATE OR REPLACE FUNCTION public.bib_apagar_pasta(_pasta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_mae uuid;
  v_dono uuid;
  v_mat integer;
  v_sub integer;
BEGIN
  SELECT p.pasta_mae_id, p.mentor_id INTO v_mae, v_dono FROM public.biblioteca_pastas p WHERE p.id = _pasta_id;
  IF v_dono IS NULL OR v_dono <> auth.uid() THEN
    RAISE EXCEPTION 'Pasta não encontrada.' USING errcode = '42501';
  END IF;

  -- As regras da pasta descem para cada filho direto (a subárvore deles continua coberta por elas).
  INSERT INTO public.biblioteca_material_destinos (material_id, group_id, person_id)
    SELECT m.id, d.group_id, d.person_id FROM public.biblioteca_materiais m
      JOIN public.biblioteca_pasta_destinos d ON d.pasta_id = _pasta_id
     WHERE m.pasta_id = _pasta_id
       AND NOT EXISTS (SELECT 1 FROM public.biblioteca_material_destinos x WHERE x.material_id = m.id
                        AND x.group_id IS NOT DISTINCT FROM d.group_id AND x.person_id IS NOT DISTINCT FROM d.person_id);
  INSERT INTO public.biblioteca_material_bloqueios (mentor_id, material_id, group_id, person_id)
    SELECT v_dono, m.id, b.group_id, b.person_id FROM public.biblioteca_materiais m
      JOIN public.biblioteca_pasta_bloqueios b ON b.pasta_id = _pasta_id
     WHERE m.pasta_id = _pasta_id
    ON CONFLICT DO NOTHING;
  INSERT INTO public.biblioteca_pasta_destinos (pasta_id, group_id, person_id)
    SELECT f.id, d.group_id, d.person_id FROM public.biblioteca_pastas f
      JOIN public.biblioteca_pasta_destinos d ON d.pasta_id = _pasta_id
     WHERE f.pasta_mae_id = _pasta_id
       AND NOT EXISTS (SELECT 1 FROM public.biblioteca_pasta_destinos x WHERE x.pasta_id = f.id
                        AND x.group_id IS NOT DISTINCT FROM d.group_id AND x.person_id IS NOT DISTINCT FROM d.person_id);
  INSERT INTO public.biblioteca_pasta_bloqueios (mentor_id, pasta_id, group_id, person_id)
    SELECT v_dono, f.id, b.group_id, b.person_id FROM public.biblioteca_pastas f
      JOIN public.biblioteca_pasta_bloqueios b ON b.pasta_id = _pasta_id
     WHERE f.pasta_mae_id = _pasta_id
    ON CONFLICT DO NOTHING;

  UPDATE public.biblioteca_materiais SET pasta_id = v_mae WHERE pasta_id = _pasta_id;
  GET DIAGNOSTICS v_mat = ROW_COUNT;
  UPDATE public.biblioteca_pastas SET pasta_mae_id = v_mae WHERE pasta_mae_id = _pasta_id;
  GET DIAGNOSTICS v_sub = ROW_COUNT;
  DELETE FROM public.biblioteca_pastas WHERE id = _pasta_id;

  RETURN jsonb_build_object('materiais', v_mat, 'subpastas', v_sub, 'para', v_mae);
END;
$fn$;

-- Portas: só quem está logado; cada uma confere dentro de quem é o login.
REVOKE EXECUTE ON FUNCTION public.bib_pode_ver_material(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bib_pode_ver_pasta(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bib_visiveis(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bib_quem_ve(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bib_resumo_acesso() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bib_apagar_pasta(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bib_pasta_confere_arvore() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bib_regra_confere() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bib_pode_ver_material(uuid) TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.bib_pode_ver_pasta(uuid) TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.bib_visiveis(uuid) TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.bib_quem_ve(uuid, uuid) TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.bib_resumo_acesso() TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.bib_apagar_pasta(uuid) TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.bib_pasta_confere_arvore() TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.bib_regra_confere() TO authenticated, service_role, postgres;

-- ============================================================================ 6. unificação de cadastros
-- Os bloqueios apontam para `people`: sem isto, `fundir_pessoas` (#300) recusaria TODA unificação (ela
-- confere se sobrou linha apontando para o cadastro absorvido). O bloqueio da pessoa absorvida passa para
-- a que fica — a negação continua valendo. Enxerto conferido no texto VIVO das duas funções (a #305
-- também as alterou): cada ponto de encaixe tem de existir exatamente uma vez, senão a migração para.
DO $enxerto$
DECLARE
  v text;
  v_ancora text;
  v_novo text;
BEGIN
  -- fundir_pessoas: mover (e descartar duplicados) como já se faz com os destinos.
  v := pg_get_functiondef('public.fundir_pessoas(uuid,uuid,uuid)'::regprocedure);
  IF position('biblioteca_material_bloqueios' in v) = 0 THEN
    v_ancora := $a$jsonb_build_object('biblioteca_pasta_destinos', v_ids);$a$;
    IF (length(v) - length(replace(v, v_ancora, ''))) / length(v_ancora) <> 1 THEN
      RAISE EXCEPTION 'fundir_pessoas: ponto de encaixe não encontrado (ou repetido) — nada foi alterado';
    END IF;
    v_novo := v_ancora || $b$

  -- #313: bloqueios da biblioteca — o da pessoa absorvida passa para a que fica.
  WITH d AS (DELETE FROM biblioteca_material_bloqueios t WHERE t.person_id = p_absorver
               AND EXISTS (SELECT 1 FROM biblioteca_material_bloqueios x WHERE x.person_id = p_manter AND x.material_id = t.material_id)
             RETURNING to_jsonb(t) AS linha)
    SELECT coalesce(jsonb_agg(linha), '[]'::jsonb) INTO v_linhas FROM d;
  IF jsonb_array_length(v_linhas) > 0 THEN v_descartados := v_descartados || jsonb_build_object('biblioteca_material_bloqueios', v_linhas); END IF;
  WITH m AS (UPDATE biblioteca_material_bloqueios SET person_id = p_manter WHERE person_id = p_absorver RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM m;
  v_movidos := v_movidos || jsonb_build_object('biblioteca_material_bloqueios', v_ids);

  WITH d AS (DELETE FROM biblioteca_pasta_bloqueios t WHERE t.person_id = p_absorver
               AND EXISTS (SELECT 1 FROM biblioteca_pasta_bloqueios x WHERE x.person_id = p_manter AND x.pasta_id = t.pasta_id)
             RETURNING to_jsonb(t) AS linha)
    SELECT coalesce(jsonb_agg(linha), '[]'::jsonb) INTO v_linhas FROM d;
  IF jsonb_array_length(v_linhas) > 0 THEN v_descartados := v_descartados || jsonb_build_object('biblioteca_pasta_bloqueios', v_linhas); END IF;
  WITH m AS (UPDATE biblioteca_pasta_bloqueios SET person_id = p_manter WHERE person_id = p_absorver RETURNING id)
    SELECT coalesce(jsonb_agg(id), '[]'::jsonb) INTO v_ids FROM m;
  v_movidos := v_movidos || jsonb_build_object('biblioteca_pasta_bloqueios', v_ids);$b$;
    EXECUTE replace(v, v_ancora, v_novo);
  END IF;

  -- previa_fusao: as contagens (somadas às de "destinos", que a tela da unificação já mostra).
  v := pg_get_functiondef('public.previa_fusao(uuid,uuid)'::regprocedure);
  IF position('biblioteca_material_bloqueios' in v) = 0 THEN
    v_ancora := $a$NOT EXISTS (SELECT 1 FROM biblioteca_pasta_destinos x WHERE x.person_id = p_manter AND x.pasta_id = d.pasta_id))$a$;
    IF (length(v) - length(replace(v, v_ancora, ''))) / length(v_ancora) <> 1 THEN
      RAISE EXCEPTION 'previa_fusao (mover): ponto de encaixe não encontrado (ou repetido) — nada foi alterado';
    END IF;
    v := replace(v, v_ancora, v_ancora || $b$
              + (SELECT count(*) FROM biblioteca_material_bloqueios d WHERE d.person_id = p_absorver
                   AND NOT EXISTS (SELECT 1 FROM biblioteca_material_bloqueios x WHERE x.person_id = p_manter AND x.material_id = d.material_id))
              + (SELECT count(*) FROM biblioteca_pasta_bloqueios d WHERE d.person_id = p_absorver
                   AND NOT EXISTS (SELECT 1 FROM biblioteca_pasta_bloqueios x WHERE x.person_id = p_manter AND x.pasta_id = d.pasta_id))$b$);
    v_ancora := $a$AND EXISTS (SELECT 1 FROM biblioteca_pasta_destinos x WHERE x.person_id = p_manter AND x.pasta_id = d.pasta_id))$a$;
    IF (length(v) - length(replace(v, v_ancora, ''))) / length(v_ancora) <> 1 THEN
      RAISE EXCEPTION 'previa_fusao (conflitos): ponto de encaixe não encontrado (ou repetido) — nada foi alterado';
    END IF;
    v := replace(v, v_ancora, v_ancora || $b$
              + (SELECT count(*) FROM biblioteca_material_bloqueios d WHERE d.person_id = p_absorver
                   AND EXISTS (SELECT 1 FROM biblioteca_material_bloqueios x WHERE x.person_id = p_manter AND x.material_id = d.material_id))
              + (SELECT count(*) FROM biblioteca_pasta_bloqueios d WHERE d.person_id = p_absorver
                   AND EXISTS (SELECT 1 FROM biblioteca_pasta_bloqueios x WHERE x.person_id = p_manter AND x.pasta_id = d.pasta_id))$b$);
    EXECUTE v;
  END IF;
END
$enxerto$;
