
-- 1. is_guest flag + helper + protect trigger
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_guest(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_guest FROM public.profiles WHERE id = _user_id), false)
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_guest()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.is_guest IS DISTINCT FROM NEW.is_guest AND NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can change guest flag';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_profile_guest_trg ON public.profiles;
CREATE TRIGGER protect_profile_guest_trg BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_guest();

-- 2. Guest-blocking write policies
DROP POLICY IF EXISTS customers_write_admin ON public.customers;
DROP POLICY IF EXISTS customers_update_admin ON public.customers;
DROP POLICY IF EXISTS customers_delete_admin ON public.customers;
CREATE POLICY customers_write_admin ON public.customers FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(),'admin'::app_role) OR (is_approved(auth.uid()) AND auth.uid() = created_by)) AND NOT is_guest(auth.uid()));
CREATE POLICY customers_update_admin ON public.customers FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR (is_approved(auth.uid()) AND auth.uid() = created_by)) AND NOT is_guest(auth.uid()));
CREATE POLICY customers_delete_admin ON public.customers FOR DELETE TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR (is_approved(auth.uid()) AND auth.uid() = created_by)) AND NOT is_guest(auth.uid()));

DROP POLICY IF EXISTS inputs_write_own_dept ON public.line_inputs;
DROP POLICY IF EXISTS inputs_update_own_dept ON public.line_inputs;
DROP POLICY IF EXISTS inputs_delete_own_dept ON public.line_inputs;
CREATE POLICY inputs_write_own_dept ON public.line_inputs FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(),'admin'::app_role) OR (is_approved(auth.uid()) AND department = current_department())) AND NOT is_guest(auth.uid()));
CREATE POLICY inputs_update_own_dept ON public.line_inputs FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR (is_approved(auth.uid()) AND department = current_department())) AND NOT is_guest(auth.uid()));
CREATE POLICY inputs_delete_own_dept ON public.line_inputs FOR DELETE TO authenticated
  USING ((has_role(auth.uid(),'admin'::app_role) OR (is_approved(auth.uid()) AND department = current_department())) AND NOT is_guest(auth.uid()));

DROP POLICY IF EXISTS org_write_admin ON public.org_nodes;
DROP POLICY IF EXISTS org_update_admin ON public.org_nodes;
DROP POLICY IF EXISTS org_delete_admin ON public.org_nodes;
CREATE POLICY org_write_admin ON public.org_nodes FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND NOT is_guest(auth.uid()));
CREATE POLICY org_update_admin ON public.org_nodes FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) AND NOT is_guest(auth.uid()));
CREATE POLICY org_delete_admin ON public.org_nodes FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) AND NOT is_guest(auth.uid()));

DROP POLICY IF EXISTS salaries_admin_insert ON public.org_node_salaries;
DROP POLICY IF EXISTS salaries_admin_update ON public.org_node_salaries;
DROP POLICY IF EXISTS salaries_admin_delete ON public.org_node_salaries;
CREATE POLICY salaries_admin_insert ON public.org_node_salaries FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) AND NOT is_guest(auth.uid()));
CREATE POLICY salaries_admin_update ON public.org_node_salaries FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) AND NOT is_guest(auth.uid()));
CREATE POLICY salaries_admin_delete ON public.org_node_salaries FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) AND NOT is_guest(auth.uid()));

-- 3. Guest user
ALTER TABLE public.profiles DISABLE TRIGGER USER;
DO $$
DECLARE guest_id uuid;
BEGIN
  SELECT id INTO guest_id FROM auth.users WHERE email = 'convidado@cascata.app';
  IF guest_id IS NULL THEN
    guest_id := '00000000-0000-0000-0000-00000000c4e5'::uuid;
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      guest_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'convidado@cascata.app', crypt('cascata-demo-2026', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Convidado Cascata"}'::jsonb,
      now(), now(), '', '', '', ''
    );
  END IF;
  INSERT INTO public.profiles (id, full_name, department, is_approved, is_guest)
    VALUES (guest_id, 'Convidado Cascata', NULL, true, true)
    ON CONFLICT (id) DO UPDATE SET is_approved = true, is_guest = true, full_name = 'Convidado Cascata';
  DELETE FROM public.user_roles WHERE user_id = guest_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (guest_id, 'member');
END $$;
ALTER TABLE public.profiles ENABLE TRIGGER USER;

-- 4. Clean prior demo rows
DELETE FROM public.line_inputs WHERE customer_id IN (
  '00000000-0000-0000-0000-0000000c0001'::uuid,'00000000-0000-0000-0000-0000000c0002'::uuid,
  '00000000-0000-0000-0000-0000000c0003'::uuid,'00000000-0000-0000-0000-0000000c0004'::uuid,
  '00000000-0000-0000-0000-0000000c0005'::uuid);
DELETE FROM public.customers WHERE id IN (
  '00000000-0000-0000-0000-0000000c0001'::uuid,'00000000-0000-0000-0000-0000000c0002'::uuid,
  '00000000-0000-0000-0000-0000000c0003'::uuid,'00000000-0000-0000-0000-0000000c0004'::uuid,
  '00000000-0000-0000-0000-0000000c0005'::uuid);
DELETE FROM public.org_node_salaries WHERE org_node_id IN (SELECT id FROM public.org_nodes WHERE bu IN ('B2B','B2C'));
DELETE FROM public.org_nodes WHERE bu IN ('B2B','B2C');

-- Customers: 3 B2B + 2 B2C
INSERT INTO public.customers (id, bu, customer_name, account_name, account_id, cnpj, attrs, created_by) VALUES
  ('00000000-0000-0000-0000-0000000c0001','B2B','Vortex Analytics','Vortex Holding','ACC-1001','12.345.678/0001-90','{"segmento":"Enterprise","vertical":"Fintech","tier":"Strategic"}'::jsonb, NULL),
  ('00000000-0000-0000-0000-0000000c0002','B2B','Helena Cosméticos','Helena Beauty Group','ACC-1002','23.456.789/0001-01','{"segmento":"Mid-market","vertical":"Retail","tier":"Growth"}'::jsonb, NULL),
  ('00000000-0000-0000-0000-0000000c0003','B2B','Nordeste Logística','Nordeste Transportes','ACC-1003','34.567.890/0001-12','{"segmento":"Mid-market","vertical":"Logistics","tier":"Standard"}'::jsonb, NULL),
  ('00000000-0000-0000-0000-0000000c0004','B2C','Studio Fitness 24h',NULL,'ACC-2001',NULL,'{"segmento":"SMB","vertical":"Wellness","tier":"Self-serve"}'::jsonb, NULL),
  ('00000000-0000-0000-0000-0000000c0005','B2C','Bistrô Lumière',NULL,'ACC-2002',NULL,'{"segmento":"SMB","vertical":"Food&Bev","tier":"Self-serve"}'::jsonb, NULL);

-- Org: 2 levels per BU
WITH bu_root AS (
  INSERT INTO public.org_nodes (id, parent_id, bu, department, leader) VALUES
    ('00000000-0000-0000-0000-0000000d0001'::uuid, NULL, 'B2B', NULL, 'Camila Tavares'),
    ('00000000-0000-0000-0000-0000000d0002'::uuid, NULL, 'B2C', NULL, 'Rafael Monteiro')
  RETURNING id, bu
)
INSERT INTO public.org_nodes (id, parent_id, bu, department, leader)
SELECT gen_random_uuid(), r.id, r.bu, d.department, d.leader
FROM bu_root r
CROSS JOIN (VALUES
  ('Comercial','Beatriz Lemos'),('Marketing','Igor Pacheco'),('CS','Daniela Castro'),
  ('Suporte','Marcos Vinicius'),('PS','Letícia Andrade'),('PS/Onboarding','Letícia Andrade'),
  ('Produto','André Sicupira'),('Engenharia','Paulo Drumond'),('Tech/Infra','Renata Yoshida'),
  ('Financeiro','Cláudio Bernardes'),('Fiscal','Tatiana Reis'),('G&A','Mariana Coelho')
) AS d(department, leader);

INSERT INTO public.org_node_salaries (org_node_id, salary)
SELECT id, CASE department
  WHEN 'Comercial' THEN 320000 WHEN 'Marketing' THEN 210000
  WHEN 'CS' THEN 180000 WHEN 'Suporte' THEN 140000
  WHEN 'PS' THEN 160000 WHEN 'PS/Onboarding' THEN 130000
  WHEN 'Produto' THEN 280000 WHEN 'Engenharia' THEN 520000
  WHEN 'Tech/Infra' THEN 240000 WHEN 'Financeiro' THEN 150000
  WHEN 'Fiscal' THEN 90000 WHEN 'G&A' THEN 200000
  ELSE 450000 END
FROM public.org_nodes WHERE bu IN ('B2B','B2C');

-- Line inputs: all 62 codes per customer
INSERT INTO public.line_inputs (bu, customer_id, line_code, department, priority, value, ai_extraction, updated_by)
SELECT
  c.bu, c.id, w.code, w.department,
  CASE WHEN w.sub_no IS NOT NULL THEN 'P2' ELSE 'P1' END,
  ROUND(
    (CASE c.customer_name
      WHEN 'Vortex Analytics' THEN 480000
      WHEN 'Helena Cosméticos' THEN 240000
      WHEN 'Nordeste Logística' THEN 180000
      WHEN 'Studio Fitness 24h' THEN 28000
      ELSE 14500 END)
    *
    (CASE w.category
      WHEN '1. RECEITA BRUTA' THEN 1.00
      WHEN '2. DEDUÇÕES COMERCIAIS' THEN -0.12
      WHEN '3. IMPOSTOS' THEN -0.09
      WHEN '4. CUSTO DIRETO (COGS)' THEN -0.28
      WHEN '5. CUSTO DE ATENDIMENTO' THEN -0.07
      WHEN '6. CUSTO DE AQUISIÇÃO (CAC)' THEN -0.11
      WHEN '7. CUSTO DE PRODUTO ALOCADO' THEN -0.08
      WHEN '8. CUSTO INDIRETO (G&A)' THEN -0.05
      ELSE -0.04 END)
    *
    (0.6 + (abs(hashtext(c.customer_name||w.code)) % 80)::numeric / 100.0)
    *
    (CASE WHEN w.sub_no IS NOT NULL THEN 0.04 ELSE 1.0 END)
  , 2),
  jsonb_build_object('source','seed','confidence',0.95),
  NULL
FROM public.customers c
CROSS JOIN public.waterfall_lines w
WHERE c.id IN (
  '00000000-0000-0000-0000-0000000c0001'::uuid,'00000000-0000-0000-0000-0000000c0002'::uuid,
  '00000000-0000-0000-0000-0000000c0003'::uuid,'00000000-0000-0000-0000-0000000c0004'::uuid,
  '00000000-0000-0000-0000-0000000c0005'::uuid);
