
## Problema identificado

A ordenação ainda falha porque o builder está usando uma lista única de drag contendo:
- perguntas soltas
- cabeçalho da seção
- perguntas da seção

Na prática, só o cabeçalho da seção é arrastável. As perguntas daquela seção não fazem parte do mesmo bloco de drag. Isso torna o `destination.index` ambíguo e a seção não “encaixa” na ordem visual esperada.

## Ajuste que vou fazer

Vou mudar a modelagem do canvas para que a ordenação de seções aconteça por blocos reais de seção, não por cabeçalhos soltos.

## Como vai funcionar

### 1. Separar visualmente em dois níveis
No canvas:
- perguntas sem seção continuam livres no topo
- cada seção vira um bloco único
- dentro desse bloco ficam:
  - cabeçalho da seção
  - perguntas daquela seção

### 2. Drag & drop das seções por bloco
Em vez de calcular a nova posição usando o índice da lista mista, vou:
- renderizar as seções ordenadas em uma lista própria
- arrastar a seção pelo índice dessa lista de seções
- reordenar apenas `sections`

Isso elimina o problema de índice causado pelas perguntas intercaladas.

### 3. Perguntas continuam organizadas automaticamente
Quando uma pergunta for atribuída a uma seção:
- ela continuará sendo movida automaticamente para o fim daquela seção
- ao renderizar, aparecerá dentro do bloco correto

### 4. Persistência correta ao salvar
No save:
- `sections` será salvo já na nova ordem
- `fields` continuará sendo recalculado conforme a ordem visual final

## Arquivos que pretendo ajustar

### `src/pages/FormBuilder.tsx`
- refatorar o canvas para renderizar seções como blocos
- criar drag de seções em lista própria
- simplificar `onDragEnd`:
  - um fluxo para reordenar seções por índice real
  - outro fluxo para mover perguntas

### `src/components/formularios/FormItemCard.tsx`
- provavelmente sem mudança estrutural grande
- manter o callback de mudança de seção para auto-organização

## Resultado esperado

Depois disso:
- ao arrastar uma seção, ela ficará exatamente na posição visual em que foi solta
- as perguntas daquela seção acompanharão o bloco corretamente
- a ordenação ficará previsível mesmo com perguntas sem seção e múltiplas seções no formulário

## Detalhe técnico
A correção não deve ser apenas no cálculo de índice atual. O problema é de estrutura do drag. Vou trocar a ordenação de “item misto” para “bloco de seção”, que é a forma confiável para esse builder.
