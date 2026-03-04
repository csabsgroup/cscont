
CREATE TABLE public.product_360_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  config_type text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.product_360_config ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX idx_product_360_config_unique ON public.product_360_config(product_id, config_type);

CREATE POLICY "Admin can manage product_360_config" ON public.product_360_config FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view product_360_config" ON public.product_360_config FOR SELECT TO authenticated USING (true);

CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  rule_type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage automation_rules" ON public.automation_rules FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view automation_rules" ON public.automation_rules FOR SELECT TO authenticated USING (true);

CREATE TABLE public.automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL,
  office_id uuid NOT NULL,
  context_key text NOT NULL,
  executed_at timestamptz NOT NULL DEFAULT now(),
  result jsonb DEFAULT '{}'
);
ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX idx_automation_exec_unique ON public.automation_executions(rule_id, office_id, context_key);

CREATE POLICY "Admin can manage automation_executions" ON public.automation_executions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users see executions of visible offices" ON public.automation_executions FOR SELECT TO authenticated USING (office_id IN (SELECT get_visible_office_ids(auth.uid())));
