

# Plan: Fix Missing Import Mappings (DATA CHURN, MOTIVO CHURN + other columns)

## Root Cause

Two separate problems:

### Problem 1: Missing fields in the template
The offices import template has NO fields for:
- **`churn_observation`** — the "MOTIVO CHURN" column from the file has no target field
- **`churn_reason_name`** — even if it existed, the DB stores `churn_reason_id` (UUID FK), requiring a name→id lookup
- **`last_meeting_date`** — "DATA DA ULTIMA REUNIÃO" has no target
- **`office_name`** (legal company name) — "ESCRITÓRIO" maps to the legal company name, separate from contact "NOME"

### Problem 2: Aliases too narrow for some columns
The file uses descriptive Portuguese headers that don't match current aliases:
- "FATURAMENTO DO ULTIMO ANO" → no alias matches (existing: `faturamento_anual`, `receita_anual`)
- "FATURAMENTO DO ULTIMO MÊS" → same issue
- "VALOR MENSALIDADE" → not in aliases for any field
- "VALOR CONTRATO ATUAL" → not in aliases
- "CLIENTES ATIVOS" → alias "clientes" would match via contains, but "NÚMERO DE FUNCIONÁRIOS" → "funcionarios" alias should match
- "DATA DE NASCIMENTO" → birthday is a contacts field, not offices
- "DATA DA ULTIMA REUNIÃO" → `last_meeting_date` not in template
- "CS" → CSM name (not email), aliases only have email-based matching

### Problem 3: Ambiguous "churn" alias
The `churn_date` field has "churn" as an alias. Via contains-matching, "MOTIVO CHURN" would match `churn_date` if it were processed after DATA CHURN is already taken. But since there's no `churn_reason` field, it just stays unmapped.

## Fix

### File 1: `src/lib/import-templates.ts`

**Add 3 new fields** to the offices template:

```typescript
{ key: 'churn_observation', label: 'motivo_churn', required: false, type: 'text', 
  example: 'Insatisfação com o serviço', dbColumn: 'churn_observation', 
  aliases: ['motivo_churn', 'motivo churn', 'motivo_cancelamento', 'motivo cancelamento', 
            'razao_churn', 'razão churn', 'observacao_churn', 'observação churn', 
            'churn_reason', 'churn_observation'] },

{ key: 'last_meeting_date', label: 'data_ultima_reuniao', required: false, type: 'date',
  example: '15/03/2024', dbColumn: 'last_meeting_date',
  aliases: ['data_ultima_reuniao', 'data_última_reunião', 'ultima_reuniao', 'última_reunião',
            'last_meeting', 'last_meeting_date', 'data_reuniao', 'data_reunião'] },

{ key: 'csm_name', label: 'csm_nome', required: false, type: 'text',
  example: 'Maria Silva',
  aliases: ['cs', 'csm_nome', 'nome_csm', 'nome_responsavel', 'nome_responsável', 
            'consultor', 'customer_success'] },
```

**Remove "churn" from churn_date aliases** (too ambiguous — causes false matches). Keep only specific ones like `data_churn`, `cancelamento`, `data_cancelamento`.

**Expand aliases** for existing fields that aren't matching:
- `faturamento_anual`: add `'faturamento do ultimo ano'`, `'faturamento ultimo ano'`, `'receita_ultimo_ano'`
- `faturamento_mensal`: add `'faturamento do ultimo mes'`, `'faturamento ultimo mes'`, `'receita_ultimo_mes'`, `'valor_mensalidade'`, `'mensalidade'`
- `qtd_clientes`: add `'clientes_ativos'`, `'clientes ativo'`

### File 2: `src/components/import-export/ImportWizard.tsx`

In the `insertRow` function for offices:

1. **Handle `churn_observation`**: Add `insertData.churn_observation = row.churn_observation || null`

2. **Handle `csm_name`** (lookup by name instead of email):
```typescript
if (row.csm_name && !csmId) {
  const { data } = await supabase.from('profiles').select('id')
    .ilike('full_name', `%${row.csm_name.trim()}%`).maybeSingle();
  csmId = data?.id || null;
}
```

3. **Handle `last_meeting_date`**: Add `insertData.last_meeting_date = parseDateBR(row.last_meeting_date)`

## Summary

| File | Changes |
|------|---------|
| `src/lib/import-templates.ts` | Add 3 new fields (churn_observation, last_meeting_date, csm_name), expand aliases for faturamento/clientes, remove ambiguous "churn" alias |
| `src/components/import-export/ImportWizard.tsx` | Handle new fields in insertRow (churn_observation, last_meeting_date, csm_name lookup) |

2 files, no database changes needed.

