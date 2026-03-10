
-- Add scoring_rules JSONB column to health_indicators
ALTER TABLE public.health_indicators ADD COLUMN IF NOT EXISTS scoring_rules jsonb DEFAULT '[]'::jsonb;

-- Create health_band_config table for configurable band thresholds per product
CREATE TABLE IF NOT EXISTS public.health_band_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  green_min integer NOT NULL DEFAULT 80,
  yellow_min integer NOT NULL DEFAULT 50,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id)
);

-- Enable RLS
ALTER TABLE public.health_band_config ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admin can manage health_band_config" ON public.health_band_config FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view health_band_config" ON public.health_band_config FOR SELECT TO authenticated USING (true);
