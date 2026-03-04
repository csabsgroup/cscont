
CREATE TABLE public.automation_rules_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  trigger_type text NOT NULL,
  trigger_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  condition_logic text NOT NULL DEFAULT 'and',
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  product_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_rules_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage automation_rules_v2"
  ON public.automation_rules_v2 FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view automation_rules_v2"
  ON public.automation_rules_v2 FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.automation_rules_v2
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
