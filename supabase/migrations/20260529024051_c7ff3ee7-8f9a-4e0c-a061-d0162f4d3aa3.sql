CREATE TABLE IF NOT EXISTS public.business_units (
  code text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_units TO authenticated;
GRANT ALL ON public.business_units TO service_role;

ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY bu_select ON public.business_units
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_approved(auth.uid()));

CREATE POLICY bu_insert ON public.business_units
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND NOT is_guest(auth.uid()));

CREATE POLICY bu_update ON public.business_units
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND NOT is_guest(auth.uid()));

CREATE POLICY bu_delete ON public.business_units
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND NOT is_guest(auth.uid()));

INSERT INTO public.business_units (code, label, sort_order) VALUES
  ('B2B', 'B2B', 1),
  ('B2C', 'B2C', 2)
ON CONFLICT (code) DO NOTHING;