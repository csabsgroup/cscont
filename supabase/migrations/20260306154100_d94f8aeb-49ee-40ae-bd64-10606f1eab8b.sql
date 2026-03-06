
-- Create office_files table
CREATE TABLE public.office_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  note_id uuid REFERENCES public.office_notes(id) ON DELETE SET NULL,
  name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_by uuid NOT NULL,
  share_with_client boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.office_files ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin can manage office_files" ON public.office_files
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- CSM can manage for own offices
CREATE POLICY "CSM can manage office_files" ON public.office_files
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'csm'::app_role) AND office_id IN (SELECT get_csm_office_ids(auth.uid())))
  WITH CHECK (has_role(auth.uid(), 'csm'::app_role) AND office_id IN (SELECT get_csm_office_ids(auth.uid())));

-- Manager can manage for team offices
CREATE POLICY "Manager can manage office_files" ON public.office_files
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND office_id IN (SELECT get_manager_office_ids(auth.uid())))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND office_id IN (SELECT get_manager_office_ids(auth.uid())));

-- Viewer can view visible offices
CREATE POLICY "Viewer can view office_files" ON public.office_files
  FOR SELECT TO authenticated
  USING (office_id IN (SELECT get_visible_office_ids(auth.uid())));

-- Client can view shared files
CREATE POLICY "Client can view shared office_files" ON public.office_files
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'client'::app_role) AND share_with_client = true AND office_id IN (SELECT get_client_office_ids(auth.uid())));

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('office-files', 'office-files', true);

-- Storage RLS policies
CREATE POLICY "Authenticated can upload office files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'office-files');

CREATE POLICY "Authenticated can read office files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'office-files');

CREATE POLICY "Authenticated can delete office files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'office-files');
