
-- User table views for saved column configurations
CREATE TABLE public.user_table_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  page text NOT NULL DEFAULT 'clientes',
  name text NOT NULL,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_table_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own views" ON public.user_table_views
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can manage all views" ON public.user_table_views
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Shared files table
CREATE TABLE public.shared_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  uploaded_by uuid NOT NULL,
  shared_with_client boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage shared_files" ON public.shared_files
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "CSM can manage shared_files" ON public.shared_files
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'csm') AND office_id IN (SELECT public.get_csm_office_ids(auth.uid())))
WITH CHECK (public.has_role(auth.uid(), 'csm') AND office_id IN (SELECT public.get_csm_office_ids(auth.uid())));

CREATE POLICY "Users see files of visible offices" ON public.shared_files
FOR SELECT TO authenticated
USING (office_id IN (SELECT public.get_visible_office_ids(auth.uid())));

CREATE POLICY "Client sees shared files" ON public.shared_files
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'client') AND shared_with_client = true AND office_id IN (SELECT public.get_client_office_ids(auth.uid())));
