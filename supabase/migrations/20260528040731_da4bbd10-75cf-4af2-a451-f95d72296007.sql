-- 1. Add flag
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

-- Bootstrap: approve existing admins
UPDATE public.profiles SET is_approved = true
WHERE id IN (SELECT user_id FROM public.user_roles WHERE role = 'admin');

-- 2. Helper
CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_approved FROM public.profiles WHERE id = _user_id), false)
$$;
REVOKE EXECUTE ON FUNCTION public.is_approved(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated, service_role;

-- 3. Trigger: block self-approval
CREATE OR REPLACE FUNCTION public.protect_profile_approval()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.is_approved IS DISTINCT FROM NEW.is_approved AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can change approval status';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.protect_profile_approval() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profile_approval_guard ON public.profiles;
CREATE TRIGGER profile_approval_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_approval();

-- 4. Admins can update profiles (to approve)
DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. Update auto-approve admin via handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, department, is_approved)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'department',
    lower(NEW.email) = 'janilo@pereirasaraiva.com'
  );

  IF lower(NEW.email) = 'janilo@pereirasaraiva.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

-- 6. Tighten RLS: only admin OR approved members
-- customers
DROP POLICY IF EXISTS customers_select_auth ON public.customers;
CREATE POLICY customers_select_auth ON public.customers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_approved(auth.uid()));

DROP POLICY IF EXISTS customers_write_admin ON public.customers;
CREATE POLICY customers_write_admin ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR (public.is_approved(auth.uid()) AND auth.uid() = created_by));

DROP POLICY IF EXISTS customers_update_admin ON public.customers;
CREATE POLICY customers_update_admin ON public.customers
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR (public.is_approved(auth.uid()) AND auth.uid() = created_by));

DROP POLICY IF EXISTS customers_delete_admin ON public.customers;
CREATE POLICY customers_delete_admin ON public.customers
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR (public.is_approved(auth.uid()) AND auth.uid() = created_by));

-- line_inputs
DROP POLICY IF EXISTS inputs_read_all ON public.line_inputs;
CREATE POLICY inputs_read_all ON public.line_inputs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_approved(auth.uid()));

DROP POLICY IF EXISTS inputs_write_own_dept ON public.line_inputs;
CREATE POLICY inputs_write_own_dept ON public.line_inputs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR (public.is_approved(auth.uid()) AND department = public.current_department()));

DROP POLICY IF EXISTS inputs_update_own_dept ON public.line_inputs;
CREATE POLICY inputs_update_own_dept ON public.line_inputs
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR (public.is_approved(auth.uid()) AND department = public.current_department()));

DROP POLICY IF EXISTS inputs_delete_own_dept ON public.line_inputs;
CREATE POLICY inputs_delete_own_dept ON public.line_inputs
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR (public.is_approved(auth.uid()) AND department = public.current_department()));

-- org_nodes
DROP POLICY IF EXISTS org_select_auth ON public.org_nodes;
CREATE POLICY org_select_auth ON public.org_nodes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_approved(auth.uid()));

-- waterfall_lines
DROP POLICY IF EXISTS lines_read_all ON public.waterfall_lines;
CREATE POLICY lines_read_all ON public.waterfall_lines
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_approved(auth.uid()));