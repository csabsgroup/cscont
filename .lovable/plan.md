

## Clientes Table Refactoring Plan

This is a complete rewrite of `src/pages/Clientes.tsx` adding column drag-and-drop reordering, advanced multi-select filters, sorting, pagination, bulk actions, and enhanced saved views. No DB migration needed — the existing `user_table_views` table already has `columns` (jsonb), `filters` (jsonb), and `is_default` fields.

### What Changes

**Single file rewrite: `src/pages/Clientes.tsx`** (~700 lines)

### Features to Implement

**1. Column Drag & Drop Reordering**
- Use HTML5 Drag API on `<TableHead>` elements (no new library needed — `@hello-pangea/dnd` is already installed but HTML5 drag is simpler for horizontal header reordering)
- `onDragStart`/`onDragOver`/`onDrop` on each header cell
- `visibleColumns` state is an ordered array — reordering = splicing the array
- Dragging header gets `opacity-50`, drop target gets left/right border indicator
- Order persists in saved views via `columns` field

**2. Add Missing Column: "nextStep" (Próximo Passo)**
- Fetch next pending activity per office from `activities` table (`WHERE completed_at IS NULL ORDER BY due_date ASC LIMIT 1`)
- Add to the data fetch batch
- Display as truncated text in cell

**3. Enhanced Filters (multi-select chips)**
- Replace single-select dropdowns with multi-select chip-based filters
- New filter state: `filterCSMs: string[]`, `filterProducts: string[]`, `filterStatuses: string[]`, `filterStages: string[]`, `filterHealth: string[]`
- Toggle filters: `noPerception` (bool), `noMeeting30d` (bool), `overdueInstallments` (bool), `renewal30d` (bool)
- Each active filter renders as a removable chip/badge
- Stage filter is dynamic: options filtered by selected product(s)
- Fetch CSM list from `profiles` joined with `user_roles` where role=csm
- All filtering remains client-side (data already fetched); toggle filters use computed fields

**4. Sorting**
- State: `sortColumn: ColumnKey | null`, `sortDirection: 'asc' | 'desc' | null`
- Click header → cycles asc → desc → none
- Arrow icon (ChevronUp/ChevronDown) next to sorted column label
- Sort the `filtered` array before pagination
- Persists in saved views

**5. Pagination**
- State: `page: number`, `pageSize: number` (default 25)
- Options: 10, 25, 50, 100
- Slice `filtered` array for display
- Footer: "Mostrando 1–25 de 142 clientes" + prev/next buttons + page numbers

**6. Row Selection & Bulk Actions**
- Checkbox column (first column) — hidden for Viewer
- State: `selectedIds: Set<string>`
- Header checkbox for select all (current page)
- Bulk action bar appears when selection > 0: "Reatribuir CSM" and "Alterar Status" buttons (Admin/Manager only)
- "Reatribuir CSM" opens dialog with CSM selector → updates `offices.csm_id` for selected
- "Alterar Status" opens dialog with status selector → updates `offices.status` for selected

**7. Enhanced Saved Views**
- Save now includes: `columns` (ordered array), `filters` (all filter state), `sort` (column + direction), `is_default`
- Load view restores all state
- Admin can mark a view as `is_default` (global default)
- Rename/delete options in view dropdown (with confirmation)
- Fetch global default views (where `is_default = true`) in addition to user's own

**8. Visual Enhancements**
- Status badges: Ativo=green, Churn=red, Não Renovado=orange, Não Iniciado=gray, Upsell=blue, Bonus Elite=amber/gold
- Health badge: colored dot (8px circle) + score number
- CSM column: avatar circle (initials) + name
- "Último contato" uses relative time ("há 3 dias")
- Days to renewal: red if <15, yellow if <30
- Search with 300ms debounce via `useEffect`

### DB Schema — No Changes Needed
The `user_table_views` table already has `columns` (jsonb), `filters` (jsonb), `is_default` (boolean), `page` (text). The `columns` field will store the ordered array, `filters` will store all filter state + sort config.

### Technical Approach
- Single large file rewrite of `Clientes.tsx`
- All data fetching logic stays the same (parallel Promise.all)
- Add `activities` fetch for "next step" column
- Add `profiles` + `user_roles` fetch for CSM filter list
- HTML5 drag for column reordering (lightweight, no extra deps)
- Debounced search via setTimeout/clearTimeout pattern
- Pagination is pure client-side slicing

