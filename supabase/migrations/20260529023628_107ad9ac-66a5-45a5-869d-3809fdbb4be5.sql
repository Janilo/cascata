INSERT INTO public.waterfall_lines (code, kind, bucket, category, label, department, main_no, sort_order)
VALUES ('29.5', 'main', 'cost', 'Pessoal', 'Pessoal (rateio do organograma)', 'RH', 295, 295)
ON CONFLICT DO NOTHING;