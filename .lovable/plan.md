

# Filtrar clientes por produto do formulário

## Contexto
Quando um formulário tem `product_id` definido (ex: "Aceleração CEO"), o campo de seleção de cliente deve mostrar apenas os escritórios que possuem esse produto ativo (`offices.active_product_id`). Formulários sem `product_id` continuam mostrando todos os clientes.

## Mudanças em `src/components/reunioes/FormFillDialog.tsx`

1. **Adicionar `product_id` à interface `FormTemplate`** e ao select de templates (linha 88)
2. **Adicionar `active_product_id` à interface `OfficeOption`** e ao select de offices (linha 101)
3. **Filtrar `filteredOffices`** pelo `product_id` do template selecionado:
   - Se o template selecionado tem `product_id`, mostrar apenas offices com `active_product_id === product_id`
   - Caso contrário, mostrar todos
4. **Limpar o cliente selecionado** quando o template muda (já faz `setFormData({})`, adicionar `setSelectedOfficeId('')`)

### Detalhes técnicos
- Query de templates: adicionar `product_id` ao select
- Query de offices: adicionar `active_product_id` ao select
- No `filteredOffices` memo, adicionar filtro condicional pelo produto do template selecionado
- Resetar seleção de cliente ao trocar template para evitar inconsistência

