
CREATE TABLE public.event_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.event_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage event_files" ON public.event_files FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view event_files" ON public.event_files FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "CSM can insert event_files" ON public.event_files FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'csm'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "CSM can delete own event_files" ON public.event_files FOR DELETE TO authenticated
  USING ((has_role(auth.uid(), 'csm'::app_role) OR has_role(auth.uid(), 'manager'::app_role)) AND uploaded_by = auth.uid());

-- Create storage bucket for event files
INSERT INTO storage.buckets (id, name, public) VALUES ('event-files', 'event-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can upload event files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-files');

CREATE POLICY "Authenticated can update event files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'event-files')
WITH CHECK (bucket_id = 'event-files');

CREATE POLICY "Public can read event files"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'event-files');

CREATE POLICY "Authenticated can delete event files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'event-files');
