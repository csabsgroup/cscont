

# Visão Anual do Calendário de Eventos (interno)

## Resumo
Criar um componente `EventYearView` com grid 4x3 de mini-calendários. Cada mês mostra os dias com dots coloridos por categoria, e ao lado uma legenda fixa listando data + dia da semana + título. Hover mostra resumo, clique navega para detalhe. Toggle "Mensal/Anual" no header existente.

## Mudanças

### 1. Novo arquivo: `src/components/eventos/EventYearView.tsx`
- Grid 4 colunas x 3 linhas, cada célula = 1 mês
- Cada mês: mini-calendário compacto (grid 7 colunas, dias numéricos pequenos)
- Dias com eventos recebem um dot colorido (cor da categoria) abaixo/sobre o número
- Ao lado do mini-calendário (ou abaixo), legenda fixa com lista dos eventos do mês: `dd dia_semana — Título`, com dot colorido
- HoverCard no evento da legenda (mesmo conteúdo do mensal: título, tipo, data, local, participantes)
- Clique navega para `/eventos/:id`
- Props: `events`, `participantCounts`, `currentYear`, `onYearChange`

### 2. Editar: `src/pages/Eventos.tsx`
- Mudar state `view` para aceitar `'list' | 'calendar' | 'year'`
- Adicionar `TabsTrigger` "Anual" no `TabsList` existente (ícone `Calendar`)
- Renderizar `<EventYearView>` quando `view === 'year'`
- Passar `filtered` e `participantCounts` como props

### 3. Editar: `src/components/eventos/EventCalendarView.tsx`
- Exportar `CATEGORY_CONFIG` e `CATEGORY_BG` para reutilização no `EventYearView` (ou duplicar as constantes no novo componente)

### Arquivos afetados: 3
- `src/components/eventos/EventYearView.tsx` (novo)
- `src/pages/Eventos.tsx` (toggle + renderização condicional)
- `src/components/eventos/EventCalendarView.tsx` (exportar constantes)

