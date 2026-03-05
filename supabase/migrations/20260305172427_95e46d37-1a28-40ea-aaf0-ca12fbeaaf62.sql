
CREATE TABLE public.office_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  note_type text NOT NULL DEFAULT 'observacao',
  content text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.office_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage office_notes"
  ON public.office_notes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "CSM can manage own office notes"
  ON public.office_notes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'csm') AND office_id IN (SELECT public.get_csm_office_ids(auth.uid())))
  WITH CHECK (public.has_role(auth.uid(), 'csm') AND office_id IN (SELECT public.get_csm_office_ids(auth.uid())));

CREATE POLICY "Users see notes of visible offices"
  ON public.office_notes FOR SELECT TO authenticated
  USING (office_id IN (SELECT public.get_visible_office_ids(auth.uid())));
