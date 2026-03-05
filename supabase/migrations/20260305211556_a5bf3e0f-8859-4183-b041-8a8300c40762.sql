
-- Create automation_logs table for detailed execution logging
CREATE TABLE public.automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL,
  rule_name text,
  office_id uuid NOT NULL,
  trigger_type text NOT NULL,
  conditions_met boolean NOT NULL DEFAULT false,
  actions_executed jsonb DEFAULT '[]'::jsonb,
  error text,
  execution_time_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage automation_logs" ON public.automation_logs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view automation_logs" ON public.automation_logs
  FOR SELECT TO authenticated
  USING (true);

-- Change default status for offices from nao_iniciado to ativo
ALTER TABLE public.offices ALTER COLUMN status SET DEFAULT 'ativo'::office_status;
