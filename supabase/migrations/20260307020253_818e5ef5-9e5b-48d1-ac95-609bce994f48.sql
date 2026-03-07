
-- Playbook templates
CREATE TABLE public.playbook_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  product_id uuid,
  is_active boolean DEFAULT true,
  auto_advance_journey boolean DEFAULT false,
  advance_to_stage_id uuid,
  activities jsonb NOT NULL DEFAULT '[]',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.playbook_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage playbooks" ON public.playbook_templates FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view playbooks" ON public.playbook_templates FOR SELECT USING (true);

-- Playbook instances (applied to an office)
CREATE TABLE public.playbook_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_template_id uuid NOT NULL REFERENCES public.playbook_templates(id),
  office_id uuid NOT NULL REFERENCES public.offices(id),
  applied_by uuid,
  applied_at timestamptz DEFAULT now(),
  status text DEFAULT 'in_progress',
  completed_at timestamptz,
  total_activities integer DEFAULT 0,
  completed_activities integer DEFAULT 0
);

ALTER TABLE public.playbook_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage playbook_instances" ON public.playbook_instances FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "CSM can manage own instances" ON public.playbook_instances FOR ALL
  USING (office_id IN (SELECT public.get_csm_office_ids(auth.uid())))
  WITH CHECK (office_id IN (SELECT public.get_csm_office_ids(auth.uid())));
CREATE POLICY "Users see instances of visible offices" ON public.playbook_instances FOR SELECT
  USING (office_id IN (SELECT public.get_visible_office_ids(auth.uid())));

-- Add playbook columns to activities
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS playbook_instance_id uuid;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS playbook_order integer;
