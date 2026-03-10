
ALTER TABLE public.form_templates ADD COLUMN IF NOT EXISTS theme jsonb DEFAULT '{}';
ALTER TABLE public.form_templates ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}';
ALTER TABLE public.form_templates ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false;

-- Storage bucket for form header images
INSERT INTO storage.buckets (id, name, public) VALUES ('form-assets', 'form-assets', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Anyone can view form assets" ON storage.objects FOR SELECT USING (bucket_id = 'form-assets');
CREATE POLICY "Authenticated can upload form assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'form-assets');
CREATE POLICY "Authenticated can delete own form assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'form-assets' AND (auth.uid())::text = (storage.foldername(name))[1]);
