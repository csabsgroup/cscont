

# Plan: Add "Run Now" and "Affected Clients Preview" to Automation Rules

## Summary

Add two features to the automation rule editor: (1) a toggle to execute the rule immediately vs only on next scheduled execution, and (2) a panel showing which clients match the rule's conditions.

## Changes

### File 1: `src/components/configuracoes/AutomationRulesTab.tsx`

**A. Add "Run Now" option in Step 3 (Agendamento) — after line ~1513:**
- Add a separator and a new section with a Switch: "Disparar regra agora ao salvar"
- When enabled, after `handleSave` succeeds, invoke `execute-automations` with `action: 'runNow'` passing the saved rule ID
- Store this in a local state `runNow` (not persisted to DB — it's a one-time action)

**B. Add "Preview affected clients" button + panel in Step 2 (Condições) — after line ~1410:**
- Add a button "Ver clientes atingidos" with the `Users` icon (already imported)
- When clicked, call a new edge function action `previewMatchedOffices` that evaluates the rule's conditions against all active offices and returns a list of matched office names/IDs
- Display results in a collapsible card showing office names, count, and CSM

**C. Update `handleSave` (line 432-475):**
- After successful save, if `runNow` is true, invoke `execute-automations` with `action: 'runNowAll'` + `rule_id` to execute the rule against all matching clients immediately

**D. Wire the existing `dryRunResults` state (line 340) and `handleDryRun` (line 524):**
- The dry run infrastructure exists but is never shown in the UI. Expose it in the conditions step or as a footer button.

### File 2: `supabase/functions/execute-automations/index.ts`

**A. Add `previewMatchedOffices` action (after line ~778):**
- Accepts: `conditions`, `condition_logic`, `product_id`
- Queries all active offices (status in ativo/upsell/bonus_elite)
- Evaluates conditions against each office using existing `resolveConditionValue` + `evaluateCondition`
- Returns list of `{ id, name, csm_name }` for matched offices (limit 100)

**B. Add `runNowAll` action (after `previewMatchedOffices`):**
- Accepts: `rule_id`
- Fetches the rule, gets all active offices matching product scope
- Runs `executeV2Rules` for each matched office with `dryRun=false`
- Returns summary of executed/skipped/errors

## UI Layout for Step 3 (Schedule)

After the existing "Retrigger" section, add:

```text
─────────────────────────────────
Execução imediata
[Toggle] Disparar regra agora ao salvar
  Texto auxiliar: "A regra será executada imediatamente
  para todos os clientes que atendem as condições."
─────────────────────────────────
```

## UI Layout for Step 2 (Conditions) — bottom

```text
─────────────────────────────────
[Users icon] Ver clientes atingidos (Preview)
  Loading... or
  ┌─────────────────────────────┐
  │ 23 clientes atingidos       │
  │                             │
  │ • Escritório ABC (CSM: Ana) │
  │ • Escritório DEF (CSM: João)│
  │ • ... (mostrar até 50)      │
  └─────────────────────────────┘
─────────────────────────────────
```

## Summary

| File | Changes |
|------|---------|
| `AutomationRulesTab.tsx` | Add run-now toggle in step 3, preview panel in step 2, wire to save |
| `execute-automations/index.ts` | Add `previewMatchedOffices` and `runNowAll` actions |

2 files modified. No database changes.

