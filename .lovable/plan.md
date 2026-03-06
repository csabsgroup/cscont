

# Plan: Fix Import Wizard Column Mapping Not Showing

## Root Cause

In `ImportWizard.tsx` line 251, the "Não mapear" option uses `<SelectItem value="">`. **Radix UI Select does not allow empty string `""` as a SelectItem value** — it silently breaks the entire dropdown, preventing it from opening or rendering any items.

This is why after uploading a file, the mapping step appears but all the Select dropdowns for column mapping are non-functional (won't open, no options visible).

## Fix

**File: `src/components/import-export/ImportWizard.tsx`** (line 251)

Change:
```tsx
<SelectItem value="">— Não mapear —</SelectItem>
```
To:
```tsx
<SelectItem value="__none__">— Não mapear —</SelectItem>
```

And update the `onValueChange` handler (line 248) to convert `__none__` back to empty string:
```tsx
onValueChange={(v) => setMapping(prev => ({ ...prev, [field.key]: v === '__none__' ? '' : v }))}
```

Also update the `value` prop to map empty string to `__none__`:
```tsx
value={mapping[field.key] || '__none__'}
```

This is a 3-line fix in a single file. The rest of the import flow (preview, validation, execution) is already working correctly — the only blocker was the broken Select preventing users from reaching those steps.

