CREATE OR REPLACE FUNCTION public.protect_profile_department()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.department IS DISTINCT FROM NEW.department AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can change department';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profile_dept_guard ON public.profiles;
CREATE TRIGGER profile_dept_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_department();