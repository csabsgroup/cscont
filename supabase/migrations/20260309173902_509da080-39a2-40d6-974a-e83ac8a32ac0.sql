
-- Add new columns to events
ALTER TABLE events
  ADD COLUMN cover_url text,
  ADD COLUMN category text NOT NULL DEFAULT 'encontro',
  ADD COLUMN observations text,
  ADD COLUMN confirmation_deadline_days integer DEFAULT 3;

-- Create event-covers storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('event-covers', 'event-covers', true);

-- Storage RLS: anyone authenticated can upload
CREATE POLICY "Authenticated can upload event covers"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-covers');

-- Storage RLS: public read
CREATE POLICY "Public can read event covers"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'event-covers');

-- Storage RLS: admin/csm/manager can delete
CREATE POLICY "Staff can delete event covers"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'event-covers' AND (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'csm') OR
  public.has_role(auth.uid(), 'manager')
));

-- Add RLS for client to update their own participant status
CREATE POLICY "Client can update own participation"
ON event_participants FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'client') AND
  office_id IN (SELECT public.get_client_office_ids(auth.uid()))
);
