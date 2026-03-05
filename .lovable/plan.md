

# Plan: Refactor Piperun Integration — Full API Support + Webhook

## Overview

Complete refactor of the Piperun edge function to use the correct API endpoints (`/companies` instead of `/organizations`, `?with=` parameter for expanded data), add a webhook edge function for real-time deal import, and update the config UI with webhook URL display and import preview.

## File Changes

### 1. `supabase/functions/integration-piperun/index.ts` — Full Rewrite

**Key structural changes:**

- **`piperunGet`**: Change auth header from `token` to `Token` (Piperun API convention). Add `?with=` support.
- **`listFields`**: Replace `organization.*` prefixes with `company.*` to match the real API. Add `signature.*` fields. Update field categories. Use `/deals?show=1&with=person,company,customFields` to get a sample deal with related data in one call. Fetch `/proposals?show=1` and `/customFields?entity=deal` separately.
- **`importDeals`**: 
  - Fetch deals with `?with=person,company,proposals,customFields,stage,pipeline,owner`
  - For each deal, if company/person not expanded, fetch separately via `/companies/{id}` and `/persons/{id}`
  - Fetch proposals via `?deal_id={id}` if not in `with`
  - Fetch signatures via `/signatures?proposal_id={id}`
  - Build unified `sourceData` object with `deal`, `company`, `person`, `proposal`, `signature` keys
  - Use `resolveNestedValue` (dot-path accessor) to apply mappings from the unified source
  - Download PDF from `signature.document_url` if mapped, upload to `office-files` bucket
  - Smart matching for product/status/csm (already exists, keep)
  - Add `previewDeals` action (new) that returns eligible deals without importing
- **New action `previewDeals`**: Same filter logic as importDeals but returns deal list (title, company, value, won_at) without creating anything — for the confirmation UI.
- **Extract `processAndCreateOffice`**: Shared function used by both `importDeals` and the webhook function. Takes `supabase`, `sourceData`, `mappings`, `dealId`, `userId` and handles: apply mappings → smart field resolution → insert office → insert contract → insert contacts → download PDF → trigger automations → audit log.

### 2. New: `supabase/functions/piperun-webhook/index.ts`

- `verify_jwt = false` (external webhook, no JWT)
- CORS headers
- POST only, parse body as deal JSON
- Validate: `status === 'won'`, pipeline/stage match config, not already imported
- Fetch related data via API if not in webhook payload (company, person, proposals, signatures)
- Build `sourceData`, call shared processing logic (duplicated inline since edge functions can't share code — copy the `processAndCreateOffice` logic)
- Return `{ success, office_id }` or `{ success: false, message }`

### 3. `supabase/config.toml`

Add:
```toml
[functions.piperun-webhook]
verify_jwt = false
```

### 4. `src/components/configuracoes/integrations/PiperunFieldPicker.tsx`

- Replace `organization.*` prefixes with `company.*` in `FIELD_CATEGORIES` and `FALLBACK_FIELDS`
- Add `🔏 Assinatura` category with prefix `signature.`
- Add signature fallback fields: `signature.status`, `signature.signed_at`, `signature.document_url`
- Update `getCategoryForField` for `company.` and `signature.` prefixes

### 5. `src/components/configuracoes/integrations/PiperunConfig.tsx`

- Update `DEFAULT_MAPPINGS` to use `company.*` instead of `organization.*` (e.g., `company.cnpj`)
- Add **webhook section** after the import button: displays the webhook URL (`https://{project_id}.supabase.co/functions/v1/piperun-webhook`), copy button, and setup instructions
- Add **import preview flow**: clicking "Importar agora" first calls `previewDeals` action, shows a dialog/table with eligible deals (title, company, value, date), then "Confirmar importação" executes the actual import

### 6. `src/components/configuracoes/integrations/PiperunConfig.tsx` — Default Mappings Update

Change `organization.cnpj` → `company.cnpj`, `organization.name` → `company.name`, etc. to match the real Piperun API entity names.

## Technical Notes

- Edge functions cannot import from each other, so the `processAndCreateOffice` logic will be duplicated between `integration-piperun` and `piperun-webhook`. This is unavoidable given the Lovable Cloud constraint of single-file edge functions.
- The webhook URL uses `VITE_SUPABASE_PROJECT_ID` env var in the frontend to construct the display URL.
- The Piperun API uses `Token` (capital T) as the auth header name — verify and fix in `piperunGet`.

