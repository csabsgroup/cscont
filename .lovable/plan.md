

# Rebuild Completo do Builder de Formulários (Google Forms Style)

Este é um projeto grande que será dividido em etapas. O builder atual (1129 linhas em um único componente Sheet) será substituído por um editor visual dedicado em página própria, com canvas de blocos, sidebar de inserção e suporte completo aos 12 tipos de pergunta do Google Forms.

---

## Arquitetura

```text
/formularios                → Lista de formulários + submissões recentes
/formularios/builder/:id    → Editor visual (novo)
/formularios/builder/new    → Criação
/forms/:formHash            → Formulário público (redesenhado)
```

### Estrutura de componentes

```text
src/pages/FormBuilder.tsx              → Página principal do editor
src/components/formularios/
  ├── FormBuilderCanvas.tsx            → Canvas central com blocos
  ├── FormBuilderSidebar.tsx           → Barra lateral de inserção
  ├── FormBuilderSettings.tsx          → Aba Settings (publicação, validação, tema)
  ├── FormBuilderResponses.tsx         → Aba Respostas (tabela simples)
  ├── FormItemCard.tsx                 → Card individual de pergunta/bloco
  ├── FormSectionBreak.tsx             → Bloco de quebra de seção
  ├── FormFieldRenderer.tsx            → Renderizador universal de campos
  ├── FormConditionalRouter.tsx        → UI de roteamento por resposta
  └── FormThemePreview.tsx             → Preview com tema customizado
```

---

## Mudanças no Banco de Dados

### Migration: Novas colunas em `form_templates`

```sql
ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS theme jsonb DEFAULT '{}';
-- theme: { primary_color, bg_color, header_image_url, font_style }

ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}';
-- settings: { collect_email, limit_one_response, allow_edit, show_progress, 
--   shuffle_questions, confirmation_message, is_accepting_responses }

ALTER TABLE form_templates ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false;
```

### Migration: Validação avançada (no JSON do campo)

Não precisa de nova coluna -- a validação fica dentro do JSON `fields[]` de cada campo, em uma propriedade `validation`:

```json
{
  "type": "regex",
  "pattern": "^\\d{5}-\\d{3}$",
  "error_message": "CEP inválido",
  "min_length": 5,
  "max_length": 100,
  "min_selections": 2,
  "max_selections": 5
}
```

---

## Tipos de Pergunta (12 tipos)

| Tipo interno | Label | Novo? |
|---|---|---|
| `short_answer` | Texto curto | Renomeia `text` |
| `paragraph` | Parágrafo | Renomeia `textarea` |
| `multiple_choice` | Múltipla escolha (radio) | **NOVO** |
| `checkboxes` | Caixas de seleção | Renomeia `multi_select` |
| `dropdown` | Menu suspenso | Mantém |
| `file_upload` | Upload de arquivo | Renomeia `file` |
| `linear_scale` | Escala linear | Mantém |
| `rating` | Avaliação (estrelas/coração) | Evolui `rating_5` |
| `multiple_choice_grid` | Grade única | **NOVO** |
| `checkbox_grid` | Grade múltipla | **NOVO** |
| `date` | Data | Mantém |
| `time` | Hora | **NOVO** |

Compatibilidade retroativa: os tipos antigos (`text`, `textarea`, `multi_select`, `rating_5`, `rating_nps`, `number`, `currency`, `boolean`) continuam funcionando no renderizador, mas o builder usará os novos nomes.

---

## Editor Visual (FormBuilder.tsx)

### Layout

```text
┌──────────────────────────────────────────────────────┐
│ ← Voltar   [Título do Formulário editável]   Preview │Publicar│
├──────────────────────────────────────────────────────┤
│ [Perguntas]  [Respostas]  [Configurações]            │
├────────────────────────────────┬─────────────────────┤
│                                │  + Pergunta          │
│   ┌─────────────────────┐     │  + Título/Desc       │
│   │ Bloco de Seção      │     │  + Seção             │
│   └─────────────────────┘     │  + Imagem            │
│   ┌─────────────────────┐     │                      │
│   │ Pergunta 1          │     │                      │
│   │ [tipo] [opções]     │     │                      │
│   │ [routing config]    │     │                      │
│   └─────────────────────┘     │                      │
│   ┌─────────────────────┐     │                      │
│   │ Pergunta 2          │     │                      │
│   └─────────────────────┘     │                      │
│                                │                      │
└────────────────────────────────┴─────────────────────┘
```

### Funcionalidades do Canvas

- Cada item é um card editável inline (click to edit)
- Drag & drop para reordenar (já usamos @hello-pangea/dnd)
- Duplicar, excluir pergunta
- Seções aparecem como separadores visuais com título e descrição
- Seleção de tipo via dropdown no card
- Roteamento por resposta configurável diretamente no card (para Multiple choice, Checkboxes, Dropdown)

### Aba Configurações

- **Publicação**: Publicar/Despublicar toggle, Aceitar respostas on/off
- **Respostas**: Limitar a 1 resposta, Coletar email, Permitir edição
- **Apresentação**: Mensagem de confirmação, Barra de progresso
- **Tema**: Cor primária, cor de fundo, imagem de cabeçalho (upload para storage)
- **Validação avançada**: Config por campo (regex, min/max, etc.)

### Aba Respostas

- Tabela de submissões (como está hoje na /formularios)
- Visualização individual em drawer

---

## Lógica Condicional (Branching por Seção)

Modelo idêntico ao Google Forms:

1. Seções são `PageBreakItem` -- cada uma inicia uma nova página
2. Em perguntas de tipo `multiple_choice`, `checkboxes`, `dropdown` -- cada opção pode apontar para uma seção ou `__end__`
3. Navegação do respondente é step-by-step (página a página)
4. Botões Next/Back/Submit entre seções

A estrutura de dados no campo permanece como já está (routing_type, routes[], default_target_section_id), apenas a UI melhora.

---

## Formulário Público (FormPublic.tsx) -- Redesenho

- Step-by-step quando há seções (uma seção por vez com Next/Back)
- Tema customizável aplicado via CSS variables
- Validação avançada no client-side
- Barra de progresso
- Suporte a todos os 12 tipos de pergunta
- Mensagem de confirmação customizada

---

## Bug do Seletor de Clientes

O `FormFillDialog` carrega offices com `.eq('status', 'ativo')` -- o bug pode ser que os clientes não têm status 'ativo' ou a RLS está bloqueando. Será investigado e corrigido junto com o redesenho.

---

## Arquivos Afetados

### Novos
- `src/pages/FormBuilder.tsx` -- Editor visual completo
- `src/components/formularios/FormBuilderCanvas.tsx`
- `src/components/formularios/FormBuilderSidebar.tsx`
- `src/components/formularios/FormBuilderSettings.tsx`
- `src/components/formularios/FormBuilderResponses.tsx`
- `src/components/formularios/FormItemCard.tsx`
- `src/components/formularios/FormFieldRenderer.tsx` -- Renderizador compartilhado

### Editados
- `src/App.tsx` -- Nova rota /formularios/builder/:id
- `src/pages/Formularios.tsx` -- Redesenho da listagem com link para builder
- `src/pages/FormPublic.tsx` -- Redesenho completo com temas e step-by-step
- `src/components/reunioes/FormFillDialog.tsx` -- Usa FormFieldRenderer compartilhado + fix seletor de clientes
- `src/components/configuracoes/FormTemplatesTab.tsx` -- Simplificado para redirecionar ao builder

### Migration SQL
- Colunas `theme`, `settings`, `is_published` em `form_templates`

---

## Ordem de Implementação

1. Migration SQL (colunas novas)
2. FormFieldRenderer compartilhado (12 tipos)
3. FormBuilder page + Canvas + Sidebar
4. FormBuilderSettings (publicação, tema, validação)
5. FormBuilderResponses
6. Redesenho do FormPublic (step-by-step + tema)
7. Atualização do FormFillDialog + fix seletor de clientes
8. Atualização de rotas e listagem
9. Simplificação do FormTemplatesTab

