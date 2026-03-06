

# Plan: MRR, Cycle Dates, and Inline Edit

## 1. Database Migration

Add `mrr` column to offices:
```sql
ALTER TABLE offices ADD COLUMN IF NOT EXISTS mrr numeric DEFAULT 0;
```

No other columns needed -- `last_nps`, `last_csat`, `last_meeting_date`, `last_meeting_type`, `cs_feeling`, `cycle_start_date`, `cycle_end_date`, `activation_date` already exist.

## 2. MRR Calculation (Ajuste 1)

### Utility function: `src/lib/mrr-helpers.ts`
```typescript
export function calculateMRR(contract: any): number {
  // Use monthly_value if set (installment_value equivalent)
  if (contract.monthly_value && contract.monthly_value > 0) return contract.monthly_value;
  // Fallback: total / 12
  if (contract.value) return contract.value / 12;
  return 0;
}
```

### Where to apply:
- **`ClienteContratos.tsx`**: After creating/editing a contract, recalculate MRR from the active contract and `UPDATE offices SET mrr = ...`
- **`integration-piperun/index.ts`**: After inserting a contract, calculate MRR and update the office
- **`Dashboard.tsx`**: Change MRR calculation from `c.monthly_value` to `o.mrr` (read from offices table directly). Also fix "Variação MRR" to compare actual MRR sums instead of client count deltas
- **`Financeiro.tsx`**, **`Relatorios.tsx`**: Same -- use `office.mrr` instead of `contract.monthly_value`
- **`ClienteHeader.tsx`**: MRR badge reads from `office.mrr`
- **`ClienteVisao360.tsx`**: MRR field reads from `office.mrr`

### Backfill: Edge function or one-time script
After migration, update all offices with active contracts:
```sql
UPDATE offices SET mrr = COALESCE(
  (SELECT c.monthly_value FROM contracts c WHERE c.office_id = offices.id AND c.status = 'ativo' ORDER BY created_at DESC LIMIT 1),
  (SELECT c.value / 12.0 FROM contracts c WHERE c.office_id = offices.id AND c.status = 'ativo' ORDER BY created_at DESC LIMIT 1),
  0
) WHERE id IN (SELECT DISTINCT office_id FROM contracts WHERE status = 'ativo');
```

## 3. Cycle Date Logic (Ajuste 2)

### Core logic function in `src/lib/mrr-helpers.ts`:
```typescript
export async function processContractDates(supabase, officeId, contract) {
  // Auto-calculate end_date = start_date + 12 months if missing
  // Update office.cycle_start_date = contract.start_date
  // Update office.cycle_end_date = start + 12 months
  // Set activation_date only if null (first contract)
  // Calculate and save MRR
}
```

### Apply in:
1. **`ClienteContratos.tsx`** -- after contract create/edit
2. **`integration-piperun/index.ts`** -- after contract insert (duplicate logic in edge function since can't import frontend utils)
3. **`ClienteVisao360.tsx`** -- mark `Fim do Ciclo`, `Data Ativação` as non-editable (already display-only)

## 4. Inline Edit Component (Ajuste 3)

### New file: `src/components/shared/InlineEditField.tsx`

A reusable component with props:
- `value`, `fieldType` (text/number/currency/date/phone/email/dropdown/textarea), `onSave`, `readOnly`, `label`, `options`, `mask`

Behavior:
- Display mode: shows value + pencil icon on hover
- Edit mode: inline input with check/X buttons
- Enter saves, Escape cancels, blur saves
- Flash green animation on success
- Currency formatting for money fields
- Dark mode compatible

### Integration in `ClienteVisao360.tsx`:

Replace static `<Card>` field rendering with `<InlineEditField>` for editable fields. Each field gets an `onSave` that calls `supabase.from('offices').update({[column]: value}).eq('id', office.id)`.

**Editable fields** (with their column mappings):
- Faturamento mensal → `offices.faturamento_mensal` (currency)
- Faturamento anual → `offices.faturamento_anual` (currency)
- Qtd clientes → `offices.qtd_clientes` (number)
- Qtd colaboradores → `offices.qtd_colaboradores` (number)
- CS Feeling → `offices.cs_feeling` (dropdown: Muito bom/Bom/Regular/Ruim/Muito ruim)
- Cidade → `offices.city` (text)
- Estado → `offices.state` (text)
- CNPJ → `offices.cnpj` (text)
- Email → `offices.email` (email)
- WhatsApp → `offices.whatsapp` (phone)
- Início do Ciclo → `offices.cycle_start_date` (date, auto-recalculates cycle_end_date)

**Non-editable fields** (no pencil icon): Health Score, MRR, LTV, Fim do Ciclo, Data Ativação, Data Churn, Dias Renovação, Tempo de Vida, Ciclos, OKR %, Cobertura, NPS/CSAT, Parcelas vencidas.

**Permissions**: `readOnly` prop is `true` for Viewer/Client roles.

The `ClienteVisao360` component needs a new `onFieldSaved` callback prop (or just calls `fetchAll` from parent) to refresh data after inline edits.

### Pass refresh callback:
- `Cliente360.tsx`: Pass `onRefresh={fetchAll}` to `ClienteVisao360`

## Files to Create/Modify

| File | Action |
|------|--------|
| Database migration | Add `mrr` column + backfill |
| `src/lib/mrr-helpers.ts` | Create -- MRR calc + processContractDates |
| `src/components/shared/InlineEditField.tsx` | Create |
| `src/components/clientes/ClienteVisao360.tsx` | Rewrite with inline edit fields |
| `src/pages/Cliente360.tsx` | Pass onRefresh prop |
| `src/components/clientes/ClienteHeader.tsx` | Read MRR from office.mrr |
| `src/components/clientes/ClienteContratos.tsx` | Call processContractDates after create/edit |
| `src/pages/Dashboard.tsx` | Use office.mrr for MRR calculations |
| `supabase/functions/integration-piperun/index.ts` | Add MRR calc + cycle date logic after contract insert |

