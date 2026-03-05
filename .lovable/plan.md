

# Plan: Add Universal "New Client Registered" Trigger

## What
Add a new trigger `office.registered` to the automation rules that fires whenever a new client enters the system, regardless of origin. It coexists with the existing specific triggers (`office.created`, `office.imported_piperun`).

## Changes

### 1. Add trigger definition (UI only)
**File:** `src/components/configuracoes/AutomationRulesTab.tsx`

Add a new entry to the `TRIGGERS` array:
```typescript
{ value: 'office.registered', label: 'Novo cliente registrado (qualquer origem)', category: 'Cliente', timing: 'realtime' },
```

No parameters needed -- it fires unconditionally on any new office.

### 2. Update the execution engine
**File:** `supabase/functions/execute-automations/index.ts`

In the `onNewOffice` handler, after processing existing `distribution` and `onboarding_tasks` rules, also query `automation_rules_v2` for rules with `trigger_type = 'office.registered'` and execute their configured actions (create activity, send notification, move stage, etc.).

This ensures any rule using this trigger fires whenever `onNewOffice` is called -- which already covers manual creation and Piperun import.

### 3. Ensure import path also triggers
**File:** `src/components/import-export/ImportWizard.tsx`

After successfully importing offices (bulk insert), call the `execute-automations` edge function with `action: 'onNewOffice'` for each newly created office. This closes the gap where imported clients currently don't trigger automations.

## No DB changes needed
The `automation_rules_v2` table already supports any `trigger_type` text value and the actions/conditions JSONB structure. No migration required.

## Summary
| File | Change |
|------|--------|
| `AutomationRulesTab.tsx` | Add `office.registered` trigger definition |
| `execute-automations/index.ts` | Query and execute v2 rules for `office.registered` |
| `ImportWizard.tsx` | Fire `onNewOffice` after office imports |

