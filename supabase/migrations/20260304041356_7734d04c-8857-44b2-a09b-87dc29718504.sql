
-- Health Score system tables

-- Health pillars (configurable per product)
CREATE TABLE public.health_pillars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.health_pillars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage pillars" ON public.health_pillars FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view pillars" ON public.health_pillars FOR SELECT USING (true);

-- Health indicators (per pillar)
CREATE TABLE public.health_indicators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pillar_id UUID NOT NULL REFERENCES public.health_pillars(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 0,
  data_source TEXT,
  data_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.health_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage indicators" ON public.health_indicators FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view indicators" ON public.health_indicators FOR SELECT USING (true);

-- Health overrides (per product)
CREATE TYPE public.health_override_action AS ENUM ('force_red', 'reduce_score');

CREATE TABLE public.health_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  condition_type TEXT NOT NULL,
  threshold NUMERIC NOT NULL DEFAULT 0,
  action public.health_override_action NOT NULL DEFAULT 'force_red',
  reduction_points NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.health_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage overrides" ON public.health_overrides FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view overrides" ON public.health_overrides FOR SELECT USING (true);

-- Health scores (calculated per office)
CREATE TYPE public.health_band AS ENUM ('red', 'yellow', 'green');

CREATE TABLE public.health_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL DEFAULT 0,
  band public.health_band NOT NULL DEFAULT 'green',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  breakdown JSONB DEFAULT '{}'::jsonb,
  UNIQUE(office_id)
);

ALTER TABLE public.health_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see scores of visible offices" ON public.health_scores FOR SELECT USING (office_id IN (SELECT get_visible_office_ids(auth.uid())));
CREATE POLICY "Admin can manage scores" ON public.health_scores FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Health playbooks (per product/band)
CREATE TABLE public.health_playbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  band public.health_band NOT NULL,
  activity_template JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.health_playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage playbooks" ON public.health_playbooks FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view playbooks" ON public.health_playbooks FOR SELECT USING (true);

-- Action plans (OKR) for Cliente 360
CREATE TYPE public.action_plan_status AS ENUM ('pending', 'in_progress', 'done', 'cancelled');

CREATE TABLE public.action_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status public.action_plan_status NOT NULL DEFAULT 'pending',
  observations TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage action plans" ON public.action_plans FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CSM can manage action plans" ON public.action_plans FOR INSERT WITH CHECK (has_role(auth.uid(), 'csm') AND office_id IN (SELECT get_csm_office_ids(auth.uid())));
CREATE POLICY "CSM can update action plans" ON public.action_plans FOR UPDATE USING (has_role(auth.uid(), 'csm') AND office_id IN (SELECT get_csm_office_ids(auth.uid())));
CREATE POLICY "CSM can delete action plans" ON public.action_plans FOR DELETE USING (has_role(auth.uid(), 'csm') AND office_id IN (SELECT get_csm_office_ids(auth.uid())));
CREATE POLICY "Users see action plans of visible offices" ON public.action_plans FOR SELECT USING (office_id IN (SELECT get_visible_office_ids(auth.uid())));
CREATE POLICY "Client can update own action plans" ON public.action_plans FOR UPDATE USING (has_role(auth.uid(), 'client') AND office_id IN (SELECT get_client_office_ids(auth.uid())));

-- Add share_with_client to meetings
ALTER TABLE public.meetings ADD COLUMN share_with_client BOOLEAN NOT NULL DEFAULT false;

-- Triggers for updated_at
CREATE TRIGGER update_health_pillars_updated_at BEFORE UPDATE ON public.health_pillars FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_health_indicators_updated_at BEFORE UPDATE ON public.health_indicators FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_health_overrides_updated_at BEFORE UPDATE ON public.health_overrides FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_health_playbooks_updated_at BEFORE UPDATE ON public.health_playbooks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_action_plans_updated_at BEFORE UPDATE ON public.action_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
