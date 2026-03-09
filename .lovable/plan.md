

# Plano: Integração Asaas por CNPJ + Aba Financeiro no Cliente 360

## Resumo

Atualizar a edge function `integration-asaas` com a action `getFinancialByOffice` que busca pelo CNPJ, criar o componente `ClienteFinanceiro` com cards de resumo + tabela paginada de cobranças, e adicionar a aba "Financeiro" no Cliente 360.

---

## 1 — Migration: colunas na tabela offices

A coluna `asaas_customer_id` já existe. Adicionar apenas as que faltam:

```sql
ALTER TABLE offices ADD COLUMN IF NOT EXISTS installments_overdue integer DEFAULT 0;
ALTER TABLE offices ADD COLUMN IF NOT EXISTS total_overdue_value numeric DEFAULT 0;
```

---

## 2 — Edge Function `integration-asaas/index.ts`

Adicionar ao handler existente:

- **`translateAsaasStatus()`** — função auxiliar de tradução pt-BR
- **Action `getFinancialByOffice`** — recebe `office_id`, busca CNPJ do escritório, normaliza para dígitos, busca customer no Asaas por `cpfCnpj`, cacheia `asaas_customer_id`, pagina todas as cobranças, classifica (paga/pendente/vencida/cancelada), calcula resumo, atualiza `installments_overdue` e `total_overdue_value` no offices, retorna tudo

Manter todas as actions existentes (`testConnection`, `searchCustomer`, `getPayments`, `syncAll`, `webhook`).

---

## 3 — Novo componente `ClienteFinanceiro.tsx`

### Hook interno `useFinancialData`
- Cache de 5 minutos via state (`lastFetch` timestamp)
- Botão "Atualizar" força refresh
- Loading com skeletons

### Layout
- 4 cards no topo: Pagas (verde), A Vencer (amarelo), Vencidas (vermelho), Inadimplência (vermelho escuro)
- Seção "Próxima parcela" e "Parcela mais atrasada" (destaques)
- Tabela paginada com filtros de status e período
- Colunas: Vencimento, Valor, Status (badge colorido), Pagamento, Dias atraso, Tipo, Ações (links boleto/fatura)
- Paginação usando `PaginationWithPageSize`

### Estados especiais
- Sem CNPJ: mensagem orientativa
- CNPJ não encontrado no Asaas: mensagem clara com o CNPJ
- Loading: skeleton shimmer

---

## 4 — Aba no Cliente360.tsx

- Adicionar `{ key: 'financeiro', label: 'Financeiro', icon: DollarSign }` no array `tabs360` (após "Contratos")
- Renderizar `<ClienteFinanceiro officeId={office.id} cnpj={office.cnpj} />` quando `activeTab === 'financeiro'`
- Import do ícone `DollarSign` do lucide-react

---

## Arquivos modificados

| Arquivo | Ação |
|---|---|
| `supabase/migrations/new` | Adicionar `installments_overdue` e `total_overdue_value` |
| `supabase/functions/integration-asaas/index.ts` | Adicionar action `getFinancialByOffice` + `translateAsaasStatus` |
| `src/components/clientes/ClienteFinanceiro.tsx` | **Novo** — aba completa com cards, filtros, tabela paginada |
| `src/pages/Cliente360.tsx` | Adicionar aba "Financeiro" nas tabs e renderização |

