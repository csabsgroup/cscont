

# Plan: Automation Rules Redesign, Flexible Import, Office IDs & Product Prefixes

## Overview
Three major changes: (1) Redesign automation rules to a 4-step SenseData-style layout with condition groups, full scheduling, and multiple action types; (2) Make imports fully flexible with auto-mapping and preview; (3) Add unique office IDs based on product prefix.

---

## 1. Automation Rules — 4-Step SenseData Layout

### Current state
Single dialog with trigger, conditions (flat list), no actions section, no scheduling.

### New layout
Replace the dialog with a **full-page editor** (or large modal) with 4 numbered sections:

**Step 1 — Informações**
- Name, Status (Ativo/Inativo), Produto (dropdown), Atingir (Cliente/Contato)

**Step 2 — Condições (Groups)**
- Support multiple **Condition Groups** (Grupo A, Grupo B, etc.)
- Each group has multiple conditions: `[Categoria] [Campo] [Operação] [Valor]`
- User chooses logic **within** each group (AND/OR) and **between** groups (AND/OR)
- Buttons: "Adicionar Grupo", "Duplicar Grupo", "Excluir Grupo"
- Each condition row has copy/add/remove icons
- "Ver amostra de clientes" link to preview matching offices (future)
- Keep all existing 38+ condition fields + custom fields

**Step 3 — Agendamento e Recorrência**
- Data de Início (date picker, default today)
- Executar Regra: dropdown (1 única vez, Todos os dias, Toda semana, Todo mês, Último dia do mês)
- Parar Execução: radio (Nunca / Em [date] / Após [X] ocorrências)
- Atingir novamente o mesmo cliente: dropdown (Sempre / Nunca / A cada intervalo de [X] dias)

**Step 4 — Ações (multiple)**
- Support multiple actions, each with type dropdown + config:
  - **Criar Atividade**: descrição, instruções, checklist items, tipo, categoria, prioridade, hora início/fim, conclusão (dias ou data fixa), responsável (CSM do cliente / fixo / gestor), anotações, checkbox "enviar alerta"
  - **Enviar Notificação**: destinatário (CSM/Gestor/Admin), título, mensagem
  - **Enviar Email**: destinatário (CSM/cliente/contato), assunto, corpo
  - **Mover Etapa da Jornada**: etapa destino (dropdown)
  - **Alterar Status**: novo status
  - **Criar Plano de Ação**: título, descrição, prazo
- "Adicionar Ação" link to add more

### DB changes
Update `automation_rules_v2` table:
```sql
ALTER TABLE public.automation_rules_v2 
  ADD COLUMN IF NOT EXISTS schedule_config jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_type text DEFAULT 'client';
```
The `conditions` column changes format to support groups:
```json
{
  "logic": "and",
  "groups": [
    { "logic": "or", "conditions": [{ "field": "...", "operator": "...", "value": "..." }] }
  ]
}
```
The `actions` column stores array of action configs.

### Files
- **Rewrite** `src/components/configuracoes/AutomationRulesTab.tsx` — list page + full editor
- Keep existing triggers and condition fields, add group structure

---

## 2. Flexible Import System

### Current state
Each entity has hardcoded fields in `import-templates.ts`. Only those fields can be imported.

### Changes

**Dynamic field discovery**: Instead of hardcoded field lists, build import templates dynamically from the actual DB schema columns + custom fields. The template still defines the entity and table, but the field list includes ALL columns.

**Enhanced auto-mapping**: 
- Current: fuzzy match on normalized field labels
- New: also match on exact column name (e.g., if CSV header is `cnpj` and DB column is `cnpj`, auto-match)
- Show visual preview of mapping with status badges (green = auto-mapped, yellow = manual, red = unmapped required)

**Preview step**: Between mapping and validation, show a table preview of the first 5 rows with mapped data so the user can visually verify before proceeding.

**Custom fields in import**: For offices, also show custom fields as mapping targets. Values go to `custom_field_values`.

### Files
- **Update** `src/lib/import-templates.ts` — expand field lists to include ALL native columns per table
- **Update** `src/components/import-export/ImportWizard.tsx` — add preview step, improve auto-map UI with status indicators
- **Update** `insertRow` function — handle additional columns dynamically

---

## 3. Office Unique ID (Product Prefix + Sequential)

### Concept
Each office gets a human-readable code like `ELT-001`, `STR-042` based on the product it's assigned to at creation. This ID is **fixed forever** — never changes even if product changes.

### DB changes
```sql
ALTER TABLE public.offices ADD COLUMN IF NOT EXISTS office_code text UNIQUE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS code_prefix text;
```

### Logic
- Admin configures `code_prefix` per product in the Products settings (e.g., Elite = "ELT", Start = "STR", Aceleração = "ACL")
- On office creation: query max existing sequential for that prefix, increment, format as `{PREFIX}-{NNN}`
- Store in `offices.office_code`
- Display in the 360 header, clients table, and import/export

### Files
- **Update** Products config UI to add prefix field
- **Update** office creation logic (wherever offices are created) to auto-generate code
- **Update** `ClienteHeader.tsx` to display office_code
- **Update** `Clientes.tsx` to show ID column
- **Update** import templates to support office_code as a field

---

## Summary of Changes

| Area | Files | Type |
|------|-------|------|
| Automation rules | `AutomationRulesTab.tsx` (major rewrite) | UI |
| DB: automation schedule | Migration: add `schedule_config`, `target_type` to `automation_rules_v2` | DB |
| DB: conditions format | Existing `conditions` jsonb column, new group format | Data format |
| Import flexibility | `import-templates.ts`, `ImportWizard.tsx` | UI + Logic |
| Office ID | Migration: add `office_code` to offices, `code_prefix` to products | DB |
| Office ID display | `ClienteHeader.tsx`, `Clientes.tsx`, Products config | UI |

Estimated: ~3 migrations, ~6 file changes (1 major rewrite).

