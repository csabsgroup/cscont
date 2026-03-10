

# Redesign do Sync Asaas: Armazenamento Local + Sync Diário

## Problema Atual
O `syncAll` tem timeout de ~50s e só consegue processar ~81 escritórios. Com 1000+ escritórios, é impossível sincronizar tudo em uma única execução.

## Arquitetura Proposta

```text
┌─────────────────────────────────────────────────────┐
│                    SYNC FLOW                         │
│                                                      │
│  pg_cron (00:00)  ──►  integration-asaas             │
│       ou                  action: syncBatch           │
│  Botão manual            offset=0, batchSize=30       │
│                              │                        │
│                    ┌─────────▼──────────┐             │
│                    │ Processa 30 offices │             │
│                    │ Busca ALL payments  │             │
│                    │ Upsert asaas_payments│            │
│                    │ Atualiza offices     │            │
│                    └─────────┬──────────┘             │
│                              │                        │
│                    offset < total?                     │
│                    ├── Sim ──► auto-invoke próximo batch│
│                    └── Não ──► FIM (log resultado)     │
│                                                       │
│  ─────────────────────────────────────────────────── │
│                    READ FLOW                          │
│                                                       │
│  ClienteFinanceiro ──► SELECT asaas_payments          │
│  Financeiro page   ──► SELECT offices (totais)        │
│  (sem chamada API Asaas na leitura!)                  │
└─────────────────────────────────────────────────────┘
```

## Mudanças

### 1. Nova tabela `asaas_payments`
Armazena todas as parcelas localmente. Campos: `asaas_id` (unique), `office_id`, `value`, `net_value`, `due_date`, `payment_date`, `status`, `billing_type`, `description`, `invoice_url`, `bank_slip_url`, `synced_at`. RLS: leitura para offices visíveis, escrita só via service role.

### 2. Coluna `asaas_last_sync` em `offices`
Timestamp da última sincronização para exibir na UI e priorizar offices não sincronizados.

### 3. Edge Function `integration-asaas` -- nova action `syncBatch`
- Recebe `offset` e `batchSize` (default 30)
- Processa o batch: para cada office, busca TODOS os pagamentos (não só overdue) e faz upsert na tabela `asaas_payments`
- Atualiza `offices.installments_overdue`, `total_overdue_value` e `asaas_last_sync`
- Se ainda há offices pendentes, auto-invoca a própria function com `offset + batchSize` (via `fetch` para a URL da function, usando service role key)
- Retorna imediatamente para o chamador com status parcial

### 4. `syncAll` vira wrapper
Chama `syncBatch` com offset=0. O front recebe feedback imediato ("Sincronização iniciada") e não precisa esperar todos os batches.

### 5. `getFinancialByOffice` lê do banco local
Em vez de chamar a API Asaas, faz `SELECT * FROM asaas_payments WHERE office_id = X`. Mantém o mesmo formato de resposta para o frontend não precisar mudar.

### 6. `ClienteFinanceiro` -- sem mudanças de interface
O hook `useFinancialData` continua chamando `getFinancialByOffice`, mas agora a resposta vem do banco local (instantânea). O botão "Atualizar" dispara sync individual daquele office.

### 7. pg_cron -- sync diário às 00:00
Cron job que chama `syncBatch` com offset=0. A cadeia de auto-invocações processa todos os offices durante a madrugada.

### 8. Página Financeiro
- Adiciona indicador "Última sincronização: X" 
- Botão "Sincronizar" agora mostra "Sincronização iniciada" e não trava

### Arquivos afetados
- **Migration SQL**: criar tabela `asaas_payments`, coluna `asaas_last_sync`, RLS, índices
- **`supabase/functions/integration-asaas/index.ts`**: reescrever syncAll → syncBatch com auto-invocação; getFinancialByOffice lê do DB
- **`src/pages/Financeiro.tsx`**: feedback de sync assíncrono, mostrar última sync
- **`src/components/clientes/ClienteFinanceiro.tsx`**: ajustes mínimos (adicionar "última atualização")
- **pg_cron**: INSERT via insert tool (não migration)

