

## Plan: Complete Jornada, Atividades & Reuniões

### Current State Analysis

**Jornada** — ~90% complete. Has drag & drop, move dialog, health/status filters. Missing: CSM filter, CSM avatar on cards.

**Atividades** — ~70% complete. Has tabs, create form, popup with complete/reopen/delete, checklist component. Missing: "Responsável" field (always assigns to self), checklist items in create dialog, office name as clickable link to 360, concluir should REQUIRE observations (currently optional).

**Reuniões** — ~65% complete. Has table, create/detail dialogs, form fill. Missing: filters (status, period, office), "marcar como realizada" should show form selection BEFORE changing status (currently changes status then opens form).

### Changes

**1. `src/pages/Jornada.tsx`** (small additions)
- Add CSM filter dropdown (fetch profiles with csm role, filter cards by `offices.csm_id`)
- Show CSM avatar (initials circle) on each card using profile data fetched alongside offices

**2. `src/pages/Atividades.tsx`** (medium changes)
- Add "Responsável" Select in create dialog: fetch all internal users from `profiles` + `user_roles`, default to current user
- Add inline checklist builder in create dialog (add/remove items, saved after activity creation)
- Make office name clickable → navigate to `/clientes/{office_id}`
- Make observations REQUIRED in complete flow (disable button if empty)

**3. `src/components/atividades/ActivityPopup.tsx`** (small change)
- Require observations to complete: disable "Concluir" button when observations empty

**4. `src/pages/Reunioes.tsx`** (medium changes)
- Add filter bar: status Select, date range (2 date inputs), office Select
- Fix "Marcar como realizada" flow: open form selection dialog FIRST → on form submit, THEN update status to completed
- Apply filters to meeting list (client-side filtering)

### No DB Changes Required
All needed tables/columns already exist.

