

# Plan: Fix Piperun Field Labels + Add Proposal/PDF Fields

## Problem Analysis

1. **Technical names shown instead of labels**: In `integration-piperun/index.ts` line 307, `extractFields` sets `label: fullKey` — so API-fetched fields display their raw key as the label (e.g., `person.name` instead of "Nome do contato").

2. **Missing categories**: No proposal or PDF/files fields exist in either the edge function or the fallback fields. Organization fields already exist in fallback but may not come through from the API with proper labels.

---

## Fix 1: Friendly Labels in Edge Function

Add a hardcoded `FIELD_LABELS` map (~60 entries) in the edge function covering deal, person, organization, and proposal keys. In `extractFields`, after building `fullKey`, look up the label from this map. Fallback: format the key by replacing underscores/dots with spaces and capitalizing.

**Change in `listFields` action** (line 300-311):
- Add `FIELD_LABELS` constant before the handler
- Change line 307 from `label: fullKey` to `label: FIELD_LABELS[fullKey] || formatKey(fullKey)`
- Add `formatKey` helper: split by `.` and `_`, capitalize first letter of each word

## Fix 2: Add Proposal Fields + PDF in Edge Function

In `listFields` action, after fetching organizations (line 343-350):
- Add a 4th try/catch block to fetch proposals: `GET /proposals?show=1`
- Extract fields with prefix `proposal.`
- Add static proposal and file fields if API fetch fails or returns empty

## Fix 3: Expand PiperunFieldPicker

### Update `FIELD_CATEGORIES` array:
Add two new categories:
```
{ label: '📄 Proposta', prefix: 'proposal.' }
{ label: '📎 Arquivos', prefix: 'file.' }
```

### Expand `FALLBACK_FIELDS`:
Add ~10 proposal fields:
- `proposal.number`, `proposal.value`, `proposal.status`, `proposal.sent_at`, `proposal.accepted_at`, `proposal.payment_conditions`, `proposal.items`, `proposal.validity`

Add 1 file field:
- `proposal.pdf_url` with label "PDF do contrato/proposta (baixar e salvar no 360)"

### Update category detection in `getCategoryForField`:
Add checks for `proposal.` prefix → Proposta category, and `file.` prefix → Arquivos category.

### Sticky group headers:
Add `sticky top-0 bg-background z-10` to the group header `<p>` element.

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/integration-piperun/index.ts` | Add `FIELD_LABELS` map + `formatKey` helper; update `extractFields` to use labels; add proposal fetch in `listFields` |
| `src/components/configuracoes/integrations/PiperunFieldPicker.tsx` | Add proposal + file categories and fallback fields; sticky headers; update category detection |

