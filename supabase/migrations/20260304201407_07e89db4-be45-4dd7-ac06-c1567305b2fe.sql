
CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type text NOT NULL,
  table_name text NOT NULL,
  record_ids uuid[] NOT NULL DEFAULT '{}',
  record_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz
);

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage import_batches" ON public.import_batches
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Manager can manage import_batches" ON public.import_batches
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'manager')) WITH CHECK (has_role(auth.uid(), 'manager'));

CREATE POLICY "Users can view own batches" ON public.import_batches
  FOR SELECT TO authenticated USING (user_id = auth.uid());
