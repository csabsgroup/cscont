
# Plan: Fix CSM Assignment, CSM Editability, and Date Formatting

## Issues Found

1. **CSM not assigned during import** — The CSM lookup (line 682) uses `ilike('%name%')` which works, but the problem is that `csm_id` gets deleted on line 745 when it's `null`. More critically, the lookup may fail due to accent normalization. Also need to verify the column header "CS" maps correctly to `csm_name`.

2. **CSM field not editable in 360** — Line 88 of `ClienteVisao360.tsx` renders CSM as read-only text. It should be a dropdown of available CSMs, editable by Admin and Manager.

3. **Date fields inconsistent formatting** — `Início do Ciclo` (line 108) passes raw ISO date `2026-01-01` to `InlineEditField`, which displays it as-is. `Fim do Ciclo` and `Data Churn` use `format()` but aren't editable. The `InlineEditField.formatDisplay` doesn't handle dates — just calls `String(value)`.

## Changes

### File 1: `src/components/shared/InlineEditField.tsx`
- Update `formatDisplay` to detect and format date fields: if `fieldType === 'date'` and value looks like ISO (`YYYY-MM-DD`), format as `dd/MM/yyyy`.

### File 2: `src/components/clientes/ClienteVisao360.tsx`
- **Make CSM editable**: Change the CSM field from static text to an editable dropdown. Fetch all CSM profiles (role = csm, manager, admin) on mount. Display as a `dropdown` type `InlineEditField` with `onSave` updating `offices.csm_id`. Only Admin/Manager can edit (controlled by `readOnly` prop).
- **Fix date display consistency**: For `Fim do Ciclo` and `Data Churn`, make them editable date fields (or at minimum, ensure they show formatted dates). Currently `Data Ativação` (line 94) is formatted but not editable. `Início do Ciclo` (line 108) is editable but raw ISO. Standardize: all date fields that are editable should pass the raw ISO value and let `InlineEditField` handle display formatting. Non-editable date fields should use `format()`.

### File 3: `src/components/import-export/ImportWizard.tsx`
- **Improve CSM matching**: Add accent-stripping normalization before the `ilike` query. Log when CSM is matched/not matched. Ensure the `csm_name` field correctly receives the "CS" column value.
- Keep `csm_id` in insertData even when null is removed — the real fix is better matching.

## Summary

| File | Changes |
|------|---------|
| `InlineEditField.tsx` | Format dates as `dd/MM/yyyy` in display mode |
| `ClienteVisao360.tsx` | Make CSM an editable dropdown, standardize all date fields to `dd/MM/yyyy` |
| `ImportWizard.tsx` | Improve CSM name matching with accent normalization |
