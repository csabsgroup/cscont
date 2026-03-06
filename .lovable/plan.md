

# Plan: Fix Import to Accept the 69-Client Excel File

## Root Causes Identified

1. **903 empty rows** — Excel has 972 rows but only 69 have data. Empty/"None" rows pass through and fail.
2. **"None" text not treated as null** — Python/Pandas export writes literal "None" strings.
3. **".0" suffix on numbers** — `"11982215029.0"` → `sanitizePhone` gets digits `"119822150290"` (12 digits, wrong). Must strip `.0` first.
4. **`status` is `required: true`** — validation rejects any row where status is empty after sanitize.
5. **Automations fire per row** — lines 151-164 call edge function for every imported office (kills performance with 69+ rows).
6. **Contract creation requires productId** — `if (officeId && productId && ...)` skips contract if product not matched.

## Changes (3 files)

### File 1: `src/lib/import-sanitize.ts`

- Add `isNullValue()` helper: treats `"None"`, `"null"`, `"N/A"`, `"NaN"`, `"-"`, `"undefined"` as null.
- Add `cleanExcelFloat()`: strips trailing `.0` from integer-as-float strings (`"15.0"` → `"15"`).
- Update `sanitizeValue()`:
  - Call `isNullValue()` first — return `null` if truthy.
  - Call `cleanExcelFloat()` before processing phone/number fields.
  - For phone fields, clean `.0` before calling `sanitizePhone`.

### File 2: `src/lib/import-templates.ts`

- Change `status` field: `required: false` (default handled in insertRow).
- Add alias `'data de ativacao'` to `activation_date`, `'data inicio do ciclo'` to `cycle_start_date`, `'data final ciclo'` to `cycle_end_date`, `'data da ultima reuniao'` to `last_meeting_date`, and other exact header matches from the spreadsheet that are currently missing.
- Add `cs_feeling` field with aliases `['cs feeling', 'sentimento cs', 'feeling']`.
- Add `last_nps` field with alias `['nps']`.

### File 3: `src/components/import-export/ImportWizard.tsx`

- **Filter empty rows** in `handleFile`: after parsing, filter out rows where all values are null/empty/"None". Show count of filtered rows in the UI.
- **Clean "None" values**: in `getMappedRows`, apply `isNullValue` check before sanitizing each cell — if null, return `null` instead of passing `"None"` to sanitizer.
- **Remove automation triggers** during bulk import (delete lines 151-164 that call `execute-automations` per office).
- **Allow contract creation without product**: change `if (officeId && productId && ...)` to `if (officeId && (row.contract_value || row.monthly_value))` and pass `product_id: productId || undefined` (DB column is NOT NULL, so if no product we skip — actually check the schema... `contracts.product_id` is `NOT NULL`. So keep requiring productId for contract, but create contract even without product by finding a default or skipping. Actually simplest: remove the `productId` requirement — if no product, skip contract silently).
- **Add `cs_feeling` and `last_nps`** to the office insert data.
- **Add `origem`** to notes field (append to notes if both exist).

## Summary

| File | Key Changes |
|------|------------|
| `src/lib/import-sanitize.ts` | Add `isNullValue()`, `cleanExcelFloat()`, use them in `sanitizeValue()` |
| `src/lib/import-templates.ts` | `status.required = false`, add `cs_feeling`/`last_nps` fields, expand aliases for exact header matches |
| `src/components/import-export/ImportWizard.tsx` | Filter empty rows, clean "None" values, remove per-row automation triggers, handle `cs_feeling`/`last_nps`/`origem` in insertRow |

3 files, no database changes needed.

