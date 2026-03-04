
-- Office logo column
ALTER TABLE public.offices ADD COLUMN logo_url text;

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('office-logos', 'office-logos', true);

-- Storage policies for avatars
CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Users can update own avatars" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "Users can delete own avatars" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars');

-- Storage policies for office-logos
CREATE POLICY "Anyone can view office logos" ON storage.objects FOR SELECT USING (bucket_id = 'office-logos');
CREATE POLICY "Authenticated can upload office logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'office-logos');
CREATE POLICY "Authenticated can update office logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'office-logos');
CREATE POLICY "Authenticated can delete office logos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'office-logos');

-- Portal settings table
CREATE TABLE public.portal_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.portal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read portal settings" ON public.portal_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin or Manager can manage portal settings" ON public.portal_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Insert default settings
INSERT INTO public.portal_settings (setting_key, setting_value) VALUES
  ('portal_show_health', true),
  ('portal_show_bonus_balance', true),
  ('portal_show_next_event', true),
  ('portal_show_next_meeting', true),
  ('portal_show_contract', true),
  ('portal_show_okr', true),
  ('portal_show_meetings', true),
  ('portal_show_events', true),
  ('portal_show_bonus', true),
  ('portal_show_files', true),
  ('portal_show_contacts', true),
  ('portal_show_members', true),
  ('portal_show_billing_info', true),
  ('portal_show_contract_values', true);
