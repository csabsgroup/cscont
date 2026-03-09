

# Fix: Botão "Alterar capa" não clicável

## Problema

O overlay de gradiente (`absolute inset-0`) cobre toda a área da capa e intercepta os cliques antes de chegarem ao botão. O div do gradiente bloqueia pointer events no botão de upload.

## Solução

Adicionar `pointer-events-none` ao div do gradiente e `relative z-10` ao div que contém o título e o botão de upload, garantindo que os cliques passem corretamente.

### `src/pages/EventoDetalhe.tsx`

- Linha ~199: adicionar `pointer-events-none` ao div do gradiente
- Linha ~200: adicionar `relative z-10` ao div do conteúdo (título + botão)

