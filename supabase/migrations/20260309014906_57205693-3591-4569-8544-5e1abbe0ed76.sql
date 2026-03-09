-- Create config_folders table for organizing playbooks and automations
CREATE TABLE public.config_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('playbooks', 'automations')),
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.config_folders ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin can manage config_folders" ON public.config_folders 
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated read
CREATE POLICY "Authenticated can view config_folders" ON public.config_folders 
  FOR SELECT USING (true);

-- Add folder_id to playbook_templates
ALTER TABLE public.playbook_templates 
  ADD COLUMN folder_id uuid REFERENCES public.config_folders(id) ON DELETE SET NULL;

-- Add folder_id to automation_rules_v2
ALTER TABLE public.automation_rules_v2 
  ADD COLUMN folder_id uuid REFERENCES public.config_folders(id) ON DELETE SET NULL;