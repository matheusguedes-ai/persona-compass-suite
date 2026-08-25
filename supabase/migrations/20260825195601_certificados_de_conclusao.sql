-- #221 F2 — certificado de conclusão (emissão automática).
-- "Foto, não espelho": nome_pessoa/nome_item/percentual_exigido/percentual_atingido
-- são cópias congeladas no INSERT. Nada no app faz UPDATE nessas colunas, e não
-- existe policy de UPDATE para authenticated — a imutabilidade é estrutural.
CREATE TABLE public.certificados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  treinamento_id uuid REFERENCES public.treinamentos(id) ON DELETE CASCADE,
  trilha_id uuid REFERENCES public.learning_tracks(id) ON DELETE CASCADE,
  CONSTRAINT certificados_um_tipo_so CHECK ((treinamento_id IS NULL) <> (trilha_id IS NULL)),
  nome_pessoa text NOT NULL,
  nome_item text NOT NULL,
  percentual_exigido integer NOT NULL,
  percentual_atingido integer NOT NULL,
  codigo uuid NOT NULL DEFAULT gen_random_uuid(),
  emitido_em timestamptz NOT NULL DEFAULT now()
);

-- Um certificado por pessoa por treinamento/trilha. Índice parcial (não
-- UNIQUE(person_id, treinamento_id, trilha_id) direto) porque treinamento_id
-- e trilha_id são mutuamente exclusivos e o Postgres trata NULL como distinto
-- por padrão — um UNIQUE comum não bloquearia duplicata nenhuma.
CREATE UNIQUE INDEX certificados_um_por_treinamento
  ON public.certificados(person_id, treinamento_id) WHERE treinamento_id IS NOT NULL;
CREATE UNIQUE INDEX certificados_um_por_trilha
  ON public.certificados(person_id, trilha_id) WHERE trilha_id IS NOT NULL;
CREATE UNIQUE INDEX certificados_codigo_key ON public.certificados(codigo);
CREATE INDEX certificados_conta_idx ON public.certificados(conta_id);
CREATE INDEX certificados_person_idx ON public.certificados(person_id);

ALTER TABLE public.certificados ENABLE ROW LEVEL SECURITY;

-- Só SELECT para authenticated — a emissão é feita pelo servidor com a
-- service role (calcula a régua em TS, não duplica a lógica em SQL, e evita
-- que um cliente autenticado forje um percentual_atingido). Sem policy de
-- INSERT/UPDATE/DELETE para authenticated: mentor não edita nem revoga.
CREATE POLICY certificados_select ON public.certificados FOR SELECT TO authenticated
  USING (
    conta_id = public.acting_account()
    OR person_id IN (SELECT id FROM public.people WHERE user_id = auth.uid())
  );

GRANT SELECT ON public.certificados TO authenticated;
GRANT ALL ON public.certificados TO service_role;
