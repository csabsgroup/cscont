

# Plan: Fix Dropdowns, Add Contract Editing, File Upload, and Slack Automation Action

## AJUSTE 4 (PRIORITY) — Fix All Dropdowns

### Root Cause
The Dialog component (`src/components/ui/dialog.tsx`) uses `z-[200]` for both the overlay and content. Select, DropdownMenu, and Popover portals render at `z-50`. When a dropdown opens inside a Dialog, its portal renders *behind* the z-200 overlay, making it invisible and unclickable.

Session replay confirms: the Select content IS rendered in the DOM with items visible, but stuck at `transform: translate(0px, -200%)` and `pointer-events: none` because the overlay blocks the Radix positioning measurement.

### Fix
Raise the z-index of all floating elements (Select, DropdownMenu, Popover, Tooltip) to `z-[250]` so they render above Dialogs/Sheets:

| File | Current z-index | New z-index |
|---|---|---|
| `select.tsx` SelectContent | `z-50` | `z-[250]` |
| `dropdown-menu.tsx` Content + SubContent | `z-50` | `z-[250]` |
| `popover.tsx` PopoverContent | `z-50` | `z-[250]` |
| `tooltip.tsx` TooltipContent | `z-50` | `z-[250]` |

This is a 4-file, 1-line-per-file fix.

---

## AJUSTE 1 — Edit Contract Drawer

### Changes

**`src/components/clientes/ClienteContratos.tsx`**:
- Add "Edit" button (pencil icon) on each contract row
- Add edit state: `editingContract`, `editForm`, `editOpen`
- Reuse the same form as "New Contract" but in a Sheet (drawer) instead of Dialog
- On save: `UPDATE contracts SET ... WHERE id = editingId`
- After save: call `processContractDates()` to recalculate MRR/cycle dates
- Insert audit_log entry
- Admin can edit product_id; CSM/Manager cannot (field disabled based on role)

**`src/pages/ContratosGlobal.tsx`**:
- Add edit button per row, open same edit drawer
- Pass `onRefresh` to re-fetch after edit

---

## AJUSTE 2 — File Upload (Files + Notes)

### Database Migration
Create `office_files` table:
```sql
CREATE TABLE public.office_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL,
  note_id uuid,
  name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_by uuid NOT NULL,
  share_with_client boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.office_files ENABLE ROW LEVEL SECURITY;
```

RLS policies: Admin ALL, CSM manage for own offices, Viewer/Client SELECT only (client filtered by `get_client_office_ids`).

### Storage
Create bucket `office-files` (public: true for signed URLs, or use public URLs).

### Components

**New: `src/components/clientes/ClienteArquivos.tsx`**:
- Upload button + drag-and-drop area
- File list: icon, name (download link), size, uploader avatar, date, share toggle, delete button
- Upload to `office-files/{office_id}/{timestamp}_{filename}`
- Max 10MB validation
- Insert into `office_files` table

**Edit: `src/components/clientes/ClienteNotas.tsx`**:
- Add "Attach file" button when creating/editing notes
- Show paperclip icon on notes that have attachments
- Click to download attachment

**Edit: `src/pages/portal/PortalArquivos.tsx`**:
- Query `office_files` WHERE `share_with_client = true` and display for download

**Edit: `src/pages/Cliente360.tsx`**:
- Add "Arquivos" tab using new `ClienteArquivos` component

---

## AJUSTE 3 — Slack Action in Automation Rules

### Frontend (`AutomationRulesTab.tsx`):
Add to `ACTION_TYPES` array:
```typescript
{ value: 'send_slack', label: '📢 Enviar Slack' }
```

Add `case 'send_slack'` in `renderActionConfig`:
- VariableTextInput for message
- Select for channel: "Canal padrão" or "Canal específico" (with input for channel ID)

### Backend (`execute-automations/index.ts`):
The `send_slack` case already exists (lines 160-210) and handles message resolution, channel from config, and gateway call. The existing implementation also reads a custom channel from `c.channel` if provided. This is already functional — only the frontend action type registration is missing.

---

## File Summary

| Action | Files |
|---|---|
| Dropdown fix | `select.tsx`, `dropdown-menu.tsx`, `popover.tsx`, `tooltip.tsx` (z-index bump) |
| Contract edit | `ClienteContratos.tsx`, `ContratosGlobal.tsx` |
| File upload | New `ClienteArquivos.tsx`, edit `ClienteNotas.tsx`, `Cliente360.tsx`, `PortalArquivos.tsx` |
| DB migration | Create `office_files` table + `office-files` storage bucket |
| Slack action | `AutomationRulesTab.tsx` (add type + render config) |

Total: ~10 files modified/created, 1 migration.

