

# Plano: Inadimplência baseada exclusivamente no Asaas

## Problema identificado

O sistema tem **duas fontes de verdade** para inadimplência:
1. `contracts.installments_overdue` — campo manual editável no formulário de contrato
2. `offices.installments_overdue` / `offices.total_overdue_value` — sincronizados do Asaas pela edge function

Todos os indicadores do sistema (Dashboard, Relatórios, Health Score, Jornada, lista de Clientes, Header 360) leem de `contracts.installments_overdue` (manual), não do Asaas. Isso explica a divergência de "2 parcelas vencidas no CRM vs 1 no Asaas".

Além disso, a edge function classifica como "overdue" por lógica de data (`dueDate < today`), sem considerar que cobranças excluídas/removidas no Asaas têm status `DELETED`.

---

## Correções

### 1 — Edge Function: tratar status DELETED do Asaas

Na classificação de parcelas, adicionar `DELETED` como status cancelado/excluído:

```
isCancelled → incluir "DELETED" na lista
Adicionar isDeleted separadamente para exibição
translateAsaasStatus: DELETED → "Excluída"
```

Inadimplência = **APENAS** parcelas com `status === "OVERDUE"` do próprio Asaas, não por lógica de data. Isso garante que se o Asaas marca como OVERDUE, é overdue; se excluiu, não conta.

### 2 — Unificar fonte de verdade: offices como fonte do Asaas

Todos os componentes que mostram inadimplência passam a ler de `offices.installments_overdue` e `offices.total_overdue_value` (escritos pelo Asaas), em vez de `contracts.installments_overdue`.

**Arquivos afetados:**

| Arquivo | Mudança |
|---|---|
| `supabase/functions/integration-asaas/index.ts` | Usar `p.status === "OVERDUE"` do Asaas em vez de lógica de data; tratar `DELETED` |
| `supabase/functions/calculate-health-score/index.ts` | Ler `offices.installments_overdue` em vez de `contracts.installments_overdue` |
| `src/pages/Financeiro.tsx` | Ler de `offices.installments_overdue` e `offices.total_overdue_value` |
| `src/pages/Relatorios.tsx` | Inadimplência usa `offices` ao invés de `contracts.installments_overdue` |
| `src/pages/Clientes.tsx` | Mapa de overdue usa `offices.installments_overdue` |
| `src/pages/Jornada.tsx` | Idem |
| `src/components/clientes/ClienteHeader.tsx` | Ler de office em vez de contract |
| `src/components/clientes/ClienteMetricas.tsx` | Idem |
| `src/components/clientes/ClienteContratos.tsx` | Remover campo manual "Parcelas Vencidas" do formulário (agora vem do Asaas) |
| `src/components/jornada/JornadaTableView.tsx` | Ler de office |
| `src/pages/portal/PortalContrato.tsx` | Ler de office |
| `src/components/clientes/ClienteFinanceiro.tsx` | Filtro "excluídas" no dropdown de status |

### 3 — Lógica de classificação refinada na Edge Function

```
// ANTES (errado): isOverdue por data
const isOverdue = !isPaid && !isCancelled && p.dueDate < today;

// DEPOIS (correto): isOverdue pelo status do Asaas
const isOverdue = p.status === "OVERDUE";
const isDeleted = p.status === "DELETED";
// isPending: PENDING + AWAITING_RISK_ANALYSIS + cobranças não-pagas não-vencidas
```

Isso garante que:
- Cobrança excluída no Asaas → aparece como "Excluída" no CRM
- Cobrança com status OVERDUE no Asaas = inadimplente
- Nenhuma lógica local de data sobrescreve o status do Asaas

