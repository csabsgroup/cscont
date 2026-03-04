

# Plan: Sidebar Accordion com Animacao Suave

## O que muda

Refatorar a sidebar de Configuracoes para usar um sistema de accordion com categorias expansiveis, substituindo o layout flat atual.

## Mudancas em `src/pages/Configuracoes.tsx`

### Estado novo
- Adicionar `expandedCategory: string | null` — controla qual categoria esta aberta
- Na montagem: derivar a categoria pai a partir de `selectedSection` e definir `expandedCategory` automaticamente

### Categorias com subcategorias (Produtos, Formularios, Visao 360, Automacoes, Integracoes)
- Clicaveis como toggle: ao clicar, `expandedCategory` alterna entre o nome da categoria e null
- Estilo: `text-sm font-medium text-gray-700 py-2.5 px-3 cursor-pointer hover:bg-gray-50 rounded-lg`
- Icone 16px a esquerda + texto + `ChevronRight` a direita (rotaciona 90 graus para `ChevronDown` quando aberto, `transition-transform duration-200`)
- Quando aberta: `bg-gray-50`
- Subcategorias aparecem dentro de um `div` com `overflow-hidden` e transicao de `max-height` (ou `grid-rows` animado) com `duration-200 ease-in-out`
- Subcategorias: `text-sm text-gray-500 py-2 px-3 pl-10 hover:text-gray-700 hover:bg-gray-50 rounded-lg`
- Subcategoria ativa: `text-red-700 bg-red-50 font-medium rounded-lg`
- Ao clicar subcategoria: `setSelectedSection(key)`, manter categoria expandida

### Itens sem subcategoria (Catalogo de Bonus, Importar/Exportar, Portal, Usuarios, Auditoria)
- Mesmo estilo de categoria mas SEM seta
- Clique: `setSelectedSection(key)` + `setExpandedCategory(null)` (fecha qualquer aberta)
- Ativo: `bg-red-50 text-red-700 font-medium`

### Accordion exclusivo
- Apenas uma categoria aberta por vez (setar `expandedCategory` fecha a anterior)

### Mobile
- Manter dropdown/select existente, sem mudancas significativas — as categorias ja aparecem como grupos no SelectContent

### Tecnica de animacao
- Usar CSS `grid-template-rows: 0fr` → `1fr` com `transition-all duration-200 ease-in-out` no wrapper, e `overflow-hidden min-h-0` no conteudo interno. Isso garante animacao suave sem precisar calcular `max-height`.

## Arquivos modificados
- `src/pages/Configuracoes.tsx` — refatorar a nav da sidebar (linhas ~488-520)

