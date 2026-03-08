

# Fix: Dropdown de Playbooks na ação "Aplicar Playbook"

## Problem
The `renderActionConfig` switch statement has no `case 'apply_playbook'`, so it falls to `default` showing "Selecione o tipo de ação acima." — an empty/useless message. Playbook templates are also not fetched.

## Changes in `src/components/configuracoes/AutomationRulesTab.tsx`

### 1. Add playbook state variable (line ~374)
```typescript
const [playbookTemplates, setPlaybookTemplates] = useState<any[]>([]);
```

### 2. Fetch playbook_templates in `fetchRefData` (line ~391)
Add to the Promise.all:
```typescript
supabase.from('playbook_templates').select('id, name, activities, product_id, is_active').eq('is_active', true).order('name')
```
And set state from the result.

### 3. Add `case 'apply_playbook'` in `renderActionConfig` (before `default:` at line ~1124)
- Compute filtered playbooks: if `form.product_id` is set, show playbooks where `product_id === form.product_id` OR `product_id is null`; otherwise show all active.
- Render a Select dropdown with each playbook showing `📋 {name} ({activities.length} atividades)`.
- If no playbooks available, show an informative message.

### Technical Details
- The `playbook_templates` table is already typed as `any` elsewhere in PlaybooksTab.tsx.
- The filtered list recomputes automatically since `form.product_id` is already in state.
- Saved config format: `{ playbook_id: "uuid" }` — matches what `execute-automations` expects.

