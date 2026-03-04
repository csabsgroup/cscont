

# Implementation Plan — 5 Blocks

## Overview
Restructure Settings page with sidebar layout, add per-product 360 config, build automation engine, improve Piperun field picker, and compact Kanban columns.

---

## Database Migrations Required

### Migration 1: `product_360_config` table
```sql
CREATE TABLE public.product_360_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  config_type text NOT NULL, -- 'indicators' | 'fields' | 'tabs'
  items jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.product_360_config ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX idx_product_360_config_unique ON public.product_360_config(product_id, config_type);
-- RLS: Admin full, authenticated read
```

### Migration 2: `automation_rules` table
```sql
CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  rule_type text NOT NULL, -- 'distribution' | 'onboarding_tasks' | 'stage_tasks' | 'health_playbook'
  config jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
-- RLS: Admin full manage, authenticated read
```

### Migration 3: `automation_executions` table (idempotency)
```sql
CREATE TABLE public.automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL,
  office_id uuid NOT NULL,
  context_key text NOT NULL, -- e.g. 'onboarding' or stage_id
  executed_at timestamptz NOT NULL DEFAULT now(),
  result jsonb DEFAULT '{}'
);
ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX idx_automation_exec_unique ON public.automation_executions(rule_id, office_id, context_key);
-- RLS: Admin manage, visible offices read
```

---

## Block 1 — Settings Sidebar Layout

**Modify `src/pages/Configuracoes.tsx`:**
- Replace `<Tabs>` with a two-panel layout: left sidebar (240px) + right content area
- Sidebar has grouped menu items with categories as headers
- State: `selectedSection` string controlling which component renders on the right
- Add breadcrumb at top of content area
- Mobile: sidebar becomes a `<Select>` dropdown
- New sections added: "Visão 360" (Block 2), "Automações" (Block 3) — load new components
- Existing tab components (ProductsTab, JourneyStagesTab, etc.) remain unchanged, just rendered conditionally

---

## Block 2 — 360 Config per Product

**Create `src/components/configuracoes/Visao360ConfigTab.tsx`:**
- Product selector at top (tabs or dropdown)
- Two sub-sections: "Campos e Indicadores" and "Abas Visíveis"
- Indicators section: list with toggle + drag handle (using @hello-pangea/dnd for vertical reorder)
- Fields section: same pattern
- Tabs section: toggles per tab (Visão 360 always on, not toggleable)
- "Copiar de outro produto" button
- Save per section to `product_360_config` table
- Fallback: if no config exists, show everything enabled

**Modify `src/pages/Cliente360.tsx`:**
- On load, fetch `product_360_config` for the office's active product
- Filter `tabs360` array based on tab config
- Pass indicator/field config to `ClienteVisao360` to filter what's shown

---

## Block 3 — Automation Engine

**Create `src/components/configuracoes/AutomationDistributionTab.tsx`:**
- Per-product config: method dropdown (Manual/Least clients/Round-robin/Fixed)
- CSM eligibility toggles per product
- Save to `automation_rules` with `rule_type='distribution'`

**Create `src/components/configuracoes/AutomationOnboardingTab.tsx`:**
- Per-product list of onboarding activity templates
- CRUD: type dropdown, title, due_days, description, checklist items
- Drag to reorder
- Save to `automation_rules` with `rule_type='onboarding_tasks'`

**Create `src/components/configuracoes/AutomationStageTasksTab.tsx`:**
- Product selector + stage selector
- Activity templates per stage
- Save to `automation_rules` with `rule_type='stage_tasks'`

**Create edge function `execute-automations/index.ts`:**
- Actions: `onNewOffice` (distribution + onboarding tasks), `onStageChange` (stage tasks)
- Checks `automation_executions` for idempotency before creating activities
- Called from client-side after office creation or stage move

---

## Block 4 — Piperun Field Picker

**Create `src/components/configuracoes/integrations/PiperunFieldPicker.tsx`:**
- Modal/popover with search input at top
- List of Piperun fields fetched from edge function `listFields` action
- Each field shows icon + name + example value
- Click selects and closes
- Cache fields in component state (1 hour TTL)

**Add `listFields` action to `integration-piperun/index.ts`:**
- GET Piperun API for deal fields
- Return array of `{key, label, example_value}`

**Modify `PiperunConfig.tsx`:**
- Replace right-side Input with PiperunFieldPicker trigger
- Left side: dropdown of CRM fields (offices columns)
- Add/remove mapping rows
- "Restaurar padrão" button

---

## Block 5 — Kanban Compact Columns

**Modify `src/pages/Jornada.tsx` (board view section):**
- Column width: `w-[240px]` instead of `w-[300px]`
- Gap: `gap-3` instead of `gap-4`
- Card padding: `p-2.5`
- Card content: max 3 lines
  - Line 1: Health badge + truncated name
  - Line 2: CSM avatar (tooltip for name) + tasks fraction + progress bar (h-1)
  - Line 3: Optional renewal/overdue badge
- Column header: `py-1.5 px-2 text-sm`
- Remove CSM name text, show only avatar with title tooltip
- Remove status badge row
- Add scroll shadow indicators on container edges

---

## Files Summary

**New files (7):**
- `src/components/configuracoes/Visao360ConfigTab.tsx`
- `src/components/configuracoes/AutomationDistributionTab.tsx`
- `src/components/configuracoes/AutomationOnboardingTab.tsx`
- `src/components/configuracoes/AutomationStageTasksTab.tsx`
- `src/components/configuracoes/integrations/PiperunFieldPicker.tsx`
- `supabase/functions/execute-automations/index.ts`

**Modified files (4):**
- `src/pages/Configuracoes.tsx` — sidebar layout
- `src/pages/Cliente360.tsx` — respect product 360 config
- `src/pages/Jornada.tsx` — compact kanban
- `supabase/functions/integration-piperun/index.ts` — add listFields action
- `src/components/configuracoes/integrations/PiperunConfig.tsx` — use PiperunFieldPicker

**3 DB migrations** for new tables.

Implementation will proceed in order: DB migrations → Block 1 → Block 5 → Block 2 → Block 4 → Block 3.

