
Diagnóstico confirmado (com evidência):
- O webhook está chegando, mas a função retorna cedo por validação de status.
- Logs atuais mostram casos como `Received deal ... undefined` (status ausente) e payloads com wrapper viram `deal.id` indefinido.
- Testes diretos da função retornaram `success:false` com mensagem “Deal não é ganho, ignorando”.
- Não há escritórios com `piperun_deal_id`, nem trilha `piperun_*`, e a tabela `webhook_logs` ainda não existe.

Plano de correção (sem remover lógica existente):

1) Endurecer parsing + logs em `supabase/functions/piperun-webhook/index.ts`
- Adicionar logs detalhados em todas as etapas (método, chaves do body, snippet do JSON, validações, erros com stack).
- Implementar extração robusta do deal para formatos:
  - root, `body.data`, `body.deal`, array root, `body.data[]`.
- Se não extrair `deal.id`, retornar 400 com erro explícito.

2) Corrigir validação de status (webhook)
- Criar helper `isWonDeal(deal)` aceitando:
  - `won`, `ganho`, `ganha` (case-insensitive), `status_label === 'Ganho'`, `won === true`.
- Se status vier ausente, assumir ganho (conforme evento “oportunidade ganha”) e logar essa decisão.

3) Corrigir comparação de funil/etapa por tipo (webhook)
- Normalizar IDs com `String(...)` antes da comparação.
- Logar valores normalizados e motivo de mismatch.

4) Persistir payload bruto para debug (`webhook_logs`)
- Criar migração para tabela `public.webhook_logs` com:
  - `id`, `provider`, `payload`, `processed`, `error`, `created_at`.
- RLS:
  - INSERT apenas via service role (função já usa service role).
  - SELECT para admin (configuração de integrações é admin-only).
- Fluxo da função:
  - Inserir log bruto no início (`processed=false`).
  - Em sucesso: marcar `processed=true`, `error=null`.
  - Em falha: manter `processed=false` e preencher `error`.

5) Atualizar status “Último webhook” na configuração
- Em `src/components/configuracoes/integrations/PiperunConfig.tsx`:
  - Buscar últimos 10 `webhook_logs` do provider `piperun`.
  - Exibir tabela com data/hora, status (✅/❌), oportunidade e botão para ver JSON em modal.
  - Fazer fallback do indicador principal:
    - usar `config.last_webhook_at` se existir;
    - senão usar `created_at` do log mais recente (atende requisito de mudar após qualquer registro).

6) Aplicar mesma normalização no import manual (`supabase/functions/integration-piperun/index.ts`)
- Reutilizar helpers:
  - `normalizeId(value) => String(value ?? '')`
  - `isWonDeal(...)`
- Em `previewDeals` e `importDeals`:
  - manter filtro por query e reforçar filtro em código por:
    - pipeline (normalizado),
    - stage (normalizado),
    - status ganho (helper robusto).

7) Observabilidade e retorno amigável
- No `catch` do webhook: log completo (`message` + `stack`) e atualização do `webhook_logs.error`.
- Manter respostas JSON claras para diagnóstico sem quebrar o fluxo do Piperun.

Detalhes técnicos e validações finais:
- Arquivos impactados:
  - `supabase/functions/piperun-webhook/index.ts`
  - `supabase/functions/integration-piperun/index.ts`
  - `src/components/configuracoes/integrations/PiperunConfig.tsx`
  - nova migração SQL em `supabase/migrations/*_webhook_logs.sql`
- Verificação pós-implementação:
  - disparar payloads nos 5 formatos e confirmar criação do escritório;
  - validar mudança de status “Aguardando...” para “Último webhook...”;
  - confirmar lista de webhooks com JSON completo;
  - confirmar que import manual e preview respeitam os mesmos filtros normalizados.
