

# Fix: Título do evento sobrepondo a sidebar

## Problema

O div da capa do evento usa `z-10`, que compete com a sidebar. O `overflow-hidden` no container da capa não está contendo os elementos `absolute` com `z-10`, fazendo com que eles visualmente sobreponham a sidebar lateral.

## Solução

Adicionar `isolation: isolate` (classe `isolate` do Tailwind) ao container da capa (`relative rounded-xl overflow-hidden`). Isso cria um novo stacking context, garantindo que o `z-10` interno não escape e compita com a sidebar (z-50).

### `src/pages/EventoDetalhe.tsx`

- Linha 204: adicionar classe `isolate` ao div da capa:
  - De: `relative rounded-xl overflow-hidden bg-muted h-56 md:h-72`
  - Para: `relative isolate rounded-xl overflow-hidden bg-muted h-56 md:h-72`

