

# Form Builder Reimplementation Plan

This is a large feature touching database schema, edge functions, frontend components, and routing. Here is the phased plan.

## Current State

- `form_templates` table exists with `type` as an enum (`kickoff`, `onboarding`, `nutricao`, etc.) -- needs migration to support `internal`/`external` plus new columns (`description`, `form_type`, `sections`, `is_active`, `form_hash`)
- `form_submissions` table exists with `template_id`, `office_id`, `meeting_id`, `user_id`, `data`
- `offices` table is missing: `last_nps`, `last_csat`, `last_meeting_date`, `last_meeting_type`, `cs_feeling`
- `office_metrics_history` table does not exist
- `FormTemplatesTab.tsx` is a basic CRUD in a dialog -- needs full rebuild
- `FormFillDialog.tsx` exists but has no mapping/conditional logic
- `execute-form-post-actions` edge function handles post-actions but not header mapping or metrics history
- No public form route exists

## Database Migrations

### Migration 1: Schema changes
```sql
-- Add missing columns to offices
ALTER TABLE offices ADD COLUMN IF NOT EXISTS last_nps numeric;
ALTER TABLE offices ADD COLUMN IF NOT EXISTS last_csat numeric;
ALTER TABLE offices ADD COLUMN IF NOT EXISTS last_meeting_date date;
ALTER TABLE offices ADD COLUMN IF NOT EXISTS last_meeting_type text;
ALTER TABLE offices ADD COLUMN IF NOT EXISTS cs_feeling text;

-- Add columns to form_templates
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS form_type text NOT NULL DEFAULT 'internal';
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS sections jsonb DEFAULT '[]';
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS form_hash text UNIQUE;

-- Create office_metrics_history
CREATE TABLE IF NOT EXISTS public.office_metrics_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL,
  period_month integer NOT NULL,
  period_year integer NOT NULL,
  faturamento_mensal numeric,
  faturamento_anual numeric,
  qtd_clientes integer,
  qtd_colaboradores integer,
  nps_score numeric,
  csat_score numeric,
  health_score numeric,
  cs_feeling text,
  form_submission_id uuid,
  custom_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(office_id, period_month, period_year)
);

ALTER TABLE office_metrics_history ENABLE ROW LEVEL SECURITY;

-- RLS for office_metrics_history
CREATE POLICY "Admin can manage office_metrics_history"
  ON office_metrics_history FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users see metrics of visible offices"
  ON office_metrics_history FOR SELECT
  USING (office_id IN (SELECT get_visible_office_ids(auth.uid())));

CREATE POLICY "CSM can insert metrics"
  ON office_metrics_history FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'csm') AND office_id IN (SELECT get_csm_office_ids(auth.uid())));
```

## Frontend Components

### 1. `FormTemplatesTab.tsx` -- Complete rewrite (~600 lines)

**List view:**
- Table with columns: Name, Type badge (Internal/External), Product, Fields count, Status (active/inactive toggle), Actions (edit/duplicate/delete)
- "Novo formulário" button opens creation flow

**Editor (full dialog or sheet, ~560px wide):**
- Header: name, form_type (radio Internal/External, locked after creation), product dropdown, description, is_active toggle
- Sections manager: add/reorder/rename sections
- Fields list with drag-and-drop (using `@hello-pangea/dnd` already installed)
- Each field card: label, type selector (12 types including currency, linear_scale), required toggle, expandable advanced options
- Advanced options per field: placeholder, description, header_mapping toggle + target dropdown, conditional_logic toggle + rules editor, "controls meeting date" toggle (boolean fields only)
- Preview button opening a read-only render
- For external forms: show/copy public link

**Field type selector:** Grid of 12 types with icons

**Header mapping targets:**
- `offices.faturamento_mensal`, `offices.faturamento_anual`, `offices.qtd_clientes`, `offices.qtd_colaboradores`, `offices.last_nps`, `offices.last_csat`, `offices.cs_feeling`
- Dynamic list of custom_fields from DB

**Conditional logic editor per field:**
- Logic operator: AND/OR
- Rules: field_id + operator + value
- Operators vary by field type (equals, greater_than, contains, is_filled, etc.)
- Action: show/hide or skip_to_section

### 2. `FormFillDialog.tsx` -- Rewrite with mapping + conditional logic

- Evaluates conditional logic in real-time as answers change
- Hidden fields produce null values
- On submit:
  1. Insert `form_submissions`
  2. For each field with `header_mapping.enabled`: update `offices` column or upsert `custom_field_values`
  3. If "controls meeting date" field = true: update `last_meeting_date` and `last_meeting_type`; if false: skip those updates
  4. Upsert `office_metrics_history` for current month/year
  5. Execute post-actions via edge function
  6. Trigger automations

### 3. Public form page: `src/pages/FormPublic.tsx`

- Route: `/forms/:formHash` (no auth required)
- Reads `office` from query param
- Fetches form_template by `form_hash`
- Renders form with conditional logic
- On submit: calls edge function (no auth, public endpoint)
- Branding: logo + colors

### 4. Edge function: `submit-public-form/index.ts`

- Public endpoint (no JWT)
- Validates form_hash + office_hash
- Inserts form_submission (submitted_by = null)
- Applies header mappings (NPS/CSAT updates)
- Upserts office_metrics_history
- Triggers automations (form.submitted, nps.below_threshold if detractor)

### 5. Update `execute-form-post-actions/index.ts`

- Add header mapping logic (update offices columns)
- Add metrics history upsert logic
- Handle "controls meeting date" field

## Routing Changes

In `App.tsx`:
- Add public route: `<Route path="/forms/:formHash" element={<FormPublic />} />`

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/configuracoes/FormTemplatesTab.tsx` | Rewrite |
| `src/components/reunioes/FormFillDialog.tsx` | Rewrite |
| `src/pages/FormPublic.tsx` | Create |
| `supabase/functions/submit-public-form/index.ts` | Create |
| `supabase/functions/execute-form-post-actions/index.ts` | Modify |
| `src/App.tsx` | Add route |
| `supabase/config.toml` | Add submit-public-form function config |
| Database migration | Create tables + columns |

## Implementation Order

1. Database migration (new table + columns)
2. FormTemplatesTab rewrite (builder UI with all 12 field types, sections, drag-drop, conditional logic, mapping, preview)
3. FormFillDialog rewrite (conditional logic runtime, mapping execution, metrics history)
4. Public form page + edge function
5. App.tsx routing update

