-- Registro do que foi enviado por email
-- ============================================================
-- Sem isto não há como responder "eu mandei o convite para essa pessoa?" —
-- e é a primeira pergunta que aparece quando alguém não responde o teste.

CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('convite', 'lembrete', 'resultado', 'teste')),
  to_email text NOT NULL,
  subject text NOT NULL,
  -- Guardamos a quem se refere para a tela conseguir mostrar "convite enviado"
  -- ao lado do envio certo. Nulo quando é só um email de teste.
  response_id uuid REFERENCES public.test_responses(id) ON DELETE SET NULL,
  assessment_id uuid REFERENCES public.assessment_responses(id) ON DELETE SET NULL,
  person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('enviado', 'falhou')),
  -- Id do provedor, para conferir lá quando alguém jurar que não recebeu.
  provider_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_mentor ON public.email_logs(mentor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_response ON public.email_logs(response_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_assessment ON public.email_logs(assessment_id);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Só leitura pela interface: quem grava é o servidor, com service role, depois
-- de o provedor responder. Deixar a tela inserir abriria espaço para registro
-- de envio que nunca aconteceu.
DROP POLICY IF EXISTS email_logs_read ON public.email_logs;
CREATE POLICY email_logs_read ON public.email_logs FOR SELECT TO authenticated
  USING (mentor_id = public.acting_account());
