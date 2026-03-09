

# Plano: Adicionar link de Eventos na Sidebar

## Problema
A rota `/eventos` existe e funciona, mas não há link na sidebar lateral para acessá-la.

## Solução
Adicionar o item **Eventos** (ícone `Calendar`) na lista `allOperationItems` do `AppSidebar.tsx`, logo após "Formulários". O item já será automaticamente ocultado para usuários com role `client`, pois o filtro existente remove itens conforme a role — basta adicionar Eventos à lista de itens filtrados para clients.

### Alteração em `src/components/AppSidebar.tsx`:

Adicionar na lista `allOperationItems`:
```ts
{ title: 'Eventos', url: '/eventos', icon: Calendar }
```

E atualizar o filtro de role `client` para também esconder Eventos:
```ts
if (role === 'client') {
  return allOperationItems.filter(item => 
    item.url !== '/tarefas-internas' && item.url !== '/eventos'
  );
}
```

Importar `Calendar` do lucide-react (já importado no arquivo).

**Uma única alteração em um único arquivo.**

