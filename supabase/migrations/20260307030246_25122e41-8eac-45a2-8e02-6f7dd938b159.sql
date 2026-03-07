-- Add CASCADE to playbook_instances FK on offices
ALTER TABLE public.playbook_instances DROP CONSTRAINT IF EXISTS playbook_instances_office_id_fkey;
ALTER TABLE public.playbook_instances ADD CONSTRAINT playbook_instances_office_id_fkey
  FOREIGN KEY (office_id) REFERENCES public.offices(id) ON DELETE CASCADE;

-- Add index for health_scores calculated_at (for ordering queries)
CREATE INDEX IF NOT EXISTS idx_health_scores_calculated_at ON public.health_scores(office_id, calculated_at DESC);