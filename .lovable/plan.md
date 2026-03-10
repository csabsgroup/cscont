

# Filtro por categoria no portal de eventos do cliente

Adicionar um `Select` de filtro por categoria (Encontro, Imersão, Workshop, etc.) na página `PortalEventos.tsx`, ao lado dos botões Lista/Calendário.

## Mudanças

### `src/pages/portal/PortalEventos.tsx`
- Adicionar estado `filterCategory` (default `'all'`)
- Renderizar um `Select` com as opções do `CATEGORY_LABELS` existente entre o título e os botões de view
- Filtrar `allListEvents` e `calendarItems` pelo `filterCategory` selecionado
- Resetar página para 1 ao trocar filtro

### Arquivo afetado: 1

