
-- Add new date/churn columns to offices
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS cycle_start_date date;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS cycle_end_date date;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS churn_date date;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS churn_reason_id uuid;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS churn_observation text;

-- Add 'pausado' to office_status enum
ALTER TYPE public.office_status ADD VALUE IF NOT EXISTS 'pausado';

-- Churn reasons table
CREATE TABLE public.churn_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.churn_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage churn_reasons" ON public.churn_reasons FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view churn_reasons" ON public.churn_reasons FOR SELECT TO authenticated
  USING (true);

-- Insert default reasons
INSERT INTO public.churn_reasons (name, sort_order) VALUES
  ('Insatisfação com o serviço', 1),
  ('Preço/Valor', 2),
  ('Mudança de estratégia', 3),
  ('Fechou a empresa', 4),
  ('Migrou para concorrente', 5),
  ('Inadimplência', 6),
  ('Não viu valor no programa', 7),
  ('Problemas internos do cliente', 8),
  ('Outro', 99);
