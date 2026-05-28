
CREATE TABLE public.line_inputs_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  line_input_id uuid,
  line_code text,
  bu text,
  customer_id uuid,
  department text,
  old_value numeric,
  new_value numeric,
  old_row jsonb,
  new_row jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.line_inputs_audit TO authenticated;
GRANT ALL ON public.line_inputs_audit TO service_role;

ALTER TABLE public.line_inputs_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_admin_select" ON public.line_inputs_audit
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "audit_system_insert" ON public.line_inputs_audit
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_line_inputs_audit_changed_at ON public.line_inputs_audit (changed_at DESC);
CREATE INDEX idx_line_inputs_audit_line_code ON public.line_inputs_audit (line_code);

CREATE OR REPLACE FUNCTION public.log_line_inputs_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.line_inputs_audit (action, line_input_id, line_code, bu, customer_id, department, old_value, new_value, new_row, changed_by)
    VALUES ('INSERT', NEW.id, NEW.line_code, NEW.bu, NEW.customer_id, NEW.department, NULL, NEW.value, to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.line_inputs_audit (action, line_input_id, line_code, bu, customer_id, department, old_value, new_value, old_row, new_row, changed_by)
    VALUES ('UPDATE', NEW.id, NEW.line_code, NEW.bu, NEW.customer_id, NEW.department, OLD.value, NEW.value, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.line_inputs_audit (action, line_input_id, line_code, bu, customer_id, department, old_value, new_value, old_row, changed_by)
    VALUES ('DELETE', OLD.id, OLD.line_code, OLD.bu, OLD.customer_id, OLD.department, OLD.value, NULL, to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

REVOKE EXECUTE ON FUNCTION public.log_line_inputs_changes() FROM PUBLIC, authenticated, anon;

DROP TRIGGER IF EXISTS line_inputs_audit_trg ON public.line_inputs;
CREATE TRIGGER line_inputs_audit_trg
AFTER INSERT OR UPDATE OR DELETE ON public.line_inputs
FOR EACH ROW EXECUTE FUNCTION public.log_line_inputs_changes();
