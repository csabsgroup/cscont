

# Plan: Change Trigger from "Won Deal" to "Signed Contract"

## Overview

Switch the Piperun integration trigger from "deal won" to "proposal signed". Remove all `status=won` filtering from webhook and manual import. Update UI instructions accordingly.

## File Changes

### 1. `supabase/functions/piperun-webhook/index.ts`

- **Remove** `isWonDeal` function (lines 18-31) and the status validation block (lines 253-260) that rejects non-won deals
- Replace with a log: `console.log('[PIPERUN-WEBHOOK] Accepting deal (trigger: proposta assinada)');`
- In signature fetch (lines 350-356), prefer signed signature: find `s.status === 'signed' || s.status === 'assinado'` first, fallback to `[0]`
- Update audit action from `piperun_webhook_import` to `piperun_contract_signed_import`

### 2. `supabase/functions/integration-piperun/index.ts`

- **`previewDeals`** (lines 651-683): Remove `&status=won` from the API path (line 655). Remove the code filter for won status (lines 659-662). Fetch deals from configured pipeline+stage without status filter.
- **`importDeals`** (lines 687-729): Same — remove `&status=won` from path (line 691) and the won filter (lines 694-697).
- **`listFields` sample** (line 616): Remove `&status=won` from sample deal path.
- In `fetchFullSourceData` (lines 274-281): When fetching signature, prefer signed ones: `sigs.find(s => s.status === 'signed' || s.status === 'assinado') || sigs[0]`

### 3. `src/components/configuracoes/integrations/PiperunConfig.tsx`

- **Line 260**: Change description from "importar deals ganhos" to "importar clientes quando o contrato for assinado"
- **Line 283**: Change label from "Etapa (deal ganho)" to "Etapa"
- **Line 382**: Change webhook description to "Configure no Piperun para importar automaticamente quando a proposta for assinada."
- **Line 400**: Change instruction from `"Oportunidade for ganha"` to `"Proposta for assinada"`
- **Line 495**: Change preview dialog description from "Deals ganhos" to "Deals no funil e etapa configurados"

## Technical Notes

- The pipeline_id and stage_id filters remain — they still constrain which deals are eligible
- The duplicate check (`piperun_deal_id`) remains unchanged
- All other validations (pipeline, stage, duplicate) are kept intact
- The signature data fetch is improved to prefer `signed`/`assinado` status

