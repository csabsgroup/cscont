

# Plano: Página dedicada do Evento + Correção do Upload de Capa

## Problemas identificados

1. **Upload de capa não funciona**: O bucket `event-covers` não tem policy de **UPDATE** no storage. O upload usa `upsert: true`, que requer INSERT + UPDATE. Falta a policy de UPDATE.

2. **Layout atual é um drawer lateral estreito**: O usuário quer uma página dedicada em tela cheia (`/eventos/:id`) com abas internas.

---

## Correções

### 1. Migration SQL — Adicionar policy de UPDATE no storage

```sql
CREATE POLICY "Authenticated can update event covers"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'event-covers')
WITH CHECK (bucket_id = 'event-covers');
```

### 2. Nova rota `/eventos/:id` — Página dedicada do evento

**Arquivo novo: `src/pages/EventoDetalhe.tsx`**

Página full-screen com:
- Header: imagem de capa (com botão de upload), título, badges de tipo/categoria, data, local
- Botão voltar para `/eventos`
- 3 abas (Tabs):
  - **Detalhes**: formulário de edição (título, descrição, datas, local, tipo, categoria, observações, produtos elegíveis, prazo confirmação, máx participantes) + botões salvar/excluir
  - **Confirmação de Presença**: tabela de participantes (reusa `ParticipantManager` atualizado) com botão "Puxar Ativos"
  - **Arquivos**: área para upload e listagem de arquivos/fotos do evento (usando bucket `event-covers` ou campo dedicado)

### 3. Atualizar `src/App.tsx`

Adicionar rota:
```tsx
<Route path="/eventos/:id" element={<ProtectedRoute><EventoDetalhe /></ProtectedRoute>} />
```

### 4. Atualizar `src/pages/Eventos.tsx`

- Remover o `EventDetailDrawer`
- No `onClick` do card, navegar para `/eventos/${ev.id}` com `useNavigate`

### 5. Remover `src/components/eventos/EventDetailDrawer.tsx`

Não será mais necessário — a lógica migra para a página dedicada.

---

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar (policy UPDATE no storage) |
| `src/pages/EventoDetalhe.tsx` | Criar (página dedicada com 3 abas) |
| `src/App.tsx` | Adicionar rota `/eventos/:id` |
| `src/pages/Eventos.tsx` | Trocar drawer por navegação |

