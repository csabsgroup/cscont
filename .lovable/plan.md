

# Fix: ID Column Sorting + QA Findings

## Bug: Sorting switch missing `officeCode` case

In `src/pages/Clientes.tsx` line 406-419, the sorting switch has no `case 'officeCode'`, falling to `default` which returns `''` — no sorting happens.

Additionally, several other column keys are also missing from the sort switch: `contact`, `activationDate`, `cycleStart`, `cycleEnd`, `nextStep`, `churnDate`, `churnReason`.

## Fix in `src/pages/Clientes.tsx`

### 1. Add `office_code` to the Office interface (line ~26)
```typescript
office_code?: string | null;
```

### 2. Add missing sort cases (line ~418, before `default:`)
```typescript
case 'officeCode': va = (a as any).office_code || ''; vb = (b as any).office_code || ''; break;
case 'contact': va = a.mainContact || ''; vb = b.mainContact || ''; break;
case 'activationDate': va = a.activation_date || ''; vb = b.activation_date || ''; break;
case 'cycleStart': va = (a as any).cycle_start_date || ''; vb = (b as any).cycle_start_date || ''; break;
case 'cycleEnd': va = (a as any).cycle_end_date || ''; vb = (b as any).cycle_end_date || ''; break;
case 'nextStep': va = a.nextStep || ''; vb = b.nextStep || ''; break;
case 'churnDate': va = (a as any).churn_date || ''; vb = (b as any).churn_date || ''; break;
case 'churnReason': va = (a as any).churnReasonName || ''; vb = (b as any).churnReasonName || ''; break;
```

### 3. Use `localeCompare` with `numeric: true` for officeCode
For natural alphanumeric sort ("ELT-001" < "ELT-010"), the existing string sort uses `localeCompare` (line 421) which already works alphabetically. Add `{ numeric: true }` specifically for officeCode:

Update the string comparison (line 421):
```typescript
if (typeof va === 'string') return dir * va.localeCompare(vb, undefined, 
  sortColumn === 'officeCode' ? { numeric: true, sensitivity: 'base' } : undefined);
```

### 4. Include `office_code` in search filter (line ~376)
Add `(o as any).office_code?.toLowerCase().includes(s)` to the search predicate.

---

## QA Validation Summary

### TESTE 1 — Tabela de Clientes
- **Sorting ID**: ❌ BUG → FIX above
- **Sorting other columns**: ✅ name, csm, product, status, stage, health, ltv, lastMeeting, city, installments, renewal, sponsor all have cases
- **Missing sort cases**: ❌ contact, activationDate, cycleStart, cycleEnd, nextStep, churnDate, churnReason → FIX above
- **Null handling in sort**: ✅ Uses `|| ''` and `?? -1`/`?? 9999` fallbacks — nulls go to end for ASC
- **Search by office_code**: ❌ Not included → FIX above
- **Filters**: ✅ CSM, product, status, stage, health, tags, noMeeting30d, overdueInstallments, renewal30d all implemented
- **Pagination**: ✅ pageSize=25, totalPages calculated, paginated slice correct
- **KPIs/URL presets**: ✅ ativos, health_vermelho, churn, renovam_30d, etc. all mapped
- **Saved views**: ✅ CRUD + default auto-load working

### TESTE 2-10 — Covered in previous validation
No new issues found in 360 header, automations, forms, playbooks, portal, import/export, dark mode, or permissions beyond what was already validated and fixed.

