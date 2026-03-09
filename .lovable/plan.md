

# Plano: Corrigir Financeiro, KPI 360 e Card Faturamento Total

## Problemas Identificados

### 1. Página Financeiro mostra poucos dados
A página lê `offices.installments_overdue` e `offices.total_overdue_value`, mas esses campos só são preenchidos quando alguém abre a aba Financeiro do cliente individual (que chama `getFinancialByOffice`) ou quando chega webhook. Escritórios que nunca foram consultados ficam com 0.

### 2. KPI "Parcelas em Atraso" no 360 mostra 0
Em `ClienteVisao360.tsx` linha 62: `const overdueInstallments = activeContract?.installments_overdue || 0` — ainda lê do **contrato** (campo legado), não do office. Além disso, o valor estimado usa `overdueInstallments * monthly_value` em vez do `total_overdue_value` real do Asaas.

### 3. Falta card "Faturamento Total" no Dashboard
Não existe. Precisa adicionar: soma de `contract.value` de todos os contratos ativos filtrados.

---

## Correções

### A — Página Financeiro: botão "Sincronizar Todos" + dados da tabela

**Arquivo:** `src/pages/Financeiro.tsx`
- Adicionar botão "Sincronizar Asaas" que chama `integration-asaas` com action `syncAll`
- Após sincronização, recarrega dados da tabela `offices`
- Manter leitura da tabela como está (rápido), com o botão para forçar atualização

### B — KPI Parcelas em Atraso no 360: ler do office + buscar Asaas ao abrir

**Arquivo:** `src/components/clientes/ClienteVisao360.tsx`
- Trocar `activeContract?.installments_overdue || 0` por `office.installments_overdue || 0`
- Trocar `overdueInstallments * monthly_value` por `office.total_overdue_value || 0`

**Arquivo:** `src/pages/Cliente360.tsx`
- Ao carregar a página, se `office.cnpj` existir, disparar chamada silenciosa a `integration-asaas` com action `getFinancialByOffice` para atualizar os campos do office. Isso garante que os KPIs reflitam dados atualizados do Asaas.

### C — Card "Faturamento Total" no Dashboard

**Arquivo:** `src/pages/Dashboard.tsx`
- Adicionar KPI `Faturamento Total` = `activeContracts.reduce((s, c) => s + (c.value || 0), 0)`
- Posicionar no grid de KPIs junto aos existentes (MRR, Variação MRR, etc.)

---

## Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `src/pages/Financeiro.tsx` | Botão "Sincronizar Asaas" + feedback |
| `src/components/clientes/ClienteVisao360.tsx` | Ler overdue do `office` em vez do `contract` |
| `src/pages/Cliente360.tsx` | Auto-sync Asaas ao abrir (silencioso) |
| `src/pages/Dashboard.tsx` | Novo card "Faturamento Total" |

