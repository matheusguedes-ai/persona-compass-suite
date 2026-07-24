
DROP POLICY IF EXISTS tr_public_read ON public.test_responses;
DROP POLICY IF EXISTS tr_public_update ON public.test_responses;
DROP POLICY IF EXISTS ta_public ON public.test_answers;
REVOKE ALL ON public.test_responses FROM anon;
REVOKE ALL ON public.test_answers FROM anon;
