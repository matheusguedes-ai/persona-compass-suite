CREATE TABLE public.assessment_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  group_id uuid NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','submitted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NULL,
  submitted_at timestamptz NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_responses TO authenticated;
GRANT ALL ON public.assessment_responses TO service_role;

ALTER TABLE public.assessment_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ar_all_own" ON public.assessment_responses
  FOR ALL TO authenticated
  USING (mentor_id = auth.uid())
  WITH CHECK (mentor_id = auth.uid());

CREATE INDEX idx_assessment_responses_mentor ON public.assessment_responses(mentor_id);
CREATE INDEX idx_assessment_responses_person ON public.assessment_responses(person_id);

ALTER TABLE public.test_responses
  ADD COLUMN assessment_response_id uuid NULL REFERENCES public.assessment_responses(id) ON DELETE CASCADE,
  ADD COLUMN assessment_sort int NOT NULL DEFAULT 0;

CREATE INDEX idx_test_responses_assessment ON public.test_responses(assessment_response_id);