

# Fix: Clientes não aparecem + Ordenação de seções com drag & drop

## 1. Bug dos clientes (causa raiz confirmada)

A query na linha 102 de `FormFillDialog.tsx` seleciona `external_id` que **não existe** na tabela `offices`. A API retorna erro 400. Fix simples: remover `external_id` da query e do filtro de busca.

**Arquivo**: `src/components/reunioes/FormFillDialog.tsx`
- Linha 102: remover `external_id` do select
- Interface `OfficeOption`: remover `external_id`
- Filtro `filteredOffices`: remover referência a `external_id`

## 2. Seções com drag & drop + auto-organização

### Canvas reorganizado por seções
No `FormBuilder.tsx`, o canvas passará a renderizar os itens agrupados visualmente:
1. Perguntas sem seção (intercaladas livremente)
2. Blocos de seção (arrastáveis como grupo)
3. Perguntas dentro de cada seção

### Drag & drop de seções
- Seções aparecem como blocos separadores arrastáveis no canvas (usando `@hello-pangea/dnd`)
- Arrastar uma seção reordena todas as perguntas vinculadas junto

### Auto-organização ao atribuir seção
- Quando o usuário atribui uma pergunta a uma seção (via select no `FormItemCard`), a pergunta é automaticamente movida para o final do grupo daquela seção no array `fields`

### Implementação
O canvas terá uma lista unificada de "itens renderizáveis" (seções + perguntas), onde:
- Itens sem seção ficam na posição em que estão
- Seções aparecem como separadores visuais com título editável e handle de drag
- Perguntas com `section_id` ficam logo após sua seção

**Arquivos afetados**:
- `src/components/reunioes/FormFillDialog.tsx` -- fix query `external_id`
- `src/pages/FormBuilder.tsx` -- canvas agrupado por seções, auto-reorder ao atribuir seção
- `src/components/formularios/FormItemCard.tsx` -- callback de mudança de seção dispara reorder

