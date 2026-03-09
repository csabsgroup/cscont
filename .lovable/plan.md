

# Plano: Cards visuais no Portal + Editor de Texto Rico para Descrição

## 1. Portal de Eventos — Layout com Cards visuais

Atualmente o `PortalEventos.tsx` usa cards simples sem imagem de capa proeminente. O objetivo é reutilizar o mesmo estilo visual do `EventCard.tsx` do CSM (imagem de capa grande, badges sobrepostos, layout limpo).

**Alteração em `src/pages/portal/PortalEventos.tsx`:**
- Substituir os cards atuais por cards no estilo do `EventCard` — imagem de capa no topo (h-40), badges de tipo/categoria sobrepostos, data, local, e badge de status de confirmação do cliente
- Manter o dialog de detalhes ao clicar, mas renderizar a descrição como HTML formatado

## 2. Editor de Texto Rico para Descrição

Instalar uma biblioteca leve de rich text. A melhor opção para o projeto é o **TipTap** (baseado em ProseMirror), que é modular e leve.

**Pacotes:** `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-underline`

**Novo componente: `src/components/ui/rich-text-editor.tsx`**
- Toolbar com botões: **Negrito**, *Itálico*, ~~Riscado~~, Sublinhado, Listas (ordenada/não-ordenada), Títulos (H2, H3)
- Armazena conteúdo como HTML no campo `description` do evento
- Componente reutilizável com props `value`, `onChange`, `readOnly`

**Alterações em `src/pages/EventoDetalhe.tsx`:**
- Substituir o `<Textarea>` de descrição pelo novo `RichTextEditor`
- O valor salvo no banco será HTML

**Alterações em `src/pages/portal/PortalEventos.tsx`:**
- Renderizar a descrição usando `dangerouslySetInnerHTML` com classes de tipografia (prose) para exibição formatada no dialog de detalhes
- Também nos cards, o `line-clamp` continua funcionando com texto extraído

**Estilos:** Adicionar classes `.prose` mínimas no `index.css` para estilizar o HTML renderizado (ou usar as do TipTap).

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `package.json` | Adicionar `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-underline` |
| `src/components/ui/rich-text-editor.tsx` | Criar — editor com toolbar |
| `src/pages/EventoDetalhe.tsx` | Trocar Textarea por RichTextEditor no campo descrição |
| `src/pages/portal/PortalEventos.tsx` | Redesenhar cards com imagem de capa + renderizar HTML formatado |
| `src/index.css` | Adicionar estilos `.prose` para renderização do HTML |

