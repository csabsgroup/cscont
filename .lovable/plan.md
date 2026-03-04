

# Plan: Corrigir Vulnerabilidades de Seguranca (2 findings error)

## Finding 1: Edge Functions sem autenticacao

Adicionar bloco de autenticacao JWT + verificacao de role (admin/manager/csm) em 5 edge functions, replicando o padrao ja usado em `execute-automations`. A acao `webhook` em cada funcao sera tratada separadamente — webhooks externos nao enviam JWT, entao serao processados sem auth (mantendo o comportamento atual para chamadas externas).

### Funcoes afetadas e mudancas

Para cada funcao abaixo, inserir apos o check de OPTIONS:

1. Parse `Authorization` header e validar usuario via `getUser()`
2. Verificar role via `get_user_role` RPC (permitir admin/manager/csm)
3. Retornar 401/403 se falhar
4. Para acoes `webhook`: processar sem auth (sao chamadas por servicos externos)
5. Substituir `String(err)` no catch por `"Internal server error"`

**Arquivos modificados:**
- `supabase/functions/integration-whatsapp/index.ts`
- `supabase/functions/integration-asaas/index.ts`
- `supabase/functions/integration-slack/index.ts`
- `supabase/functions/integration-piperun/index.ts`
- `supabase/functions/integration-email/index.ts`

### Estrutura do bloco de auth (inserido apos OPTIONS check, antes de parse body)

```typescript
// Webhook bypass — external services don't send JWT
const rawBody = await req.text();
const body = JSON.parse(rawBody);
if (body.action === "webhook") {
  // process webhook without auth...
}

// Auth for all other actions
const authHeader = req.headers.get("Authorization");
if (!authHeader?.startsWith("Bearer ")) { return 401 }
const userClient = createClient(url, anonKey, { headers: { Authorization: authHeader } });
const { data: { user } } = await userClient.auth.getUser();
if (!user) { return 401 }
const { data: roleCheck } = await supabase.rpc("get_user_role", { _user_id: user.id });
if (!["admin","manager","csm"].includes(roleCheck)) { return 403 }
```

Nota: como `req.json()` so pode ser chamado uma vez, o body sera parsed via `req.text()` + `JSON.parse()` para permitir o check de webhook antes do auth.

## Finding 2: Transcripts expostos via `OR matched = false`

Criar migracao SQL que:
1. Remove a policy atual `"Users see transcripts of visible offices"`
2. Recria sem o `OR matched = false`
3. Adiciona policy separada para admins verem transcripts nao vinculados

```sql
DROP POLICY IF EXISTS "Users see transcripts of visible offices" ON public.meeting_transcripts;

CREATE POLICY "Users see transcripts of visible offices" ON public.meeting_transcripts
FOR SELECT TO authenticated USING (
  meeting_id IN (SELECT id FROM public.meetings WHERE office_id IN (SELECT get_visible_office_ids(auth.uid())))
);

CREATE POLICY "Admin can see unmatched transcripts" ON public.meeting_transcripts
FOR SELECT TO authenticated USING (
  matched = false AND has_role(auth.uid(), 'admin')
);
```

## Resumo

- 5 edge functions corrigidas com auth JWT + RBAC
- 1 migracao SQL para corrigir policy de transcripts
- Total: 6 arquivos modificados

