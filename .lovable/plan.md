

## Cliente 360 Restructuring Plan

### Overview
Restructure the Cliente 360 page to show a KPI overview section above the tabs, enhance the header with more badges and actions, and improve the Timeline tab with full activity/meeting creation and detailed popup menus.

### Files to Change

**1. `src/components/clientes/ClienteHeader.tsx` — Enhanced Header**
- Add badges: health score, journey stage name, CSM avatar+name
- Add "..." dropdown menu (DropdownMenu): reatribuir CSM, alterar status, nota rápida
- Fetch CSM profile name, current journey stage name via props passed from Cliente360
- Viewer: hide edit button and "..." menu

**2. `src/pages/Cliente360.tsx` — Main Page Restructure**
- Fetch additional data in `fetchAll`: meetings (for engagement KPI), action_plans (for OKR KPI), office_journey with stage name, CSM profile
- Add KPI grid section between header and tabs (6 cards, responsive grid)
- Remove "Resumo" tab (its data is now in the KPI section + header)
- Pass enriched props to ClienteHeader (csm profile, stage name, health)
- KPI Cards:
  - **Contrato**: value, monthly, installments paid/total, overdue (red), days to renewal (color-coded), end date
  - **Saúde**: health score big number + badge, last NPS (from form_submissions where field type=rating_nps)
  - **Engajamento**: last meeting date (relative), days without meeting, total meetings in cycle, last activity completed
  - **Plano de Ação**: % completion (progress bar), tasks done/total, overdue count, next due task
  - **Percepção**: faturamento mês/ano, qtd clientes/colaboradores (from offices fields — currently missing columns, show placeholders "—")
  - **Tempo de Vida**: months as client (from onboarding_date), contract cycles count, first signature date, LTV total

**3. `src/components/clientes/ClienteTimeline.tsx` — Enhanced Timeline**
- Store full activity/meeting raw data (not just the simplified TimelineItem)
- Add "Nova Atividade" and "Nova Reunião" buttons at top (hidden for viewer)
- **New Activity Dialog**: type dropdown (all activity types), title, description, due_date, responsible (dropdown of internal users fetched from profiles+user_roles), priority, checklist items (add/remove)
- **New Meeting Dialog**: date, time, title, share_with_client toggle, office pre-filled
- **Detail popup**: clicking an item opens a Dialog showing ALL fields:
  - Activity: type, title, description, dates (start/due/completed), responsible, status, observations, checklist
  - Meeting: date, status, notes, transcript, share_with_client
  - Action buttons: Edit, Complete (with required observations textarea), Reopen, Delete
- Add filters: type (activity/meeting), status (pending/done)
- Complete activity now requires observations (textarea must be non-empty)

**4. `src/components/clientes/ClienteJornada.tsx` — Add Stage History**
- Fetch `office_stage_history` for this office, join with journey_stages for names
- Display history list below current stage: date, from→to, reason, who moved, change_type badge

### Data Fetching Strategy (in Cliente360.tsx)
Add to the existing `Promise.all`:
- `meetings` count + last meeting date (already fetched in timeline, but need at page level for KPI)
- `action_plans` for OKR KPI stats
- `profiles` for CSM name (join via `office.csm_id`)
- `office_journey` with stage name (already fetched partially)

### Responsive Grid
KPI section: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`

### No DB Changes Required
All data needed is available in existing tables. Perception fields (faturamento_mensal etc.) don't exist yet in `offices` — those KPI cells will show "—" placeholders.

### Estimated Scope
- `Cliente360.tsx`: Major rewrite (~250 lines, adding KPI section + extra fetches)
- `ClienteHeader.tsx`: Medium rewrite (~80 lines, adding badges + dropdown menu)
- `ClienteTimeline.tsx`: Major rewrite (~350 lines, adding create dialogs + detail popup + filters)
- `ClienteJornada.tsx`: Small addition (~40 lines, stage history)
- `ClienteResumo.tsx`: Keep file but remove the tab reference (file stays for potential reuse)

