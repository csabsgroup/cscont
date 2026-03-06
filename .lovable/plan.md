

# Plan: Fix Silent Import Failure

## Root Cause

The `handleImport` function (line 134) is async but has **no top-level try-catch** and no `finally` block. If any exception occurs (e.g., during `getMappedRows()`, batch insert, or audit log), the function crashes silently:
- `setImporting(false)` never runs → button stays disabled showing "Importando..."
- `setStep('execute')` never runs → no result screen shown
- No toast is displayed → user sees nothing

Additionally, per-row errors only go to `console.error` (line 154), never shown to the user.

## Fix (1 file)

### `src/components/import-export/ImportWizard.tsx`

1. **Wrap entire `handleImport` body in try/catch/finally**:
   - `catch`: show `toast.error()` with the actual error message
   - `finally`: always call `setImporting(false)`

2. **Add toast feedback** at key points:
   - Start: `toast.info('Importando X registros...')`
   - Per-row errors: collect error messages in an array, show summary toast at end
   - Success: `toast.success('X importados com sucesso')`
   - Partial: `toast.warning('X importados, Y com erro')`

3. **Add console.log at import start** to log `mappedRows.length` so we can see if validation filters everything out

4. **Show error details in result screen**: pass collected error messages to `result.warnings` so they appear in the UI

| Change | Detail |
|--------|--------|
| Lines 134-187 | Wrap in try/catch/finally, add toasts and logging |

1 file modified. No database changes.

