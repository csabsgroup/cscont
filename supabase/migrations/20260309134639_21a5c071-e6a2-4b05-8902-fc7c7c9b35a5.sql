
-- 1. Drop the recursive policy
DROP POLICY IF EXISTS "Client can view directory members" ON public.offices;

-- 2. Create SECURITY DEFINER function to get client product IDs without triggering RLS
CREATE OR REPLACE FUNCTION public.get_client_product_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT o.active_product_id
  FROM offices o
  JOIN client_office_links col ON col.office_id = o.id
  WHERE col.user_id = _user_id
    AND o.active_product_id IS NOT NULL
$$;

-- 3. Recreate policy using the function (no recursion)
CREATE POLICY "Client can view directory members" ON public.offices
FOR SELECT
TO authenticated
USING (
  visible_in_directory = true
  AND status = 'ativo'
  AND has_role(auth.uid(), 'client')
  AND active_product_id IN (SELECT get_client_product_ids(auth.uid()))
);
