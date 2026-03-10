

# Correções no Builder de Formulários

## Problema 1: Drag & Drop não funciona entre zonas

O `@hello-pangea/dnd` atual tem 3 tipos de Droppable (`unsectioned-fields`, `sections-list`, `section-fields-*`), mas o `onDragEnd` só trata reordenação dentro da mesma zona. Movimentos entre zonas diferentes (ex: arrastar campo de "sem seção" para dentro de uma seção) são ignorados. Além disso, o Droppable de seções contém Droppables aninhados de campos, o que causa conflitos de drag.

**Correção em `FormBuilder.tsx`**:
- Adicionar `type="FIELD"` em todos os Droppables de campos e `type="SECTION"` no Droppable de seções, para separar os dois tipos de drag
- No `onDragEnd`, tratar movimentos cross-droppable: quando `source.droppableId !== destination.droppableId`, mover o campo para a nova zona (atribuir/remover `section_id`)
- Garantir que reordenação de seções funcione independentemente dos campos aninhados

## Problema 2: Tipos de campo faltando no builder

O renderer já suporta `number`, `currency` e `paragraph` (texto longo), mas o array `QUESTION_TYPES` não inclui `number` nem `currency`. Falta adicionar ao dropdown do builder.

**Correção em `FormFieldRenderer.tsx`**:
- Adicionar ao array `QUESTION_TYPES`:
  - `{ value: 'number', label: 'Número', icon: '🔢' }`
  - `{ value: 'currency', label: 'Moeda (R$)', icon: '💰' }`
  - `{ value: 'long_text', label: 'Texto longo', icon: '📃' }` (novo tipo distinto de parágrafo, com mais linhas)
- Adicionar renderização do `long_text` como Textarea com mais rows
- Atualizar `defaultField` no FormBuilder para inicializar opções corretas dos novos tipos

## Arquivos afetados
- `src/pages/FormBuilder.tsx` — refatorar onDragEnd para cross-droppable + types
- `src/components/formularios/FormFieldRenderer.tsx` — adicionar tipos number, currency, long_text
- `src/components/formularios/FormItemCard.tsx` — ajustar validação para novos tipos numéricos

