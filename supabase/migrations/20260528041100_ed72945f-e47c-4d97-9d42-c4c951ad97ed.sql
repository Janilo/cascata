
DROP POLICY IF EXISTS "audit_system_insert" ON public.line_inputs_audit;
CREATE POLICY "audit_self_insert" ON public.line_inputs_audit
  FOR INSERT TO authenticated
  WITH CHECK (changed_by = auth.uid());
