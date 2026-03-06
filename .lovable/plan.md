

# Diagnosis and Fix Plan

## Root Causes Found

### Problem 1 — Webhook mapping not filling fields
The webhook_logs table confirms the error: `"supabase.from(...).insert(...).catch is not a function"`. The last two webhooks (March 5 and March 6) both crashed with this error BEFORE reaching office creation. The `.catch()` fix was applied in code but the webhooks arrived before deployment completed. The mapping paths are correct, the company data exists at root level with all expected fields. This problem is already fixed in code — just needs a new webhook to test.

### Problem 2 — Only 3 of 17 create_activity actions succeeded
**This is the critical finding.** The `activity_type` database enum has these valid values:
`task, follow_up, onboarding, renewal, other, ligacao, check_in, email, whatsapp, planejamento`

It does NOT include `"meeting"`. The automation rule "[ELT] Delegação automática" has 14 actions with `activity_type: "meeting"` — every one of those fails silently because the INSERT violates the enum constraint. The `handleAction` function doesn't capture the error from `supabase.from("activities").insert(...)`.

Evidence: automation_logs shows 19 `actions_executed` entries, but only 3 `create_activity` have an `id` (the ones with type "task" or "email"). The other 14 have no `id` — they failed silently.

### Problem 3 — Webhook doesn't trigger automations
Same root cause as Problem 1 — the webhook crashed before reaching the automation invocation lines (419-430). Once the webhook stops crashing, automations will be invoked via `supabase.functions.invoke()`.

## Fixes

### Fix A — Add "meeting" to activity_type enum (database migration)
```sql
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'meeting';
```
This is the correct fix because:
- The automation builder UI offers "meeting" as an option
- Users have configured rules with this type
- 14 activities are waiting to be created with this type

### Fix B — Add error handling in handleAction (execute-automations)
In the `create_activity` case (line 46-47), capture and log the error:
```javascript
const { data: act, error: actErr } = await supabase.from("activities").insert(payload).select("id").single();
if (actErr) {
  console.error('[AUTOMATIONS] Activity insert error:', actErr.message, 'payload:', JSON.stringify(payload));
  return { type: "create_activity", error: actErr.message };
}
```
Apply similar error capture to ALL action types that do database inserts (send_notification, add_note, create_action_plan, etc.).

### Fix C — Ensure webhook deployment is current
The piperun-webhook code already has the `.catch()` fix from the previous iteration. Verify the edge function redeploys by checking logs after saving. No code change needed — just confirmation.

### Fix D — Add company fallback in webhook (safety)
In `piperun-webhook/index.ts` line 341, add fallback to `person.company`:
```javascript
let companyData = deal.company || deal.person?.company;
```
This handles edge cases where the Piperun payload structure varies.

## Files Modified
- `supabase/functions/execute-automations/index.ts` — error handling in handleAction
- `supabase/functions/piperun-webhook/index.ts` — company fallback
- Database migration: add `meeting` to `activity_type` enum

## Expected Result After Fix
- All 17 `create_activity` actions succeed (activities created with correct types)
- Webhook creates office with all mapped fields populated
- Webhook triggers automations that execute all 19 actions
- automation_logs show complete execution with all action IDs

