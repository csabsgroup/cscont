

# Ajuste nos Cards de Tarefas Internas -- Adicionar Prioridade

## Situação Atual
O card exibe: tags, titulo, data de vencimento, checklist e avatares dos responsaveis. Falta o campo **prioridade**, que nao existe na tabela `board_cards`.

## Mudanças

### 1. Migration SQL -- Adicionar coluna `priority` em `board_cards`
```sql
ALTER TABLE public.board_cards 
ADD COLUMN priority text NOT NULL DEFAULT 'medium';
```
Valores: `low`, `medium`, `high`, `urgent`.

### 2. `BoardCardData` interface -- Adicionar `priority`
Adicionar `priority: string` ao tipo.

### 3. `BoardCard.tsx` -- Redesenhar card
Ordem visual do card:
1. **Tags** (coloridas, como ja esta)
2. **Titulo** da tarefa
3. **Linha inferior**: prioridade (badge colorido), data de vencimento, checklist, avatares dos responsaveis

Badge de prioridade com cores:
- `low` → cinza
- `medium` → azul/primary
- `high` → amarelo/warning  
- `urgent` → vermelho/destructive

### 4. `BoardView.tsx` -- Mapear `priority` no enrich
Adicionar `priority: c.priority || 'medium'` no mapeamento dos cards.

### 5. `CardEditDrawer.tsx` -- Campo de prioridade no formulario
Adicionar Select de prioridade entre Coluna e Responsaveis para que o usuario possa definir/editar.

### 6. `BoardView.tsx` -- `saveCard` persiste prioridade
Incluir `priority` nos inserts e updates do `board_cards`.

### Arquivos afetados
- **Migration SQL**: nova coluna
- `src/components/tarefas/BoardCard.tsx`
- `src/components/tarefas/CardEditDrawer.tsx`
- `src/components/tarefas/BoardView.tsx`

