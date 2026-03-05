

# Plan: Fix Field Paths to Match Real Piperun JSON Structure

## Problem
The webhook creates offices with empty fields because the field paths in mappings (e.g., `person.email`, `company.address`, `proposal.value`) don't match the real Piperun JSON structure (e.g., `person.contact_emails[0].address`, `company.address.street`, `proposals[0].value`). Additionally, `resolveNestedValue` doesn't support array access (`[0]`), `.length`, or custom field lookups.

## Changes

### 1. Fix `resolveNestedValue` in both edge functions

Replace the simple dot-split reducer with a robust resolver that handles:
- Array index access: `proposals[0].value` → `source.proposals[0].value`
- `.length` on arrays: `proposals[0].parcels.length` → count
- Custom fields: `fields.find.{id}` → searches `source.fields` array for `{id: N}` and returns `.valor`

Applies to: `piperun-webhook/index.ts` (line 52-54) and `integration-piperun/index.ts` (line 68-70)

### 2. Fix `sourceData` construction in webhook

Currently wraps deal data under `{ deal: {...}, company: ..., person: ..., proposal: (single), signature: ... }`. The real JSON has `proposals` as an array and `fields` as an array on the deal. Change to:
- Keep `proposals` as the full array (not just first one as `proposal`)
- Keep `fields` from the deal root
- Keep `action` from body for trigger metadata
- Also keep `proposal` and `signature` for backward compat

In `piperun-webhook/index.ts` (lines 340-353): restructure sourceData to include `proposals: deal.proposals || []`, `fields: deal.fields || []`, `action: body.action || {}`

In `integration-piperun/index.ts` `fetchFullSourceData` (lines 284-304): same restructure

### 3. Update field paths in `listFields` (integration-piperun, lines 514-647)

Replace all static field definitions with paths matching the real API:

**Deal fields** — change:
- `deal.owner.name` → `user.name`, `deal.owner.email` → `user.email`
- `deal.stage.name` → `stage.name`, `deal.pipeline.name` → `pipeline.name`
- Remove `deal.` prefix for root deal fields: `deal.title` → `title`, `deal.value` → `value`, etc.
- Add `city.name`, `city.uf`, `observation`

**Company fields** — change:
- `company.corporate_name` → `company.company_name`
- `company.phone` → `company.contact_phones[0].number`
- `company.email` → `company.contact_emails[0].address`
- `company.address` → `company.address.street` + add `company.address.number`, `.district`, `.complement`, `.postal_code`
- `company.state.abbr` → `company.city.uf`
- `company.zip_code` → `company.address.postal_code`
- Add `company.cnae`, `company.open_at`

**Person fields** — change:
- `person.email` → `person.contact_emails[0].address`
- `person.phone` → `person.contact_phones[0].number`
- `person.cell_phone` → remove (same as phone)
- `person.birth_date` → `person.birth_day`
- `person.position` → `person.job_title`
- `person.state.abbr` → `person.city.uf`
- `person.whatsapp`/`person.instagram` → `person.contact_phones[0].number` (same field)
- Add `person.address.street`, `person.address.postal_code`

**Proposal fields** — change all `proposal.*` to `proposals[0].*`:
- `proposal.value` → `proposals[0].value`
- Add `proposals[0].items[0].name`, `proposals[0].items[0].code`, `proposals[0].parcels.length`, `proposals[0].parcels[0].value`, `proposals[0].parcels[0].due_date`, `proposals[0].user.name`

**Signature** — keep `signature.*` but also add `action.trigger_type`, `action.create`

**Custom fields** — change `deal.custom.{id}` to `fields.find.{id}`

### 4. Update `FALLBACK_FIELDS` in PiperunFieldPicker.tsx

Mirror the same path changes from step 3. Update all keys and example values.

### 5. Update `DEFAULT_MAPPINGS` in PiperunConfig.tsx (lines 88-99)

Change to use correct paths:
- `deal.title` → `title`
- `person.email` → `person.contact_emails[0].address`
- `person.phone` → `person.contact_phones[0].number`
- `company.state.abbr` → `company.city.uf`
- `deal.value` → `proposals[0].value`
- Add `proposals[0].items[0].name` → `offices.active_product_id`

### 6. Improve product matching (smart field for `active_product_id`)

In `resolveSmartField` for `offices.active_product_id` in both edge functions: use CONTAINS matching instead of exact `ilike`. Fetch all products, then find one whose name is contained in (or contains) the raw value string.

### 7. Update `getCategoryForField` in PiperunFieldPicker

Add handling for paths that start with `proposals` or `fields.find.` or `action.` prefixes. Update `FIELD_CATEGORIES` to include proposals category.

## Files Modified
- `supabase/functions/piperun-webhook/index.ts`
- `supabase/functions/integration-piperun/index.ts`
- `src/components/configuracoes/integrations/PiperunFieldPicker.tsx`
- `src/components/configuracoes/integrations/PiperunConfig.tsx`

