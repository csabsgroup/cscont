
-- Phase 3: Form Templates
CREATE TYPE public.form_template_type AS ENUM ('kickoff', 'onboarding', 'nutricao', 'renovacao', 'expansao', 'sos', 'extra', 'apresentacao');

CREATE TABLE public.form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type public.form_template_type NOT NULL DEFAULT 'extra',
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  post_actions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage form_templates" ON public.form_templates FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Manager can manage form_templates" ON public.form_templates FOR ALL USING (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Authenticated can view form_templates" ON public.form_templates FOR SELECT USING (true);

CREATE TABLE public.form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.form_templates(id) ON DELETE CASCADE NOT NULL,
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage form_submissions" ON public.form_submissions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "CSM can insert form_submissions" ON public.form_submissions FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'csm') AND office_id IN (SELECT public.get_csm_office_ids(auth.uid()))
);
CREATE POLICY "Users see submissions of visible offices" ON public.form_submissions FOR SELECT USING (
  office_id IN (SELECT public.get_visible_office_ids(auth.uid()))
);

-- Phase 4: Bonus Catalog
CREATE TYPE public.bonus_request_status AS ENUM ('pending', 'approved', 'denied');

CREATE TABLE public.bonus_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'unidade',
  default_validity_days INTEGER DEFAULT 90,
  visible_in_portal BOOLEAN NOT NULL DEFAULT true,
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  eligible_product_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bonus_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage bonus_catalog" ON public.bonus_catalog FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view bonus_catalog" ON public.bonus_catalog FOR SELECT USING (true);

CREATE TABLE public.bonus_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
  catalog_item_id UUID REFERENCES public.bonus_catalog(id) ON DELETE CASCADE NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  used NUMERIC NOT NULL DEFAULT 0,
  available NUMERIC NOT NULL DEFAULT 1
);

ALTER TABLE public.bonus_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage bonus_grants" ON public.bonus_grants FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "CSM can manage bonus_grants" ON public.bonus_grants FOR ALL USING (
  public.has_role(auth.uid(), 'csm') AND office_id IN (SELECT public.get_csm_office_ids(auth.uid()))
);
CREATE POLICY "Manager can manage bonus_grants" ON public.bonus_grants FOR ALL USING (
  public.has_role(auth.uid(), 'manager') AND office_id IN (SELECT public.get_manager_office_ids(auth.uid()))
);
CREATE POLICY "Users see grants of visible offices" ON public.bonus_grants FOR SELECT USING (
  office_id IN (SELECT public.get_visible_office_ids(auth.uid()))
);

CREATE TABLE public.bonus_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
  catalog_item_id UUID REFERENCES public.bonus_catalog(id) ON DELETE CASCADE NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  notes TEXT,
  status public.bonus_request_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bonus_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage bonus_requests" ON public.bonus_requests FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "CSM can manage bonus_requests for own offices" ON public.bonus_requests FOR ALL USING (
  public.has_role(auth.uid(), 'csm') AND office_id IN (SELECT public.get_csm_office_ids(auth.uid()))
);
CREATE POLICY "Client can view own bonus_requests" ON public.bonus_requests FOR SELECT USING (
  public.has_role(auth.uid(), 'client') AND office_id IN (SELECT public.get_client_office_ids(auth.uid()))
);
CREATE POLICY "Client can create bonus_requests" ON public.bonus_requests FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'client') AND office_id IN (SELECT public.get_client_office_ids(auth.uid()))
);
CREATE POLICY "Users see requests of visible offices" ON public.bonus_requests FOR SELECT USING (
  office_id IN (SELECT public.get_visible_office_ids(auth.uid()))
);

-- Phase 4 prep: add eligible_product_ids to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS eligible_product_ids UUID[] DEFAULT '{}';

-- Phase 5: shared_with_client on activities
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS shared_with_client BOOLEAN NOT NULL DEFAULT false;
