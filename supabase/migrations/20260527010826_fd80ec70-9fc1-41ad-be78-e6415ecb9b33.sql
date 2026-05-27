
-- 1) Move salaries to admin-only table
CREATE TABLE IF NOT EXISTS public.org_node_salaries (
  org_node_id uuid PRIMARY KEY,
  salary numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_node_salaries TO authenticated;
GRANT ALL ON public.org_node_salaries TO service_role;

ALTER TABLE public.org_node_salaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salaries_admin_select" ON public.org_node_salaries
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "salaries_admin_insert" ON public.org_node_salaries
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "salaries_admin_update" ON public.org_node_salaries
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "salaries_admin_delete" ON public.org_node_salaries
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Migrate existing salaries then drop the column
INSERT INTO public.org_node_salaries (org_node_id, salary)
SELECT id, COALESCE(salary, 0) FROM public.org_nodes
WHERE salary IS NOT NULL AND salary <> 0
ON CONFLICT (org_node_id) DO UPDATE SET salary = EXCLUDED.salary;

ALTER TABLE public.org_nodes DROP COLUMN IF EXISTS salary;

-- 2) Tighten org_nodes & customers policies (writes admin-only; reads stay open to authenticated)
DROP POLICY IF EXISTS org_all_auth ON public.org_nodes;
CREATE POLICY "org_select_auth" ON public.org_nodes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "org_write_admin" ON public.org_nodes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "org_update_admin" ON public.org_nodes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "org_delete_admin" ON public.org_nodes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS customers_all_auth ON public.customers;
CREATE POLICY "customers_select_auth" ON public.customers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers_write_admin" ON public.customers
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = created_by);
CREATE POLICY "customers_update_admin" ON public.customers
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = created_by);
CREATE POLICY "customers_delete_admin" ON public.customers
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = created_by);

-- 3) Storage policies for 'inputs' bucket scoped by user folder (path: <userId>/...)
DROP POLICY IF EXISTS "inputs_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "inputs_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "inputs select" ON storage.objects;
DROP POLICY IF EXISTS "inputs insert" ON storage.objects;

CREATE POLICY "inputs_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'inputs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "inputs_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'inputs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "inputs_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'inputs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "inputs_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'inputs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));
