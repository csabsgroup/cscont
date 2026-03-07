
CREATE TABLE public.custom_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  config jsonb NOT NULL DEFAULT '{}',
  visualization_type text DEFAULT 'number',
  is_predefined boolean DEFAULT false,
  pinned_to_dashboard boolean DEFAULT false,
  created_by uuid,
  product_filter uuid,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.custom_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage indicators" ON public.custom_indicators FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Manager can manage own indicators" ON public.custom_indicators FOR ALL
  USING (public.has_role(auth.uid(), 'manager') AND created_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'manager') AND created_by = auth.uid());

CREATE POLICY "Authenticated can read active indicators" ON public.custom_indicators FOR SELECT
  USING (is_active = true);
