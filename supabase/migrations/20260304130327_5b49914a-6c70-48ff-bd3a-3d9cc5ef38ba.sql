
-- Table: office_stage_history (audit log for stage changes)
CREATE TABLE public.office_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  from_stage_id uuid REFERENCES public.journey_stages(id),
  to_stage_id uuid NOT NULL REFERENCES public.journey_stages(id),
  changed_by uuid NOT NULL,
  reason text,
  change_type text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.office_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage stage history" ON public.office_stage_history FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users see history of visible offices" ON public.office_stage_history FOR SELECT TO authenticated USING (office_id IN (SELECT get_visible_office_ids(auth.uid())));
CREATE POLICY "CSM can insert stage history" ON public.office_stage_history FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'csm'::app_role) AND office_id IN (SELECT get_csm_office_ids(auth.uid())));

-- Table: health_playbook_executions (idempotency for playbook auto-activities)
CREATE TABLE public.health_playbook_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  band public.health_band NOT NULL,
  period_key text NOT NULL,
  executed_at timestamptz NOT NULL DEFAULT now(),
  created_activity_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE(office_id, band, period_key)
);

ALTER TABLE public.health_playbook_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage playbook executions" ON public.health_playbook_executions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users see executions of visible offices" ON public.health_playbook_executions FOR SELECT TO authenticated USING (office_id IN (SELECT get_visible_office_ids(auth.uid())));

-- Table: form_action_executions (idempotency for form post-actions)
CREATE TABLE public.form_action_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.form_submissions(id) ON DELETE CASCADE,
  action_key text NOT NULL,
  executed_at timestamptz NOT NULL DEFAULT now(),
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(submission_id, action_key)
);

ALTER TABLE public.form_action_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage form action executions" ON public.form_action_executions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can view form action executions" ON public.form_action_executions FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
