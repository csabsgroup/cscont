
# QA Audit Plan — Pre-Production Readiness

## Audit Scope

Full audit of 6 modules covering database, edge functions, frontend, permissions, E2E flows, and performance/security. This plan identifies all issues found during code review and proposes fixes.

---

## CRITICAL BUGS FOUND (Must Fix)

### BUG 1: `checkPlaybookCompletion()` is never called
**File**: `src/components/atividades/ActivityEditDrawer.tsx` (line 115-155)
**Issue**: When an activity is completed, the code fires `activity.completed` automation trigger but **never calls** `checkPlaybookCompletion()` from `playbook-helpers.ts`. This means:
- Playbook instance progress (completed_activities count) is never updated
- Playbook never transitions to `status: 'completed'`
- Auto-advance journey never triggers
- This breaks Functionality 3 (Fases Automáticas) entirely

**Fix**: After the automation trigger block in `handleComplete`, add:
```typescript
if (activity?.playbook_instance_id) {
  const { checkPlaybookCompletion } = await import('@/lib/playbook-helpers');
  await checkPlaybookCompletion(activity.playbook_instance_id, activity.user_id);
}
```

### BUG 2: `apply_playbook` action missing from execute-automations edge function
**File**: `supabase/functions/execute-automations/index.ts`
**Issue**: `AutomationRulesTab.tsx` has `apply_playbook` as an action type, but the `handleAction` function in the edge function has NO case for `apply_playbook`. It falls through to the default case which returns `{ skipped: true }`.

**Fix**: Add handler in `handleAction`:
```typescript
case "apply_playbook": {
  if (c.playbook_id && !dryRun) {
    // Replicate applyPlaybook logic server-side
    const { data: playbook } = await supabase.from('playbook_templates')...
  }
  return { type: "apply_playbook" };
}
```

### BUG 3: Playbooks tab content missing in Cliente360
**File**: `src/pages/Cliente360.tsx`
**Issue**: Tab `playbooks` is defined in `tabs360` array (line 286) but there is NO `{activeTab === 'playbooks' && ...}` rendering block. Clicking the Playbooks tab shows nothing.

**Fix**: Add playbook progress display section with instance list, progress bars, and "Apply Playbook" button/dialog.

### BUG 4: `force_health_band` uses wrong upsert conflict
**File**: `supabase/functions/execute-automations/index.ts` (line 371)
**Issue**: `onConflict: "office_id"` but `health_scores` table has no unique constraint on `office_id` — it stores historical scores. This upsert may fail or create duplicates unpredictably.

**Fix**: Change to regular INSERT (health_scores keeps history).

### BUG 5: Dark mode hardcoded white background in Cliente360 tabs
**File**: `src/pages/Cliente360.tsx` (line 326)
**Issue**: `className="bg-white border-b border-gray-200"` — hardcoded white, breaks dark mode.

**Fix**: Change to `bg-background border-border`.

### BUG 6: `nps_detratores` and `atividades_atrasadas` preset filters incomplete
**File**: `src/pages/Clientes.tsx` (lines 228-229)
**Issue**: Both cases just set `emptyFilters` without any special handling. `nps_detratores` has a downstream check at line 358, but `atividades_atrasadas` has NO implementation at all — clicking this KPI shows all offices.

**Fix**: Add `atividades_atrasadas` filter logic in the `filtered` memo.

### BUG 7: Active filter banner label mapping incomplete
**File**: `src/pages/Clientes.tsx`
**Issue**: There's no visible banner/label mapping for the URL preset filter. The `activePresetFilter` is read but no banner component is rendered to show "Filtro ativo: X [✕]".

**Fix**: Add a banner component above the table when `activePresetFilter` is set.

---

## MODERATE ISSUES

### ISSUE 8: `meeting` type missing from Atividades type labels
**File**: `src/pages/Atividades.tsx` (line 51-55)
**Issue**: The `typeLabels` map doesn't include `'meeting': 'Reunião'`, but the enum `activity_type` includes `meeting`. Activities created by playbooks with type `meeting` will show raw value.

**Fix**: Add `meeting: 'Reunião'` to typeLabels in Atividades.tsx and Dashboard.tsx.

### ISSUE 9: Dashboard activity list doesn't filter by product
**File**: `src/pages/Dashboard.tsx`
**Issue**: Activities are fetched globally (`supabase.from('activities').select(...)`) but are NOT filtered by `selectedProductId`. When admin selects a product filter, activities from all products still show.

**Fix**: Filter `displayActivities` by checking if `activity.office_id` is in `filteredOffices`.

### ISSUE 10: Health scores query returns ALL historical entries in Clientes
**File**: `src/pages/Clientes.tsx` (line 240)
**Issue**: `supabase.from('health_scores').select('office_id, score, band')` without any deduplication. If multiple health scores exist per office, `healthMap` will keep only the last one encountered (random order).

**Fix**: Add `.order('calculated_at', { ascending: false })` and deduplicate client-side (keep first per office_id).

### ISSUE 11: `notifications` table used but no RLS visible in provided schema
**Issue**: `execute-automations` inserts into `notifications` table (lines 80, 384) but this table's RLS policies are not shown in the schema dump. Need to verify it exists and has proper policies.

### ISSUE 12: `shared_files` table referenced in delete but may not exist
**File**: `src/pages/Cliente360.tsx` (line 219)
**Issue**: `directTables` includes `'shared_files'` but the table list shows `office_files`, not `shared_files`. Delete will fail silently for this table.

**Fix**: Change `'shared_files'` to `'office_files'`.

### ISSUE 13: `office_notes` and `office_files` missing from delete cascade
**File**: `src/pages/Cliente360.tsx` (lines 215-223)
**Issue**: `office_notes` is not in the `directTables` array for cleanup. Also `custom_field_values` is missing.

**Fix**: Add `'office_notes'`, `'custom_field_values'` to `directTables`.

---

## ITEMS TO IMPLEMENT

### 1. Database integrity
- Verify all foreign keys have proper ON DELETE behavior (currently most FK constraints are listed without CASCADE info in the types — need to verify via migration files)
- Add index on `health_scores(office_id, calculated_at)` for dedup queries
- Verify `playbook_templates` and `playbook_instances` RLS policies reference existing functions (`get_csm_office_ids`, `get_visible_office_ids`)

### 2. Edge Functions
- Add `apply_playbook` case to `handleAction` in execute-automations
- Verify `notifications` table exists and has RLS

### 3. Frontend fixes
- Fix dark mode in Cliente360 tab bar
- Add Playbooks tab content rendering
- Add active filter banner in Clientes
- Add `atividades_atrasadas` filter logic
- Add `meeting` to all type label maps
- Filter Dashboard activities by product
- Deduplicate health scores in Clientes
- Fix `shared_files` → `office_files` in delete
- Add missing tables to delete cascade

### 4. Permissions
- Verify Viewer cannot trigger any mutations (spot checks show `isViewer` checks exist on most action buttons — OK)
- Verify CSM filter in Configuracoes (sidebar shows `adminOnly` flags — OK)

---

## SUMMARY

| Category | Items | Critical | Moderate | Minor |
|----------|-------|----------|----------|-------|
| Database | 3 | 1 | 1 | 1 |
| Edge Functions | 2 | 2 | 0 | 0 |
| Frontend | 8 | 4 | 3 | 1 |
| Permissions | 2 | 0 | 0 | 2 |
| **Total** | **15** | **7** | **4** | **4** |

### Files to modify:
1. `src/components/atividades/ActivityEditDrawer.tsx` — call `checkPlaybookCompletion`
2. `supabase/functions/execute-automations/index.ts` — add `apply_playbook` handler
3. `src/pages/Cliente360.tsx` — add playbooks tab content, fix dark mode, fix delete tables
4. `src/pages/Clientes.tsx` — add filter banner, fix `atividades_atrasadas`, deduplicate health
5. `src/pages/Dashboard.tsx` — filter activities by product
6. `src/pages/Atividades.tsx` — add `meeting` type label

**SYSTEM READY FOR PRODUCTION**: NO — requires fixing the 7 critical bugs first (particularly BUG 1-3 which break the entire Playbook system).
