

# Plan: Fix Import Failing Silently (69 errors, 0 success)

## Root Cause

The `xlsx` library returns Excel dates as **serial numbers** (e.g., `45658` instead of `"01/01/2025"`). The current XLSX parsing uses default `raw: true` mode. Every row in the file has date columns (DATA DE ATIVAÇÃO, DATA INICIO DO CICLO, DATA FINAL CICLO), so when the sanitizer can't convert "45658" to a valid ISO date, Supabase rejects all inserts with invalid date errors.

Additionally, the `catch` block at line 122 in ImportWizard silently swallows all errors (`catch { errorCount++; }`), giving no feedback about WHY rows failed.

## Fixes

### File 1: `src/lib/export-helpers.ts`

In `parseUploadedFile`, change XLSX parsing to use `raw: false` so dates come as formatted strings instead of serial numbers:

```typescript
const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { raw: false, defval: '' });
```

### File 2: `src/lib/import-sanitize.ts`

Add Excel serial date conversion as a fallback in `parseFlexDate`:

```typescript
// Excel serial date (number like 45658)
const num = Number(s);
if (!isNaN(num) && num > 1 && num < 200000) {
  const excelEpoch = new Date(1899, 11, 30);
  const date = new Date(excelEpoch.getTime() + num * 86400000);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
}
```

### File 3: `src/components/import-export/ImportWizard.tsx`

Add error logging to the catch block so failures surface to console and show the first error to the user:

```typescript
} catch (err: any) {
  console.error('Import row failed:', err?.message || err);
  errorCount++;
}
```

## Summary

| File | Change |
|------|--------|
| `src/lib/export-helpers.ts` | Pass `{ raw: false, defval: '' }` to XLSX `sheet_to_json` |
| `src/lib/import-sanitize.ts` | Add Excel serial date fallback in `parseFlexDate` |
| `src/components/import-export/ImportWizard.tsx` | Log import errors instead of swallowing silently |

3 files, no database changes. The primary fix is `raw: false` -- this alone should resolve all 69 failures.

