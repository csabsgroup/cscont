

# Diagnosis: Manual Import Not Filling Fields

## Root Cause

The bug is in `fetchFullSourceData()` (line 293-343 of `integration-piperun/index.ts`).

The function fetches the deal with `?with=person,company,proposals,...` which returns **shallow** company and person objects — they have `id`, `name`, `cnpj` but are **missing nested relations** like `city`, `address`, `contact_phones[]`, `contact_emails[]`.

Since the shallow `dealData.company` is truthy, the fallback fetch to `/companies/{id}` (which returns the FULL company with all nested data) is **skipped**:

```javascript
// Line 298-303: this check FAILS because company exists (but is shallow)
let companyData = dealData.company;
if (!companyData && dealData.company_id) {  // ← never enters here
  const companyRes = await piperunGet(`/companies/${dealData.company_id}`, token);
  companyData = companyRes.data || companyRes;  // ← full data never fetched
}
```

Same problem for `person` — the shallow person has `name` and `cpf` but no `contact_emails[]` or `contact_phones[]`.

**Evidence from DB:** The office has `cnpj` filled (top-level company field) and `name` from deal title, but `city`, `state`, `cep`, `email`, `whatsapp` are all null — these all come from nested paths like `company.city.name`, `person.contact_emails[0].address`.

The webhook worked differently because it received the deal payload directly (without `?with=` shallow objects), so the fallback API calls to `/companies/{id}` and `/persons/{id}` actually ran.

## Fix

**File:** `supabase/functions/integration-piperun/index.ts`

**Change in `fetchFullSourceData` (lines 297-313):** Always fetch company and person from their dedicated API endpoints, regardless of what `?with=` returned. The `?with=` data is unreliable for nested relations.

```javascript
// ALWAYS fetch full company from dedicated endpoint
let companyData = null;
const companyId = dealData.company_id || dealData.company?.id;
if (companyId) {
  try {
    const companyRes = await piperunGet(`/companies/${companyId}`, token);
    companyData = companyRes.data || companyRes;
  } catch (e) { 
    companyData = dealData.company || {};
  }
} else {
  companyData = dealData.company || {};
}

// ALWAYS fetch full person from dedicated endpoint
let personData = null;
const personId = dealData.person_id || dealData.person?.id;
if (personId) {
  try {
    const personRes = await piperunGet(`/persons/${personId}`, token);
    personData = personRes.data || personRes;
  } catch (e) {
    personData = dealData.person || {};
  }
} else {
  personData = dealData.person || {};
}
```

This ensures company and person always have full nested data (city, address, contact_phones, contact_emails) regardless of what the `?with=` query returned.

No other changes needed — the mapping logic and `processAndCreateOffice` are correct; the problem is purely that the source data is incomplete.

