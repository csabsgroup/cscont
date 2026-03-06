

# Plan: Fix Portal Data, Bonus Catalog, and Add UserAvatar System

## Summary

Three problems to fix:
1. **Portal empty**: `client_office_links` has **0 records** — the portal resolves `officeId` via this table, so all pages show empty. The `admin-create-user` edge function already inserts into `client_office_links` when `role=client && office_id` is provided, but existing client users were likely created without an `office_id`. Also, portal pages should use `usePortal()` context instead of each independently querying `client_office_links`.
2. **Bonus catalog empty in grant dialog**: The table has 2 items. The query in `ClienteBonus.tsx` (line 40) fetches all items without filter, so data should appear. Most likely a transient issue or the logged-in user's role RLS is blocking. Will add debug logging and ensure the query works.
3. **Avatar component**: Create reusable `UserAvatar` with tooltip, apply across all 14+ locations.

---

## Part 1 — Fix Portal Data Flow

### Root cause
`client_office_links` has 0 records. The edge function `admin-create-user` correctly inserts a link when `role=client && office_id`, but existing clients were created without linking.

### Changes

**A. Refactor portal pages to use `usePortal()` context** instead of each page independently querying `client_office_links`:
- `PortalHome.tsx` — replace inline `client_office_links` query with `usePortal().officeId`
- `PortalContrato.tsx` — same
- `PortalOKR.tsx` — same
- `PortalReunioes.tsx` — same
- `PortalEventos.tsx` — same
- `PortalBonus.tsx` — same
- `PortalArquivos.tsx` — same
- `PortalContatos.tsx` — same
- `PortalMembros.tsx` — same

Each page currently has ~5 lines of boilerplate to get `officeId`. Replace with:
```typescript
const { officeId } = usePortal();
```

**B. Add debug logging in PortalContext** (line 34-55) to trace `officeId` resolution:
```typescript
console.log('[PORTAL] User:', user?.id, 'Office:', oid);
```

**C. The actual fix**: The edge function is correct. The issue is that existing client users have no `client_office_links` record. I'll add a check in `PortalProvider` that shows a clear "Seu escritório não está vinculado" message when `officeId` is null, and also provide an admin tool to manually link existing clients.

---

## Part 2 — Fix Bonus Catalog in Grant Dialog

### Root cause
The `ClienteBonus.tsx` query at line 40 is `supabase.from('bonus_catalog').select('*').order('name')` — this should return all 2 items. The RLS policy "Authenticated can view" allows SELECT. 

### Potential issue
Both items have `eligible_product_ids: [cf7b0fd6...]`. The query doesn't filter by this — so all items should appear in the CSM grant dialog. But in the **portal** (`PortalBonus.tsx` line ~45), the catalog query also doesn't filter by product eligibility.

### Fix
- Add console logging to `ClienteBonus.tsx` fetchAll to debug
- Ensure the Select component renders correctly (verify `catalog.length` before render)
- In `PortalBonus.tsx`, filter catalog by `eligible_product_ids` containing the office's `active_product_id`

---

## Part 3 — Reusable UserAvatar Component

### New files

**`src/components/shared/UserAvatar.tsx`**
- Props: `userId?, name, avatarUrl?, size ('xs'|'sm'|'md'|'lg'), showName?`
- Renders circular avatar with photo or colored initials
- Tooltip on hover showing full name
- Color derived from name hash (consistent)
- Sizes: xs=20px, sm=28px, md=36px, lg=44px

**`src/hooks/useUserProfiles.ts`**
- In-memory cache (`Map`) for profiles
- `useUserProfile(userId)` → `{ name, avatarUrl, loading }`
- Batch-friendly: avoids N queries per page

### Where to apply (14 locations)

| Location | File | Current | New |
|---|---|---|---|
| Clientes table CSM col | `Clientes.tsx:583-591` | Inline initials div + name | `<UserAvatar size="xs" />` + tooltip |
| Kanban cards | `Jornada.tsx` | CSM text or avatar | `<UserAvatar size="xs" />` |
| Activities list | `Atividades.tsx` | Text name | `<UserAvatar size="sm" />` |
| Cliente 360 header | `ClienteHeader.tsx` | Text CSM name | `<UserAvatar size="md" showName />` |
| Reunioes table | `Reunioes.tsx` | Text | `<UserAvatar size="sm" />` |
| Dashboard activities | `Dashboard.tsx` | Text | `<UserAvatar size="xs" />` |
| Activity drawer | `ActivityEditDrawer.tsx` | Text | `<UserAvatar size="md" showName />` |
| Config users list | `Configuracoes.tsx` | Text | `<UserAvatar size="sm" showName />` |
| Sidebar footer | `AppSidebar.tsx` | Inline avatar | `<UserAvatar size="md" />` |
| Portal Contatos | `PortalContatos.tsx` | Inline Avatar | `<UserAvatar size="lg" showName />` |
| Timeline 360 | `ClienteTimeline.tsx` | Text | `<UserAvatar size="xs" />` |
| Mentions | `ActivityPopup.tsx` | Text tags | `<UserAvatar size="xs" />` + name |
| Topbar | `AppLayout.tsx` | Inline avatar | `<UserAvatar size="md" />` |
| Portal Membros | `PortalMembros.tsx` | Inline Avatar | `<UserAvatar size="md" />` |

### Implementation approach
1. Create `UserAvatar` component with Radix Tooltip
2. Create `useUserProfiles` hook with cache
3. Apply to each location, passing existing profile data as props where available
4. Where only `userId` is available, use the hook for lazy fetch

---

## Estimated files changed
- **New**: `src/components/shared/UserAvatar.tsx`, `src/hooks/useUserProfiles.ts`
- **Portal refactor** (9 files): All portal pages to use `usePortal()`
- **Avatar integration** (14 files): All locations listed above
- **Bonus fix**: `ClienteBonus.tsx`, `PortalBonus.tsx`

Total: ~25 files touched.

