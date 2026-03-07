

# Plan: 6 Functional Adjustments

## Ajuste 1 — Trigger "Atividade concluída"

### AutomationRulesTab.tsx
- Add to TRIGGERS array: `{ value: 'activity.completed', label: '📌 Atividade concluída', category: 'Atividades', timing: 'realtime' }`
- Render config fields when selected: name_contains (Input), activity_types (multi-select from TYPE_LABELS), completion_filter (Select: any/on_time/late/late_by_days), late_by_days (Input number, shown when late_by_days selected)
- Save to `trigger_params`

### ActivityEditDrawer.tsx (line ~115-127, handleComplete)
- After the update succeeds, if `activity.office_id` exists, invoke `execute-automations` with `action: 'triggerV2'`, `trigger_type: 'activity.completed'`, passing context (activity_id, name, type, was_late, days_late, completed_by)

### execute-automations/index.ts
- In the `triggerV2` handler, add filter logic for `activity.completed`: check `name_contains`, `activity_types`, and `completion_filter` against the context before executing actions

## Ajuste 2 — Corrigir Variação de MRR

### Dashboard.tsx (lines 90-95)
- Current `mrrDelta` compares new client COUNTS (wrong). Replace with actual MRR difference.
- Since there's no monthly MRR snapshot table readily usable, compute: `mrrDelta = sum of mrr for offices created this month` (new MRR gained) minus `sum of mrr for offices that churned this month` (MRR lost). Or simpler: just show absolute MRR value and note "vs mês anterior" as unavailable without snapshots.
- Better approach: query `office_metrics_history` for previous month's total faturamento_mensal sum as proxy for previous MRR, compare to current MRR sum.
- Update the KPI card (line 216) to show R$ formatted value with % change.

## Ajuste 3 — Gráficos de evolução na aba Métricas

### ClienteMetricas.tsx
- Fetch `office_metrics_history` for the officeId, ordered by year/month
- Add 4 charts in a 2x2 grid using Recharts (already installed):
  1. Faturamento Mensal (LineChart)
  2. Clientes Ativos (LineChart)
  3. Funcionários (LineChart)
  4. Contratos/Ciclos (BarChart from contracts count by year)
- Each in a Card with title, 280px height
- Empty state message when no data

## Ajuste 4 — Filtro de produto no Dashboard

### Dashboard.tsx
- Add `selectedProductId` state
- Show product dropdown next to CSM filter (only for Admin/Manager)
- Apply `.eq('active_product_id', selectedProductId)` filter to `filteredOffices` memo when set
- All downstream KPIs automatically filter since they derive from `filteredOffices`

## Ajuste 5 — Avatares nas telas

### Atividades.tsx (ActivityCard component, line 324)
- Add `<UserAvatar userId={activity.user_id} size="xs" />` next to the activity title/metadata
- The `user_id` is already available on the activity object

### Dashboard.tsx (activity table, line 296)
- Already has UserAvatar — verify it's showing correctly. Currently uses `csm?.full_name` from profileMap which should work.

## Ajuste 6 — Revalidar KPIs da Minha Carteira

### Dashboard.tsx
- **MRR Total** (line 88): Currently `ativos.reduce(mrr)` — correct but should include `upsell` status too. Fix: include all non-churned active statuses.
- **Variação MRR** (line 95): Fixed in Ajuste 2.
- **MRR em Risco** (line 98): Uses `redHealth` filtered by band. Need to ensure we get latest health per office (not duplicates). Currently `health_scores` query doesn't deduplicate — should use latest per office.
- **Churn**: Add churn count and rate KPIs (currently missing from dashboard).
- **NPS médio**: Add `AVG(last_nps)` from filtered offices where not null.
- **Cobertura**: Calculate % of offices with `last_meeting_date` within 30 days.
- **Health médio** (line 110): Already computed correctly.
- **Activities pending/overdue** (lines 114-118): Already computed. Verify CSM filtering works via RLS.

Fix health deduplication: get latest health score per office using a client-side dedup (group by office_id, keep latest calculated_at).

---

## Files Modified

| File | Changes |
|------|---------|
| `AutomationRulesTab.tsx` | Add `activity.completed` trigger + config UI |
| `ActivityEditDrawer.tsx` | Fire automation trigger on completion |
| `execute-automations/index.ts` | Handle `activity.completed` trigger filtering |
| `Dashboard.tsx` | Fix MRR variation, add product filter, add missing KPIs (NPS, churn, cobertura), dedup health scores |
| `ClienteMetricas.tsx` | Add 4 evolution charts from office_metrics_history |
| `Atividades.tsx` | Add UserAvatar to ActivityCard |

No database migrations needed.

