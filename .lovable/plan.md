

# Plan: Playbook Accordion + Client Wizard + Auto ID

## AJUSTE 1 — Playbook Accordion in ClienteTimeline

### Current state
`ClienteTimeline.tsx` renders all activities as flat cards. Activities with `playbook_instance_id` are not grouped.

### Changes to `src/components/clientes/ClienteTimeline.tsx`

1. **Fetch playbook instances** alongside activities: query `playbook_instances` with `playbook_templates(name)` for this office
2. **Group activities** in a `useMemo`:
   - Separate activities with `playbook_instance_id` into groups keyed by that ID
   - Keep activities without `playbook_instance_id` as standalone
3. **Render playbook groups** as collapsible accordion cards:
   - Collapsed: chevron icon, 📋, template name, progress bar, `X/Y (Z%)`, status badge
   - Expanded: indented list of activities sorted by `playbook_order`, each clickable to open `ActivityEditDrawer`
4. **Render standalone activities** as current flat cards
5. **Sort logic**: playbook groups sorted by earliest pending `due_date`; standalone sorted by `due_date`; both respect ASC/DESC toggle
6. **Filter logic**: type filter "activity" includes playbook groups; status filter applies inside groups (hide completed playbooks if filtering pending only, etc.)

### Technical details
- Use local state `expandedPlaybooks: Set<string>` for accordion toggle (no radix dependency needed, just click handler)
- Playbook instances already have `completed_activities`, `total_activities`, `status` fields
- Activities already have `playbook_instance_id` and `playbook_order` columns
- Meeting items remain unchanged, interspersed by date

---

## AJUSTE 2 — Client Creation Wizard (3 steps)

### Current state
`Clientes.tsx` has a simple dialog with name/CNPJ/city/state/email/phone/product fields, creating only the office.

### Changes

1. **New component**: `src/components/clientes/CreateClientWizard.tsx`
   - 3-step wizard in a Dialog
   - Step indicator at top (1: Empresa, 2: Contato, 3: Contrato)
   - **Step 1 (Empresa)**: Name*, CNPJ, Email, WhatsApp, Phone, Address, City, State (UF dropdown), CEP, Segment, Product* (dropdown), CSM (dropdown with search), Status (default: Ativo), Notes
   - **Step 2 (Contato)**: Name*, Email, Phone/WhatsApp, CPF, Role, Birthday, Instagram, is_sponsor checkbox, visible_in_portal checkbox. "Add another contact" button. "Skip" button.
   - **Step 3 (Contrato)**: Total value, Monthly value, Installments (default 12), Start date, End date (auto-calculated: start+12mo, editable), Contract status (default: Ativo), Asaas reference, Notes. "Skip" button.
   - "Criar Cliente" final button

2. **Creation logic** (sequential):
   - Generate `office_code` via `generateNextId()` (Ajuste 3)
   - Insert office with all fields
   - Insert contact(s) if provided (with `is_main_contact: true` for first/sponsor)
   - Insert contract if provided, then update office MRR/cycle dates/activation_date
   - Trigger automations (`office.created` or `onNewOffice`)
   - Toast with full summary

3. **Replace** the existing simple dialog in `Clientes.tsx` with this wizard

---

## AJUSTE 3 — Auto Sequential ID (office_code)

### Current state
- `products` table already has `code_prefix` column (verified in Configuracoes.tsx)
- `offices` table has `office_code` column
- ID generation already exists in `handleCreate` (lines 588-604) but uses dash format `PREFIX-001`
- User wants format `PREFIX - 001` (with spaces around dash)

### Changes

1. **Shared utility**: `src/lib/office-code-helpers.ts`
   - `generateNextOfficeCode(productId, supabase)`: fetches prefix, queries max existing code, returns next sequential
   - Format: `{PREFIX} - {NNN}` (spaces around dash, 3-digit zero-padded)
   - Handles null prefix gracefully (returns null)

2. **Use in Wizard** (Ajuste 2): call before inserting office

3. **Use in import** (`src/lib/import-sanitize.ts` or `ImportWizard.tsx`): if row has no external_id/office_code, generate one

4. **Database**: Add UNIQUE constraint on `offices.office_code` via migration (with `WHERE office_code IS NOT NULL` to allow nulls)

5. **Retry logic**: if insert fails with unique violation code `23505`, increment and retry up to 3 times

### Files to create/modify
- **Create**: `src/lib/office-code-helpers.ts`
- **Modify**: `src/components/clientes/CreateClientWizard.tsx` (new file from Ajuste 2)
- **Modify**: `src/pages/Clientes.tsx` (replace dialog with wizard, remove old handleCreate logic)
- **Modify**: `src/components/clientes/ClienteTimeline.tsx` (accordion grouping)
- **Migration**: UNIQUE constraint on `offices.office_code`

