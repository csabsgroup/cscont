
-- Enums
CREATE TYPE public.activity_type AS ENUM ('task', 'follow_up', 'onboarding', 'renewal', 'other');
CREATE TYPE public.activity_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.meeting_status AS ENUM ('scheduled', 'completed', 'cancelled');

-- Journey stages per product (kanban columns)
CREATE TABLE public.journey_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  sla_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Track which stage each office is in
CREATE TABLE public.office_journey (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  journey_stage_id UUID NOT NULL REFERENCES public.journey_stages(id) ON DELETE CASCADE,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(office_id)
);

-- Activities / daily tasks for CSMs
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  type activity_type NOT NULL DEFAULT 'task',
  priority activity_priority NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Meetings
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  status meeting_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  transcript TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.journey_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_journey ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- journey_stages policies
CREATE POLICY "Authenticated can view stages" ON public.journey_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage stages" ON public.journey_stages FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- office_journey policies
CREATE POLICY "Users see journey of visible offices" ON public.office_journey FOR SELECT TO authenticated USING (office_id IN (SELECT get_visible_office_ids(auth.uid())));
CREATE POLICY "Admin can manage journey" ON public.office_journey FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CSM can insert journey" ON public.office_journey FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'csm') AND office_id IN (SELECT get_csm_office_ids(auth.uid())));
CREATE POLICY "CSM can update journey" ON public.office_journey FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'csm') AND office_id IN (SELECT get_csm_office_ids(auth.uid())));

-- activities policies
CREATE POLICY "Users see own activities" ON public.activities FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admin can see all activities" ON public.activities FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create activities" ON public.activities FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own activities" ON public.activities FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own activities" ON public.activities FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admin can manage activities" ON public.activities FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- meetings policies
CREATE POLICY "Users see meetings of visible offices" ON public.meetings FOR SELECT TO authenticated USING (office_id IN (SELECT get_visible_office_ids(auth.uid())));
CREATE POLICY "Admin can manage meetings" ON public.meetings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CSM can create meetings" ON public.meetings FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'csm') AND office_id IN (SELECT get_csm_office_ids(auth.uid())));
CREATE POLICY "CSM can update meetings" ON public.meetings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'csm') AND office_id IN (SELECT get_csm_office_ids(auth.uid())));
CREATE POLICY "CSM can delete meetings" ON public.meetings FOR DELETE TO authenticated USING (has_role(auth.uid(), 'csm') AND office_id IN (SELECT get_csm_office_ids(auth.uid())));

-- Triggers
CREATE TRIGGER update_journey_stages_updated_at BEFORE UPDATE ON public.journey_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_office_journey_updated_at BEFORE UPDATE ON public.office_journey FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
