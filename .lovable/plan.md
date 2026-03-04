

## Relatórios Page Complete Rewrite Plan

### Current State
The page has 8 tabs with basic KPI cards and a few charts, but is missing:
- CSM/Product filters for manager/admin
- Churn breakdown charts (donut by type, monthly evolution line, churned clients table)
- Retention/LTV charts (distribution histogram, monthly retention evolution)
- Health evolution charts (monthly line, stacked bar by band, biggest drops table)
- NPS distribution chart (promoters/neutrals/detractors bars), quarterly evolution
- Cobertura table (meetings per CSM with coverage %), monthly meeting frequency chart
- Journey analytics (avg time per stage, churn by stage, conversion funnel)
- Inadimplência evolution chart, days overdue in table
- Evolução rankings (placeholder since perception fields don't exist)
- Period comparison overlays on line charts

### Implementation: Single file rewrite `src/pages/Relatorios.tsx`

**Filters bar** (top, always visible):
- Period selector (month/quarter/semester/year) — already exists
- CSM multi-select (manager/admin only) — uses `useAuth()` + fetch profiles with csm role
- Product dropdown (all products from `products` table)
- Comparison toggle — already exists
- "Limpar" button to reset filters

**Data fetching**: Same `Promise.all` as current but add `office_stage_history` for journey analytics. All computations use `useMemo` filtered by selected CSM/product.

**Tab enhancements:**

1. **Visão Executiva**: Keep current KPIs + charts, add comparison deltas to all cards

2. **Churn**: Add donut chart (breakdown by type: nao_iniciado/during journey/nao_renovado), monthly churn evolution line chart (last 12 months), churned clients table (office, type, months active, last health, CSM)

3. **Receita & LTV**: Add LTV distribution histogram (group offices by LTV ranges), monthly retention evolution line chart

4. **Health/NPS**: Split into health evolution line chart (12 months), stacked bar (green/yellow/red per month), biggest health drops table. NPS: quarterly evolution, promoter/neutral/detractor bar chart

5. **Cobertura**: Add CSM coverage table (CSM name, total meetings, clients attended, coverage %), monthly meeting frequency bar chart, no-contact-30d client list

6. **Jornada**: Add avg time per stage (horizontal bars, red if > SLA), churn-by-stage bar, conversion funnel percentages

7. **Inadimplência**: Add monthly evolution line chart, expand table with days overdue and CSM columns

8. **Evolução**: Placeholder with "Configure percepção para ver rankings" since perception fields don't exist in offices table

**Role-based filtering**: Use `useAuth()` to get role/user. CSM: filter all data by `csm_id = user.id`. Manager: filter by team CSMs. Admin/Viewer: see all.

**Comparison overlay**: Line charts show 2 lines (current period + previous period) when comparison toggle is on.

### No DB changes needed
All data comes from existing tables. `office_stage_history` provides journey analytics data.

### Estimated size
~700 lines (rewrite of existing 405-line file with significantly more charts and tables).

