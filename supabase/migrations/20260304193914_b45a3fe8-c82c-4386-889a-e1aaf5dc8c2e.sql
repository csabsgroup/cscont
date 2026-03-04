DROP POLICY IF EXISTS "Users see transcripts of visible offices" ON public.meeting_transcripts;

CREATE POLICY "Users see transcripts of visible offices" ON public.meeting_transcripts
FOR SELECT TO authenticated USING (
  meeting_id IN (SELECT id FROM public.meetings WHERE office_id IN (SELECT get_visible_office_ids(auth.uid())))
);

CREATE POLICY "Admin can see unmatched transcripts" ON public.meeting_transcripts
FOR SELECT TO authenticated USING (
  matched = false AND has_role(auth.uid(), 'admin')
);