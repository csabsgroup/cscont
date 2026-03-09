

# Fix: Recursão Infinita na Policy de Offices

## Causa Raiz

A migration que adicionou a policy `Client can view directory members` faz um sub-SELECT na tabela `offices` dentro de uma RLS policy da própria tabela `offices`. Isso gera recursão infinita e **bloqueia TODAS as queries** à tabela para todos os usuários (erro 42P17).

## Solução

1. **Dropar a policy com recursão** (`Client can view directory members`)
2. **Criar uma função SECURITY DEFINER** que busca o `active_product_id` do cliente sem passar pela RLS:

```sql
CREATE OR REPLACE FUNCTION public.get_client_product_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT o.active_product_id
  FROM offices o
  JOIN client_office_links col ON col.office_id = o.id
  WHERE col.user_id = _user_id
    AND o.active_product_id IS NOT NULL
$$;
```

3. **Recriar a policy** usando a função (sem recursão):

```sql
CREATE POLICY "Client can view directory members" ON offices FOR SELECT
TO authenticated
USING (
  visible_in_directory = true
  AND status = 'ativo'
  AND has_role(auth.uid(), 'client')
  AND active_product_id IN (SELECT get_client_product_ids(auth.uid()))
);
```

## Arquivos

- Uma migration SQL (drop policy + criar função + recriar policy)
- Nenhuma alteração de código frontend necessária

