

# Plan: Indicator Builder, Cohort Analysis & Enhanced Reports

## Overview

Add two major features to the Reports page: (1) an Indicator Builder with predefined metric library + custom builder, and (2) a Cohort Analysis heatmap. The product filter already exists — just needs to be verified it applies everywhere.

## Database Migration

Create `custom_indicators` table:

```sql
CREATE TABLE public.custom_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  config jsonb NOT NULL DEFAULT '{}',
  visualization_type text DEFAULT 'number',
  is_predefined boolean DEFAULT false,
  pinned_to_dashboard boolean DEFAULT false,
  created_by uuid,
  product_filter uuid,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.custom_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage indicators" ON public.custom_indicators FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Manager can manage own indicators" ON public.custom_indicators FOR ALL
  USING (public.has_role(auth.uid(), 'manager') AND created_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'manager') AND created_by = auth.uid());

CREATE POLICY "Authenticated can read active indicators" ON public.custom_indicators FOR SELECT
  USING (is_active = true);
```

## File Changes

### New File: `src/components/relatorios/IndicatorBuilder.tsx`

Component with two sub-views:

**A) Predefined Metrics Library** — Categorized list (Retenção, Receita, Engajamento, Satisfação, Saúde, Jornada, Financeiro, Crescimento) with 35+ toggleable metrics. Each opens a config dialog: period, product filter, CSM filter, visualization type. "Salvar indicador" persists to `custom_indicators`.

**B) Advanced Builder** — Form with: name input, data source dropdown (offices, contracts, activities, meetings, health_scores, office_metrics_history, form_submissions, events, bonus_grants), metric type (COUNT, SUM, AVG, MIN, MAX, %), numeric field dropdown (dynamic per source), filters (add/remove rows with field/operator/value), group_by (none, product, CSM, status, month, stage), period selector, visualization picker (number, line, bar, pie, table), live preview rendering.

Config saved as JSON to `custom_indicators.config`.

### New File: `src/components/relatorios/CohortAnalysis.tsx`

Component with:
- Type selector: Retenção mensal, Churn acumulado, Evolução MRR
- Group by: Mês/Trimestre de ativação
- Product filter (uses parent's `filterProduct`)
- Period: últimos 6/12/18 meses

Renders an HTML table heatmap:
- Rows = cohort months (activation month)
- Columns = Month 0, Month 1, ... Month 12
- Cell values = retention % (or MRR $)
- Background color gradient: green (100-80%) → yellow (79-50%) → red (49-0%)
- Hover tooltip shows absolute count

Calculation: groups offices by `activation_date` month, for each subsequent month checks if `churn_date` is null or after that month. All client-side from already-fetched `offices` data.

### New File: `src/components/relatorios/IndicatorCard.tsx`

Renders a saved indicator based on its `config` and `visualization_type`. Used both in Reports tab and when `pinned_to_dashboard = true` in Dashboard.

### Modified: `src/pages/Relatorios.tsx`

- Add two new tabs to the TabsList: "📊 Indicadores" and "📈 Cohort"
- Import and render `IndicatorBuilder` and `CohortAnalysis` components
- Pass `filteredOffices`, `filteredContracts`, `filteredMeetings`, `filteredHealth`, `products`, `csmUsers`, `profileMap`, `filterProduct`, `filterCsm` as props
- Both components receive already-filtered data so product/CSM filter applies automatically

### Modified: `src/pages/Dashboard.tsx`

- After existing KPI cards, query `custom_indicators` where `pinned_to_dashboard = true`
- Render each using `IndicatorCard` component
- Only show for Admin/Manager

## Architecture Decisions

- **Client-side computation**: All metric calculations happen client-side using already-fetched data (offices, contracts, meetings, etc.) — no new edge functions needed. The data is already loaded in Relatorios.tsx.
- **Product filter**: Already implemented at line 93/454 of Relatorios.tsx and applies to all filtered data. The new components receive `filteredOffices` so they inherit the filter.
- **Permissions**: Builder UI hidden for CSM/Viewer (they only see saved indicators). Cohort visible to all but CSM sees only their portfolio (already filtered by RLS).

## Summary

| Component | Change |
|-----------|--------|
| Database | Create `custom_indicators` table with RLS |
| `IndicatorBuilder.tsx` | New — predefined library + advanced builder |
| `CohortAnalysis.tsx` | New — cohort heatmap with 3 types |
| `IndicatorCard.tsx` | New — renders saved indicator |
| `Relatorios.tsx` | Add 2 tabs, import new components |
| `Dashboard.tsx` | Show pinned indicators |

