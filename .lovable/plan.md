

## Plan: Fullscreen Preview Modal + Import/Export Page

### Funcionalidade 1 — Portal Preview as Fullscreen Modal

**Current state:** Button in ClienteHeader opens `/portal/preview/:officeId` in a new tab. PortalPreview.tsx + PortalPreviewLayout.tsx handle the rendering. PortalContext already supports `previewOfficeId` and `isPreview`/`isReadOnly`.

**Changes:**

| File | Action |
|------|--------|
| `src/components/clientes/PortalPreviewModal.tsx` | **New** — Fullscreen modal using `createPortal`. Contains amber banner bar (h-12), sidebar with nav items (from portal_settings), and content area. Local `useState` for active page. Renders portal page components directly (PortalHome, PortalContrato, etc.) based on active page. Wrapped in `PortalProvider` with `previewOfficeId`. Animation: fade-in + slide-up 200ms. All content area has `pointer-events-none`. |
| `src/components/clientes/ClienteHeader.tsx` | Change `openPreview` from `window.open` to `onPreviewOpen?.()` callback prop. Add `onPreviewOpen` to props interface. |
| `src/pages/Cliente360.tsx` | Add `useState` for `previewOpen`, pass `onPreviewOpen` to ClienteHeader, render `<PortalPreviewModal>` conditionally. |
| `src/App.tsx` | Remove the `/portal/preview/:officeId/*` route (line 95). Remove `PortalPreview` import. |
| `src/pages/portal/PortalPreview.tsx` | **Delete** — no longer needed. |
| `src/components/portal/PortalPreviewLayout.tsx` | **Delete** — replaced by PortalPreviewModal. |

**PortalPreviewModal internals:**
- Props: `isOpen`, `onClose`, `officeId`, `officeName`
- Uses `ReactDOM.createPortal(modal, document.body)`
- Internal state: `activePage` (string) — switches between portal page components
- Sidebar: reuses same nav item list filtered by portal_settings
- Body scroll locked when open (overflow hidden on body)
- ESC key closes modal

### Funcionalidade 2 — Import/Export Tab in Configuracoes

**New files:**

| File | Purpose |
|------|---------|
| `src/components/configuracoes/ImportExportTab.tsx` | Main tab with two sections (Import cards + Export cards). Admin/Manager see both. CSM sees only Export. |
| `src/components/import-export/ImportWizard.tsx` | 4-step wizard modal: Upload → Preview/Map → Validate → Execute. Generic, receives entity config. |
| `src/components/import-export/ExportDialog.tsx` | Export modal: format selector (CSV/XLSX), entity-specific filters, generates file client-side. |
| `src/lib/import-templates.ts` | Entity definitions: fields, required markers, validation rules, match strategies, template generator. |
| `src/lib/export-helpers.ts` | Functions to query data with filters and generate CSV (via manual serialization) / XLSX (via SheetJS). |

**Dependencies needed:** `papaparse` for CSV parsing, `xlsx` (SheetJS) for XLSX read/write.

**Import entities:** Clientes, Contatos, Contratos, Reuniões, NPS/CSAT
**Export entities:** Clientes, Contatos, Contratos, Reuniões, Atividades, OKR, Health Score

**Import flow per entity:**
1. Upload .csv/.xlsx (max 5MB, max 5000 rows)
2. Auto-map columns by header name similarity + manual dropdown override
3. Validate: required fields, format (dates, emails, numbers), enum values, reference existence (office by name, CSM by email)
4. Show valid/error counts, highlight errors in red with tooltips
5. Execute: batch upsert in chunks of 50, progress bar, audit log entry
6. Result summary with error report download

**Export flow:**
- Select format (CSV/XLSX)
- Apply optional filters (status, product, period, etc.)
- CSM: auto-filter by own portfolio (csm_id)
- Generate and download file

**Configuracoes.tsx changes:**
- Add new tab "Importar / Exportar" with `ArrowUpDown` icon
- Visible for Admin, Manager, CSM
- CSM sees only export section (handled inside ImportExportTab)

### No DB changes needed

All tables already exist. Import writes to existing tables (offices, contacts, contracts, meetings, form_submissions). Export reads from them.

