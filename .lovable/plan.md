

# Eventos multi-dia no calendário (barra contínua)

## Problema
Eventos com `end_date` preenchido aparecem apenas no dia de `event_date`. Um evento de 3 dias deve exibir uma barra contínua do primeiro ao último dia.

## Abordagem
Expandir cada evento multi-dia em entradas por dia, marcando a posição (`start`, `middle`, `end`, `single`) para renderizar como barra contínua estilo Google Calendar.

```text
┌───────┬───────┬───────┬───────┐
│  Seg  │  Ter  │  Qua  │  Qui  │
│       │       │       │       │
│ ┌─────┼───────┼─────┐ │       │
│ │ Imersão CEO       │ │       │
│ └─────┼───────┼─────┘ │       │
└───────┴───────┴───────┴───────┘
  start   middle   end
```

## Mudanças

### 1. `src/components/eventos/EventCalendarView.tsx`
- No `eventsByDay` memo, para cada evento: se `end_date` existe e > `event_date`, gerar `eachDayOfInterval` e inserir entrada em cada dia com `{ ...ev, _pos: 'start'|'middle'|'end' }`
- Eventos sem `end_date` recebem `_pos: 'single'`
- Na renderização, aplicar classes CSS condicionais:
  - `start`: `rounded-l px-1` + mostra título
  - `middle`: `rounded-none px-0` + sem título (apenas cor)
  - `end`: `rounded-r px-0` + sem título
  - `single`: comportamento atual (rounded completo)

### 2. `src/components/portal/PortalCalendar.tsx`
- Adicionar `endDate?: Date` na interface `CalendarItem`
- Mesma lógica de expansão no `eventsByDay` memo
- Mesma renderização com barras contínuas
- No detalhe do dia selecionado, mostrar apenas uma vez (filtrar duplicatas por id)

### 3. `src/pages/portal/PortalEventos.tsx`
- Ao montar `calendarItems`, passar `endDate: ev.end_date ? new Date(ev.end_date) : undefined`

### Arquivos afetados: 3
- `src/components/eventos/EventCalendarView.tsx`
- `src/components/portal/PortalCalendar.tsx`
- `src/pages/portal/PortalEventos.tsx`

