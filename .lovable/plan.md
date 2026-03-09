

# Plano: Visão de Calendário Mensal na página de Eventos

## Resumo

Adicionar um toggle Lista/Calendário na página `/eventos` (apenas para usuários internos: Admin, Manager, Viewer). A visão de calendário mostra um mês por vez com navegação entre meses, exibindo todos os eventos nos dias correspondentes. Hover mostra popup com resumo, clique navega para `/eventos/:id`.

## Alterações

### 1. Novo componente: `src/components/eventos/EventCalendarView.tsx`

Calendário mensal customizado (não usa o DayPicker pequeno do shadcn — precisa de um grid maior com conteúdo nos dias):

- Grid 7 colunas (Dom-Sáb) com header dos dias da semana
- Navegação mês anterior/próximo com botão "Hoje"
- Cada célula do dia mostra indicadores dos eventos (dots coloridos ou mini-badges com título truncado)
- **Hover** em um evento: `HoverCard` com título, data/hora, local, tipo, categoria e contagem de confirmados
- **Clique** no evento: `navigate('/eventos/:id')`
- Cores por categoria (encontro = azul, imersão = roxo, workshop = verde, etc.)

### 2. Atualizar `src/pages/Eventos.tsx`

- Adicionar toggle de visão (Lista | Calendário) no header, ao lado dos filtros
- Toggle visível apenas para roles `admin`, `manager`, `viewer` (usar `useAuth()`)
- Quando visão = calendário, renderizar `EventCalendarView` passando os eventos filtrados e `participantCounts`
- Quando visão = lista, manter o layout atual (cards com próximos/passados)

### Comportamento do calendário

- Mês atual como padrão
- Setas para navegar entre meses
- Dias com eventos mostram até 2-3 eventos visíveis + "+N mais" se houver mais
- Eventos passados ficam com opacidade reduzida
- Responsivo: em telas menores, mostra apenas dots coloridos nos dias

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/components/eventos/EventCalendarView.tsx` | Criar |
| `src/pages/Eventos.tsx` | Adicionar toggle e renderização condicional |

Nenhuma alteração de banco de dados necessária.

