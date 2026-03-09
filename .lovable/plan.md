

# Plano: Corrigir syncAll para resolver CNPJ → Asaas Customer ID

## Problema

- 449 escritórios têm CNPJ cadastrado
- Apenas 4 têm `asaas_customer_id` preenchido
- `syncAll` filtra `WHERE asaas_customer_id IS NOT NULL` — resultado: só sincroniza 4 escritórios
- Os outros 445 nunca são consultados no Asaas, ficam com `installments_overdue = 0`

## Correção

### Edge Function `integration-asaas/index.ts` — action `syncAll`

Reescrever o `syncAll` para:

1. Buscar todos os escritórios com CNPJ (não apenas os que já têm `asaas_customer_id`)
2. Para cada escritório sem `asaas_customer_id`, fazer lookup por CNPJ na API do Asaas (`/customers?cpfCnpj=...`)
3. Cachear o `asaas_customer_id` encontrado
4. Buscar pagamentos OVERDUE e atualizar `installments_overdue` + `total_overdue_value`
5. Se o escritório não for encontrado no Asaas, pular silenciosamente (sem erro)
6. Processar em batches para evitar timeout da edge function (limite de 60s)
7. Retornar contadores: `{ synced, notFound, errors, total }`

```text
syncAll flow:
┌─────────────────────────────────┐
│ SELECT offices WHERE cnpj != '' │
└──────────────┬──────────────────┘
               │
     ┌─────────▼─────────┐
     │ Has asaas_customer_id? │
     └──┬────────────┬────┘
       YES          NO
        │            │
        │    ┌───────▼────────┐
        │    │ GET /customers  │
        │    │ ?cpfCnpj=...   │
        │    └───────┬────────┘
        │            │
        │    ┌───────▼────────┐
        │    │ Cache customer  │
        │    │ id in offices   │
        │    └───────┬────────┘
        │            │
     ┌──▼────────────▼──┐
     │ GET /payments     │
     │ ?customer=X       │
     │ &status=OVERDUE   │
     └──────────┬───────┘
                │
     ┌──────────▼───────┐
     │ UPDATE offices    │
     │ installments_overdue │
     │ total_overdue_value  │
     └──────────────────┘
```

### Consideração de performance

- 449 escritórios × 2 chamadas API (lookup + payments) = até 898 requests
- Edge functions têm timeout de ~60s
- Solução: processar concorrentemente em batches de 5, com early-exit se próximo do timeout
- Retornar quantos foram processados para o frontend mostrar progresso

### Arquivo: `src/pages/Financeiro.tsx`

- Melhorar feedback do botão "Sincronizar Asaas" para mostrar resultado detalhado: `X sincronizados, Y não encontrados no Asaas`

## Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/integration-asaas/index.ts` | Reescrever `syncAll` para incluir lookup por CNPJ |
| `src/pages/Financeiro.tsx` | Melhorar feedback da sincronização |

