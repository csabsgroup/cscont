
ALTER TABLE public.automation_rules_v2 
  ADD COLUMN IF NOT EXISTS schedule_config jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS target_type text DEFAULT 'client';

ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS office_code text UNIQUE;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS code_prefix text;
