

# Fix: Portal tela branca + Filtro de Gestores

## Problema 1 — Portal do Cliente: Tela Branca

**Causa raiz:** Todas as páginas do portal (PortalHome, PortalContrato, PortalOKR, etc.) chamam `usePortal()` que exige estar dentro de um `PortalProvider`. Porém, o `PortalRoute` no App.tsx envolve as páginas apenas com `PortalLayout` — sem `PortalProvider`. O `usePortal()` lança uma exceção e a tela fica branca.

**Correção:** Envolver o `PortalLayout` com `PortalProvider` dentro do `PortalRoute` no App.tsx:

```typescript
function PortalRoute({ children }) {
  // ... auth checks ...
  return (
    <PortalProvider>
      <PortalLayout>{children}</PortalLayout>
    </PortalProvider>
  );
}
```

Adicionalmente, o `PortalLayout` já busca `officeId` e `officeName` por conta própria (duplicando a lógica do `PortalContext`). Refatorar `PortalLayout` para usar `usePortal()` em vez de buscar dados duplicados, eliminando o `useEffect` interno que consulta `client_office_links`.

## Problema 2 — Páginas do Portal ficam em branco ao navegar

Mesmo problema: sem `PortalProvider`, qualquer página do portal que usa `usePortal()` crasha. A correção do Problema 1 resolve isso automaticamente.

## Problema 3 — Filtro de CSM deve incluir Gestores

Nas telas de **Dashboard** e **Jornada**, o filtro "Responsável" / "Consolidado do time" lista apenas usuários com role `csm`. Um gestor que tem clientes na sua carteira (via `manager_csm_links` → CSMs → offices) não aparece nesse filtro.

**Correção:** Nos dois arquivos (Dashboard.tsx e Jornada.tsx):

1. Buscar também os usuários com role `manager` e incluí-los na lista de filtro, identificados como "Gestor"
2. Ao filtrar por um gestor, expandir para incluir todos os CSMs subordinados a ele (via `manager_csm_links`), filtrando offices cujo `csm_id` esteja nessa lista
3. Buscar `manager_csm_links` para mapear gestor → CSMs

A lógica de filtro ficaria:
- Se o ID selecionado é de um CSM → filtra `csm_id === selectedId` (como hoje)
- Se o ID selecionado é de um manager → busca CSMs subordinados e filtra `csm_id IN subordinados`

## Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/App.tsx` | Envolver PortalLayout com PortalProvider no PortalRoute |
| `src/components/portal/PortalLayout.tsx` | Usar `usePortal()` em vez de buscar office internamente |
| `src/pages/Dashboard.tsx` | Incluir managers no filtro + lógica de expansão para CSMs subordinados |
| `src/pages/Jornada.tsx` | Incluir managers no filtro + lógica de expansão para CSMs subordinados |

