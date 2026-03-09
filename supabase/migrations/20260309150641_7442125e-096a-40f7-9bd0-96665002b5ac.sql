
CREATE OR REPLACE FUNCTION public.get_directory_office_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id FROM public.offices o
  WHERE o.active_product_id IN (SELECT public.get_client_product_ids(_user_id))
    AND o.status = 'ativo'
    AND o.visible_in_directory = true
$$;

DROP POLICY IF EXISTS "Client can view directory members" ON public.offices;

CREATE POLICY "Client can view directory members"
ON public.offices
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'client'::app_role)
  AND visible_in_directory = true
  AND status = 'ativo'
  AND id IN (SELECT public.get_directory_office_ids(auth.uid()))
);
