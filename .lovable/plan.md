

# Ajustes: Builder em Configurações + Formulários para Preenchimento + Lógica Condicional

## Resumo das mudanças

### 1. Mover o Builder para dentro de Configurações
O `FormTemplatesTab` atualmente apenas redireciona para `/formularios`. Será substituído pelo builder completo (listagem + editor inline ou navegação para `/configuracoes` com o builder embutido).

**Abordagem**: O `FormTemplatesTab` voltará a ser o componente principal de gestão de formulários, com a listagem de templates e botão para abrir o builder. O builder continuará em `/formularios/builder/:id` como rota protegida, mas o botão "Voltar" levará a `/configuracoes` (seção formulários) em vez de `/formularios`.

### 2. Página /formularios = Preenchimento para CSMs
A página `/formularios` será redesenhada para mostrar apenas:
- Lista de formulários ativos com botão "Preencher"
- Links diretos para preenchimento (abre o `FormFillDialog`)
- Formulários externos mostram link público copiável
- Sem opções de edição/duplicação/exclusão (isso fica em Configurações)

### 3. Lógica Condicional Visível
O roteamento por resposta já está implementado no `FormItemCard` (linhas 262-331), mas só aparece quando:
- O campo é de tipo suportado (multiple_choice, checkboxes, dropdown, etc.)
- **E existem seções criadas** (`sections.length > 0`)
- **E o usuário clica em "Avançado"** (ícone de engrenagem)

Problemas de visibilidade:
- A lógica está escondida atrás do botão "Avançado" -- será movida para o footer principal do card, mais visível
- Se não houver seções, não aparece -- será adicionado um hint para criar seções

## Arquivos afetados

### `src/components/configuracoes/FormTemplatesTab.tsx`
- Restaurar como listagem completa de formulários (tabela com nome, tipo, campos, status)
- Botões: Novo (abre builder), Editar (abre builder), Duplicar, Excluir, Copiar link
- Toggle de ativo/inativo
- Essencialmente o conteúdo atual de `Formularios.tsx` mas com navegação apontando para configurações

### `src/pages/Formularios.tsx`
- Redesenhar como página de preenchimento para CSMs
- Lista de formulários ativos com botão "Preencher" que abre `FormFillDialog`
- Formulários externos mostram link copiável
- Sem opções de administração

### `src/pages/FormBuilder.tsx`
- Alterar botão "Voltar" de `/formularios` para `/configuracoes`

### `src/components/formularios/FormItemCard.tsx`
- Mover o bloco de roteamento condicional para fora da seção "Avançado"
- Exibir diretamente no footer do card quando o tipo suporta routing
- Se `sections.length === 0`, mostrar um aviso "Crie seções para habilitar lógica condicional"
- Tornar o botão de routing mais visível (com ícone e label)

