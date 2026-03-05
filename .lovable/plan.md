

# Plan: Status Dropdown na Visão 360

## O que muda
O badge de status do cliente se torna um dropdown clicável em dois locais: no header (ClienteHeader) e no corpo da Visão 360 (ClienteVisao360). Apenas Admin, CSM e Manager podem alterar. Viewer e Client veem o badge normal (sem dropdown).

Ao selecionar um status "negativo" (Churn, Não Renovado, Não Iniciado), abre o popup existente `StatusChangeModal` pedindo data, motivo e observação. Para status "positivos" (Ativo, Upsell, Bônus Elite, Pausado), abre o `StatusChangeModal` com confirmação simples (já funciona assim).

O fluxo atual via menu "..." > "Alterar Status" > Dialog intermediário com Select é removido/simplificado, pois o dropdown direto substitui essa necessidade.

## Arquivos e mudanças

### 1. Novo componente: `StatusDropdown.tsx`
Cria `src/components/clientes/StatusDropdown.tsx` que:
- Renderiza um `DropdownMenu` estilizado como o `StatusBadge` atual (mesmas cores por status)
- Lista todos os status (exceto o atual) como opções no menu
- Cada opção tem o dot de cor correspondente
- Recebe `onStatusSelect(newStatus)` callback
- Recebe `readonly` prop: se true, renderiza o badge estático (para Viewer/Client)

### 2. `ClienteHeader.tsx`
- Substitui `<StatusBadge status={office.status} />` por `<StatusDropdown>` quando visível
- Passa `readonly={isViewer || isClient}` 
- Conecta `onStatusSelect` ao callback do parent

### 3. `ClienteVisao360.tsx`
- No card "Status" do grid de infoFields, substitui o texto estático por `<StatusDropdown>`
- Recebe props `onStatusSelect` e `canEditStatus` do parent

### 4. `Cliente360.tsx`
- Remove o Dialog intermediário de seleção de status (linhas 392-408)
- Cria callback `handleStatusSelect(newStatus)` que seta `selectedStatusTarget` e abre `showStatusChange` diretamente no `StatusChangeModal`
- Passa `onStatusSelect` para `ClienteHeader` e `ClienteVisao360`
- Passa `canEditStatus={!isViewer && !isClient}` para ambos

### Nenhuma mudança de banco
O `StatusChangeModal` já trata todos os cenários (churn com campos obrigatórios, positivos com confirmação simples). Apenas eliminamos o passo intermediário.

