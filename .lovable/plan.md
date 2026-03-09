

# Adicionar cores nas confirmações de presença

## O que será feito

Adicionar indicadores visuais coloridos (bolinhas/dots) nos selects de Confirmação e Presença no `ParticipantManager`, para que o usuário identifique rapidamente o status de cada participante.

## Mudanças em `src/components/eventos/ParticipantManager.tsx`

1. **Select de Confirmação** -- Adicionar um dot colorido antes do texto em cada `SelectItem` e no `SelectValue`:
   - A Confirmar: dot cinza (`bg-muted-foreground`)
   - Confirmado: dot azul/primary (`bg-primary`)
   - Não Vai: dot laranja (`bg-orange-500`)

2. **Select de Presença** -- Mesmo padrão:
   - Pendente (—): sem dot
   - Compareceu: dot verde (`bg-emerald-500`)
   - Não Compareceu: dot vermelho (`bg-destructive`)

3. **Badges read-only** -- Adicionar o mesmo dot colorido antes do texto nos badges exibidos no modo somente leitura.

### Implementação

- Adicionar campo `dot` às constantes `CONFIRMATION_OPTIONS` e `ATTENDANCE_OPTIONS` com as classes de cor do dot
- Renderizar um `<span className="h-2 w-2 rounded-full {dot}" />` antes do label em cada `SelectItem` e no trigger via `SelectValue`
- Adicionar o dot também nos `<Badge>` do modo readOnly

