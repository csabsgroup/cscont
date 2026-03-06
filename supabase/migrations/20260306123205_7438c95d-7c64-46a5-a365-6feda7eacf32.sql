
-- Add missing columns to offices
ALTER TABLE offices ADD COLUMN IF NOT EXISTS last_nps numeric;
ALTER TABLE offices ADD COLUMN IF NOT EXISTS last_csat numeric;
ALTER TABLE offices ADD COLUMN IF NOT EXISTS last_meeting_date date;
ALTER TABLE offices ADD COLUMN IF NOT EXISTS last_meeting_type text;
ALTER TABLE offices ADD COLUMN IF NOT EXISTS cs_feeling text;

-- Add columns to form_templates
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS form_type text NOT NULL DEFAULT 'internal';
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS sections jsonb DEFAULT '[]';
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS form_hash text UNIQUE;

-- Create office_metrics_history
CREATE TABLE IF NOT EXISTS public.office_metrics_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL,
  period_month integer NOT NULL,
  period_year integer NOT NULL,
  faturamento_mensal numeric,
  faturamento_anual numeric,
  qtd_clientes integer,
  qtd_colaboradores integer,
  nps_score numeric,
  csat_score numeric,
  health_score numeric,
  cs_feeling text,
  form_submission_id uuid,
  custom_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(office_id, period_month, period_year)
);

ALTER TABLE office_metrics_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage office_metrics_history"
  ON office_metrics_history FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users see metrics of visible offices"
  ON office_metrics_history FOR SELECT TO authenticated
  USING (office_id IN (SELECT get_visible_office_ids(auth.uid())));

CREATE POLICY "CSM can insert metrics"
  ON office_metrics_history FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'csm'::app_role) AND office_id IN (SELECT get_csm_office_ids(auth.uid())));

-- Allow public insert on form_submissions for external forms (submitted_by will be null)
-- Make user_id nullable for external submissions
ALTER TABLE form_submissions ALTER COLUMN user_id DROP NOT NULL;
