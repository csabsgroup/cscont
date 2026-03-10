

# Fix: Sidebar com texto cortado + Página branca ao navegar

## Diagnóstico

Ambos os problemas têm a **mesma causa raiz**: a arquitetura de rotas atual.

Cada rota faz:
```jsx
<Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
<Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
```

Isso faz o React **desmontar e remontar** o `AppLayout` inteiro (sidebar, header, navigation tabs) a cada navegação. Resultado:
- **Página branca**: O layout inteiro desmonta → monta de novo → dados precisam carregar novamente
- **Texto cortado no sidebar**: O `SidebarProvider` reinicializa, causando uma animação de transição que corta o texto durante o remount (o `overflow-hidden` + `transition-[width,height,padding]` do `SidebarMenuButton` clipa o texto durante a transição)

## Solução

Converter para **Layout Route** do React Router v6. O layout fica montado permanentemente e apenas o conteúdo interno troca via `<Outlet />`.

```text
ANTES:                          DEPOIS:
Route "/" → Protected+Layout    Route element={<ProtectedLayout />}
Route "/clientes" → Prot+Layout   ├── Route "/" → Dashboard
Route "/jornada" → Prot+Layout    ├── Route "/clientes" → Clientes
  (remonta tudo a cada nav)        ├── Route "/jornada" → Jornada
                                   └── (sidebar/header NUNCA remontam)
```

## Arquivos afetados

### 1. `src/App.tsx`
- `ProtectedRoute` usa `<Outlet />` em vez de `{children}`
- Agrupar todas as rotas protegidas como filhas de um `<Route element={<ProtectedRoute />}>`
- Mesmo padrão para `PortalRoute`

### 2. `src/components/AppLayout.tsx`
- Receber conteúdo via `<Outlet />` de `react-router-dom` em vez de `{children}`
- Remover prop `children`

Resultado: **2 arquivos editados**, nenhuma tabela ou migração necessária.

