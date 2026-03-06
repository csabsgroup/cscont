

# Plan: Improve Import Column Matching + Add Data Normalization

## Problem 1: Columns Not Being Identified

The `autoMapColumns` function only matches on exact `key`, `label`, and `dbColumn` values, plus basic fuzzy matching. It fails when the user's CSV has:
- Common Portuguese names: "Nome", "Telefone", "Cidade", "Estado", "Endereço"
- Accented characters: "Código", "Razão Social", "Observações"
- Common synonyms: "razao_social" for name, "telefone" for phone, "nome_empresa" for name
- Mixed case: "CNPJ", "CEP", "Nome Do Cliente"

**Fix:** Add an `aliases` array to each `ImportField` with all common variations. Enhance `autoMapColumns` to strip accents, normalize separators, and match against aliases.

## Problem 2: No Data Normalization

Raw data enters the system as-is. Need sanitization masks for:
- **CPF**: Strip non-digits, format as `XXX.XXX.XXX-XX`
- **CNPJ**: Strip non-digits, format as `XX.XXX.XXX/XXXX-XX`
- **Phone/WhatsApp**: Strip non-digits, ensure country code, format consistently
- **CEP**: Strip non-digits, format as `XXXXX-XXX`
- **Monetary values**: Handle `R$ 1.500,00` or `1500.00` → numeric
- **Text names**: Trim whitespace, title case
- **State**: Uppercase, validate 2-letter code
- **Email**: Trim, lowercase
- **Dates**: Handle multiple formats (DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, DD.MM.YYYY)

---

## Implementation

### File 1: `src/lib/import-templates.ts`

**Add `aliases` to ImportField interface:**
```typescript
export interface ImportField {
  // ... existing fields
  aliases?: string[]; // additional column name variations for auto-mapping
}
```

**Add aliases to every field** in `offices`, `contacts`, `contracts`, `meetings`, `nps_csat` templates. Examples:
- `name`: aliases `['nome', 'nome_empresa', 'razao_social', 'razão social', 'empresa', 'cliente', 'nome_cliente', 'nome do cliente']`
- `phone`: aliases `['telefone', 'fone', 'tel', 'phone']`
- `city`: aliases `['cidade', 'municipio', 'município']`
- `cnpj`: aliases `['cnpj', 'cnpj_cpf']`
- `cpf`: aliases `['cpf', 'documento']`
- etc.

**Enhance `autoMapColumns`:** Add accent stripping (`normalizeAccents`), match against `field.aliases`, and use broader fuzzy logic.

**Add `sanitizeValue` function** that normalizes data by field type before insert:
```typescript
export function sanitizeValue(val: any, field: ImportField): any
```
Handles: CPF/CNPJ digit extraction, phone cleanup, CEP formatting, monetary parsing (`R$ 1.500,00` → `1500`), email lowercase, text trimming, state uppercase, enhanced date parsing.

### File 2: `src/components/import-export/ImportWizard.tsx`

**In `getMappedRows`:** Apply `sanitizeValue` to each field value after mapping.

**In preview:** Show sanitized values so user sees the normalized data before confirming.

---

## Changes Summary

| File | Change |
|------|--------|
| `src/lib/import-templates.ts` | Add `aliases` to all fields, enhance `autoMapColumns` with accent normalization + alias matching, add `sanitizeValue` function |
| `src/components/import-export/ImportWizard.tsx` | Call `sanitizeValue` in `getMappedRows` so preview + insert use normalized data |

2 files edited. No database changes needed.

