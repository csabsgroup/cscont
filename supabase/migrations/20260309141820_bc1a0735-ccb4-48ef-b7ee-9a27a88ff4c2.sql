
ALTER TABLE board_columns ADD COLUMN IF NOT EXISTS header_color text DEFAULT '#374151';
ALTER TABLE board_columns ADD COLUMN IF NOT EXISTS bg_color text DEFAULT '#f3f4f6';
ALTER TABLE board_columns ADD COLUMN IF NOT EXISTS bg_gradient_from text;
ALTER TABLE board_columns ADD COLUMN IF NOT EXISTS bg_gradient_to text;
ALTER TABLE board_columns ADD COLUMN IF NOT EXISTS bg_opacity numeric DEFAULT 100;
ALTER TABLE board_columns ADD COLUMN IF NOT EXISTS icon text;

-- Also add RLS for manager to manage columns they created
CREATE POLICY "Manager can manage own columns" ON public.board_columns
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) AND created_by = auth.uid())
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND created_by = auth.uid());
