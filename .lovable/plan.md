

# Plano: Depurar e corrigir Membros Ativos no Portal

## Diagnóstico atual

Todos os dados e políticas RLS estão corretos no banco:
- 59 escritórios ELITE ativos com `visible_in_directory=true`
- Política "Client can view directory members" (offices) → OK
- Política "Client can view directory contacts" (contacts) → OK
- `get_directory_office_ids` retorna 59 IDs para o usuário client

**Hipótese provável**: A query com embed de `contacts` via `contacts!contacts_office_id_fkey(...)` pode estar falhando silenciosamente no PostgREST quando executada pelo client. Se a primeira query (buscar `active_product_id`) também falhar, o erro não é capturado.

## Correção

### `src/pages/portal/PortalMembros.tsx`

1. **Separar a query de offices e contacts** — buscar offices primeiro (sem embed), depois buscar contacts separadamente. Isso isola qualquer problema com a join e garante que os cards de membros apareçam.

2. **Adicionar logging detalhado** nas duas queries e no officeId para debugging futuro.

3. **Capturar erros em ambas as queries** (a primeira query de `active_product_id` atualmente ignora erros).

```text
Fluxo corrigido:
1. Query offices (sem embed de contacts)
2. Se sucesso → mostrar cards
3. Query contacts para os office_ids retornados
4. Merge contacts nos membros
```

## Arquivo a modificar

| Arquivo | Mudança |
|---|---|
| `src/pages/portal/PortalMembros.tsx` | Separar queries, adicionar error handling completo |

