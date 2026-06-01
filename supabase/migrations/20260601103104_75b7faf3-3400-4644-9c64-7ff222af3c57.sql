
-- Revoke direct EXECUTE on internal SECURITY DEFINER helpers.
-- These functions are used inside RLS policies and triggers; Postgres
-- evaluates them in those contexts without requiring EXECUTE on the
-- calling role, so revoking public/anon/authenticated access is safe.

DO $$
DECLARE
  fn text;
BEGIN
  FOR fn IN
    SELECT unnest(ARRAY[
      'public.current_department()',
      'public.has_role(uuid, public.app_role)',
      'public.is_approved(uuid)',
      'public.is_guest(uuid)',
      'public.line_owner_department(text)',
      'public.handle_new_user()',
      'public.protect_profile_approval()',
      'public.protect_profile_department()',
      'public.protect_profile_guest()',
      'public.log_line_inputs_changes()'
    ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
  END LOOP;
END $$;
