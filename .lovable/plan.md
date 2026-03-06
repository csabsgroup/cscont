

# Plan: Periodic "Cliente contém" Trigger

## Overview

Add a new periodic trigger type `client_contains` that runs on a schedule, evaluates all clients against conditions, and executes actions for matching ones. This requires UI changes, edge function logic, and a cron job.

## Changes

### File 1: `src/components/configuracoes/AutomationRulesTab.tsx`

**A. Add trigger to TRIGGERS array (after line 71):**
```
{ value: 'client_contains', label: '🔄 Cliente contém (verificação periódica)', category: 'Periódico', timing: 'cron' }
```

**B. Add periodic frequency/repeat options (new constants near line 310):**
- `PERIODIC_FREQUENCY_OPTIONS`: hourly, every_6h, every_12h, daily, weekly
- `PERIODIC_REPEAT_OPTIONS`: once, always, interval

**C. Render periodic params in Step 1 (after trigger select, ~line 1337):**
When `trigger_type === 'client_contains'`, show:
- Frequency dropdown → saves to `trigger_params.frequency`
- Repeat mode dropdown → saves to `trigger_params.repeat_mode`  
- If repeat_mode === 'interval': numeric input for `repeat_interval_days`

**D. Update list view badge (line ~1167):**
Show "🔄 Periódico" badge when `trigger_type === 'client_contains'`

### File 2: `supabase/functions/execute-automations/index.ts`

**A. Add helper functions (before main handler):**

- `checkShouldRun(triggerParams)`: Compare `last_run_at` against `frequency` to determine if rule should execute now
- `checkRepeatMode(rule, officeId, supabase)`: Query `automation_executions` to enforce once/always/interval repeat logic per office
- `enrichOfficeData(office, supabase)`: Fetch and attach calculated fields (health score, journey stage, days_to_renewal, days_without_meeting, contract data) — reuses existing `resolveConditionValue` pattern but pre-fetches for efficiency

**B. Add `runPeriodicRules` action (after `runNowAll`, ~line 987):**

Logic flow:
1. Fetch all active rules with `trigger_type = 'client_contains'`
2. For each rule, call `checkShouldRun` based on frequency
3. If should run: fetch offices (filtered by `product_id` if set, excluding `pausado`)
4. For each office: evaluate conditions using existing `resolveConditionValue` + `evaluateCondition` (reuse the same group-based evaluation from `executeV2Rules`)
5. If conditions match: call `checkRepeatMode` for idempotency
6. If can execute: run each action via `handleAction` with individual try/catch
7. Record in `automation_executions` and `automation_logs`
8. After processing all offices for a rule: update `trigger_params.last_run_at`
9. Return summary of results

**C. Key design decisions:**
- Reuse `resolveConditionValue`, `evaluateCondition`, and `handleAction` — no duplicated logic
- Condition evaluation uses the same group-based approach (groups with logic) as `executeV2Rules`
- Individual try/catch per office and per action — one failure doesn't stop others
- `context_key` for idempotency: `periodic_{rule_id}_{office_id}` (for `once` mode) or `periodic_{rule_id}_{office_id}_{date}` (for `always`/`interval`)

### Cron Setup (SQL insert, not migration)

Use `pg_cron` + `pg_net` to invoke the edge function every hour:
```sql
SELECT cron.schedule(
  'automation-periodic-check',
  '0 * * * *',
  $$ SELECT net.http_post(
    url := 'https://fdkaxkuehhnqdkduiwsy.supabase.co/functions/v1/execute-automations',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <service_role_key>"}'::jsonb,
    body := '{"action":"runPeriodicRules"}'::jsonb
  ); $$
);
```
This will be executed via the insert tool (not migration) since it contains project-specific secrets.

## Summary

| Component | Change |
|-----------|--------|
| `AutomationRulesTab.tsx` | Add `client_contains` trigger + frequency/repeat UI fields |
| `execute-automations/index.ts` | Add `runPeriodicRules` action + helper functions |
| Database (insert) | Schedule hourly cron via `pg_cron` |

3 changes total. No schema migrations needed — reuses existing `automation_executions` and `automation_logs` tables.

