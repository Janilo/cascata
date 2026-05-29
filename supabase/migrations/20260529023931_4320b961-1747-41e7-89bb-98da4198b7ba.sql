-- Helper: resolve owning department for a line code (sublines inherit from main)
CREATE OR REPLACE FUNCTION public.line_owner_department(_line_code text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department
  FROM public.waterfall_lines
  WHERE code = split_part(_line_code, '.', 1)
    AND kind = 'main'
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.line_owner_department(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.line_owner_department(text) TO authenticated, service_role;

-- Tighten write policies on line_inputs: user's dept must own the line
DROP POLICY IF EXISTS inputs_write_own_dept ON public.line_inputs;
CREATE POLICY inputs_write_own_dept
ON public.line_inputs
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role)
   OR (
     is_approved(auth.uid())
     AND department = current_department()
     AND current_department() = public.line_owner_department(line_code)
   ))
  AND NOT is_guest(auth.uid())
);

DROP POLICY IF EXISTS inputs_update_own_dept ON public.line_inputs;
CREATE POLICY inputs_update_own_dept
ON public.line_inputs
FOR UPDATE
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role)
   OR (
     is_approved(auth.uid())
     AND department = current_department()
     AND current_department() = public.line_owner_department(line_code)
   ))
  AND NOT is_guest(auth.uid())
);

DROP POLICY IF EXISTS inputs_delete_own_dept ON public.line_inputs;
CREATE POLICY inputs_delete_own_dept
ON public.line_inputs
FOR DELETE
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role)
   OR (
     is_approved(auth.uid())
     AND department = current_department()
     AND current_department() = public.line_owner_department(line_code)
   ))
  AND NOT is_guest(auth.uid())
);