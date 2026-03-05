


# Plan: Piperun Full Data Extraction + Automation Conditional Fields Expansion

## Part 1: Piperun — Extract ALL data from deals, persons, organizations

### Edge Function `integration-piperun/index.ts`

**`listFields` action changes:**
- Current: fetches 1 deal via `GET /deals?show=1` and extracts flat fields
- New: fetch deal with expanded relations (`?with=person,organization`), AND make separate calls to `GET /persons?show=1` and `GET /organizations?show=1`
- Merge all fields with prefixes: `deal.*`, `person.*`, `organization.*`
- Deduplicate keys that appear in both the deal's nested objects and standalone endpoints

### `PiperunFieldPicker.tsx`

**Expand `FALLBACK_FIELDS`:**
- Add ~30+ common fields covering person (name, email, phones, city, state, CPF, birthday, social media), organization (name, CNPJ, segment, address, city, state, CEP, phone, website, employee_count), and deal metadata (value, monthly_value, custom fields, tags, notes, created/updated dates)
- Group fields visually by prefix in the picker UI (Deal, Pessoa, Organização)

### `PiperunConfig.tsx` field mapping
- No structural changes needed — the field picker already supports any key string, so expanded fields will work automatically in mappings

---

## Part 2: Automation Conditions — Expand with office, contact, contract and custom fields data

### `AutomationRulesTab.tsx` — `CONDITION_FIELDS` array

**New fields to add by category:**

**Escritório (offices):** `office_name` (contém/igual), `cep`, `endereco`, `cidade`, `estado`, `instagram`, `whatsapp`

**Contato:** `contact_name`, `contact_email`, `contact_phone`, `contact_whatsapp`, `contact_role_title`, `contact_cpf`, `contact_instagram`, `contact_type`
- Each contact field gets a sub-selector: "Contato principal" or "Qualquer contato" — stored as `contact_scope: 'main' | 'any'` in the condition object

**Contrato:** already has some fields; add `contract_start_date` (dias), `contract_end_date` (dias), `contract_renewal_date` (dias), `contract_product_id` (uuid select), `contract_negotiation_notes` (contém)

**Campos customizados:** dynamically loaded from `custom_fields` table at runtime. Each custom field becomes a condition option with type matching its `field_type`. Grouped under "Campos Personalizados" category.

### Condition UI changes

- Add a `contact_scope` selector (radio: "Principal" / "Qualquer") that appears when a contact-category field is selected
- For custom fields: fetch `custom_fields` on dialog open, convert each to a `ConditionFieldDef` dynamically, and append to the field list
- Custom field values use the appropriate operator set based on `field_type` (text → contains/equals, number → gt/lt/between, boolean → equals, date → days operators, select/multi-select → is_in)

### Backend: `execute-automations/index.ts`

- Expand the condition evaluation logic to resolve new field values:
  - Office fields: direct column access from `offices` table
  - Contact fields: query `contacts` table filtered by `office_id` with `is_main_contact` filter based on `contact_scope`
  - Contract fields: query `contracts` table by `office_id` (use active contract or latest)
  - Custom fields: query `custom_field_values` joined with `custom_fields` to get the typed value

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/integration-piperun/index.ts` | Expand `listFields` to fetch person + organization endpoints, merge results |
| `src/components/configuracoes/integrations/PiperunFieldPicker.tsx` | Expand `FALLBACK_FIELDS` to ~50 fields, add category grouping in UI |
| `src/components/configuracoes/AutomationRulesTab.tsx` | Add ~20 new condition fields, dynamic custom fields loader, contact_scope selector |
| `supabase/functions/execute-automations/index.ts` | Expand condition evaluation to resolve contact, contract, custom field values |

## No Database Changes Required
All tables (`offices`, `contacts`, `contracts`, `custom_fields`, `custom_field_values`) already exist with the necessary columns.
