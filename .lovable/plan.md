

# Diagnóstico e Correção: Automação não atingiu todos os clientes

## Diagnóstico

**262 escritórios** têm produto Aceleração + status ativo, mas apenas **42 foram processados**. Duas causas raiz:

### Causa 1 — Timeout da Edge Function
Cada escritório leva ~4.5 segundos para processar (7 ações incluindo 6 playbooks). O processamento é sequencial: 262 × 4.5s = ~1179 segundos. A Edge Function tem limite de ~400s e morre após processar ~42 escritórios. Os logs confirmam: `shutdown` aparece intercalado com os `Summary` dos últimos offices processados.

### Causa 2 — Idempotência bloqueia re-execução
O `runNowAll` chama `executeV2Rules` que verifica a tabela `automation_executions`. Os 42 escritórios já processados têm registros lá. Se disparar novamente, esses 42 serão pulados (correto), mas os restantes 220 sofrerão o mesmo timeout.

## Correções

### Fix 1 — Processamento em lotes (Edge Function)
Refatorar `runNowAll` em `execute-automations/index.ts`:
- Processar escritórios em lotes de 10
- Após cada lote, verificar o tempo decorrido
- Se restarem escritórios, a função chama a si mesma via `fetch()` com os IDs restantes (passando `offset` ou `remaining_ids`)
- Retornar imediatamente ao frontend com `{ queued: true, total: 262 }` e processar em background

A abordagem:
1. `runNowAll` recebe `rule_id` + opcionalmente `offset`
2. Busca offices, pula os já processados (via `automation_executions`)
3. Processa até 15 offices (~67s)
4. Se restarem mais, faz `fetch()` para si mesma com `offset` incrementado (fire-and-forget)
5. Retorna resultado parcial ao cliente

### Fix 2 — Bypass idempotência no "Disparar agora"
Adicionar flag `skip_idempotency: true` quando `runNowAll` chama `executeV2Rules`, para que offices que já rodaram possam rodar de novo se o usuário explicitamente pedir.

### Fix 3 — UI: Fechar editor ao ativar + toast
Em `AutomationRulesTab.tsx`:
- No `handleSave`, quando `runNow` está ativo: fechar o editor (`setEditorOpen(false)`) ANTES de invocar a função, mostrar toast "Regra salva e executando em segundo plano..."
- Não esperar o `await` da invocação para fechar o editor — disparar fire-and-forget
- Adicionar toast de conclusão via `.then()` no background

## Arquivos modificados
- `supabase/functions/execute-automations/index.ts` — lotes + bypass idempotência
- `src/components/configuracoes/AutomationRulesTab.tsx` — fechar editor antes de executar

