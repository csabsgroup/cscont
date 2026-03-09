
-- =============================================
-- BOARD COLUMNS
-- =============================================
CREATE TABLE IF NOT EXISTS public.board_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text DEFAULT '#6b7280',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.board_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read columns" ON public.board_columns
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage columns" ON public.board_columns
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- BOARD CARDS
-- =============================================
CREATE TABLE IF NOT EXISTS public.board_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id uuid NOT NULL REFERENCES public.board_columns(id),
  title text NOT NULL,
  description text,
  tags text[] DEFAULT '{}',
  start_date date,
  due_date date,
  completed_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  template_id uuid,
  checklist jsonb DEFAULT '[]',
  status text DEFAULT 'active',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.board_cards ENABLE ROW LEVEL SECURITY;

-- =============================================
-- BOARD CARD ASSIGNEES
-- =============================================
CREATE TABLE IF NOT EXISTS public.board_card_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.board_cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(card_id, user_id)
);

ALTER TABLE public.board_card_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read assignees" ON public.board_card_assignees
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert assignees" ON public.board_card_assignees
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update assignees" ON public.board_card_assignees
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete assignees" ON public.board_card_assignees
  FOR DELETE TO authenticated USING (true);

-- Now create RLS for board_cards (after assignees table exists)
CREATE POLICY "User can view assigned cards" ON public.board_cards
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'viewer'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR id IN (SELECT card_id FROM public.board_card_assignees WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "Authenticated can create cards" ON public.board_cards
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.has_role(auth.uid(), 'viewer'::app_role)
  );

CREATE POLICY "Assignees can update cards" ON public.board_cards
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR id IN (SELECT card_id FROM public.board_card_assignees WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "Admin or creator can delete cards" ON public.board_cards
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
  );

-- =============================================
-- BOARD CARD TEMPLATES
-- =============================================
CREATE TABLE IF NOT EXISTS public.board_card_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  title_template text,
  description_template text,
  default_tags text[] DEFAULT '{}',
  default_checklist jsonb DEFAULT '[]',
  default_column_id uuid REFERENCES public.board_columns(id),
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.board_card_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read templates" ON public.board_card_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage templates" ON public.board_card_templates
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- BOARD TAGS
-- =============================================
CREATE TABLE IF NOT EXISTS public.board_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text DEFAULT '#6b7280',
  is_predefined boolean DEFAULT false,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.board_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read tags" ON public.board_tags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create tags" ON public.board_tags
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admin can update tags" ON public.board_tags
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR is_predefined = false);

CREATE POLICY "Admin can delete tags" ON public.board_tags
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR is_predefined = false);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_board_cards_column ON public.board_cards(column_id);
CREATE INDEX idx_board_cards_status ON public.board_cards(status);
CREATE INDEX idx_board_assignees_user ON public.board_card_assignees(user_id);
CREATE INDEX idx_board_assignees_card ON public.board_card_assignees(card_id);

-- =============================================
-- SEED DEFAULT COLUMNS
-- =============================================
INSERT INTO public.board_columns (name, color, sort_order) VALUES
  ('A Fazer', '#3b82f6', 0),
  ('Em Andamento', '#eab308', 1),
  ('Concluído', '#16a34a', 2);
