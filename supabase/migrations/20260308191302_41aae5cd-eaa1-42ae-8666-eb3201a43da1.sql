-- Allow all authenticated users to read global default views
CREATE POLICY "Authenticated can read default views"
ON public.user_table_views
FOR SELECT
TO authenticated
USING (is_default = true);