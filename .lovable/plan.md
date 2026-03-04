

## Dashboard Complete Rewrite Plan

### Current State
The Dashboard already has ~454 lines with basic KPI cards, attention items, agenda, funnel, birthdays, and rankings. However it's missing several requested blocks and the existing ones need restructuring.

### What's Missing
1. **KPI grid restructure**: Currently 5 cards in a row. Needs 8 specific KPIs (Novos clientes as number+delta, Ativos with Bonus Elite count, Em risco clickable, Churn macro with breakdown, Expansão, NPS médio, Cobertura with progress bar, Health médio with sparkline)
2. **Health distribution chart**: Only shown as dots in subtitle. Needs donut/horizontal bar with clickable segments
3. **NPS médio KPI**: Not fetched at all. Need to extract from `form_submissions` where field type contains NPS rating
4. **Cobertura KPI**: % of active offices with a meeting this month — data exists but not calculated as KPI
5. **Ranking "Clientes que mais evoluíram"**: Requires perception data (faturamento, clientes, colaboradores) which doesn't exist in `offices` table — will show placeholder
6. **"Atenção Hoje" as actionable table**: Currently a list of alert cards. Needs table format with columns: escritório, motivo(s) badges, health, dias, ação sugerida. Each row = 1 client with multiple motivos
7. **Gestor variation**: CSM filter dropdown at top for manager/admin. "Consolidado do time" default. Performance por CSM table
8. **CSM performance table**: For manager view — CSM name, portfolio size, avg health, coverage %, churn count

### What Exists & Stays (restructured)
- Agenda do Dia, Funil da Jornada, Top Churn Risk, Top Expansão, Aniversários, Próximos Eventos — all stay but get repositioned

### Data Fetching Changes
- Add: `profiles` + `user_roles` fetch (for CSM filter and performance table)
- Add: NPS extraction from `form_submissions` (look for NPS-type fields in `data` jsonb)
- Add: `health_overrides` fetch (for "Em risco" count)
- Add: meetings coverage calculation (meetings this month per office)
- Existing fetches remain

### Implementation

**Single file rewrite: `src/pages/Dashboard.tsx`** (~600 lines)

**Layout structure:**
1. Page header + CSM filter (manager/admin only)
2. 8 KPI cards grid (4 cols desktop, 2 tablet, 1 mobile)
3. Health distribution bar + Atenção Hoje table (2 cols)
4. Agenda do Dia + Funil da Jornada (2 cols)
5. Top Churn Risk + Top Expansão + Ranking Evolução (3 cols)
6. Aniversários + Eventos + CSM Performance (2-3 cols)

**Gestor/Admin variation:**
- `useAuth()` provides `role`, `isAdmin`, `isManager`
- If manager/admin: show CSM multi-select filter at top
- Fetch CSM list from `profiles` joined with `user_roles` where role='csm'
- Filter all data by selected CSM(s) — client-side filtering since data is already fetched
- Add "Performance por CSM" card/table

**NPS calculation:**
- From `form_submissions.data` jsonb, look for fields with NPS-like keys. Since we can't reliably parse jsonb structure without knowing form templates, we'll show "—" placeholder if no NPS data found, with a note explaining it needs form template configuration.

**Health sparkline:**
- Fetch last 3 months of `health_scores` grouped by month (using `calculated_at`). Show mini inline bars or dots as trend indicator.

**Ranking "Evolução":**
- Since perception fields (faturamento, clientes, colaboradores) don't exist in `offices` table, this section will show a placeholder with "Configure percepção para ver rankings de evolução."

**No DB changes needed.** All data comes from existing tables.

