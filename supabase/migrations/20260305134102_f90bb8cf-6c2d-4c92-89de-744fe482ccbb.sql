
-- Custom fields definitions
CREATE TABLE public.custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  field_type text NOT NULL,
  description text,
  scope text NOT NULL DEFAULT 'global',
  product_id uuid REFERENCES public.products(id),
  is_required boolean DEFAULT false,
  default_value text,
  options jsonb,
  data_source text DEFAULT 'manual',
  data_source_config jsonb,
  position text DEFAULT 'body',
  is_visible boolean DEFAULT true,
  is_editable boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid
);

-- Custom field values per office
CREATE TABLE public.custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  custom_field_id uuid NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  value_text text,
  value_number numeric,
  value_date date,
  value_boolean boolean,
  value_json jsonb,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  UNIQUE(office_id, custom_field_id)
);

-- RLS
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;

-- custom_fields: Admin manage, all authenticated read
CREATE POLICY "Admin manage custom_fields" ON public.custom_fields FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated view custom_fields" ON public.custom_fields FOR SELECT TO authenticated
  USING (true);

-- custom_field_values: Admin full, CSM manage own offices, users view visible
CREATE POLICY "Admin manage custom_field_values" ON public.custom_field_values FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "CSM manage own office values" ON public.custom_field_values FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'csm') AND office_id IN (SELECT public.get_csm_office_ids(auth.uid())))
  WITH CHECK (public.has_role(auth.uid(), 'csm') AND office_id IN (SELECT public.get_csm_office_ids(auth.uid())));
CREATE POLICY "Manager manage office values" ON public.custom_field_values FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager') AND office_id IN (SELECT public.get_manager_office_ids(auth.uid())))
  WITH CHECK (public.has_role(auth.uid(), 'manager') AND office_id IN (SELECT public.get_manager_office_ids(auth.uid())));
CREATE POLICY "Users view visible office values" ON public.custom_field_values FOR SELECT TO authenticated
  USING (office_id IN (SELECT public.get_visible_office_ids(auth.uid())));
