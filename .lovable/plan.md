

# Fix: Descrição com HTML aparecendo como texto no card

## Problema
O campo `description` agora contém HTML (do RichTextEditor), mas o `EventCard` renderiza como texto puro dentro de um `<p>`, mostrando as tags cruas (`<h2><strong>...`).

## Solução
Remover as tags HTML para exibir apenas o texto limpo no preview do card. Usar uma função simples de strip HTML (`replace(/<[^>]*>/g, '')`) antes de exibir.

## Arquivo
`src/components/eventos/EventCard.tsx` — linha 79: trocar `{event.description}` por versão com HTML removido.

