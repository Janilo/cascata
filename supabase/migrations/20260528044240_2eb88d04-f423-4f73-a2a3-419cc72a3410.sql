
-- 1) handle_new_user: ignore client-supplied department
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, department, is_approved)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NULL,
    lower(NEW.email) = 'janilo@pereirasaraiva.com'
  );

  IF lower(NEW.email) = 'janilo@pereirasaraiva.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $function$;

-- 2) Audit log: remove client INSERT path; trigger (SECURITY DEFINER) handles all writes
DROP POLICY IF EXISTS audit_self_insert ON public.line_inputs_audit;
REVOKE INSERT ON public.line_inputs_audit FROM authenticated;
