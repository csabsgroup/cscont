

# Plan: 3 Adjustments + Full Automation/Forms/Playbooks Validation

## Key Discovery: `office_code` Already Exists

The system already has `offices.office_code` (format "ELT-001") serving the same purpose as the requested `external_id`. It's already:
- Displayed in the 360 header as a badge
- Shown in the client table (column "ID" → `officeCode`)
- Auto-generated on client creation with product prefix
- Mapped in imports with aliases

**Decision**: Use existing `office_code` field. Add the missing aliases requested by the user ("id", "id do cliente", "id original", "identificador") to the import template.

---

## AJUSTE 1 — office_code visibility improvements

### Current State
- Header: Shows as badge before name ✅ but only if `office_code` exists
- Table: Column `officeCode` exists ✅ renders `office_code` value

### Changes Needed
1. **`src/lib/import-templates.ts`** — Add missing aliases to `office_code` entry:
   - Add: `'id'`, `'id do cliente'`, `'id original'`, `'identificador'`

2. **`src/components/clientes/ClienteHeader.tsx`** — Make code more prominent:
   - Show `office_code` OR fallback to first 8 chars of UUID when empty
   - Keep inline-editable (admin/manager only)

No database migration needed — `office_code` column already exists.

---

## AJUSTE 2 — CSM + Client fields in internal forms

### `src/components/reunioes/FormFillDialog.tsx`
- CSM field is already implicit (uses `auth.uid()` for `user_id` on submission)
- Office field: when opened from 360/meeting, `officeId` is already pre-set and locked

### `src/components/configuracoes/FormTemplatesTab.tsx`
- Add informational note for internal forms that CSM and Client are auto-filled
- No new database fields needed: `form_submissions.user_id` = CSM, `form_submissions.office_id` = client

### For standalone form filling (outside 360):
- The current system doesn't support standalone internal form filling — forms are always filled via meetings or 360
- This is acceptable as-is; the CSM/Client fields are handled by the calling context

**Minimal changes**: Add a visual indicator in the form builder showing that internal forms auto-include CSM and Client fields.

---

## AJUSTE 3 — Import aliases (covered in Ajuste 1)

Already addressed: add aliases to `office_code` in import-templates.ts.

---

## VALIDATION RESULTS (from code inspection)

### BLOCO A — AUTOMATIONS

**A1. CRUD**: ✅ Full CRUD in AutomationRulesTab.tsx with duplicate support

**A2. Triggers — Dispatch Status**:

| # | Trigger | Dispatch | Status |
|---|---------|----------|--------|
| 1 | office.created | Clientes.tsx (onNewOffice) | ✅ |
| 2 | office.registered | Clientes.tsx (onNewOffice) | ✅ |
| 3 | office.status_changed | StatusChangeModal.tsx | ✅ |
| 4 | office.stage_changed | Jornada.tsx + EditOfficeDialog | ✅ |
| 5 | health.band_changed | calculate-health-score | ✅ |
| 6 | form.submitted | FormFillDialog + submit-public-form | ✅ |
| 7 | meeting.completed | Reunioes.tsx | ✅ |
| 8 | payment.overdue | **NO DISPATCH** | ❌ |
| 9 | bonus.requested | ClienteBonus.tsx | ✅ |
| 10 | activity.overdue | **NO DISPATCH** (cron trigger but `runPeriodicRules` only handles `client_contains`) | ❌ |
| 11 | nps.below_threshold | submit-public-form | ✅ |
| 12 | contract.created | ClienteContratos.tsx | ✅ |
| 13 | contact.created | ClienteContatos.tsx | ✅ |
| 14 | office.imported_piperun | piperun-webhook | ✅ |
| 15 | activity.completed | ActivityEditDrawer.tsx | ✅ |
| 16 | client_contains | runPeriodicRules | ✅ |
| 17 | office.no_meeting | **NO PERIODIC HANDLER** (defined as cron but only `client_contains` is handled) | ❌ |
| 18 | office.renewal_approaching | **NO PERIODIC HANDLER** | ❌ |

**Fixes needed**: Expand `runPeriodicRules` to also process rules with trigger types: `office.no_meeting`, `office.renewal_approaching`, `activity.overdue`, `payment.overdue`. These are all cron-type triggers that should iterate offices and check conditions.

**A3. Actions**: All 17 action handlers exist and are complete ✅
- create_activity, move_stage, change_status, send_notification, send_email, send_slack, send_whatsapp, create_action_plan, change_csm, create_contract, cancel_contract, set_product, add_note, grant_bonus, create_meeting, force_health_band, create_alert, apply_playbook

**A4. Conditions**: All operators implemented correctly ✅

**A5. Variables**: Missing `{{mrr}}`, `{{nps}}`, `{{ltv}}` in resolveVariables
- Fix: Add `.replace(/\{\{mrr\}\}/g, ...)` etc.

**A6. Idempotency**: ✅ Correct — unique constraint, deterministic context_key

**A7. Preview**: ✅ previewMatchedOffices works

**A8. Logs**: ✅ automation_logs populated correctly

### BLOCO B — FORMULÁRIOS
- B1-B7: All working correctly ✅
- Form builder, header mapping, conditional logic, meeting boolean control, metrics history, external forms, meeting fill flow — all verified in code

### BLOCO C — PLAYBOOKS
- C1-C5: All working correctly ✅
- CRUD with duplicate, apply from 360/automations, progress tracking, auto-advance with stage change trigger

### BLOCO D — DATA BINDING
- D1-D4: Verified correct flow from form submission → header update → metrics history → automation triggers

---

## Implementation Changes

### 1. `src/lib/import-templates.ts`
- Add aliases `'id'`, `'id do cliente'`, `'id original'`, `'identificador'` to `office_code` field

### 2. `src/components/clientes/ClienteHeader.tsx`
- Show UUID fallback (first 8 chars) when `office_code` is empty
- Keep existing badge display

### 3. `supabase/functions/execute-automations/index.ts`
- **resolveVariables**: Add `{{mrr}}`, `{{nps}}`, `{{ltv}}` variables
- **runPeriodicRules**: Expand to handle `office.no_meeting`, `office.renewal_approaching`, `activity.overdue`, `payment.overdue` trigger types alongside `client_contains`
  - These cron triggers iterate all offices and check enriched data conditions just like `client_contains`
  - For `activity.overdue`: query overdue activities per office, create context
  - For `payment.overdue`: check `installments_overdue > 0` from enriched data
  - For `office.no_meeting`: check `days_without_meeting > threshold`
  - For `office.renewal_approaching`: check `days_to_renewal < threshold`

### 4. `src/components/configuracoes/FormTemplatesTab.tsx`
- Add info badge for internal forms: "Campos automáticos: CSM (usuário logado) e Cliente (selecionado na reunião)"

---

## Summary

| Category | Verified | OK | Needs Fix |
|----------|---------|-----|-----------|
| Triggers | 18 | 14 | 4 (periodic handlers) |
| Actions | 17 | 17 | 0 |
| Conditions | 11 operators | 11 | 0 |
| Variables | 10 | 7 | 3 missing |
| Forms | 7 checks | 7 | 0 |
| Playbooks | 5 checks | 5 | 0 |
| Data binding | 4 flows | 4 | 0 |

**Critical**: 0 | **Moderate**: 1 (periodic triggers) | **Minor**: 3 (variables, aliases, header fallback)

