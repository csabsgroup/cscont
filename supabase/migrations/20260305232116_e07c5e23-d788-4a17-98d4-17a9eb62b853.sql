
CREATE TABLE public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view webhook_logs"
ON public.webhook_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete webhook_logs"
ON public.webhook_logs
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert webhook_logs"
ON public.webhook_logs
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update webhook_logs"
ON public.webhook_logs
FOR UPDATE
TO service_role
USING (true);
