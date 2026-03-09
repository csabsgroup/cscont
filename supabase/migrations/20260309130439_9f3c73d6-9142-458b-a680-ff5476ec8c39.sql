-- RLS policy: clients can see directory members of same product
CREATE POLICY "Client can view directory members" ON public.offices
FOR SELECT TO authenticated
USING (
  visible_in_directory = true
  AND status = 'ativo'
  AND public.has_role(auth.uid(), 'client'::app_role)
  AND active_product_id IN (
    SELECT o.active_product_id FROM public.offices o
    JOIN public.client_office_links col ON col.office_id = o.id
    WHERE col.user_id = auth.uid()
  )
);