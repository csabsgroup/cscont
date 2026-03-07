-- Fix bonus_catalog: require authentication for SELECT
DROP POLICY IF EXISTS "Authenticated can view bonus_catalog" ON public.bonus_catalog;
CREATE POLICY "Authenticated can view bonus_catalog" ON public.bonus_catalog
  FOR SELECT TO authenticated
  USING (true);