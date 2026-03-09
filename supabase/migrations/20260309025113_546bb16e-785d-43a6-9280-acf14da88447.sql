
-- Tabela de Objetivos OKR
CREATE TABLE public.okr_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  area text NOT NULL DEFAULT 'gestao_estrategica',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.okr_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage okr_objectives" ON public.okr_objectives FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "CSM can manage okr_objectives" ON public.okr_objectives FOR ALL TO authenticated USING (has_role(auth.uid(), 'csm'::app_role) AND office_id IN (SELECT get_csm_office_ids(auth.uid()))) WITH CHECK (has_role(auth.uid(), 'csm'::app_role) AND office_id IN (SELECT get_csm_office_ids(auth.uid())));
CREATE POLICY "Users see okr_objectives of visible offices" ON public.okr_objectives FOR SELECT TO authenticated USING (office_id IN (SELECT get_visible_office_ids(auth.uid())));
CREATE POLICY "Client can view okr_objectives" ON public.okr_objectives FOR SELECT TO authenticated USING (has_role(auth.uid(), 'client'::app_role) AND office_id IN (SELECT get_client_office_ids(auth.uid())));

-- Adicionar colunas ao action_plans para KRs
ALTER TABLE public.action_plans
  ADD COLUMN IF NOT EXISTS objective_id uuid REFERENCES public.okr_objectives(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS kr_type text NOT NULL DEFAULT 'action',
  ADD COLUMN IF NOT EXISTS area text NOT NULL DEFAULT 'gestao_estrategica';

-- Trigger updated_at
CREATE TRIGGER update_okr_objectives_updated_at BEFORE UPDATE ON public.okr_objectives FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
