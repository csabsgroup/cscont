

# Plano: Adicionar Upload de Capa na Criação de Evento

## Diagnóstico

O upload de capa funciona apenas na página de detalhe do evento (`/eventos/:id`), após o evento já ter sido criado. O formulário de **criação** de evento na página `/eventos` não possui campo para upload de imagem de capa nem editor de texto rico para descrição.

## Alterações

### `src/pages/Eventos.tsx`

1. Adicionar campo de upload de capa no dialog de criação:
   - Preview da imagem selecionada
   - Upload para o bucket `event-covers` após criação do evento (precisa do ID)
   - Fluxo: cria evento → faz upload da capa → atualiza `cover_url` no evento

2. Substituir o `Textarea` de descrição pelo `RichTextEditor` no dialog de criação

### Fluxo técnico

```text
Criar evento (insert) → obter ID
  → Se tem arquivo de capa: upload para event-covers/{id}.ext
  → Atualizar cover_url no evento
```

| Arquivo | Ação |
|---|---|
| `src/pages/Eventos.tsx` | Adicionar preview+upload de capa e RichTextEditor na criação |

