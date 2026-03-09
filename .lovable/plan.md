

# Fix Membros Ativos + Paginação Reutilizável

## Ajuste 1 — Membros ativos não aparecem

**Causa raiz:** A RLS policy `Users see visible offices` usa `get_visible_office_ids()`, que para clientes retorna apenas os offices vinculados via `client_office_links` (o próprio escritório). Resultado: o cliente não consegue ver os outros escritórios do mesmo produto.

**Correção:**

1. **Nova RLS policy** para permitir que clientes vejam offices do diretório:
```sql
CREATE POLICY "Client can view directory members" ON offices FOR SELECT
TO authenticated
USING (
  visible_in_directory = true
  AND status = 'ativo'
  AND has_role(auth.uid(), 'client')
  AND active_product_id IN (
    SELECT o.active_product_id FROM offices o
    JOIN client_office_links col ON col.office_id = o.id
    WHERE col.user_id = auth.uid()
  )
);
```

2. **Fix de dados** — setar `visible_in_directory = true` para ativos com valor NULL:
```sql
UPDATE offices SET visible_in_directory = true
WHERE status = 'ativo' AND visible_in_directory IS NULL;
```

3. **Refatorar PortalMembros.tsx** — melhorar a query para incluir `visible_in_directory = true`, `external_id`, `logo_url`, e buscar contatos com mais campos (email, phone, instagram, role_title). Redesenhar o card conforme especificação (logo, external_id, contato principal com cargo).

## Ajuste 2 — Componente de paginação reutilizável

**Novo componente:** `src/components/shared/PaginationWithPageSize.tsx`
- Props: totalItems, currentPage, pageSize, onPageChange, onPageSizeChange, pageSizeOptions
- Botões pill para seleção de quantidade (estilo destacado no selecionado)
- Texto "Mostrando X-Y de Z" + navegação anterior/próximo
- Dark mode compatível via classes Tailwind existentes

**Aplicar em 7 páginas:**

| Arquivo | Default | Notas |
|---------|---------|-------|
| PortalMembros.tsx | 50 | Novo — adicionar state de paginação |
| PortalReunioes.tsx | 25 | Novo — adicionar state de paginação |
| PortalEventos.tsx | 25 | Novo — adicionar state de paginação |
| PortalArquivos.tsx | 25 | Novo — adicionar state de paginação |
| PortalBonus.tsx | 25 | Novo — adicionar state de paginação |
| Clientes.tsx | 25 | Já tem paginação — substituir o seletor dropdown pelo componente |
| Atividades.tsx | 25 | Novo — paginar cada tab individualmente |

## Arquivos modificados

- **Novo:** `src/components/shared/PaginationWithPageSize.tsx`
- **RLS + dados:** migration para policy + UPDATE de visible_in_directory
- **Editados:** PortalMembros, PortalReunioes, PortalEventos, PortalArquivos, PortalBonus, Clientes, Atividades (7 arquivos)

