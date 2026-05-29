ALTER TABLE public.line_inputs
  DROP CONSTRAINT IF EXISTS line_inputs_line_code_customer_id_bu_key;

ALTER TABLE public.line_inputs
  ADD CONSTRAINT line_inputs_line_code_customer_id_bu_ref_key
  UNIQUE (line_code, customer_id, bu, reference_date);