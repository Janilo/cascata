CREATE TABLE public.shared_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  bu text NOT NULL CHECK (bu IN ('B2B','B2C')),
  reference_date date,
  expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  label text
);

GRANT SELECT, INSERT, DELETE ON public.shared_links TO authenticated;
GRANT ALL ON public.shared_links TO service_role;

ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY shared_links_select ON public.shared_links
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR (is_approved(auth.uid()) AND created_by = auth.uid()));

CREATE POLICY shared_links_insert ON public.shared_links
  FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(),'admin'::app_role) OR is_approved(auth.uid())) AND created_by = auth.uid() AND NOT is_guest(auth.uid()));

CREATE POLICY shared_links_delete ON public.shared_links
  FOR DELETE TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR (is_approved(auth.uid()) AND created_by = auth.uid())) AND NOT is_guest(auth.uid()));

CREATE INDEX idx_shared_links_token ON public.shared_links(token);
CREATE INDEX idx_shared_links_created_by ON public.shared_links(created_by);