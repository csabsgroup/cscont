

# Auditoria de Qualidade: Bugs e Inconsistências Identificadas

## Resumo Executivo

Após inspeção profunda de front-end, back-end (edge functions), RLS e fluxo de dados, foram encontrados **7 bugs concretos** e **3 melhorias de robustez** que afetam diretamente a precisão dos dados financeiros e a experiência do cliente.

---

## Bugs Críticos (dados incorretos em produção)

### BUG 1 — Edge Function `integration-asaas`: webhook atualiza coluna errada
**Arquivo:** `supabase/functions/integration-asaas/index.ts` (linha 75)
**Problema:** A action `webhook` atualiza `asaas_total_overdue` (coluna legada) em vez de `installments_overdue` + `total_overdue_value`.
**Impacto:** Quando o Asaas envia webhook de pagamento, os dados de inadimplência do escritório não são atualizados corretamente. Todos os indicadores do sistema ficam desatualizados até que alguém abra a aba Financeiro manualmente.
**Correção:** Reescrever a lógica do webhook para buscar count + valor total de OVERDUE e gravar em `installments_overdue` e `total_overdue_value`.

### BUG 2 — Edge Function `integration-asaas`: syncAll atualiza coluna errada
**Arquivo:** `supabase/functions/integration-asaas/index.ts` (linha 274)
**Problema:** A action `syncAll` atualiza `asaas_total_overdue` em vez das colunas corretas.
**Impacto:** Sincronização em massa não reflete nos indicadores do sistema.
**Correção:** Mesma lógica: gravar em `installments_overdue` (count) e `total_overdue_value` (soma).

### BUG 3 — Edge Function `execute-automations`: fallback para coluna legada
**Arquivo:** `supabase/functions/execute-automations/index.ts` (linha 842)
**Problema:** `installments_overdue: activeContract?.installments_overdue || office.asaas_total_overdue || 0` — ainda faz fallback para `asaas_total_overdue` e lê do contrato (manual) primeiro.
**Impacto:** Regras de automação que usam condição de inadimplência podem disparar com dados incorretos.
**Correção:** Usar `office.installments_overdue || 0` como fonte única.

### BUG 4 — `ClienteContratos`: formulário ainda salva installments_overdue no contrato
**Arquivo:** `src/components/clientes/ClienteContratos.tsx` (linhas 101, 162)
**Problema:** O campo está `disabled` na UI, mas o `handleSave` e `handleEditSave` ainda enviam `installments_overdue` para a tabela `contracts`. Como o valor é string vazia (`''`), vira `null` no banco — mas isso pode sobrescrever dados manuais antigos e gera confusão.
**Correção:** Remover `installments_overdue` do payload de insert e update.

### BUG 5 — `ImportWizard`: importação CSV ainda grava installments_overdue no contrato
**Arquivo:** `src/components/import-export/ImportWizard.tsx` (linha 877)
**Problema:** `installments_overdue: Number(row.installments_overdue) || 0` — importação grava no contrato, criando fonte de dados divergente.
**Correção:** Remover do payload de importação ou ignorar coluna.

### BUG 6 — `ContratosGlobal`: possível double-count de inadimplência
**Arquivo:** `src/pages/ContratosGlobal.tsx` (linha 82)
**Problema:** `const vencidos = contracts.reduce((sum, c) => sum + (c.installments_overdue || 0), 0)` — como o valor é sobrescrito do office para cada contrato, se um escritório tem 2 contratos, a inadimplência do office é contada 2x.
**Correção:** Calcular inadimplência total usando `Set` de office_ids para evitar duplicação.

### BUG 7 — `Relatorios`: campo `diasAtraso` sempre 0
**Arquivo:** `src/pages/Relatorios.tsx` (linha 387)
**Problema:** `diasAtraso: 0` — hardcoded, nunca calculado. A tabela de inadimplentes mostra "0 dias" para todos.
**Correção:** Esse dado não está disponível sem chamar o Asaas. Remover a coluna da tabela ou deixar como "—".

---

## Melhorias de Robustez

### MELHORIA 1 — Remover campo "Parcelas Vencidas" do formulário de contrato
O campo está `disabled` mas ainda aparece. Remover completamente do formulário (tanto criar quanto editar) para evitar confusão do usuário.

### MELHORIA 2 — `ClienteFinanceiro`: useEffect dependency
**Arquivo:** `src/components/clientes/ClienteFinanceiro.tsx` (linha 89)
**Problema:** `useEffect(() => { fetchData(); }, [officeId])` — `fetchData` não está no array de dependências. Funciona porque `officeId` é a trigger real, mas pode causar stale closure se `cnpj` mudar.
**Correção:** Adicionar `cnpj` como dependência.

### MELHORIA 3 — `fmtDate` no ClienteFinanceiro pode falhar
**Arquivo:** `src/components/clientes/ClienteFinanceiro.tsx` (linha 96-98)
**Problema:** `const [y, m, day] = d.split('-')` — se a data vier em formato inesperado, exibe `undefined`.
**Correção:** Adicionar fallback.

---

## Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/integration-asaas/index.ts` | Corrigir webhook e syncAll para gravar nas colunas corretas |
| `supabase/functions/execute-automations/index.ts` | Usar `office.installments_overdue` como fonte única |
| `src/components/clientes/ClienteContratos.tsx` | Remover `installments_overdue` dos payloads e do formulário |
| `src/components/import-export/ImportWizard.tsx` | Remover `installments_overdue` do payload de importação |
| `src/pages/ContratosGlobal.tsx` | Corrigir double-count usando Set de office_ids |
| `src/pages/Relatorios.tsx` | Remover coluna `diasAtraso` da tabela de inadimplentes |
| `src/components/clientes/ClienteFinanceiro.tsx` | Ajustar dependências do useEffect + fallback no fmtDate |

