ALTER TABLE public.line_inputs
  ADD COLUMN IF NOT EXISTS reference_date date;

UPDATE public.line_inputs
  SET reference_date = date_trunc('month', now())::date
  WHERE reference_date IS NULL;

ALTER TABLE public.line_inputs
  ALTER COLUMN reference_date SET NOT NULL,
  ALTER COLUMN reference_date SET DEFAULT date_trunc('month', now())::date;

CREATE INDEX IF NOT EXISTS idx_line_inputs_reference_date
  ON public.line_inputs (reference_date);

CREATE INDEX IF NOT EXISTS idx_line_inputs_dept_ref
  ON public.line_inputs (department, reference_date);