

# Plan: Clickable KPIs, Structured Playbooks, and Auto-Journey Phases

## Overview

Three features: (1) Make Dashboard KPI cards navigate to `/clientes` with filter presets, (2) Create a Playbook system for templated activity bundles, (3) Auto-advance journey stages when playbooks complete.

## Database Migration

```sql
-- Playbook templates
CREATE TABLE public.playbook_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  product_id uuid,
  is_active boolean DEFAULT true,
  auto_advance_journey boolean DEFAULT false,
  advance_to_stage_id uuid,
  activities jsonb NOT NULL DEFAULT '[]',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.playbook_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage playbooks" ON public.playbook_templates FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view playbooks" ON public.playbook_templates FOR SELECT USING (true);

-- Playbook instances (applied to an office)
CREATE TABLE public.playbook_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_template_id uuid NOT NULL REFERENCES public.playbook_templates(id),
  office_id uuid NOT NULL,
  applied_by uuid,
  applied_at timestamptz DEFAULT now(),
  status text DEFAULT 'in_progress',
  completed_at timestamptz,
  total_activities integer DEFAULT 0,
  completed_activities integer DEFAULT 0
);

ALTER TABLE public.playbook_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage playbook_instances" ON public.playbook_instances FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "CSM can manage own instances" ON public.playbook_instances FOR ALL
  USING (office_id IN (SELECT public.get_csm_office_ids(auth.uid())))
  WITH CHECK (office_id IN (SELECT public.get_csm_office_ids(auth.uid())));
CREATE POLICY "Users see instances of visible offices" ON public.playbook_instances FOR SELECT
  USING (office_id IN (SELECT public.get_visible_office_ids(auth.uid())));

-- Add playbook columns to activities
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS playbook_instance_id uuid;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS playbook_order integer;
```

## File Changes

### 1. `src/pages/Dashboard.tsx` — Clickable KPIs

- Make each KPI card in the grid clickable with `onClick={() => navigate('/clientes?filter=...')}` and `cursor-pointer hover:shadow-md` styling
- KPI → filter mapping:
  - Clientes Ativos → `?filter=ativos`
  - Em Risco → `?filter=health_vermelho`
  - MRR em Risco → `?filter=health_vermelho`
  - Cobertura → `?filter=sem_reuniao_30d`
  - NPS → `?filter=nps_detratores`
- Health distribution bars (red/yellow/green counts) also clickable: `?filter=health_vermelho`, `?filter=health_amarelo`, `?filter=health_verde`
- Non-filterable KPIs (MRR, Variação MRR, MRR Expansão): no click behavior

### 2. `src/pages/Clientes.tsx` — Read filter from URL + active filter banner

- Import `useSearchParams` from react-router-dom
- Read `filter` query param on mount
- Map preset filter values to FilterState changes:
  - `ativos` → `statuses: ['ativo', 'bonus_elite', 'upsell']`
  - `health_vermelho` → `health: ['red']`
  - `health_amarelo` → `health: ['yellow']`
  - `health_verde` → `health: ['green']`
  - `churn` → `statuses: ['churn', 'nao_renovado']`
  - `renovam_30d` → `renewal30d: true`
  - `sem_reuniao_30d` → `noMeeting30d: true`
  - `nps_detratores` → custom filter on `last_nps <= 6` (add to FilterState)
  - `atividades_atrasadas` → custom filter on offices with overdue activities (add to FilterState)
- Show colored banner above table when preset filter is active: "Filtro ativo: [label] [X]"
- Clicking X clears filter and removes query param

### 3. New file: `src/components/configuracoes/PlaybooksTab.tsx`

- Full CRUD for playbook templates
- List view: table with name, product, activity count, auto-advance toggle, status
- Editor dialog/drawer with:
  - Name, description, product selector, active toggle
  - Auto-advance checkbox + stage destination dropdown (populated from `journey_stages` filtered by selected product)
  - Activity list with drag-and-drop reorder (@hello-pangea/dnd already installed)
  - Each activity: title, type (dropdown from TYPE_LABELS), description, due_days_offset (number), priority, responsible_type (CSM do escritório / fixed user)
  - Add/remove activities
- Save to `playbook_templates` table

### 4. `src/pages/Configuracoes.tsx` — Add Playbooks section

- Add to SIDEBAR_SECTIONS: `{ key: 'playbooks', label: 'Playbooks', icon: ClipboardList, category: 'Automações', adminOnly: true }`
- Import and render `PlaybooksTab` in renderContent

### 5. `src/pages/Cliente360.tsx` — Apply playbook + progress display

- Add "Aplicar Playbook" button in the header actions area
- Dialog to select a playbook template (filtered by office's product)
- `applyPlaybook` function: creates instance, creates all activities with calculated due dates
- In the Visão 360 or a dedicated sub-section, show active playbook instances with progress bar and activity checklist

### 6. `src/components/atividades/ActivityEditDrawer.tsx` — Playbook completion logic

- After `handleComplete` succeeds and the activity has `playbook_instance_id`:
  1. Count completed activities for that instance
  2. Update `playbook_instances.completed_activities` and potentially `status = 'completed'`
  3. If completed and template has `auto_advance_journey`: update `office_journey`, insert `office_stage_history`, trigger `office.stage_changed` automation

### 7. `src/components/configuracoes/AutomationRulesTab.tsx` — Add "Apply Playbook" action type

- Add to ACTION_TYPES: `{ value: 'apply_playbook', label: '📋 Aplicar Playbook' }`
- In `renderActionConfig`: when type is `apply_playbook`, show dropdown of active playbook templates

### 8. `supabase/functions/execute-automations/index.ts` — Handle apply_playbook action

- In `handleAction`, add case for `apply_playbook`: fetch template, create instance, create activities (same logic as client-side but server-side)

## Summary

| Component | Change |
|-----------|--------|
| Database | Create `playbook_templates`, `playbook_instances` tables; add columns to `activities` |
| `Dashboard.tsx` | Make KPI cards clickable with navigate to `/clientes?filter=...` |
| `Clientes.tsx` | Read URL filter param, apply preset filters, show active filter banner |
| `PlaybooksTab.tsx` | New — full CRUD for playbook templates with drag-drop activity editor |
| `Configuracoes.tsx` | Add Playbooks to sidebar |
| `Cliente360.tsx` | Add apply playbook button + progress display |
| `ActivityEditDrawer.tsx` | Add playbook completion + auto-advance logic |
| `AutomationRulesTab.tsx` | Add `apply_playbook` action type |
| `execute-automations/index.ts` | Handle `apply_playbook` action server-side |

