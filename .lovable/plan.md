

# Fix: Seções não mantêm a ordem ao arrastar

## Causa raiz

O cálculo de `dstSectionOrder` nas linhas 282-291 está errado. A lógica tenta contar seções antes do `dstIdx`, mas o loop e as condições produzem resultados incorretos -- especialmente quando há perguntas intercaladas entre seções.

## Solução

Simplificar o mapeamento: contar quantos itens do tipo `section` existem antes de `srcIdx` e `dstIdx` no array `canvasItems` para obter os índices corretos no array de seções.

```typescript
// Conta seções antes de um índice no canvas
const sectionIndexAt = (canvasIdx: number) => 
  canvasItems.slice(0, canvasIdx).filter(i => i.type === 'section').length;

const srcSectionIdx = sectionIndexAt(srcIdx);
// Para destino, se movendo para baixo precisa considerar o offset
const dstSectionIdx = sectionIndexAt(dstIdx);
```

Substituir as linhas 275-296 em `src/pages/FormBuilder.tsx` com esta lógica simplificada.

## Arquivo afetado
- `src/pages/FormBuilder.tsx` -- linhas 275-296 (bloco `if (dragId.startsWith('section-'))`)

