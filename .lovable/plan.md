

# Plano: Corrigir Membros Ativos no Portal do Cliente

## Diagnóstico

Investigando o banco:
- 59 escritórios ELITE com `status='ativo'` e `visible_in_directory=true`
- A função `get_directory_office_ids` retorna corretamente 59 IDs para o usuário client
- A política RLS "Client can view directory members" na tabela `offices` está correta

**Problema identificado**: A query no `PortalMembros.tsx` faz embed de `contacts`, mas a tabela `contacts` tem RLS que só permite clientes verem contatos do PRÓPRIO escritório (via `get_visible_office_ids`). Isso pode causar um erro no PostgREST que é silenciosamente ignorado (o código não checa `error`).

Além disso, se o PostgREST retornar erro 400 por conta da join com contacts bloqueada por RLS, toda a query falha e `data` vem null → `members` = `[]` → "0 membros".

## Correções

### 1. Adicionar política RLS em `contacts` para clientes do diretório

Criar uma nova política que permita clientes verem contatos dos escritórios do diretório (mesmo produto):

```sql
CREATE POLICY "Client can view directory contacts"
ON public.contacts FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role)
  AND office_id IN (SELECT get_directory_office_ids(auth.uid()))
);
```

### 2. Adicionar tratamento de erro em `PortalMembros.tsx`

Capturar e logar erros da query para facilitar debugging futuro:

```typescript
const { data, error } = await query;
if (error) console.error('[PortalMembros] Query error:', error);
```

## Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| Nova migration SQL | Política RLS contacts para diretório |
| `src/pages/portal/PortalMembros.tsx` | Adicionar error handling |

