

# Plan: Robust Import Normalization Layer

## Analysis of the Uploaded File

The `IMPORT_ELITE.xlsx` file has 55 columns. Current system auto-matches only ~15 of them. Key issues:

1. **NOME vs ESCRITÓRIO conflict**: File uses NOME for partner name and ESCRITÓRIO for company name. The `name` field alias "escritório" causes wrong mapping — office name should come from ESCRITÓRIO, not NOME.
2. **Missing template fields**: PRODUTO, ORIGEM, CICLO, NÚMERO DE SÓCIOS, DIAS PARA RENOVAÇÃO, EQUITY, health score sub-fields — none have template fields.
3. **Status validation too strict**: File has "ATIVO" (uppercase). The enum sanitizer lowercases it, but the existing alias set for status is narrow.
4. **Currency values rejected**: "R$ 23.880,00" is sanitized by `parseMoney` but the `validateRow` function runs `isNaN(Number(strVal))` which may fail on already-sanitized numeric values that got stringified.
5. **VALOR CONTRATO ATUAL / VALOR MENSALIDADE**: No aliases match these to any field.

## Changes

### File 1: `src/lib/import-templates.ts`

**Fix NOME/ESCRITÓRIO conflict**: Remove 'escritório' from `name` aliases. Add a new field `office_name_legal` that maps to `name` DB column with aliases `['escritório', 'escritorio', 'razão social', 'razao social', 'nome fantasia', 'nome da empresa', 'empresa']`. The existing `name` field keeps aliases like `'nome', 'nome_cliente', 'cliente'`.

Actually simpler: since in this file ESCRITÓRIO is the real office name and NOME is the partner, we should restructure — remove 'escritório'/'escritorio' from the `name` field aliases (keep 'nome', 'nome_cliente', etc.) and add them to a **new approach**: make `name` have aliases prioritizing company-name variants, and add a `partner_name` field for the contact name that auto-creates a linked contact.

**Revised approach** (less disruptive): Keep `name` as the office name field. Add 'escritório' as a **higher-priority** alias. Remove 'nome' from the `name` field aliases (since 'nome' in this context is the partner). Add a new field `contact_name` (key: `contact_name`, type: text) with aliases `['nome', 'nome_socio', 'nome_sócio', 'sócio', 'socio', 'contato', 'nome do contato', 'responsável', 'nome responsavel']` — during insert, if `contact_name` is present, auto-create a contact linked to the office.

**Add missing fields to offices template**:
- `contact_name` (text) — aliases: nome, sócio, contato, responsável, nome do contato
- `contact_email` (email) — aliases: email do sócio, email contato  
- `contact_phone` (text) — aliases: telefone do sócio
- `contact_birthday` (date) — aliases: data de nascimento, aniversário, nascimento
- `contact_cpf` (text) — aliases: cpf do sócio
- `num_socios` (number) — aliases: número de sócios, qtd sócios, socios
- `contract_value` (number) — aliases: valor contrato atual, valor do contrato, valor contrato
- `monthly_value` (number) — aliases: valor mensalidade, mensalidade, valor mensal, valor da parcela
- `origem` (text) — aliases: origem, origin, fonte, source
- `ciclo` (text) — aliases: ciclo, cycle
- `produto` (text) — aliases: produto, product, programa (maps to active_product_id via name lookup, replaces product_name field)

**Massively expand aliases** for all existing fields per user spec (add all Portuguese variations listed in the user's instructions).

**Fix `validateRow`**: 
- For `enum` type: if value doesn't match after lowercase, apply a status normalization map before rejecting. If still no match, default to first enum value (e.g. 'ativo') and log as warning instead of error.
- For `number` type: check if already a number (typeof === 'number') before stringifying.
- Remove overly strict validation — empty non-required fields should never error.

### File 2: `src/lib/import-sanitize.ts`

**Add status normalization**:
```typescript
export function normalizeStatus(val: string): string {
  const statusMap: Record<string, string> = {
    'ativo': 'ativo', 'active': 'ativo', 'sim': 'ativo',
    'churn': 'churn', 'cancelado': 'churn', 'cancelled': 'churn',
    'naorenovado': 'nao_renovado', 'naorenovou': 'nao_renovado',
    'naoiniciado': 'nao_iniciado', 'novo': 'nao_iniciado',
    'upsell': 'upsell', 'expansao': 'upsell',
    'bonuselite': 'bonus_elite', 'elite': 'bonus_elite',
    'pausado': 'pausado', 'paused': 'pausado', 'suspenso': 'pausado',
  };
  const norm = normalize(val);
  return statusMap[norm] || val.toLowerCase().trim();
}
```

**Add phone normalization with country code**: Strip leading 0, add 55 prefix if 10-11 digits.

**Update `sanitizeValue`**: Add `status` key handling calling `normalizeStatus`. Ensure numeric results from `parseMoney` stay as numbers (not stringified).

### File 3: `src/components/import-export/ImportWizard.tsx`

**In `insertRow` for offices**:
- Handle `contact_name`: if present, after inserting office, auto-create a contact with `contact_name`, `contact_email`, `contact_phone`, `contact_birthday`, `contact_cpf`.
- Handle `contract_value` / `monthly_value`: if present, auto-create a contract linked to the office with the product.
- Handle `produto` / `product_name` with fuzzy product matching (exact → contains → partial word).
- Handle `origem`, `ciclo` as notes or custom field values.

**In `handleValidate`**: Show normalization summary badge — "X campos auto-matchados, Y valores normalizados".

**Make validation more tolerant**: Status defaults to 'ativo', product not found = warning not error, empty optional fields = accepted as null.

## Summary

| File | Changes |
|------|---------|
| `src/lib/import-templates.ts` | Fix nome/escritório conflict, add ~8 new fields (contact_name, contact_email, contact_birthday, num_socios, contract_value, monthly_value, origem, produto), expand aliases massively, make validateRow more tolerant with status defaulting |
| `src/lib/import-sanitize.ts` | Add normalizeStatus(), improve phone normalization with country code, fix numeric handling |
| `src/components/import-export/ImportWizard.tsx` | Auto-create contacts from contact_name, fuzzy product matching, normalization summary UI, tolerant validation |

3 files modified. No database changes needed.

