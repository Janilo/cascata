-- Roles
CREATE TYPE public.app_role AS ENUM ('admin','member');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid()=id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid()=id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_self" ON public.user_roles FOR SELECT TO authenticated USING (user_id=auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

CREATE OR REPLACE FUNCTION public.current_department()
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT department FROM public.profiles WHERE id=auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE PLPGSQL SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, department)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'department');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.waterfall_lines (
  code TEXT PRIMARY KEY,
  category TEXT,
  label TEXT,
  department TEXT,
  p1_desc TEXT,
  p2_desc TEXT,
  p3_desc TEXT,
  kind TEXT NOT NULL,
  bucket TEXT NOT NULL,
  main_no INTEGER,
  sub_no NUMERIC,
  sort_order INTEGER NOT NULL
);
GRANT SELECT ON public.waterfall_lines TO authenticated;
GRANT ALL ON public.waterfall_lines TO service_role;
ALTER TABLE public.waterfall_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lines_read_all" ON public.waterfall_lines FOR SELECT TO authenticated USING (true);

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT,
  account_name TEXT,
  customer_name TEXT NOT NULL,
  cnpj TEXT,
  bu TEXT NOT NULL CHECK (bu IN ('B2B','B2C')),
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers_all_auth" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.org_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.org_nodes(id) ON DELETE CASCADE,
  bu TEXT,
  department TEXT,
  leader TEXT,
  channel TEXT,
  account TEXT,
  customer TEXT,
  salary NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_nodes TO authenticated;
GRANT ALL ON public.org_nodes TO service_role;
ALTER TABLE public.org_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_all_auth" ON public.org_nodes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.line_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_code TEXT NOT NULL REFERENCES public.waterfall_lines(code),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  bu TEXT NOT NULL,
  department TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'P1',
  value NUMERIC,
  rateio_key TEXT,
  file_path TEXT,
  ai_extraction JSONB,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(line_code, customer_id, bu)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.line_inputs TO authenticated;
GRANT ALL ON public.line_inputs TO service_role;
ALTER TABLE public.line_inputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inputs_read_all" ON public.line_inputs FOR SELECT TO authenticated USING (true);
CREATE POLICY "inputs_write_own_dept" ON public.line_inputs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR department = public.current_department());
CREATE POLICY "inputs_update_own_dept" ON public.line_inputs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR department = public.current_department());
CREATE POLICY "inputs_delete_own_dept" ON public.line_inputs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR department = public.current_department());

INSERT INTO storage.buckets (id, name, public) VALUES ('inputs','inputs', false)
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "inputs_bucket_read_auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='inputs');
CREATE POLICY "inputs_bucket_write_auth" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='inputs');

INSERT INTO public.waterfall_lines (code,category,label,department,p1_desc,p2_desc,p3_desc,kind,bucket,main_no,sub_no,sort_order) VALUES
('1','1. RECEITA BRUTA','Assinaturas recorrentes (MRR/ARR) — plano base, seats, add-ons','Comercial','Faturamento por cliente no billing','Contrato vigente × preço tabela','Rateio por # seats ativos','main','revenue',1,NULL,0),
('2','1. RECEITA BRUTA','Setup / Onboarding (one-time)','Comercial','NF emitida por cliente','Contrato + cronograma de cobrança','Rateio por novos clientes do período','main','revenue',2,NULL,1),
('3','1. RECEITA BRUTA','Serviços profissionais (consultoria, customização)','PS','Timesheet apontado por cliente','Escopo contratado × valor/hora','Rateio proporcional ao ARR','main','revenue',3,NULL,2),
('4','1. RECEITA BRUTA','Receita de uso/consumo (API, storage, transações)','Produto','Metering direto da plataforma','Logs agregados por tenant','Rateio por tier de plano','main','revenue',4,NULL,3),
('5','1. RECEITA BRUTA','Add-ons / Marketplace','Comercial','Billing por cliente','Ativações registradas no produto','Rateio por # clientes ativos no módulo','main','revenue',5,NULL,4),
('6','2. DEDUÇÕES DE RECEITA','Impostos s/ receita (PIS, COFINS, ISS)','Fiscal','Cálculo por NF emitida','Alíquota efetiva × receita bruta do cliente','Alíquota média × receita rateada','main','deduction',6,NULL,5),
('7','2. DEDUÇÕES DE RECEITA','Descontos comerciais (total — soma das 33 políticas abaixo)','Comercial','Discount reason code no CPQ/CRM','Δ entre preço tabela e preço faturado','Desconto médio por segmento','main','deduction',7,NULL,6),
('7.1','  └ Volume','Volume seats/usuários','Comercial','Tier aplicado registrado no CPQ por deal','Calc: # seats × regra de tier','Rateio por # seats','sub','cost',7,7.1,7),
('7.2','  └ Volume','Volume de consumo (API/GB/trans.)','Comercial','Tier de uso logado no billing','Consumo × tabela de tiers','Rateio por consumo','sub','cost',7,7.2,8),
('7.3','  └ Volume','Volume financeiro (ARR)','Comercial','Desconto ARR registrado no contrato','Calc: ARR × régua de desconto','Rateio por ARR','sub','cost',7,7.3,9),
('7.4','  └ Prazo','Multi-year discount','Comercial','Flag multi-year + desconto no CPQ','Δ vs preço 1 ano × duração','Rateio por contratos multi-year','sub','cost',7,7.4,10),
('7.5','  └ Prazo','Prepayment (pagto anual antecipado)','Comercial','Flag prepay no contrato','Δ vs pagto mensal','Rateio por receita prepaga','sub','cost',7,7.5,11),
('7.6','  └ Prazo','Auto-renewal discount','Comercial','Flag auto-renew no contrato','Δ vs renovação manual','Rateio por clientes auto-renew','sub','cost',7,7.6,12),
('7.7','  └ Prazo','Early renewal discount','Comercial','Data de renovação vs vencimento + bônus','Δ aplicado por renovação antecip.','Rateio por renovações antecip.','sub','cost',7,7.7,13),
('7.8','  └ Segmento','Segmento (SMB/MM/Enterprise)','Comercial','Segmento no CRM × tabela do segmento','Δ vs tabela master por segmento','Rateio por receita do segmento','sub','cost',7,7.8,14),
('7.9','  └ Segmento','Vertical / indústria','Comercial','Vertical no CRM + tabela setorial','Δ vs tabela master por vertical','Rateio por receita da vertical','sub','cost',7,7.9,15),
('7.10','  └ Segmento','Geográfico / PPP','Comercial','País no contrato × tabela regional','Δ vs tabela US$ ajustada por PPP','Rateio por receita geográfica','sub','cost',7,7.10,16),
('7.11','  └ Segmento','Startup program','Comercial','Flag de programa no CRM','Δ vs tabela padrão SMB','Rateio por clientes startup','sub','cost',7,7.11,17),
('7.12','  └ Segmento','Academic / non-profit','Comercial','Flag de programa + verificação documental','Δ vs tabela comercial','Rateio por clientes do programa','sub','cost',7,7.12,18),
('7.13','  └ Promo','New logo discount','Comercial','Flag ''new logo'' + desconto no CPQ','Δ aplicado em 1º contrato','CAC promo médio × novos clientes','sub','cost',7,7.13,19),
('7.14','  └ Promo','Black Friday / sazonal','Comercial','Código promo aplicado no checkout/CPQ','Desconto por campanha × deals','Rateio por deals no período','sub','cost',7,7.14,20),
('7.15','  └ Promo','Win-back (recuperação de churn)','Comercial','Flag win-back no CRM + desconto','Δ aplicado em reativação','Rateio por clientes reativados','sub','cost',7,7.15,21),
('7.16','  └ Promo','Free trial → paid (conversão)','Comercial','Origem trial registrada no billing','Δ vs preço cheio em conversão','Rateio por conversões','sub','cost',7,7.16,22),
('7.17','  └ Bundle','Bundle multi-produto','Comercial','Combo registrado no CPQ + bundle disc.','Δ vs soma de produtos avulsos','Rateio por receita em bundle','sub','cost',7,7.17,23),
('7.18','  └ Bundle','Add-on attach discount','Comercial','Flag attach + desconto no CPQ','Δ vs preço avulso do add-on','Rateio por add-ons vendidos','sub','cost',7,7.18,24),
('7.19','  └ Bundle','Family pricing (suíte)','Comercial','Família registrada no contrato','Δ vs soma de módulos','Rateio por receita da suíte','sub','cost',7,7.19,25),
('7.20','  └ Estratégico','Strategic account / lighthouse logo','Comercial','Flag strategic + aprovação no CPQ','Δ vs tabela do segmento','Rateio por contas strategic','sub','cost',7,7.20,26),
('7.21','  └ Estratégico','Case study / co-marketing','Comercial','Acordo de co-mkt + desconto registrado','Δ vs preço cheio','Rateio por contas co-mkt','sub','cost',7,7.21,27),
('7.22','  └ Estratégico','Competitive displacement','Comercial','Flag competitive + concorrente no CRM','Δ vs tabela padrão','Rateio por wins competitivos','sub','cost',7,7.22,28),
('7.23','  └ Estratégico','Executive override / CEO discount','Comercial','Aprovação registrada no CPQ + reason','Δ acima da alçada padrão','Rateio por deals aprovados','sub','cost',7,7.23,29),
('7.24','  └ Canal','Channel partner / reseller margin','Comercial','Margem de canal no contrato de revenda','% partner × receita do canal','Rateio por receita do canal','sub','cost',7,7.24,30),
('7.25','  └ Canal','Referral discount','Comercial','Programa de referral no CRM','Δ aplicado em indicados','Rateio por clientes indicados','sub','cost',7,7.25,31),
('7.26','  └ Canal','Marketplace fee (AWS, Azure, etc.)','Comercial','Fee descontado direto pelo marketplace','% marketplace × receita canal','Rateio por receita marketplace','sub','cost',7,7.26,32),
('7.27','  └ Retenção','Loyalty (cliente X+ anos)','Comercial','Tempo de casa no CRM + régua de loyalty','Δ vs tabela atual','Rateio por clientes >X anos','sub','cost',7,7.27,33),
('7.28','  └ Retenção','Grandfathering (preço congelado)','Comercial','Flag grandfathered no billing','Δ vs tabela vigente','Rateio por clientes legados','sub','cost',7,7.28,34),
('7.29','  └ Retenção','Save offer / retention discount','Comercial','Caso de save registrado pelo CS + desc.','Δ aplicado em contas em risco','Rateio por contas em risco','sub','cost',7,7.29,35),
('7.30','  └ Retenção','Expansion discount (upsell base)','Comercial','Desconto em expansion registrado no CPQ','Δ em upsell vs preço cheio','Rateio por receita de expansion','sub','cost',7,7.30,36),
('7.31','  └ Contratual','Price hold / cap de reajuste','Comercial','Cap registrado em cláusula contratual','Δ entre reajuste pleno e cap','Rateio por contratos com cap','sub','cost',7,7.31,37),
('7.32','  └ Contratual','Ramp deal (preço crescente)','Comercial','Cronograma de ramp no contrato','Δ entre preço-alvo e preço atual','Rateio por contratos em ramp','sub','cost',7,7.32,38),
('7.33','  └ Contratual','Credit notes / SLA breach','Comercial','Nota de crédito emitida por cliente','Tickets de SLA × valor compensado','Rateio por clientes impactados','sub','cost',7,7.33,39),
('8','2. DEDUÇÕES DE RECEITA','Cancelamentos / refunds / chargebacks','Financeiro','Lançamento direto por cliente (gateway)','Tickets de cancelamento × valor contratual','Churn médio × receita rateada','main','deduction',8,NULL,40),
('9','3. CPV','Cloud (AWS/GCP/Azure)','Tech/Infra','Cost allocation tags por tenant','Consumo medido por tenant (CPU, storage, queries)','Rateio por # seats ou receita','main','cost',9,NULL,41),
('10','3. CPV','Licenças 3rd party repassadas','Tech/Infra','Licenças nominais por cliente','Consumo medido por cliente','Rateio por usuários ativos','main','cost',10,NULL,42),
('11','3. CPV','Gateway de pagamento / antifraude','Financeiro','Taxa por transação processada','% sobre receita do cliente','Rateio por receita','main','cost',11,NULL,43),
('12','3. CPV','CDN / Bandwidth','Tech/Infra','Logs de tráfego por cliente','Volume de dados por tenant','Rateio por # transações','main','cost',12,NULL,44),
('13','3. CPV','APIs externas (KYC, enrichment, dados)','Tech/Infra','Chamadas registradas por cliente','Uso medido por funcionalidade','Rateio por receita','main','cost',13,NULL,45),
('14','4. CPV','Customer Success (CSM)','CS','Time tracking por conta','# contas no portfolio do CSM','Rateio por ARR','main','cost',14,NULL,46),
('15','4. CPV','Suporte técnico (L1/L2/L3)','Suporte','Tickets × tempo médio × custo/hora','# tickets por cliente','Rateio por seats/MRR','main','cost',15,NULL,47),
('16','4. CPV','Onboarding / Implementação','PS/Onboarding','Horas apontadas no projeto','FTE alocado × cronograma padrão','Rateio por novos clientes','main','cost',16,NULL,48),
('17','5. OPEX','Comissões de vendas','Comercial','Comissão paga vinculada ao deal','% comissão × receita do cliente','Total comissões × ARR cliente / ARR total','main','cost',17,NULL,49),
('18','5. OPEX','SDR / BDR (prospecção)','Comercial','Leads convertidos por SDR atribuídos ao cliente','# touches no CRM por conta','Rateio por novos clientes','main','cost',18,NULL,50),
('19','5. OPEX','Account Executives','Comercial','Tempo no CRM por oportunidade ganha','Pipeline trabalhado × hit rate','Rateio por receita nova','main','cost',19,NULL,51),
('20','6. OPEX','Mídia paga (Ads)','Marketing','Atribuição multi-touch (MTA) por cliente','First/last-touch attribution','CAC médio × novos clientes','main','cost',20,NULL,52),
('21','6. OPEX','Conteúdo / Brand','Marketing','Atribuição assistida modelada','Rateio por canal de origem','Rateio por receita','main','cost',21,NULL,53),
('22','6. OPEX','Eventos / Field marketing','Marketing','Leads do evento × convertidos','# contatos qualificados','Rateio por receita B2B','main','cost',22,NULL,54),
('23','7. OPEX','Engenharia de produto (feature dev)','Engenharia','Time tracking por epic × clientes usuários da feature','% uso de features por cliente','Rateio por receita/seats','main','cost',23,NULL,55),
('24','7. OPEX','DevOps / SRE','Engenharia','Incidents/tickets por cliente','Rateio por consumo de infra','Rateio por receita','main','cost',24,NULL,56),
('25','7. OPEX','Product Management','Produto','Roadmap por segmento × receita do segmento','Uso de features por cliente','Rateio por receita','main','cost',25,NULL,57),
('26','8. OPEX','Finance / Contábil','G&A','# transações por cliente × tempo médio','Complexidade contratual (peso)','Rateio por receita','main','cost',26,NULL,58),
('27','8. OPEX','Jurídico / Compliance','G&A','Horas apontadas em contratos/disputas','# contratos ativos','Rateio por # clientes','main','cost',27,NULL,59),
('28','8. OPEX','RH / People','G&A','FTE alocado por área × rateio da área','Headcount × custo médio','Rateio linear por receita','main','cost',28,NULL,60),
('29','8. OPEX','Facilities / TI interna','G&A','FTE alocado por cliente','Rateio pelo headcount da área','Rateio por receita','main','cost',29,NULL,61);