

# Plan: Fix Automation Engine + Status Default + Duplicate Rules + Piperun Expansion + Dry Run

## Analysis Summary

**Root causes identified:**
1. **Automations don't fire**: The `execute-automations` edge function exists with v2 rule evaluation logic, but it's only called from `ImportWizard.tsx`. The office creation in `Clientes.tsx` (line 531) does NOT call it. No other system event (status change, meeting completed, form submitted, etc.) triggers it either.
2. **Status defaults to "nao_iniciado"**: Hardcoded on line 531 of `Clientes.tsx` and in the Piperun edge function.

---

## BLOCO 1 — Fix Automation Engine

### 1A. Refactor edge function to accept generic trigger

Currently `execute-automations` only accepts `onNewOffice` and `onStageChange`. Refactor to also accept a generic `{ action: "triggerV2", trigger_type, office_id, context }` action that runs `executeV2Rules` directly. This avoids breaking existing v1 callers.

Add variable substitution (`resolveVariables`) for message templates in actions like `send_notification`, `send_email`, `send_slack`. Add `send_slack` and `send_whatsapp` action handlers that invoke the respective edge functions. Add `automation_logs` table for detailed execution logging.

### 1B. Connect triggers to all system events

Add `try/catch` calls to `supabase.functions.invoke('execute-automations', ...)` at each event point:

| Event | File | Trigger |
|---|---|---|
| Create office (manual) | `src/pages/Clientes.tsx` handleCreate | `office.created` + `office.registered` |
| Status changed | `src/components/clientes/StatusDropdown.tsx` or `StatusChangeModal.tsx` | `office.status_changed` |
| Stage changed | `src/components/clientes/ClienteJornada.tsx` (or wherever stage moves) | `office.stage_changed` |
| Meeting completed | `src/pages/Reunioes.tsx` | `meeting.completed` |
| Form submitted | `src/components/reunioes/FormFillDialog.tsx` | `form.submitted` |
| Contract created | `src/components/clientes/ClienteContratos.tsx` | `contract.created` |
| Contact created | `src/components/clientes/ClienteContatos.tsx` | `contact.created` |
| Bonus requested | `src/components/clientes/ClienteBonus.tsx` | `bonus.requested` |
| Health band changed | `supabase/functions/calculate-health-score/index.ts` | `health.band_changed` |
| Piperun import | Already partially done in `integration-piperun` | `office.imported_piperun` + `office.registered` |

### 1C. Database: Create `automation_logs` table

```sql
CREATE TABLE public.automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL,
  rule_name text,
  office_id uuid NOT NULL,
  trigger_type text NOT NULL,
  conditions_met boolean NOT NULL DEFAULT false,
  actions_executed jsonb DEFAULT '[]',
  error text,
  execution_time_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
-- Admin can manage, authenticated can view
```

### 1D. Automation Logs UI

Add a "Logs" tab in `AutomationRulesTab.tsx` showing execution history with filters (period, rule, trigger, success/error).

### 1E. Cron function (deferred)

Create `automation-cron` edge function for time-based triggers (`office.no_meeting`, `office.renewal_approaching`, `payment.overdue`, `activity.overdue`, `nps.below_threshold`). Runs daily, checks all active non-paused offices.

---

## BLOCO 2 — Status Default "ativo"

**3 changes:**
1. `src/pages/Clientes.tsx` line 531: change `status: 'nao_iniciado'` → `status: 'ativo'`
2. `supabase/functions/integration-piperun/index.ts`: change default status from `'nao_iniciado'` to `'ativo'`
3. Database migration: `ALTER TABLE offices ALTER COLUMN status SET DEFAULT 'ativo'`

---

## BLOCO 3 — Duplicate Rules

Add "Duplicar" button in the rules list dropdown in `AutomationRulesTab.tsx`:
- Copies all rule data with name `"[original] (cópia)"`, `is_active: false`
- Opens editor with the duplicated rule

---

## BLOCO 4 — Piperun Field Expansion

Already substantially implemented in the previous iteration (expanded `listFields` to fetch deals + persons + organizations). The request asks for additional proposal fields and PDF download.

**Additions:**
- In `integration-piperun` `listFields`: add `/proposals?show=1` fetch, merge proposal fields with `proposal.` prefix
- In `importDeals`: after importing a deal, check for proposals (`GET /proposals?deal_id=X`), if PDF URL exists, download and upload to Supabase Storage
- Expand `PiperunFieldPicker.tsx` fallback fields with proposal fields and PDF option
- Add category "Proposta" and "Arquivos" groupings

---

## BLOCO 5 — Preview de Alcance + Dry Run

- Add a reach counter card between Conditions and Actions in the rule editor
- Debounced query (500ms) counting offices matching current product + conditions
- "Ver escritórios atingidos" expandable table
- "Simular (Dry Run)" button that calls the edge function with `{ action: "dryRun" }` — evaluates but doesn't execute, returns preview of what would happen for first 5 offices

---

## Files Changed

| File | Change |
|---|---|
| Migration SQL | Create `automation_logs` table; ALTER offices default status |
| `supabase/functions/execute-automations/index.ts` | Add `triggerV2` action, variable substitution, `send_slack`/`send_whatsapp` handlers, logging to `automation_logs`, `dryRun` action |
| `supabase/functions/automation-cron/index.ts` | New: daily cron for time-based triggers |
| `supabase/functions/integration-piperun/index.ts` | Default status `ativo`, proposal fields, PDF download |
| `supabase/functions/calculate-health-score/index.ts` | Trigger `health.band_changed` on band change |
| `src/pages/Clientes.tsx` | Status default `ativo`, call `execute-automations` on create |
| `src/components/clientes/StatusChangeModal.tsx` | Trigger `office.status_changed` |
| `src/components/clientes/ClienteJornada.tsx` | Trigger `office.stage_changed` |
| `src/components/clientes/ClienteContratos.tsx` | Trigger `contract.created` |
| `src/components/clientes/ClienteContatos.tsx` | Trigger `contact.created` |
| `src/components/clientes/ClienteBonus.tsx` | Trigger `bonus.requested` |
| `src/components/reunioes/FormFillDialog.tsx` | Trigger `form.submitted` |
| `src/pages/Reunioes.tsx` | Trigger `meeting.completed` |
| `src/components/configuracoes/AutomationRulesTab.tsx` | Duplicate rule button, Logs tab, reach preview + dry run UI |
| `src/components/configuracoes/integrations/PiperunFieldPicker.tsx` | Proposal fields, PDF category |

