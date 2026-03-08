

# QA Report: Bugs, Usability Issues & Correction Plan

After thorough code review, I identified **14 issues** across 4 severity levels.

---

## CRITICAL (Data Loss / Broken Functionality)

### BUG 1 — Playbook activity completion skips automation trigger + playbook completion check
**Where:** `ClienteTimeline.tsx` → `confirmComplete()` (line 190-196)
**Problem:** When completing an activity from the timeline (both standalone and playbook), it only updates `completed_at` and `observations`. Unlike `ActivityEditDrawer.handleComplete()`, it does NOT:
- Trigger `execute-automations` with `activity.completed`
- Check playbook completion via `checkPlaybookCompletion()`
- This means completing a playbook activity from the timeline dropdown menu will never mark the playbook as complete and never fire automations.

**Fix:** Mirror the logic from `ActivityEditDrawer.handleComplete()` in `confirmComplete()`. After updating the activity, invoke automations and check playbook completion if `playbook_instance_id` is set.

### BUG 2 — `generateNextOfficeCodeSafe` never actually retries
**Where:** `src/lib/office-code-helpers.ts` (lines 32-48)
**Problem:** The `generateNextOfficeCodeSafe` function is supposed to retry on unique violations, but it returns the code *before* insertion. The retry logic has no actual INSERT to fail — it's dead code. The function calls `generateNextOfficeCode` which will return the **same value** each time (the DB hasn't changed), then adds `attempt` offset, but this entire function is never even called anywhere in the codebase. `CreateClientWizard` uses `generateNextOfficeCode` directly instead.

**Fix:** Either remove `generateNextOfficeCodeSafe` or refactor `CreateClientWizard` to use it properly by wrapping the insert+retry into a single atomic helper.

### BUG 3 — Wizard retry logic can still fail on race conditions
**Where:** `CreateClientWizard.tsx` lines 130-146
**Problem:** On unique violation (`23505`), the retry increments by 1, but `generateNextOfficeCode` already returned what it thought was the next number. If 2 users create simultaneously, the retry with +1 may also collide. Only one retry attempt is made.

**Fix:** Use a loop (up to 3 attempts) that re-queries the max code each time instead of just incrementing.

---

## HIGH (Incorrect Behavior)

### BUG 4 — Playbook accordion: "Concluir" from dropdown doesn't pass activity through `handleComplete`
**Where:** `ClienteTimeline.tsx` line 371
**Problem:** The dropdown "Concluir" action inside playbook cards directly sets `completeItem` and `completeObs`, bypassing `handleComplete()`. This works for the observations dialog flow but inconsistently — standalone activities go through `handleComplete(item)` which expects `{type, data}`, while playbook activities set `completeItem = act` directly. Both paths converge at `confirmComplete`, so it works, but the code is fragile and inconsistent.

**Fix:** Normalize both paths to use the same flow.

### BUG 5 — `handleDelete` in timeline has no confirmation dialog
**Where:** `ClienteTimeline.tsx` line 204-208, and line 373
**Problem:** Clicking "Excluir" from the dropdown menu (both standalone and playbook activities) immediately deletes without any confirmation prompt. This is a data loss risk, especially since the user might accidentally click it.

**Fix:** Add a confirmation dialog or `window.confirm()` before deleting.

### BUG 6 — Wizard Step 3 "Pular" both clears the form AND calls `handleCreate`
**Where:** `CreateClientWizard.tsx` line 470
**Problem:** When clicking "Pular" on Step 3, it resets the contrato state and immediately calls `handleCreate()`. But `handleCreate` reads from the `contrato` state which was just reset. Due to React's batching, the state might not have updated yet when `handleCreate` runs, potentially inserting stale contract data.

**Fix:** Call `handleCreate` with an explicit empty contract override, or separate the reset from the create call.

### BUG 7 — Wizard doesn't generate `office_code` in import
**Where:** `ImportWizard.tsx`
**Problem:** The import wizard does not call `generateNextOfficeCode` for rows without an `office_code`. The plan specified this should happen, but the implementation was never added to the import logic.

**Fix:** In the import row processing loop, if the template is `offices` and the row doesn't have `office_code`, generate one using `generateNextOfficeCode`.

---

## MEDIUM (Usability Issues)

### ISSUE 8 — Playbook header not keyboard-accessible
**Where:** `ClienteTimeline.tsx` line 310
**Problem:** The playbook accordion toggle is a `<button>` (good), but lacks `aria-expanded` attribute and keyboard focus styling is not visible.

**Fix:** Add `aria-expanded={isExpanded}` to the button.

### ISSUE 9 — No empty state when playbook has zero activities
**Where:** `ClienteTimeline.tsx` lines 131-150
**Problem:** If a `playbook_instance` exists but has zero activities (e.g., they were all deleted), the playbook still appears with "0/0 (NaN%)" or "0/0 (0%)" and an empty expanded section.

**Fix:** Filter out playbook groups with zero activities, or show "Nenhuma atividade" inside the expanded section.

### ISSUE 10 — Wizard doesn't validate CNPJ format
**Where:** `CreateClientWizard.tsx`
**Problem:** CNPJ field accepts any string with no format validation or mask. Users could enter invalid data.

**Fix:** Add a CNPJ mask or at least length validation (14 digits).

### ISSUE 11 — Wizard contact phone populates both `phone` and `whatsapp` with same value
**Where:** `CreateClientWizard.tsx` line 172
**Problem:** `whatsapp: c.phone || null` — the contact's phone field is used for both `phone` and `whatsapp` columns. There's a single input for "Telefone/WhatsApp" but it duplicates the value into both database columns.

**Fix:** Either add separate fields for phone and WhatsApp, or only populate `whatsapp` (since the label says "Telefone/WhatsApp").

### ISSUE 12 — Wizard Step 2 shows first contact as required (`*`) but it's actually optional
**Where:** `CreateClientWizard.tsx` line 371
**Problem:** The label shows `*` for the first contact name, but Step 2 has a "Pular" button. The asterisk misleads the user into thinking it's required.

**Fix:** Remove the `*` from the contact name label since the entire step is skippable.

---

## LOW (Polish / Consistency)

### ISSUE 13 — Sort by `officeCode` uses `localeCompare` with numeric option AFTER numeric extraction
**Where:** `Clientes.tsx` line 432
**Problem:** The `officeCode` case extracts numeric values (line 418-421), setting `va` and `vb` as numbers. But the sort comparison at line 432 checks `typeof va === 'string'` — since they're numbers, it correctly falls into the numeric branch. However, the `localeCompare` fallback at line 432 still has a special case for `officeCode` (`numeric: true`) which is dead code now.

**Fix:** Remove the dead `officeCode` special case from the `localeCompare` call for clarity.

### ISSUE 14 — Automation toggle in import shows success toast before automations finish
**Where:** `ImportWizard.tsx` lines 317-324
**Problem:** `toast.success('Automações disparadas...')` fires immediately after starting the fire-and-forget loop, not after all automations finish. For large imports, some may fail silently.

**Fix:** Use `Promise.allSettled` and report actual success/failure count.

---

## Correction Plan (Priority Order)

| # | Severity | File | Fix |
|---|----------|------|-----|
| 1 | CRITICAL | `ClienteTimeline.tsx` | Add automation trigger + playbook completion check to `confirmComplete()` |
| 5 | HIGH | `ClienteTimeline.tsx` | Add delete confirmation dialog |
| 6 | HIGH | `CreateClientWizard.tsx` | Fix "Pular" on Step 3 to pass empty contract explicitly |
| 2 | CRITICAL | `office-code-helpers.ts` | Remove dead `generateNextOfficeCodeSafe` or integrate it properly |
| 3 | CRITICAL | `CreateClientWizard.tsx` | Implement proper retry loop with re-query on race condition |
| 4 | HIGH | `ClienteTimeline.tsx` | Normalize complete flow for playbook vs standalone |
| 7 | HIGH | `ImportWizard.tsx` | Add `generateNextOfficeCode` call during import for missing codes |
| 9 | MEDIUM | `ClienteTimeline.tsx` | Handle empty playbook groups |
| 11 | MEDIUM | `CreateClientWizard.tsx` | Fix phone/whatsapp duplication |
| 12 | MEDIUM | `CreateClientWizard.tsx` | Remove misleading `*` from optional contact |
| 8 | MEDIUM | `ClienteTimeline.tsx` | Add `aria-expanded` |
| 14 | LOW | `ImportWizard.tsx` | Use `Promise.allSettled` for automation results |
| 13 | LOW | `Clientes.tsx` | Remove dead code in sort comparison |

Shall I proceed with implementing all fixes?

