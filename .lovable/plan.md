

# Plano: 3 Ajustes — Board Interno, Colunas Customizáveis e Perfil do Usuário

---

## AJUSTE 1 — Board apenas para usuários internos

### 1.1 Filtrar profiles no BoardView
- Linha 53 do `BoardView.tsx`: a query `profiles` busca todos. Alterar para usar join com `user_roles` filtrando `role IN ('admin','manager','csm')`:
```sql
supabase.from('user_roles')
  .select('user_id, role, profiles!inner(id, full_name, avatar_url)')
  .in('role', ['admin','manager','csm'])
```
- Propagar lista filtrada para `CardEditDrawer` (props `profiles`) e para o dropdown de filtro CSM no toolbar.

### 1.2 Verificar isolamento board_cards vs activities
- Já confirmado: o board usa exclusivamente `board_cards`. Nenhuma query à `activities` existe nos componentes de tarefas. OK.

### 1.3 Esconder "Tarefas Internas" da sidebar para clientes
- `AppSidebar.tsx`: filtrar `operationItems` removendo "Tarefas Internas" quando `role === 'client'`.

---

## AJUSTE 2 — Colunas totalmente customizáveis

### Migration SQL
```sql
ALTER TABLE board_columns ADD COLUMN IF NOT EXISTS header_color text DEFAULT '#374151';
ALTER TABLE board_columns ADD COLUMN IF NOT EXISTS bg_color text DEFAULT '#f3f4f6';
ALTER TABLE board_columns ADD COLUMN IF NOT EXISTS bg_gradient_from text;
ALTER TABLE board_columns ADD COLUMN IF NOT EXISTS bg_gradient_to text;
ALTER TABLE board_columns ADD COLUMN IF NOT EXISTS bg_opacity numeric DEFAULT 100;
ALTER TABLE board_columns ADD COLUMN IF NOT EXISTS icon text;
```

### Interfaces atualizadas
- `Column` em `BoardView.tsx` ganha os novos campos.

### BoardColumn.tsx — Visual
- Header com `backgroundColor: column.header_color`.
- Body com background sólido ou gradiente conforme config + opacidade.
- Ícone lucide-react dinâmico ao lado do nome.
- Menu `···` (DropdownMenu) no header com opções: Editar coluna, Adicionar card, Template, Mover esquerda/direita, Arquivar todos, Excluir.

### ColumnConfigDialog → Refatorar como ColumnEditPopover
- Ao clicar "Editar coluna" no menu `···`, abrir um Dialog/Popover com:
  - Nome da coluna
  - Cor do header (picker + cores rápidas)
  - Background: cor sólida / gradiente / transparente
  - Opacidade (slider)
  - Ícone (dropdown com ícones lucide populares)
  - Botão excluir (com lógica de mover cards)
- Manter o dialog global de config (botão ⚙️) para Admin com drag & drop de reordenação + adicionar colunas.

### Drag & drop de colunas no board
- No `BoardView.tsx`, envolver as colunas em um `Droppable` horizontal do tipo `COLUMN`.
- Cada `BoardColumn` fica dentro de um `Draggable` (drag handle no header).
- `handleDragEnd` diferencia `type === 'COLUMN'` vs `type === 'CARD'`.
- Persistir nova ordem via `board_columns.sort_order`.
- Apenas Admin e Manager podem arrastar colunas.

### Botão "+ Adicionar coluna" no final do board
- Após a última coluna, renderizar botão para criar nova coluna inline.
- Criar com nome "Nova Coluna" e cores padrão.
- Apenas Admin pode adicionar.

### Excluir coluna com cards
- Se coluna tem cards: mostrar dialog com opção de mover todos para outra coluna.
- Se vazia: excluir com confirmação.

### Permissões
- Admin: tudo (criar, editar, excluir, reordenar).
- Manager: criar colunas, editar as que criou.
- CSM: apenas usar (criar cards, mover cards). Sem acesso ao menu de edição de coluna.
- Viewer: read-only.

---

## AJUSTE 3 — Edição de perfil do usuário

### UserProfileDialog.tsx — Melhorias
O dialog já existe e funciona. Ajustes:

1. **Remover campo WhatsApp** do label "WhatsApp" → manter como está (já existe e é usado pelo portal).
2. **Remover campo Telefone** — não adicionar, manter apenas WhatsApp.
3. **Adicionar seção "Alterar Senha"** separada:
   - Campos: Nova senha + Confirmar nova senha (mínimo 8 chars).
   - Botão "Alterar senha" independente do "Salvar perfil".
   - Usa `supabase.auth.updateUser({ password })`.
4. **Botão "Remover foto"** — ao lado do avatar, limpa `avatar_url`.
5. **Validações**: nome mínimo 2 chars, senha mínimo 8 chars, confirmação deve coincidir, foto máx 5MB.

### Email permanece read-only (como está).

---

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/` | Nova migration: colunas extras em `board_columns` |
| `src/components/tarefas/BoardView.tsx` | Filtrar profiles internos, drag & drop de colunas, botão "+ coluna" |
| `src/components/tarefas/BoardColumn.tsx` | Visual com cores/gradiente/ícone, menu `···` |
| `src/components/tarefas/CardEditDrawer.tsx` | Recebe profiles já filtrados (sem mudança funcional) |
| `src/components/tarefas/ColumnConfigDialog.tsx` | Refatorar para suportar campos visuais avançados |
| `src/components/tarefas/ColumnEditDialog.tsx` | **Novo**: dialog individual de edição de coluna |
| `src/components/tarefas/DeleteColumnDialog.tsx` | **Novo**: dialog de confirmação com opção de mover cards |
| `src/components/AppSidebar.tsx` | Esconder "Tarefas Internas" para role client |
| `src/components/UserProfileDialog.tsx` | Adicionar seção de senha, botão remover foto, validações |

