
## Plan: Real Integrations (6 services) — IMPLEMENTED

### Phase 1: Database Schema ✅
- Created tables: `integration_settings`, `integration_tokens`, `meeting_transcripts`, `whatsapp_messages`, `whatsapp_templates`
- Added columns: `meetings.google_event_id`, `offices.asaas_customer_id`, `offices.asaas_total_overdue`, `offices.piperun_deal_id`
- RLS policies applied

### Phase 2: Edge Functions ✅
All 6 stubs replaced with real API integrations:
- `integration-google-calendar` — OAuth exchange, sync, CRUD events
- `integration-slack` — Uses Lovable Slack connector gateway for notifications
- `integration-asaas` — Real Asaas API for payments/billing
- `integration-piperun` — Real Piperun API for deal import
- `integration-fireflies` — GraphQL API + webhook for transcripts
- `integration-whatsapp` — WhatsApp Business API for templates + webhook

### Phase 3: Integration Configuration UI ✅
- Rewritten `IntegracoesTab.tsx` with dynamic status from DB
- 6 config components: GoogleCalendarConfig, SlackConfig, AsaasConfig, PiperunConfig, FirefliesConfig, WhatsAppConfig
- `useIntegrationSettings` hook for state management

### Phase 4: Flow Integration ✅
- WhatsApp send button in ClienteHeader (360 view)
- Transcript modal in ClienteReunioes (Fireflies)
- WhatsAppSendDialog component for template/manual send

### Secrets Required
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — for Google Calendar OAuth
- `ASAAS_API_KEY` — for Asaas billing
- `PIPERUN_API_TOKEN` — for Piperun CRM
- `FIREFLIES_API_KEY` — for Fireflies transcription
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` — for WhatsApp Business
- Slack uses Lovable connector (already connected, SLACK_API_KEY available)
