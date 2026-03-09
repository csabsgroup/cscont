

# Fix: Bulk Delete Dialog White Screen

## Root Cause
`BulkDeleteDialog.tsx` line 151: `<SelectItem value="">Todos</SelectItem>` — Radix UI Select crashes on empty string values. When the dialog mounts and tries to render the filter Select for entities that have filters (offices, contracts, meetings), it throws silently and the dialog shows a blank screen.

## Fix

**File: `src/components/import-export/BulkDeleteDialog.tsx`**

1. Change `<SelectItem value="">Todos</SelectItem>` to `<SelectItem value="__all__">Todos</SelectItem>`
2. Update `handleFilterChange` to treat `"__all__"` as clearing the filter (same as empty string before)
3. Update the `value` prop: `value={filters[f.key] || '__all__'}`

This is a one-line logical fix across 3 locations in the same file.

