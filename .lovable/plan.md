

# Fix: Notificações via Sistema e Slack nas Automações

## Diagnóstico

Após análise dos logs de execução e dados do banco:

1. **Notificações no sistema** — Estão sendo criadas com sucesso, mas são enviadas para o CSM responsável do escritório (que pode não ser você). As notificações de hoje (10/03) foram para outros CSMs.

2. **Slack** — Erro `not_in_channel`: o bot precisa ser convidado para o canal. Além disso, o código ignora o canal configurado na ação individual e sempre usa o da `integration_settings`.

## Correções

### 1. `supabase/functions/execute-automations/index.ts` — Ação `send_slack`
- Priorizar o canal configurado na ação (`c.channel`) antes de usar o fallback da `integration_settings`
- Isso permite que cada automação envie para canais diferentes

```
Antes:  sempre pega de integration_settings
Depois: usa c.channel || c.channel_id || integration_settings.channel_id
```

### 2. `supabase/functions/execute-automations/index.ts` — Ação `send_notification`
- Quando `c.recipient` é `admin`, enviar para todos os admins (não só o CSM)
- Adicionar opção `all_admins` para enviar notificação para todos os administradores
- Quando `c.recipient` não é especificado ou é `csm`, manter o comportamento atual

### 3. Ação manual necessária (Slack)
- Você precisa convidar o bot do Slack para o canal `avisos-cs` no Slack: digite `/invite @Lovable App` no canal

## Arquivos afetados: 1
- `supabase/functions/execute-automations/index.ts`

