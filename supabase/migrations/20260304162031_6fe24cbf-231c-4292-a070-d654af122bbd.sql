
-- New tables for integrations

-- 1. Integration settings (provider-level config)
CREATE TABLE public.integration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text UNIQUE NOT NULL,
  config jsonb DEFAULT '{}'::jsonb,
  workspace_name text,
  is_connected boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage integration_settings" ON public.integration_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can read integration_settings" ON public.integration_settings FOR SELECT TO authenticated USING (true);

-- 2. Integration tokens (per-user OAuth)
CREATE TABLE public.integration_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  provider_email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);
ALTER TABLE public.integration_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage integration_tokens" ON public.integration_tokens FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can manage own tokens" ON public.integration_tokens FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3. Meeting transcripts (Fireflies)
CREATE TABLE public.meeting_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  fireflies_meeting_id text,
  title text,
  date timestamptz,
  transcript text,
  summary text,
  action_items jsonb DEFAULT '[]'::jsonb,
  attendees jsonb DEFAULT '[]'::jsonb,
  matched boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.meeting_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage transcripts" ON public.meeting_transcripts FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users see transcripts of visible offices" ON public.meeting_transcripts FOR SELECT TO authenticated USING (
  meeting_id IN (SELECT id FROM public.meetings WHERE office_id IN (SELECT get_visible_office_ids(auth.uid())))
  OR matched = false
);

-- 4. WhatsApp messages
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid REFERENCES public.offices(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'sent',
  message_type text NOT NULL DEFAULT 'template',
  template_name text,
  content text,
  phone_to text,
  phone_from text,
  wamid text,
  status text DEFAULT 'sent',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage whatsapp_messages" ON public.whatsapp_messages FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users see messages of visible offices" ON public.whatsapp_messages FOR SELECT TO authenticated USING (office_id IN (SELECT get_visible_office_ids(auth.uid())));
CREATE POLICY "CSM can insert whatsapp_messages" ON public.whatsapp_messages FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(), 'csm'::app_role) AND office_id IN (SELECT get_csm_office_ids(auth.uid()))
);

-- 5. WhatsApp templates
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  description text,
  variables jsonb DEFAULT '[]'::jsonb,
  auto_trigger text DEFAULT 'none',
  auto_trigger_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage whatsapp_templates" ON public.whatsapp_templates FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can read whatsapp_templates" ON public.whatsapp_templates FOR SELECT TO authenticated USING (true);

-- Column additions to existing tables
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS google_event_id text;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS asaas_customer_id text;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS asaas_total_overdue numeric;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS piperun_deal_id text;

-- Triggers for updated_at
CREATE TRIGGER update_integration_settings_updated_at BEFORE UPDATE ON public.integration_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integration_tokens_updated_at BEFORE UPDATE ON public.integration_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
