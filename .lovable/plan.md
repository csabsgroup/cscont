

# Fix: Automações de bônus (Slack + Sistema) não disparam

## Diagnóstico

Encontrei 3 problemas distintos:

1. **Portal do cliente (`PortalBonus.tsx`)**: Quando o cliente solicita um bônus pelo portal, o código chama `integration-slack` diretamente com mensagem sem `channel`, gerando erro `"channel is required"` (visível nos logs). Ele NÃO chama o motor de automações (`execute-automations`), então nenhuma regra configurada é executada.

2. **Aprovação interna (`ClienteBonus.tsx`)**: Quando o CSM aprova uma solicitação via `handleRequestAction`, nenhuma automação é disparada. Apenas o `handleGrant` (conceder bônus manual) dispara.

3. **Variáveis não resolvidas nas notificações**: As notificações de "cliente novo" ainda mostram `{{cnpj}}`, `{{socio_nome}}`, etc. porque esses campos não são resolvidos no `resolveVariables`.

## Correções

### 1. `src/pages/portal/PortalBonus.tsx`
- Remover chamada direta a `integration-slack` (linhas 122-126)
- Substituir por chamada a `execute-automations` com `trigger_type: 'bonus.requested'`
- Isso faz o motor de automações processar todas as regras configuradas, incluindo Slack e notificações

### 2. `src/components/clientes/ClienteBonus.tsx`
- Adicionar trigger `bonus.requested` no `handleRequestAction` quando status for `approved`
- Assim, aprovar uma solicitação de cashback também dispara as automações

### 3. Resolver variáveis adicionais no `execute-automations/index.ts`
- Adicionar resolução de `{{cnpj}}`, `{{socio_nome}}`, `{{socio_email}}`, `{{socio_telefone}}` usando dados do office e contatos

## Arquivos afetados: 3
- `src/pages/portal/PortalBonus.tsx`
- `src/components/clientes/ClienteBonus.tsx`
- `supabase/functions/execute-automations/index.ts`

