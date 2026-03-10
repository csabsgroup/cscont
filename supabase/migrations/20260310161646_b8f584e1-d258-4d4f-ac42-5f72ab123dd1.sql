
CREATE TABLE public.office_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.office_timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see timeline of visible offices"
  ON public.office_timeline_events FOR SELECT TO authenticated
  USING (office_id IN (SELECT get_visible_office_ids(auth.uid())));

CREATE POLICY "Authenticated can insert timeline events"
  ON public.office_timeline_events FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can manage timeline events"
  ON public.office_timeline_events FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE INDEX idx_timeline_events_office_id ON public.office_timeline_events(office_id);
CREATE INDEX idx_timeline_events_created_at ON public.office_timeline_events(created_at DESC);
CREATE INDEX idx_timeline_events_type ON public.office_timeline_events(event_type);
