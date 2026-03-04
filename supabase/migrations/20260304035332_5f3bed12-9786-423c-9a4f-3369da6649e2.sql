
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  location TEXT,
  type TEXT NOT NULL DEFAULT 'presencial',
  max_participants INTEGER,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view events" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage events" ON public.events FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CSM can create events" ON public.events FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'csm') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "CSM can update own events" ON public.events FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "CSM can delete own events" ON public.events FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "Authenticated can view participants" ON public.event_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage participants" ON public.event_participants FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "CSM can manage participants" ON public.event_participants FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'csm') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "CSM can update participants" ON public.event_participants FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'csm') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "CSM can delete participants" ON public.event_participants FOR DELETE TO authenticated USING (has_role(auth.uid(), 'csm') OR has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
