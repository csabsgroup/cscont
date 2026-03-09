

# Plano: Otimizar syncAll contra rate limiting do Asaas (429)

## Problema

Os logs mostram centenas de erros **429 (Too Many Requests)** do Asaas. O batch de 5 requisições simultâneas dispara ~10 chamadas de API ao mesmo tempo (lookup CNPJ + payments), excedendo o rate limit do Asaas rapidamente. Resultado: 384 dos 449 escritórios falham.

## Correções no Edge Function `integration-asaas/index.ts`

### 1. Processamento sequencial com delay entre requests
- Trocar `Promise.allSettled` de batches de 5 por processamento **sequencial** (1 por vez)
- Adicionar `await delay(350ms)` entre cada chamada à API do Asaas (~170 req/min, seguro para o rate limit)

### 2. Retry com backoff em caso de 429
- Se receber 429, aguardar 5 segundos e tentar novamente (máximo 2 retries)
- Isso recupera de throttling temporário sem abortar

### 3. Priorizar escritórios com `asaas_customer_id` já cacheado
- Processar primeiro os que já têm ID (1 request cada)
- Depois os que precisam de lookup CNPJ (2 requests cada)
- Maximiza escritórios sincronizados antes do timeout

### 4. Timeout mais inteligente
- Manter o timeout de 50s mas retornar quantos foram processados vs pendentes
- Informar no response se foi interrompido por timeout

### Estrutura da função `asaasGet` com retry:
```text
asaasGet(path, retries=2)
  ├─ fetch → 200 OK → return data
  ├─ fetch → 429 → wait 5s → retry
  └─ fetch → other error → throw
```

### Estrutura do loop:
```text
1. Sort: offices with asaas_customer_id first
2. For each office (sequential):
   a. delay(350ms)
   b. If no customer_id → lookup CNPJ (+ delay 350ms)
   c. Fetch OVERDUE payments
   d. Update office
   e. Check timeout → break if needed
3. Return { synced, notFound, errors, total, timedOut }
```

## Arquivo a modificar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/integration-asaas/index.ts` | Retry com backoff, processamento sequencial com delay, priorização |

