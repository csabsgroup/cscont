

# Plan: Expandir Ações do Motor de Automação v2

## Resumo
Adicionar 5 novos tipos de ação ao editor de automações v2 (`AutomationRulesTab.tsx`), além dos 6 já existentes. Também atualizar a edge function `execute-automations` para executar as novas ações.

## Ações Existentes (já implementadas)
1. `create_activity` — Criar Atividade
2. `send_notification` — Enviar Notificação
3. `send_email` — Enviar Email
4. `move_journey_stage` — Mover Etapa da Jornada
5. `change_status` — Alterar Status
6. `create_action_plan` — Criar Plano de Ação

## Novas Ações a Adicionar

### 1. `change_csm` — Alterar CSM Responsável
- Config UI: Select com 3 métodos (Fixo, Menor carteira, Round-robin)
  - **Fixo**: mostra select de CSMs
  - **Menor carteira**: mostra multi-select de CSMs elegíveis
  - **Round-robin**: mostra multi-select de CSMs elegíveis
- Execução: atualiza `offices.csm_id`

### 2. `create_contract` — Criar Contrato
- Config UI: campos completos — produto (select), valor, valor mensal, data início, data fim, data renovação, status inicial (select: ativo/pendente)
- Execução: insere na tabela `contracts`

### 3. `cancel_contract` — Cancelar/Encerrar Contrato
- Config UI: select de ação (cancelar ou encerrar), select de produto alvo (para identificar qual contrato)
- Execução: atualiza `contracts.status` para `cancelado` ou `encerrado` + seta `end_date`

### 4. `set_product` — Definir Jornada (Produto)
- Config UI: select de produto destino
- Execução: atualiza `offices.active_product_id` e insere/atualiza `office_journey` na primeira etapa do produto

### 5. `add_note` — Adicionar Nota na Timeline
- Config UI: textarea com texto da nota, select de tipo (observação, ponto de atenção)
- Execução: insere na tabela `office_notes` (ou campo equivalente de timeline)

### 6. `grant_bonus` — Conceder Bônus
- Config UI: select de item do catálogo (`bonus_catalog`), quantidade, validade (dias)
- Execução: insere na tabela `bonus_grants`

## Arquivos Alterados

### `src/components/configuracoes/AutomationRulesTab.tsx`
- Expandir array `ACTION_TYPES` com os 6 novos tipos
- Adicionar cases no `renderActionConfig` para cada nova ação com seus campos de configuração
- Buscar dados adicionais no `fetchRefData`: `bonus_catalog`

### `supabase/functions/execute-automations/index.ts`
- Adicionar handlers para cada novo `action.type` dentro dos blocos de execução de regras v2
- `change_csm`: lógica de distribuição (fixo/menor carteira/round-robin)
- `create_contract`: insert na tabela contracts
- `cancel_contract`: update status do contrato
- `set_product`: update active_product_id + upsert office_journey
- `add_note`: insert em tabela de notas (verificar se existe `office_notes`)
- `grant_bonus`: insert em bonus_grants

### Verificação necessária (na implementação)
- Confirmar existência de tabela de notas/timeline para a ação `add_note`
- Se não existir, criar migração para `office_notes`

## Sem Mudanças de Schema
As tabelas `contracts`, `bonus_grants`, `offices`, `office_journey` já existem. Apenas precisamos verificar a tabela de notas.

