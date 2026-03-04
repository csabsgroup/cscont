

# Plan: Automation Rules Engine — Triggers + Conditions

## Context

The current system has hardcoded automation types (distribution, onboarding_tasks, stage_tasks) stored in `automation_rules` with `rule_type` + `config` JSONB. The new system replaces this with a generic trigger-condition-action engine.

## 1. Database Migration

**New table: `automation_rules_v2`**

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | Rule name |
| description | text | Optional |
| is_active | boolean | Default true |
| trigger_type | text NOT NULL | e.g. "office.created", "health.band_changed" |
| trigger_params | jsonb | e.g. `{ "dias": 30 }` for time-based triggers |
| conditions | jsonb | Array of condition objects |
| condition_logic | text | "and" or "or", default "and" |
| actions | jsonb | Array of action objects (for future use) |
| product_id | uuid | Optional filter (nullable) |
| created_by | uuid | |
| created_at / updated_at | timestamptz | |

RLS: Admin-only for ALL, authenticated SELECT.

Keep existing `automation_rules` table untouched for backward compatibility.

## 2. Frontend — New Component `AutomationRulesTab.tsx`

### Rule List View
- Table showing all rules: Name, Trigger (badge), Active toggle, Edit/Delete buttons
- "Nova Regra" button opens rule editor dialog

### Rule Editor (Dialog or full panel)

**Section 1 — Info**
- Name (text input)
- Description (optional textarea)
- Active toggle

**Section 2 — Trigger (SE)**
- Dropdown with 15 triggers grouped by category:
  - **Cliente**: T1 (office.created), T7 (office.status_changed), T15 (office.imported_piperun)
  - **Jornada**: T2 (office.stage_changed)
  - **Health Score**: T3 (health.band_changed)
  - **Formulários**: T4 (form.submitted)
  - **Reuniões**: T5 (meeting.completed), T9 (office.no_meeting)
  - **Financeiro**: T6 (payment.overdue), T8 (office.renewal_approaching)
  - **Bônus**: T10 (bonus.requested)
  - **Atividades**: T11 (activity.overdue)
  - **NPS**: T12 (nps.below_threshold)
  - **Contrato/Contato**: T13 (contract.created), T14 (contact.created)
- Dynamic params below trigger based on type (stage selectors, number inputs, form dropdown, etc.)
- Badge indicating "Tempo real" vs "Cron diário" for each trigger

**Section 3 — Conditions (QUANDO)**
- "+ Adicionar condição" button
- Each condition row: `[Campo dropdown] [Operador dropdown] [Valor input/dropdown]`
- Between conditions: AND/OR toggle
- Fields available per the user's spec (Produto, Status, Health Score, CSM, Etapa, Cidade, Estado, Parcelas vencidas, Dias para renovação, etc.)
- Operators change dynamically based on field type (text → igual/diferente/contém, number → maior/menor/entre, enum → igual/diferente/está em)

**Data shape stored in `conditions` JSONB:**
```json
[
  { "field": "product_id", "operator": "equals", "value": "uuid-here" },
  { "field": "health_band", "operator": "equals", "value": "red" },
  { "field": "installments_overdue", "operator": "greater_than", "value": 3 }
]
```

## 3. Navigation

Add to `SIDEBAR_SECTIONS` in Configuracoes.tsx:
```
{ key: 'auto_regras', label: 'Regras de Automação', icon: Workflow, category: 'Automações', adminOnly: true }
```

Add to `renderContent()`:
```
case 'auto_regras': return <AutomationRulesTab />;
```

## 4. Files to Create/Modify

| File | Action |
|---|---|
| SQL Migration | Create `automation_rules_v2` table with RLS |
| `src/components/configuracoes/AutomationRulesTab.tsx` | **New** — Rule list + editor with trigger/condition UI |
| `src/pages/Configuracoes.tsx` | Add sidebar entry + render case |

## Notes

- Actions (ENTÃO) will be implemented in a follow-up — for now the `actions` column stores an empty array
- Time-based triggers (T8, T9, T11) need a cron Edge Function — will be planned separately
- Existing automation_rules table stays intact; migration path will come later

