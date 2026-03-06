

# Diagnosis: Slack and Email Automations Not Firing

## Root Causes Found

There are **3 mismatches** in the `execute-automations` edge function when calling the Slack and Email integration functions:

### Bug 1 — Slack: Wrong action name + missing required params
In `execute-automations/index.ts` line 119-124, the Slack call uses:
- `action: 'sendMessage'` -- but `integration-slack` only handles `sendNotification`
- Missing `channel` param (required by `sendNotification`)
- Missing `data` param with the message content

The Slack function expects: `{ action: 'sendNotification', channel: 'C0AJJK8FSN6', data: { type: 'generic', message: '...' } }`

### Bug 2 — Email: Wrong action name
In `execute-automations/index.ts` line 99-106, the Email call uses:
- `action: 'send'` -- but `integration-email` only handles `sendEmail`

### Bug 3 — Auth context lost in function-to-function calls
Both `integration-slack` and `integration-email` validate JWT and check user roles. When `execute-automations` calls them via `supabase.functions.invoke()` using the service-role client, the inner functions can't validate the JWT properly (service role key != user JWT). This causes 401/403 errors silently.

## Fix Plan

### File: `supabase/functions/execute-automations/index.ts`

**Slack fix (lines 116-131):** Instead of calling the edge function (which has auth issues), call Slack API directly from the automation handler:
1. Fetch `integration_settings` for `provider='slack'` to get channel_id
2. Call `integration-slack` with correct params: `action: 'sendNotification'`, `channel: config.channel_id`, `data: { type: 'generic', message: resolvedMessage }`
3. OR better: bypass the edge function entirely and call the Slack gateway directly (avoids auth issues)

Best approach: **Modify `send_slack` handler** to:
- Read Slack config from `integration_settings` table
- Use the Slack gateway directly (same as `integration-slack` does) with `LOVABLE_API_KEY` and `SLACK_API_KEY` env vars
- Post message to the configured channel

**Email fix (lines 96-114):** 
- Change `action: 'send'` to `action: 'sendEmail'`
- Since email is a stub anyway, alternatively just inline the stub logic

### Simpler alternative for both:
Since calling edge functions from edge functions has auth issues, **inline the Slack API call and Email stub** directly in `execute-automations`:
- For Slack: read channel from `integration_settings`, call Slack gateway directly
- For Email: just log it (it's a stub already)

This avoids the auth chain problem entirely and is more reliable.

