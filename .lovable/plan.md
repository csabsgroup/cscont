

## Gap Analysis and Implementation Plan

After thoroughly reviewing the codebase against the full specification, here is what exists and what remains to be built.

---

### What's Already Implemented

- **Database**: All core tables exist with RLS (offices, contacts, contracts, products, activities, meetings, events, event_participants, journey_stages, office_journey, health_scores/pillars/indicators/overrides/playbooks, form_templates, form_submissions, bonus_catalog/grants/requests, action_plans, client_office_links, manager_csm_links, profiles, user_roles)
- **Auth/RBAC**: 5 roles with security definer functions (has_role, get_visible_office_ids, etc.)
- **All pages exist**: Dashboard, Clientes, Cliente360, Jornada, Atividades, Reunioes, Eventos, ContratosGlobal, ContatosGlobal, Relatorios, Configuracoes, Portal (8 pages)
- **Configuracoes tabs**: Produtos, Etapas da Jornada, Health Score, Formularios, Catalogo de Bonus, Usuarios & Roles

---

### What's Missing (organized by priority)

#### Batch 1 — Core Functionality Gaps

**1. Dashboard Enhancements**
- Missing: Health distribution (V/A/V), health medio, NPS medio + cobertura, sem percepcao no mes, +30 dias sem reuniao, ranking evolucao, funil/etapas por produto, top churn risk, top expansao
- Current: Only has basic KPI cards + attention items + birthdays

**2. Atividades Improvements**
- Missing: Tabs Hoje/Atrasadas/Futuras/Concluidas (has only Pendentes/Concluidas)
- Missing: Full activity types (ligacao, follow_up, check_in, email, whatsapp, planejamento, task, other)
- Missing: Checklist/subtarefas inside activities
- Missing: Popup menu with edit/complete/delete actions per item
- Missing: "Observacoes" prompt when completing

**3. Reunioes Improvements**
- Missing: `share_with_client` toggle on create/detail
- Missing: Form selector when marking as "completed" (link to form_templates)
- Missing: Transcript field visible in detail

**4. Eventos Improvements**
- Missing: `eligible_product_ids` multi-select on create
- Missing: Auto-pull all active offices of eligible products as participants
- Missing: Participation management UI (confirm/attended/absent/remove)

**5. Jornada Kanban Improvements**
- Missing: Real drag & drop (currently uses Select dropdown)
- Missing: Move reason modal
- Missing: Health badge on cards, dias renovacao, parcelas vencidas, ultima reuniao
- Missing: Filters (saude, status, CSM, renovacao, parcelas vencidas, sem percepcao, +30 dias sem reuniao)

#### Batch 2 — Enhanced Features

**6. Clientes Table Enhancements**
- Missing: Health, LTV, ultimo contato, proximo passo, parcelas vencidas, dias renovacao columns
- Missing: Configurable/reorderable columns with saved views (user_table_views table needed)
- Missing: More filters (CSM, etapa, tags, saude, etc.)

**7. Relatorios Full Implementation**
- Missing: Tab structure (Visao executiva, Churn & retencao, Receita & LTV, Health/NPS/CSAT, Cobertura/cadencia, Jornada analytics, Inadimplencia, Evolucao do cliente)
- Missing: Period selector + comparison

**8. Configuracoes — Missing Tabs**
- Missing: Integracoes tab (stubs for Google Calendar, Asaas, Slack, Piperun, WhatsApp, Fireflies)
- Missing: Templates/Automacoes tab

**9. Portal Pages — Real Data**
- Current portal pages are minimal stubs
- Missing: Real contract details with installments in PortalContrato
- Missing: Proper OKR editing (status/observations only) in PortalOKR
- Missing: share_with_client filter in PortalReunioes
- Missing: Product-filtered events in PortalEventos
- Missing: Full bonus request flow in PortalBonus
- Missing: Arquivos compartilhados page

#### Batch 3 — Polish & Data

**10. Branding**
- Red primary color needs to be applied in Tailwind config

**11. Viewer Read-Only**
- Partially implemented; needs consistent check across all pages

**12. Seed Data**
- 3 products, 10 offices, 20 contacts, 30 activities, 10 meetings, 3 events, journey stages, health config

---

### Database Changes Needed

```text
New table: activity_checklists
  - id, activity_id, title, completed, position, created_at

New table: user_table_views
  - id, user_id, page, name, columns (jsonb), filters (jsonb), is_default, created_at

New table: shared_files (for portal "Arquivos compartilhados")
  - id, office_id, name, url, uploaded_by, shared_with_client, created_at

Enum update: activity_type
  - Add: ligacao, check_in, email, whatsapp, planejamento

Add column: activities.observations (text, nullable)
```

---

### Implementation Order

Due to the volume, I recommend splitting into 3 batches:

**Batch 1** (this implementation — highest impact):
1. DB migration (activity_checklists, activity_type enum, observations column)
2. Branding (red primary in tailwind.config)
3. Atividades: 4-tab layout, full types, checklist, popup menu, observations on complete
4. Reunioes: share_with_client toggle, form selector on complete, transcript
5. Eventos: product selector, auto-pull participants, participation management
6. Jornada: Filters, health/info on cards, move reason modal
7. Dashboard: Health distribution, +30 dias sem reuniao, funil/etapas, attention items expansion

**Batch 2** (next round):
1. DB migration (user_table_views, shared_files)
2. Clientes: Enhanced columns, saved views
3. Relatorios: Full tab structure with all report types
4. Configuracoes: Integracoes tab, Templates/Automacoes tab
5. Portal: Enhanced pages with real data flows, Arquivos page

**Batch 3** (final round):
1. Viewer read-only consistency
2. Seed data
3. Polish and edge cases

---

### Files to Create (Batch 1)
- `src/components/atividades/ActivityChecklist.tsx`
- `src/components/atividades/ActivityPopup.tsx`
- `src/components/eventos/ParticipantManager.tsx`
- `src/components/reunioes/FormFillDialog.tsx`

### Files to Edit (Batch 1)
- `tailwind.config.ts` (red primary)
- `src/pages/Dashboard.tsx` (health + funil + more attention items)
- `src/pages/Atividades.tsx` (4 tabs, types, checklist, popup, observations)
- `src/pages/Reunioes.tsx` (share_with_client, form on complete, transcript)
- `src/pages/Eventos.tsx` (product selector, auto-pull, participation)
- `src/pages/Jornada.tsx` (filters, card info, move reason)

Shall I proceed with Batch 1?

