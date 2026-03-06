

# Fix: Piperun Manual Import Missing Nested Fields

## Root Cause

The `fetchFullSourceData` function calls `/companies/{id}` and `/persons/{id}` without the `?with=` parameter. Piperun's API returns only flat fields (name, cnpj, cpf) from these endpoints. Nested objects like `city`, `contact_phones`, `contact_emails`, `address`, and `segment` are returned as IDs (e.g. `city_id: 123`) instead of expanded objects (e.g. `city: { name: "São Paulo", uf: "SP" }`).

**Evidence from logs:**
- `Full company fetched: MATHEUS LEME DE OLIVEIRA SILVA city: undefined`
- `Full person fetched: Matheus Leme de Oliveira Silva emails: undefined`
- CNPJ and name populated correctly (flat fields) — only nested fields are missing.

**DB confirms:** Office has `cnpj` filled but `city`, `state`, `cep`, `address`, `email`, `whatsapp` are all null.

## Fix

**File:** `supabase/functions/integration-piperun/index.ts`

**Lines 302 and 318:** Add `?with=` to the dedicated endpoint calls:

```typescript
// Line 302: Company endpoint
const companyRes = await piperunGet(`/companies/${companyId}?with=city,address,contact_phones,contact_emails,segment`, token);

// Line 318: Person endpoint  
const personRes = await piperunGet(`/persons/${personId}?with=city,address,contact_phones,contact_emails`, token);
```

**Also fix `supabase/functions/piperun-webhook/index.ts`** (same issue, lines 344 and 352):

```typescript
// Line 344: Company
const res = await piperunGet(`/companies/${deal.company_id}?with=city,address,contact_phones,contact_emails,segment`, token);

// Line 352: Person
const res = await piperunGet(`/persons/${deal.person_id}?with=city,address,contact_phones,contact_emails`, token);
```

Two lines changed per file. No logic changes needed — the mapping resolution and data structure remain identical.

