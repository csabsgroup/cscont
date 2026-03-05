

# Plan: Date Fields, Churn Flow, Custom Fields, Configurable Header, System-Wide Impacts

This is a very large request spanning 5 blocks. Due to the scope, I recommend implementing in **3 phases** to keep changes manageable and testable.

---

## Phase 1: Database Schema + Status/Churn Flow (Blocos 1 + 2)

### 1.1 Database Migration

**Migration 1 - Add columns and tables:**

```sql
-- Add new date/churn columns to offices
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS cycle_start_date date;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS cycle_end_date date;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS churn_date date;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS churn_reason_id uuid;
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS churn_observation text;

-- Add 'pausado' to office_status enum
ALTER TYPE public.office_status ADD VALUE IF NOT EXISTS 'pausado';

-- Churn reasons table
CREATE TABLE public.churn_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.churn_reasons ENABLE ROW LEVEL SECURITY;

-- RLS: Admin manage, all authenticated read
CREATE POLICY "Admin can manage churn_reasons" ON public.churn_reasons FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view churn_reasons" ON public.churn_reasons FOR SELECT TO authenticated
  USING (true);

-- Insert default reasons
INSERT INTO public.churn_reasons (name, sort_order) VALUES
  ('Insatisfação com o serviço', 1),
  ('Preço/Valor', 2),
  ('Mudança de estratégia', 3),
  ('Fechou a empresa', 4),
  ('Migrou para concorrente', 5),
  ('Inadimplência', 6),
  ('Não viu valor no programa', 7),
  ('Problemas internos do cliente', 8),
  ('Outro', 99);
```

### 1.2 Status Change Modal (`StatusChangeModal.tsx` - new component)

- Detects if target status is churn-like (`churn`, `nao_renovado`, `nao_iniciado`)
- If churn-like: shows date picker (default today, no future), reason dropdown (from `churn_reasons`), observation textarea
- If non-churn: simple confirmation
- On confirm for churn: updates `offices` with `status`, `churn_date`, `churn_reason_id`, `churn_observation`
- On confirm for reactivation (back to ativo/upsell/bonus_elite): clears `churn_date`, `churn_reason_id`, `churn_observation`
- Logs to `audit_logs` with details including reason name

### 1.3 StatusBadge update

- Add `pausado` entry: `bg-purple-100 text-purple-700` / dark mode variant

### 1.4 ClienteVisao360 updates

- Show `cycle_start_date`, `cycle_end_date`, `churn_date` in info fields
- Compute "Tempo de vida" from `activation_date` to now (or `churn_date`)
- Compute "Dias para renovação" from `cycle_end_date`

### 1.5 Churn Reasons Config Tab (`ChurnReasonsTab.tsx`)

- CRUD list with drag-and-drop reorder, toggle active, add/edit
- Add to Configuracoes sidebar under new "Dados Mestres" category (or alongside "Produtos")

### 1.6 Cliente360 integration

- Replace current simple status change dialog with `StatusChangeModal`
- Pass churn reasons data

---

## Phase 2: Custom Fields (Bloco 3)

### 2.1 Database Migration

```sql
CREATE TABLE public.custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  field_type text NOT NULL,
  description text,
  scope text NOT NULL DEFAULT 'global',
  product_id uuid,
  is_required boolean DEFAULT false,
  default_value text,
  options jsonb,
  data_source text DEFAULT 'manual',
  data_source_config jsonb,
  position text DEFAULT 'body',
  is_visible boolean DEFAULT true,
  is_editable boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid
);

CREATE TABLE public.custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL,
  custom_field_id uuid NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value_text text,
  value_number numeric,
  value_date date,
  value_boolean boolean,
  value_json jsonb,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  UNIQUE(office_id, custom_field_id)
);

-- RLS for both tables
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;

-- custom_fields: Admin manage, all read
CREATE POLICY "Admin manage custom_fields" ON public.custom_fields FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated view custom_fields" ON public.custom_fields FOR SELECT TO authenticated
  USING (true);

-- custom_field_values: follows office visibility
CREATE POLICY "Admin manage custom_field_values" ON public.custom_field_values FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "CSM manage own office values" ON public.custom_field_values FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'csm') AND office_id IN (SELECT get_csm_office_ids(auth.uid())))
  WITH CHECK (has_role(auth.uid(), 'csm') AND office_id IN (SELECT get_csm_office_ids(auth.uid())));
CREATE POLICY "Users view visible office values" ON public.custom_field_values FOR SELECT TO authenticated
  USING (office_id IN (SELECT get_visible_office_ids(auth.uid())));
```

### 2.2 Custom Fields Config UI (`CustomFieldsConfigTab.tsx`)

- Add to Visao360ConfigTab or as separate section in Configuracoes > Visão 360
- Form: name, auto-slug, type dropdown (11 types), scope (global/product), required toggle, default value, options list (for dropdown/multi), data source, position (header/body), visible, editable toggles
- List with drag-and-drop reorder, edit, deactivate

### 2.3 Custom Fields Display in ClienteVisao360

- Fetch `custom_fields` + `custom_field_values` for current office
- Filter by scope (global or matching product)
- Render in info fields grid (position='body') with proper type-specific display
- Inline edit for editable + manual source fields

### 2.4 Custom Fields in Header (feeds into Phase 3)

---

## Phase 3: Configurable Header + System-Wide Impacts (Blocos 4 + 5)

### 3.1 Header Config (via `product_360_config` with `config_type='header'`)

- New section in Visao360ConfigTab: "Configuração do Header"
- Drag-and-drop list of native + custom fields with visibility toggles
- Native fields: status, health_score, product, csm, stage, activation_date, cycle dates, renewal_days, overdue, ltv, nps, revenue, city/state, cnpj, whatsapp, email
- Custom fields with `position='header'` auto-included
- Name field always ON, not removable

### 3.2 ClienteHeader refactor

- Fetch header config for the office's product
- Render Line 1 (logo + name + action buttons) always
- Render Line 2 as flex-wrap badges/chips based on config order and visibility
- Type-aware rendering (status badge, health bars, date format, currency format, etc.)

### 3.3 System-Wide Impacts (Bloco 5)

**Automation engine:**
- Add `churn_reason` as condition field in AutomationRulesTab
- Add `activation_date`, `cycle_start_date`, `days_in_cycle` condition fields
- Custom fields available as conditions (types: text->equals, number->comparisons, boolean->is, dropdown->equals)
- `pausado` status in trigger options
- Edge function `execute-automations`: skip offices with `status='pausado'` in cron mode

**Health Score:**
- Edge function `calculate-health-score`: skip offices with `status='pausado'`
- On status change from `pausado` to `ativo`: trigger health recalculation

**Reports (`Relatorios.tsx`):**
- Churn by reason chart (donut/bar breakdown)
- Filter by churn reason
- `pausado` excluded from active and churn counts
- "Tempo até churn" uses `activation_date` → `churn_date`

**Clients table (`Clientes.tsx`):**
- New available columns: Data Ativação, Data Início Ciclo, Data Fim Ciclo, Data Churn, Motivo Churn
- Pausado status filter + badge styling

**Portal:**
- If office `status='pausado'`: show banner "Seu acesso está temporariamente pausado"

**Contract auto-fill logic (in ClienteContratos or hook):**
- On creating first contract: set `cycle_start_date`, `cycle_end_date`, and `activation_date` (if null) on the office
- On creating renewal contract: update `cycle_start_date` and `cycle_end_date` only

---

## Files to Create
- `src/components/clientes/StatusChangeModal.tsx` - Churn/status change modal
- `src/components/configuracoes/ChurnReasonsTab.tsx` - Manage churn reasons
- `src/components/configuracoes/CustomFieldsConfigTab.tsx` - Custom fields CRUD
- `src/components/clientes/CustomFieldsDisplay.tsx` - Render custom fields in 360
- `src/components/clientes/ConfigurableHeader.tsx` - Dynamic header based on config

## Files to Modify
- `src/components/clientes/StatusBadge.tsx` - Add `pausado`
- `src/pages/Cliente360.tsx` - Replace status dialog, add custom fields, use configurable header
- `src/components/clientes/ClienteHeader.tsx` - Refactor for configurable fields
- `src/components/clientes/ClienteVisao360.tsx` - Add new date fields, custom fields
- `src/pages/Configuracoes.tsx` - Add ChurnReasons + CustomFields sections
- `src/components/configuracoes/Visao360ConfigTab.tsx` - Add header config section
- `src/components/configuracoes/AutomationRulesTab.tsx` - Add churn reason + custom field conditions
- `src/components/clientes/ClienteContratos.tsx` - Auto-fill date logic on contract create
- `src/pages/Relatorios.tsx` - Churn by reason chart, pausado exclusion
- `src/pages/Clientes.tsx` - New columns, pausado badge/filter

## Estimated: ~15 file changes, 3 migrations

Due to the massive scope, I recommend implementing Phase 1 first (dates + churn flow + pausado status), then Phase 2 (custom fields), then Phase 3 (configurable header + system impacts). Shall I proceed with Phase 1?

