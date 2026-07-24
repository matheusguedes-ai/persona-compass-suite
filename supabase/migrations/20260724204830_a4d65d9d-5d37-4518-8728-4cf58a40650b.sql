
ALTER TABLE public.test_result_bands
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'natural';

ALTER TABLE public.test_result_bands
  DROP CONSTRAINT IF EXISTS test_result_bands_mode_check;
ALTER TABLE public.test_result_bands
  ADD CONSTRAINT test_result_bands_mode_check CHECK (mode IN ('natural','adaptado'));
