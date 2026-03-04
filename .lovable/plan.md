

## Plan: Real Integrations (6 services)

This is a very large scope. I'll break it into implementable phases. Given the constraints of Lovable Cloud, some aspects (like Google OAuth per-user, Slack OAuth) require API keys/secrets from external services before they can work. The plan focuses on building the full infrastructure so everything works once credentials are provided.

### Phase 1: Database Schema (single migration)

**New tables:**
- `integration_settings` — provider config (API keys stored in secrets, but channel/pipeline config stored here)
  - `id uuid PK, provider text UNIQUE, config jsonb DEFAULT '{}', workspace_name text, is_connected boolean DEFAULT false, created_at, updated_at`
- `integration_tokens` — per-user OAuth tokens (Google Calendar)
  - `id uuid PK, user_id uuid, provider text, access_token text, refresh_token text, token_expiry timestamptz, provider_email text, created_at, updated_at, UNIQUE(user_id, provider)`
- `meeting_transcripts` — Fireflies transcriptions
  - `id uuid PK, meeting_id uuid nullable, fireflies_meeting_id text, title text, date timestamptz, transcript text, summary text, action_items jsonb, attendees jsonb, matched boolean DEFAULT false, created_at`
- `whatsapp_messages` — WhatsApp message log
  - `id uuid PK, office_id uuid, contact_id uuid nullable, direction text, message_type text, template_name text, content text, phone_to text, phone_from text, wamid text, status text DEFAULT 'sent', created_at`
- `whatsapp_templates` — approved WA templates
  - `id uuid PK, template_name text, description text, variables jsonb, auto_trigger text DEFAULT 'none', auto_trigger_enabled boolean DEFAULT false, created_at`

**Column additions:**
- `meetings.google_event_id` text nullable
- `offices.asaas_customer_id` text nullable
- `offices.asaas_total_overdue` numeric nullable
- `offices.piperun_deal_id` text nullable

**RLS:** Admin-only write on integration_settings/tokens. Authenticated read on settings. User-own on tokens. Visible-office-based on whatsapp_messages and meeting_transcripts.

### Phase 2: Edge Functions (replace all stubs)

| Function | Purpose |
|----------|---------|
| `integration-google-calendar` | Rewrite: OAuth callback handler, sync events, create/update/delete events. Uses `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` secrets. |
| `integration-slack` | Rewrite: Send Block Kit notifications to configured channel. Uses `SLACK_BOT_TOKEN` secret. Actions: sendNotification (health, churn, bonus alerts), dailySummary. |
| `integration-asaas` | Rewrite: testConnection, searchCustomer, getPayments, webhook receiver. Uses `ASAAS_API_KEY` secret. |
| `integration-piperun` | Rewrite: testConnection, listPipelines, importDeals. Uses `PIPERUN_API_TOKEN` secret. |
| `integration-fireflies` | Rewrite: testConnection (GraphQL), webhook receiver for transcripts with meeting matching logic. Uses `FIREFLIES_API_KEY` secret. |
| `integration-whatsapp` | Rewrite: testConnection, sendTemplate, webhook receiver. Uses `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` secrets. |

Each function validates its API key exists, handles errors gracefully, and returns structured responses.

### Phase 3: Integration Configuration UI

**Rewrite `IntegracoesTab.tsx`** — from static cards to dynamic, stateful cards:
- Each card shows real connection status from `integration_settings` table
- "Configurar" button opens a drawer/dialog specific to each integration

**New config dialogs (one component per integration):**

| Component | Fields |
|-----------|--------|
| `GoogleCalendarConfig` | OAuth connect button, connected email display, disconnect |
| `SlackConfig` | Bot token input, test connection, channel selector dropdown, notification toggles (health/churn/bonus/daily) |
| `AsaasConfig` | API key input, test connection, auto-sync toggle |
| `PiperunConfig` | API token input, test connection, pipeline/stage selectors, default product/CSM, auto-import toggle, import now button |
| `FirefliesConfig` | API key input, test connection, webhook URL display for copy |
| `WhatsAppConfig` | Phone Number ID, Account ID, Access Token inputs, test connection, template management, auto-reminder toggles |

All stored in `integration_settings` table (config jsonb) + secrets for API keys.

### Phase 4: Integration into existing flows

**Google Calendar:**
- In `Reunioes.tsx` create-meeting flow: after insert, invoke `integration-google-calendar` action=createEvent if user has token
- Add `google_event_id` tracking

**Slack:**
- In health score recalculation (health-engine): after band change, invoke `integration-slack` action=healthAlert
- In bonus request creation: invoke slack action=bonusAlert
- In office status change to churn: invoke slack action=churnAlert

**Asaas:**
- In `ClienteContratos.tsx`: add "Vincular Asaas" button, show real payment data when linked
- Fetch payments on 360 load if `asaas_customer_id` exists

**Piperun:**
- Import results shown in config dialog
- Auto-import via cron (pg_cron scheduled edge function call)

**Fireflies:**
- In `ClienteReunioes.tsx`: show "Ver transcrição" button if transcript exists in `meeting_transcripts`
- Unmatched transcripts badge in Reunioes page

**WhatsApp:**
- In `ClienteHeader.tsx`: "Enviar WhatsApp" button (template or wa.me link)
- In timeline: show WhatsApp messages
- Auto-reminders via cron

### Phase 5: Secrets required from user

Before each integration works, the user must provide API keys:
- Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Slack: `SLACK_BOT_TOKEN` (or use Lovable Slack connector)
- Asaas: `ASAAS_API_KEY`
- Piperun: `PIPERUN_API_TOKEN`
- Fireflies: `FIREFLIES_API_KEY`
- WhatsApp: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`

### Files Summary

**New files (~15):**
- `src/components/configuracoes/integrations/GoogleCalendarConfig.tsx`
- `src/components/configuracoes/integrations/SlackConfig.tsx`
- `src/components/configuracoes/integrations/AsaasConfig.tsx`
- `src/components/configuracoes/integrations/PiperunConfig.tsx`
- `src/components/configuracoes/integrations/FirefliesConfig.tsx`
- `src/components/configuracoes/integrations/WhatsAppConfig.tsx`
- `src/hooks/useIntegrationSettings.ts` — hook to fetch/cache integration status
- `src/components/clientes/WhatsAppSendDialog.tsx` — send template/manual from 360
- `src/components/clientes/TranscriptModal.tsx` — view transcript details

**Modified files (~8):**
- `src/components/configuracoes/IntegracoesTab.tsx` — full rewrite with dynamic status
- `supabase/functions/integration-*` — all 6 rewritten with real API calls
- `src/components/clientes/ClienteReunioes.tsx` — transcript button
- `src/components/clientes/ClienteHeader.tsx` — WhatsApp send button
- `src/components/clientes/ClienteContratos.tsx` — Asaas integration
- `src/pages/Reunioes.tsx` — Google Calendar event creation on meeting create
- `supabase/config.toml` — new function entries

**Deleted files:** None (stubs are overwritten in-place)

### Important Notes

- Slack: I'll check if the Lovable Slack connector is available first (it may simplify auth). If so, I'll use the connector gateway pattern instead of raw bot tokens.
- Google Calendar OAuth requires a callback URL — the edge function will handle the OAuth code exchange.
- All integrations are independent — if one fails or isn't configured, others and manual flows continue working.
- API keys will be requested via the `add_secret` tool one at a time as the user configures each integration.

