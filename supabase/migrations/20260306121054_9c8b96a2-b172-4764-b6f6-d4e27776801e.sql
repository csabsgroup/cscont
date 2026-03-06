
CREATE TABLE IF NOT EXISTS public.activity_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.activity_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage activity_mentions" ON public.activity_mentions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can manage own activity mentions" ON public.activity_mentions FOR ALL TO authenticated USING (activity_id IN (SELECT id FROM public.activities WHERE user_id = auth.uid())) WITH CHECK (activity_id IN (SELECT id FROM public.activities WHERE user_id = auth.uid()));

CREATE POLICY "Users can view mentions on visible activities" ON public.activity_mentions FOR SELECT TO authenticated USING (activity_id IN (SELECT id FROM public.activities WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
