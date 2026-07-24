
-- 1) Prevent mentors from turning their own versions into global templates via UPDATE
DROP POLICY IF EXISTS tv_update_own ON public.test_versions;
CREATE POLICY tv_update_own ON public.test_versions
  FOR UPDATE
  USING (mentor_id = auth.uid())
  WITH CHECK (mentor_id = auth.uid() AND is_template = false);

-- 2) Enforce allowed status values on test_responses
ALTER TABLE public.test_responses
  DROP CONSTRAINT IF EXISTS test_responses_status_check;
ALTER TABLE public.test_responses
  ADD CONSTRAINT test_responses_status_check
  CHECK (status IN ('pending','in_progress','submitted'));

-- 3) Migrate linear_scale configs to reference dimension_id (UUID) instead of dimension_key (mutable string)
UPDATE public.test_questions q
SET config = (COALESCE(q.config, '{}'::jsonb) - 'dimension_key')
             || jsonb_build_object('dimension_id', d.id::text)
FROM public.test_dimensions d
WHERE q.type = 'linear_scale'
  AND d.version_id = q.version_id
  AND q.config ? 'dimension_key'
  AND (q.config ->> 'dimension_key') = d.key
  AND NOT (q.config ? 'dimension_id');
