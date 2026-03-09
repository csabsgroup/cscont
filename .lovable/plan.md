

# Plano: Liberar visibilidade de membros do mesmo produto para clientes

## Problema

A RLS da tabela `offices` usa `get_visible_office_ids` que, para clientes, retorna apenas o próprio escritório (`get_client_office_ids`). A query do `PortalMembros` busca outros escritórios do mesmo produto, mas RLS bloqueia tudo → lista vazia.

## Solução

### 1 — Migration: nova função + política RLS

Criar função `SECURITY DEFINER` que retorna IDs de escritórios do mesmo produto do cliente, filtrados por `visible_in_directory = true` e `status = 'ativo'`:

```sql
CREATE FUNCTION get_directory_office_ids(_user_id uuid)
RETURNS SETOF uuid
AS $$
  SELECT o.id FROM offices o
  WHERE o.active_product_id IN (SELECT get_client_product_ids(_user_id))
    AND o.status = 'ativo'
    AND o.visible_in_directory = true
$$
```

Adicionar política RLS na tabela `offices`:

```sql
CREATE POLICY "Client can view directory members"
ON offices FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client') 
  AND visible_in_directory = true 
  AND status = 'ativo'
  AND id IN (SELECT get_directory_office_ids(auth.uid()))
);
```

A função `get_client_product_ids` já existe e retorna os `active_product_id` dos escritórios vinculados ao cliente.

### 2 — Nenhuma mudança no componente

O `PortalMembros.tsx` já faz a query correta (filtro por produto, status ativo, visible_in_directory). O problema é puramente RLS.

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/migrations/new` | Função `get_directory_office_ids` + política RLS |

