

# Tarefas Internas — Board Trello

## Resumo

Criar um board estilo Trello para gestão de tarefas internas da equipe, com colunas customizáveis, cards com drag & drop, tags coloridas, múltiplos responsáveis, templates e permissões por role.

## Banco de Dados

Migration com 5 tabelas + índices + RLS:

| Tabela | Função |
|--------|--------|
| `board_columns` | Colunas do board (nome, cor, ordem) |
| `board_cards` | Cards (título, descrição, tags, checklist, datas) |
| `board_card_assignees` | Responsáveis (N:N cards↔users) |
| `board_card_templates` | Templates de cards pré-configurados |
| `board_tags` | Tags com cores (pré-definidas + livres) |

Seed com 3 colunas default: A Fazer (azul), Em Andamento (amarelo), Concluído (verde).

RLS segue o modelo descrito: CSM vê apenas cards onde é assignee, Manager vê cards do time (via `get_manager_office_ids` adaptado para assignees do time), Admin/Viewer vêem todos.

Data fix: `UPDATE offices SET visible_in_directory = true WHERE status = 'ativo' AND visible_in_directory IS NULL` (do plano anterior, se não executado).

## Navegação

- Adicionar "Tarefas Internas" (`ClipboardList`) no grupo "Operação" da sidebar entre Jornada e o separador
- Adicionar tab "Tarefas" na NavigationTabs
- Nova rota `/tarefas-internas` no App.tsx
- Adicionar ao `pageNames` no AppLayout

## Componentes Novos

| Arquivo | Função |
|---------|--------|
| `src/pages/TarefasInternas.tsx` | Página principal com board |
| `src/components/tarefas/BoardView.tsx` | Board com colunas + drag & drop (@hello-pangea/dnd) |
| `src/components/tarefas/BoardColumn.tsx` | Coluna individual com lista de cards |
| `src/components/tarefas/BoardCard.tsx` | Card visual (tags, avatares, due date, checklist progress) |
| `src/components/tarefas/CardEditDrawer.tsx` | Drawer de edição completo (título, descrição, responsáveis, tags, datas, checklist) |
| `src/components/tarefas/NewCardDialog.tsx` | Dialog para criar card (em branco ou de template) |
| `src/components/tarefas/ColumnConfigDialog.tsx` | Config de colunas (Admin: nome, cor, ordem, CRUD) |
| `src/components/tarefas/TagManager.tsx` | Componente de seleção/criação de tags |

## Funcionalidades

- **Drag & drop**: @hello-pangea/dnd (já instalado) — entre colunas e dentro da coluna, atualizando `column_id` e `sort_order`
- **Filtros**: CSM (dropdown), Tag (dropdown), "Apenas minhas tarefas" (checkbox)
- **Cards atrasados**: borda vermelha se `due_date < hoje`
- **Checklist**: array JSON no card, progresso visual (ex: 2/4)
- **Multi-assignees**: multi-select com avatares dos usuários
- **Templates**: Admin configura via ColumnConfigDialog ou seção dedicada
- **Viewer**: read-only (sem botões de criar/editar/mover)

## Permissões

| Role | Vê | Cria | Edita | Exclui | Config colunas |
|------|-----|------|-------|--------|----------------|
| Admin | Todos | Sim | Todos | Sim | Sim |
| Manager | Time + seus | Sim | Time + seus | Só seus | Nao |
| CSM | Só assignee | Sim | Só assignee | Só seus | Nao |
| Viewer | Todos (RO) | Nao | Nao | Nao | Nao |

## Arquivos Modificados

- `src/App.tsx` — nova rota `/tarefas-internas`
- `src/components/AppSidebar.tsx` — item "Tarefas Internas" no menu
- `src/components/NavigationTabs.tsx` — tab "Tarefas"
- `src/components/AppLayout.tsx` — pageNames

## Arquivos Criados

- Migration SQL (5 tabelas + RLS + seed)
- `src/pages/TarefasInternas.tsx`
- `src/components/tarefas/BoardView.tsx`
- `src/components/tarefas/BoardColumn.tsx`
- `src/components/tarefas/BoardCard.tsx`
- `src/components/tarefas/CardEditDrawer.tsx`
- `src/components/tarefas/NewCardDialog.tsx`
- `src/components/tarefas/ColumnConfigDialog.tsx`
- `src/components/tarefas/TagManager.tsx`

