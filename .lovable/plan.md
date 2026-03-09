

# Fix: Botão "Alterar capa" não funciona ao clicar

## Problema

O `<Button>` na linha 238 tem `pointer-events-none`, que faz os cliques passarem **através** do botão para os elementos por trás dele no z-order, em vez de propagarem para o `<label>` pai. Isso impede que o `<input type="file">` seja acionado.

## Solução

Remover `pointer-events-none` do Button. O `<label>` envolve tanto o Button quanto o input, então clicar no botão naturalmente propaga para o label e aciona o input file. Não precisa de `pointer-events-none`.

### `src/pages/EventoDetalhe.tsx`

- Linha 238: remover `pointer-events-none` da className do Button

