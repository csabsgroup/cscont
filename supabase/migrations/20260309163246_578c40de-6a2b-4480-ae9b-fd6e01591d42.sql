CREATE POLICY "Client can view directory contacts"
ON public.contacts FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role)
  AND office_id IN (SELECT get_directory_office_ids(auth.uid()))
);