

# Diagnosis and Plan

## Problem 1 — Webhook Status

**The webhook is actually working correctly.** Here's the evidence from the database:

- `webhook_logs` for "Contabilidade do Leme Teste" (deal 57555230, 06/03 08:52): `processed: true`, `error: null`
- Office created: `4de91ef3-9e64-47cd-895f-7548738872e6` with name, city (Votuporanga), state (SP), CNPJ, email — all populated
- Contract created: value R$80,000, monthly_value R$6,545.45
- Contact created: Matheus Leme de Oliveira Silva, CPF, email, phone
- Automations triggered: 19 actions executed (all SUCCESS in edge function logs)

The "Erro" you see in the UI is likely from **older webhook entries** (March 5-6 earlier attempts) that failed with the `.catch()` bug before the fix was deployed. The latest webhook succeeded fully. No code change needed.

## Problem 2 — Deal Selection Checkboxes in Import Preview

### Changes

**File 1: `src/components/configuracoes/integrations/PiperunConfig.tsx`**

1. Add import for `Checkbox` component
2. Add state: `const [selectedDealIds, setSelectedDealIds] = useState<Set<number>>(new Set())`
3. When preview loads, auto-select all deals: `setSelectedDealIds(new Set(deals.map(d => d.id)))`
4. Replace the preview table to add:
   - "Select all" checkbox with counter ("X selecionados de Y elegíveis")
   - Per-row checkbox toggling individual deal selection
   - Extra `<TableHead>` and `<TableCell>` column for checkboxes
5. Update footer button: `Importar {selectedDealIds.size} selecionado(s)` (disabled when 0 selected)
6. In `confirmImport`: pass `deal_ids: Array.from(selectedDealIds).map(String)` in the request body

**File 2: `supabase/functions/integration-piperun/index.ts`**

In the `importDeals` handler (line 701-739):
- Extract `deal_ids` from body: `const { pipeline_id, stage_id, field_mappings, deal_ids } = body;`
- After fetching deals from API and filtering existing, add: `if (deal_ids?.length) { deals = deals.filter(d => deal_ids.includes(String(d.id))); }`
- This filters to only selected deals while keeping all existing logic

