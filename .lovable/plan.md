

# Plan: Detailed Import Error Feedback

## Current State

The result screen (lines 410-438) shows only basic counters and a flat list of warning strings. Errors from `insertRow` are caught as plain strings and merged into `warnings`. There's no per-row breakdown, no error grouping, no error export, and no friendly translation of database errors.

## Changes (1 file)

### `src/components/import-export/ImportWizard.tsx`

**1. Add types and helper functions:**
- `ImportRowResult` interface with `lineNumber`, `officeName`, `status`, `errors[]`, `warnings[]`
- `translateSupabaseError()` function to convert raw DB errors into Portuguese messages
- `groupErrorsByType()` to create a summary count by error category
- `exportErrorsCSV()` to download failed rows as CSV

**2. Refactor `handleImport` (lines 134-236):**
- Replace flat `errorDetails: string[]` with structured `ImportRowResult[]` array
- For each row, collect per-row errors and warnings into the result object
- Add pre-insert validations (missing name) that produce friendly error messages
- Catch `insertRow` errors and pass through `translateSupabaseError()`
- Store the full `ImportRowResult[]` in the result state

**3. Update result state type:**
- Change from `{ success, errors, skipped, batchId, warnings }` to include `rowResults: ImportRowResult[]`

**4. Redesign the result screen (lines 410-438):**
- Show counters with color-coded icons (success/error/warning)
- Show error icon instead of green checkmark when there are errors
- Collapsible "Error Details" section showing per-row errors with line number and office name
- Collapsible "Warnings" section
- "Summary by Error Type" section with grouped counts
- "Export errors as CSV" button
- "Try again" button that resets to upload step

## Summary

| Area | Change |
|------|--------|
| Types | Add `ImportRowResult` interface |
| Helpers | Add `translateSupabaseError`, `groupErrorsByType`, `exportErrorsCSV` |
| `handleImport` | Collect structured per-row results instead of flat strings |
| Result UI | Rich result screen with per-row details, grouping, and CSV export |

1 file modified. No database changes.

