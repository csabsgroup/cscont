

## Plan: Implement Phases 3-5 (Formularios, Cashback/Bonus, Portal do Cliente)

Given the volume, I'll implement Phases 3, 4, and 5 together as they are interconnected (Portal depends on Bonus and Forms features).

---

### Phase 3 — Custom Forms

**Database migration:**
- `form_templates` table: id, name, type (enum: kickoff, onboarding, nutricao, renovacao, expansao, sos, extra, apresentacao), product_id (nullable), fields (jsonb), post_actions (jsonb), created_by, created_at, updated_at
- `form_submissions` table: id, template_id, office_id, meeting_id (nullable), user_id, data (jsonb), submitted_at
- RLS: admin full access, CSM can create/view submissions for their offices, authenticated can view templates

**UI:**
- New "Formularios" tab in Configuracoes: template builder with field types (text, number, date, dropdown, multi, rating 1-5, NPS 0-10, boolean, file)
- Reunioes page: when marking as "completed", show form selector and fill form
- Form submissions stored as JSONB

---

### Phase 4 — Cashback/Bonus Catalog

**Database migration:**
- `bonus_catalog` table: id, name, unit, default_validity_days, visible_in_portal, requires_approval, eligible_product_ids (uuid[]), created_at, updated_at
- `bonus_grants` table: id, office_id, catalog_item_id, quantity, granted_at, expires_at, used, available
- `bonus_requests` table: id, office_id, catalog_item_id, quantity, notes, status (enum: pending, approved, denied), reviewed_by (nullable), created_at, updated_at
- RLS: admin full access on catalog; CSM can manage grants/requests for their offices; clients can view own grants and create requests

**UI:**
- New "Catalogo de Bonus" tab in Configuracoes (admin)
- New "Bonus/Cashback" tab in Cliente 360: show grants balance, requests history, create grant
- Events `eligible_product_ids` column (uuid[]) added to events table for Phase 7 prep

---

### Phase 5 — Portal do Cliente (role=client)

**Database migration:**
- Add `shared_with_client boolean default false` to activities table (notes already have office-level visibility)

**UI — New layout + pages:**
- `PortalLayout.tsx`: separate nav (no internal sidebar), with portal-specific menu
- Portal routes under `/portal/*` with client-role guard
- Pages:
  - **Home**: summary cards (contract status, OKR progress, upcoming events)
  - **Meu Contrato**: contract details, installments, renewal info
  - **Plano de Acao**: view action_plans, edit only status + observations
  - **Reunioes**: meetings with share_with_client=true, view notes/transcript
  - **Eventos**: events for the client's product
  - **Bonus/Cashback**: view balance, create requests
  - **Contatos**: CSM and manager contact info
  - **Membros Ativos**: directory of active offices in same product with visible_in_directory=true (photo, name, phone, instagram, email, city/state)

**Routing:**
- Add `/portal/*` routes in App.tsx with a `PortalRoute` guard that checks role=client
- Redirect clients to `/portal` on login

---

### Implementation Order

1. Database migration (all tables + columns in one migration)
2. Configuracoes: Forms tab + Bonus Catalog tab
3. Reunioes: form integration on completion
4. Cliente 360: Bonus/Cashback tab
5. Portal layout + all portal pages
6. App.tsx routing updates + client redirect logic

### Files to create:
- `src/components/configuracoes/FormTemplatesTab.tsx`
- `src/components/configuracoes/BonusCatalogTab.tsx`
- `src/components/clientes/ClienteBonus.tsx`
- `src/components/portal/PortalLayout.tsx`
- `src/pages/portal/PortalHome.tsx`
- `src/pages/portal/PortalContrato.tsx`
- `src/pages/portal/PortalOKR.tsx`
- `src/pages/portal/PortalReunioes.tsx`
- `src/pages/portal/PortalEventos.tsx`
- `src/pages/portal/PortalBonus.tsx`
- `src/pages/portal/PortalContatos.tsx`
- `src/pages/portal/PortalMembros.tsx`

### Files to edit:
- `src/pages/Configuracoes.tsx` (add Forms + Bonus tabs)
- `src/pages/Reunioes.tsx` (form selector on completion)
- `src/pages/Cliente360.tsx` (add Bonus tab)
- `src/App.tsx` (portal routes + client redirect)
- `src/contexts/AuthContext.tsx` (add portal redirect logic)

