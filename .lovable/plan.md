

# Fix: Dropdown de nova pergunta sumindo ao mover o mouse

## Problema
O submenu usa CSS `group-hover:block` com `mr-2` (gap de 8px) entre o botão e o painel. Ao mover o mouse do botão para o dropdown, ele passa por essa lacuna, saindo da área do `group`, e o menu desaparece.

## Correção em `src/components/formularios/FormBuilderSidebar.tsx`
- Remover o `mr-2` do dropdown absoluto
- Adicionar padding invisível no dropdown para criar uma "ponte" entre o botão e o painel, mantendo o hover contínuo
- Usar `pr-2` no wrapper externo do dropdown (área transparente que conecta ao botão) e manter o painel visual com as mesmas dimensões

Basicamente trocar:
```
<div className="absolute right-full top-0 mr-2 hidden group-hover:block z-50">
  <div className="bg-popover border rounded-lg ...">
```
Por:
```
<div className="absolute right-full top-0 hidden group-hover:block z-50 pr-2">
  <div className="bg-popover border rounded-lg ...">
```

O `pr-2` fica no container invisível (sem fundo), criando a ponte hover. O painel visual interno mantém o gap visual de 8px.

## Arquivo afetado: 1

