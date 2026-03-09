

# Fix: Botão de upload sumiu e título quebrado

## Problema

Na linha 213, o div tem ambas as classes `absolute` e `relative`, o que causa conflito — `relative` sobrescreve `absolute`, fazendo o conteúdo (título + botão) sair de cima da imagem de capa e quebrar o layout.

## Solução

Remover `relative` da linha 213 e manter apenas `absolute` com `z-10`. O `pointer-events-none` no gradiente já resolve a questão de cliques.

### `src/pages/EventoDetalhe.tsx`

- Linha 213: trocar `absolute bottom-4 left-5 right-5 flex items-end justify-between relative z-10` por `absolute bottom-4 left-5 right-5 flex items-end justify-between z-10`

