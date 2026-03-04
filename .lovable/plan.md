

## Plan: Health Score Engine, Automations & Integration Stubs

### What Exists
- **Health config UI**: Pillars, indicators, overrides, playbooks — all configured per product
- **Edge functions**: `execute-health-playbook` (creates activities on band change, idempotent) and `execute-form-post-actions` (post-actions on form submission, idempotent)
- **Client-side helper**: `src/lib/health-playbook.ts` calls the playbook edge function
- **Health scores table**: stores `score`, `band`, `breakdown`, `calculated_at` per office
- **FormFillDialog**: already calls `execute-form-post-actions` after submission

### What's Missing

1. **Health Score calculation engine** — No logic exists to actually compute the score from indicators/data sources. Currently `health_scores` must be populated manually.
2. **Recalculation trigger** — No automatic recalculation when data changes (form submitted, meeting completed, contract updated, etc.)
3. **Integration stub edge functions** — Only 3 edge functions exist. Missing: email, whatsapp, google-calendar, asaas, slack, piperun, fireflies stubs.
4. **Calling recalculation after relevant actions** — FormFillDialog, meeting completion, contract updates, activity completion should trigger health recalculation.

### Implementation

**1. New Edge Function: `supabase/functions/calculate-health-score/index.ts`**

Core calculation engine invoked with `{ office_id }`. Logic:
- Fetch office → get `active_product_id`
- Fetch pillars + indicators for that product
- For each indicator, resolve data from its `data_source`/`data_key`:
  - `meetings` → days since last meeting, count in period
  - `form_submission` → latest NPS/CSAT/perception values from `form_submissions`
  - `contracts` → `installments_overdue` from active contract
  - `events` → participation rate from `event_participants`
  - `action_plans` → % completed tasks
  - `activities` → count of recent activities
- Score each indicator 0-100 based on the data value
- **Neutralization**: if indicator has no data, redistribute its weight among siblings in same pillar; if entire pillar has no data, redistribute among other pillars
- Weighted average → raw score
- Fetch overrides for product, check conditions (installments_overdue >= threshold, days_without_meeting >= threshold, etc.)
- Apply overrides: `force_red` sets band regardless of score; `reduce_score` subtracts points
- Determine band: 0-39 red, 40-69 yellow, 70-100 green
- Upsert into `health_scores` (one row per office)
- If band changed from previous, call `execute-health-playbook` logic internally
- Return `{ score, band, breakdown, overrides_applied }`

**2. New Edge Function stubs (7 functions)**

Each stub: validates auth, accepts defined params, returns mock success response.

| Function | Interface |
|----------|-----------|
| `integration-email` | `sendEmail(to, subject, body)` → `{success, messageId}` |
| `integration-whatsapp` | `sendWhatsApp(to, message)` / `logNote(officeId, content)` → `{success}` |
| `integration-google-calendar` | `syncMeetings(userId)` / `createEvent(data)` → `{events}` / `{eventId}` |
| `integration-asaas` | `getInvoices(officeId)` / `getOverdue(officeId)` → mock invoice list |
| `integration-slack` | `sendNotification(channel, message)` → `{success}` |
| `integration-piperun` | `importLeads()` / `updateDeal(dealId, data)` → mock data |
| `integration-fireflies` | `getTranscript(meetingId)` → `{transcript, summary}` mock |

**3. Client-side recalculation calls**

Create `src/lib/health-engine.ts` with `recalculateHealth(officeId)` that invokes `calculate-health-score`.

Add calls to recalculate after:
- `FormFillDialog.tsx` — after form submission + post-actions
- Meeting status changes (in Reunioes page or Cliente360 meetings section)
- Contract updates (in ContratosGlobal or ClienteContratos)
- Action plan status changes (in ClienteOKR / PortalOKR)

**4. Config updates**

Update `supabase/config.toml` to register all new edge functions with `verify_jwt = false`.

### Files

| File | Action |
|------|--------|
| `supabase/functions/calculate-health-score/index.ts` | New — core engine |
| `supabase/functions/integration-email/index.ts` | New stub |
| `supabase/functions/integration-whatsapp/index.ts` | New stub |
| `supabase/functions/integration-google-calendar/index.ts` | New stub |
| `supabase/functions/integration-asaas/index.ts` | New stub |
| `supabase/functions/integration-slack/index.ts` | New stub |
| `supabase/functions/integration-piperun/index.ts` | New stub |
| `supabase/functions/integration-fireflies/index.ts` | New stub |
| `src/lib/health-engine.ts` | New — client helper |
| `src/components/reunioes/FormFillDialog.tsx` | Add recalculation call |
| `supabase/config.toml` | Register new functions |

### No DB changes needed

All tables already exist. The engine reads from existing indicator configs and writes to `health_scores`.

