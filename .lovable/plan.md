

# Implementation Plan: 3 Adjustments

## Ajuste 1 — Fix Piperun signature fields

**What's wrong:** The field picker and edge function reference `signature.status`, `signature.signed_at`, `signature.document_url` which don't exist in the webhook JSON. The edge function also makes an unnecessary API call to `/signatures`.

**Changes:**

### `src/components/configuracoes/integrations/PiperunFieldPicker.tsx`
- Lines 87-93: Replace the 3 `signature.*` fields with `action.*` fields:
  - `action.create` → "Data da assinatura/ação"
  - `action.trigger_type` → "Tipo do trigger"
  - `action.stage` → "Etapa no momento da ação"
  - `action.pipeline` → "Funil no momento da ação"
- Line 24: Update category prefix from `signature.` to `action.`

### `supabase/functions/integration-piperun/index.ts`
- Lines 601-607: Replace `signature.*` fields with `action.*` fields in `listFields`
- Lines 224-239: Update PDF download to check `action.document_url` instead of `signature.document_url`
- Lines 297-305: Remove the `/signatures` API call entirely (data comes from `action` in webhook body)
- Line 316: Remove `signature: signatureData || {}` from sourceData (keep `action` which comes from deal spread)

### `src/components/configuracoes/integrations/PiperunConfig.tsx`
- No changes needed — DEFAULT_MAPPINGS don't reference `signature.*`

---

## Ajuste 2 — Sort toggle on Activities tab (Cliente 360)

**What's wrong:** Activities in `ClienteTimeline.tsx` are sorted only by date descending. Need a toggle button.

**Changes in `src/components/clientes/ClienteTimeline.tsx`:**
- Add state: `const [sortAsc, setSortAsc] = useState(true)` (ascending = closest first)
- Add an `ArrowUpDown` toggle button next to the Filters button
- Modify the `.sort()` on line 93 to respect `sortAsc`:
  - When `sortAsc`: sort by date ascending (closest/most overdue first)
  - When `!sortAsc`: sort by date descending
- Button label: "↑ Mais próximas" / "↓ Mais distantes"

---

## Ajuste 3 — Activity edit drawer

**New file: `src/components/atividades/ActivityEditDrawer.tsx`**

A reusable drawer component (560px width on desktop, fullscreen on mobile) using `vaul` Drawer component.

**Props:** `activityId`, `isOpen`, `onClose`, `onSave`, `readOnly`

**Features:**
- Fetches activity by ID + checklist items + mentions on open
- Fetches internal users for assignee/mentions dropdowns
- All fields editable: title, type, description, due_date, priority, user_id, observations
- Checklist management inline (toggle, add, remove, progress bar)
- Mentions as multi-select tags (stored in new `activity_mentions` table)
- Footer buttons: Delete (left), Reopen (if completed), Complete (with observations sub-dialog), Save
- Read-only mode for viewers

**Database migration:** Create `activity_mentions` table with RLS policies.

**Integration points (click handler changes):**
1. `src/pages/Atividades.tsx` — `ActivityCard`: make card clickable, open drawer
2. `src/components/clientes/ClienteTimeline.tsx` — activity cards: open drawer instead of detail dialog
3. `src/components/atividades/ActivityPopup.tsx` — "Detalhes" menu item opens drawer

Each integration adds:
```tsx
const [editActivityId, setEditActivityId] = useState<string | null>(null);
// onClick on card → setEditActivityId(activity.id)
<ActivityEditDrawer activityId={editActivityId} isOpen={!!editActivityId} onClose={() => setEditActivityId(null)} onSave={fetchData} readOnly={isViewer} />
```

**Drawer uses Sheet component** (right-side panel) from shadcn for better UX on desktop, with `className="w-[560px] sm:max-w-[560px]"`.

