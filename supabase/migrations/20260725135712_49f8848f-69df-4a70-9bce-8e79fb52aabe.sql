ALTER TABLE public.test_responses
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS parent_response_id uuid NULL REFERENCES public.test_responses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS rater_name text NULL;

ALTER TABLE public.test_responses
  DROP CONSTRAINT IF EXISTS test_responses_kind_check;
ALTER TABLE public.test_responses
  ADD CONSTRAINT test_responses_kind_check CHECK (kind IN ('self','observer'));

CREATE INDEX IF NOT EXISTS idx_test_responses_parent ON public.test_responses(parent_response_id);