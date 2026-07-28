-- Devolutivas: o registro da conversa entre mentor e avaliado sobre o resultado.
--
-- Até aqui a plataforma cobria até a entrega do relatório. O que acontece
-- depois — a reunião em que o mentor senta com a pessoa, explica o resultado e
-- combina o plano de ação — não tinha onde ser registrado. Sem isso, não há
-- como saber quem já teve a conversa e quem está esperando há três semanas.
--
-- Uma devolutiva aponta para a PESSOA (sempre) e para o que foi discutido:
-- uma resposta avulsa ou uma bateria. As duas referências são opcionais e
-- ON DELETE SET NULL de propósito — apagar um teste antigo não pode apagar o
-- registro de que a conversa aconteceu.

CREATE TABLE IF NOT EXISTS public.devolutivas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Conta dona. Mesmo padrão das outras tabelas: acting_account() resolve
  -- dono e convidado para o mesmo valor.
  mentor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,

  -- O que foi conversado. Preenche um OU outro; nenhum dos dois também é
  -- válido (devolutiva de acompanhamento, sem teste novo).
  response_id uuid REFERENCES public.test_responses(id) ON DELETE SET NULL,
  assessment_id uuid REFERENCES public.assessment_responses(id) ON DELETE SET NULL,

  status text NOT NULL DEFAULT 'agendada'
    CHECK (status IN ('agendada', 'realizada', 'cancelada')),

  scheduled_at timestamptz,
  completed_at timestamptz,
  /** Duração real da conversa, preenchida ao registrar. */
  duration_min integer CHECK (duration_min IS NULL OR duration_min BETWEEN 1 AND 600),

  /** O que foi conversado. */
  notes text,
  /** O que ficou combinado — é o que se relê antes do próximo encontro. */
  agreements text,
  /** Data sugerida para o próximo acompanhamento. */
  next_at date,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS devolutivas_mentor_idx ON public.devolutivas (mentor_id, status);
CREATE INDEX IF NOT EXISTS devolutivas_person_idx ON public.devolutivas (person_id);

-- Uma pessoa não deveria ter duas devolutivas abertas para o MESMO resultado.
-- Índice parcial: só vale para as que ainda não foram canceladas.
CREATE UNIQUE INDEX IF NOT EXISTS devolutivas_resposta_unica
  ON public.devolutivas (response_id)
  WHERE response_id IS NOT NULL AND status <> 'cancelada';
CREATE UNIQUE INDEX IF NOT EXISTS devolutivas_bateria_unica
  ON public.devolutivas (assessment_id)
  WHERE assessment_id IS NOT NULL AND status <> 'cancelada';

ALTER TABLE public.devolutivas ENABLE ROW LEVEL SECURITY;

-- Mesmo recorte das outras tabelas: a conta é do dono, e o mentor convidado só
-- enxerga quem está nos grupos dele (can_see_person cuida disso).
DROP POLICY IF EXISTS devolutivas_read ON public.devolutivas;
CREATE POLICY devolutivas_read ON public.devolutivas FOR SELECT TO authenticated
  USING (mentor_id = public.acting_account() AND public.can_see_person(person_id));

DROP POLICY IF EXISTS devolutivas_insert ON public.devolutivas;
CREATE POLICY devolutivas_insert ON public.devolutivas FOR INSERT TO authenticated
  WITH CHECK (mentor_id = public.acting_account() AND public.can_see_person(person_id));

DROP POLICY IF EXISTS devolutivas_update ON public.devolutivas;
CREATE POLICY devolutivas_update ON public.devolutivas FOR UPDATE TO authenticated
  USING (mentor_id = public.acting_account() AND public.can_see_person(person_id))
  WITH CHECK (mentor_id = public.acting_account());

DROP POLICY IF EXISTS devolutivas_delete ON public.devolutivas;
CREATE POLICY devolutivas_delete ON public.devolutivas FOR DELETE TO authenticated
  USING (mentor_id = public.acting_account() AND public.can_see_person(person_id));

-- updated_at automático, reusando a função que todas as outras tabelas já usam.
-- Criar uma nova com outro nome só espalharia cópias da mesma coisa.
DROP TRIGGER IF EXISTS devolutivas_set_updated_at ON public.devolutivas;
CREATE TRIGGER devolutivas_set_updated_at
  BEFORE UPDATE ON public.devolutivas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
