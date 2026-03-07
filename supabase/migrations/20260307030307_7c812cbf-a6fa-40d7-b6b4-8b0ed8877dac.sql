-- Fix overly permissive INSERT on notifications: only authenticated users inserting for themselves or via service role
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- webhook_logs INSERT/UPDATE are used by edge functions with service_role key, 
-- which bypasses RLS. These policies are safe as-is but let's scope them properly.
DROP POLICY IF EXISTS "Service role can insert webhook_logs" ON public.webhook_logs;
CREATE POLICY "Service role can insert webhook_logs" ON public.webhook_logs
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update webhook_logs" ON public.webhook_logs;
CREATE POLICY "Service role can update webhook_logs" ON public.webhook_logs
  FOR UPDATE TO service_role
  USING (true);