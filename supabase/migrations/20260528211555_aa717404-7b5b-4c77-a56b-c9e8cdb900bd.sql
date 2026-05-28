
-- Drop overly broad legacy policies
DROP POLICY IF EXISTS "inputs_bucket_read_auth" ON storage.objects;
DROP POLICY IF EXISTS "inputs_bucket_write_auth" ON storage.objects;

-- Recreate scoped policies with approval check
DROP POLICY IF EXISTS "inputs_select_own" ON storage.objects;
CREATE POLICY "inputs_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'inputs'
    AND (
      (auth.uid()::text = (storage.foldername(name))[1] AND public.is_approved(auth.uid()))
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "inputs_insert_own" ON storage.objects;
CREATE POLICY "inputs_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'inputs'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))
  );

DROP POLICY IF EXISTS "inputs_update_own" ON storage.objects;
CREATE POLICY "inputs_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'inputs'
    AND (
      (auth.uid()::text = (storage.foldername(name))[1] AND public.is_approved(auth.uid()))
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "inputs_delete_own" ON storage.objects;
CREATE POLICY "inputs_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'inputs'
    AND (
      (auth.uid()::text = (storage.foldername(name))[1] AND public.is_approved(auth.uid()))
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );
