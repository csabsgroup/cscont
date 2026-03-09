

# Fix: Automação duplicando atividades + Limpeza

## Diagnóstico

O "Disparar agora" envia `skip_idempotency: true`, que **deleta todos os registros de execução** da regra (linha 1172). Isso significa que ao disparar pela segunda vez, o sistema esquece que já processou todos os clientes e roda tudo de novo. Resultado: 3 cópias de cada atividade (1 original + 2 re-execuções).

**Dados confirmados:** 17.575 atividades nos últimos 2 dias, 7.450 grupos duplicados (3 cópias cada).

## Correções

### Fix 1 — Remover limpeza de idempotência no "Disparar agora"

**Arquivo:** `supabase/functions/execute-automations/index.ts` (linhas 1169-1173)

Trocar a lógica: em vez de deletar execuções anteriores, apenas **pular a verificação** de idempotência para offices que ainda NÃO foram processados. O `runNowAll` já filtra offices e chama `executeV2Rules` — basta não deletar os registros. Offices já processados serão naturalmente pulados pelo check na linha 654-665.

Remover:
```typescript
if (skip_idempotency && offset === 0) {
  await supabase.from("automation_executions").delete().eq("rule_id", rule_id);
}
```

E remover o parâmetro `skip_idempotency` do frontend e da auto-invocação.

### Fix 2 — Deletar atividades duplicadas

Usar uma query para manter apenas a atividade mais antiga de cada grupo (title + office_id) criada nos últimos 2 dias, deletando as cópias extras. Isso será feito via ferramenta de dados (não migration).

Lógica SQL:
```sql
DELETE FROM activities WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY title, office_id ORDER BY created_at ASC) as rn
    FROM activities
    WHERE created_at > now() - interval '2 days'
  ) sub WHERE rn > 1
)
```

### Fix 3 — Frontend: Remover skip_idempotency

**Arquivo:** `src/components/configuracoes/AutomationRulesTab.tsx` (linha 543)

Remover `skip_idempotency: true` do body da invocação. O comportamento correto do "Disparar agora" é: processar apenas offices que ainda não foram atingidos por essa regra.

### Opção de "Forçar re-execução"

Adicionar um checkbox separado no editor ("Forçar re-execução em todos os clientes, mesmo os já atingidos") que, quando marcado, aí sim limpa as execuções. Isso evita duplicatas acidentais mas permite re-runs intencionais.

## Arquivos modificados
- `supabase/functions/execute-automations/index.ts` — remover delete de execuções
- `src/components/configuracoes/AutomationRulesTab.tsx` — remover skip_idempotency, adicionar checkbox "Forçar"
- Query de dados — deletar ~14.900 atividades duplicadas

