CREATE POLICY "Manager can view okr_objectives"
ON public.okr_objectives
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND office_id IN (SELECT get_manager_office_ids(auth.uid()))
);