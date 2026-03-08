

# Duplicate Playbook Feature

## What to build
Add a "Duplicate" button next to Edit/Delete in the playbooks table. Clicking it creates a copy of the playbook with name "Cópia de [original name]", opens the editor pre-filled with all duplicated data, allowing the user to adjust before saving.

## Changes in `src/components/configuracoes/PlaybooksTab.tsx`

1. Add a new `handleDuplicate` function that calls `openEdit`-like logic but with `editingId = null` (so it inserts as new) and prefixes the name with "Cópia de ".

2. Add a `Copy` icon button in the actions column between Edit and Delete.

### Implementation detail
```typescript
import { Copy } from 'lucide-react';

const handleDuplicate = (pb: any) => {
  setEditingId(null); // null = insert new
  setName(`Cópia de ${pb.name}`);
  setDescription(pb.description || '');
  setProductId(pb.product_id || '');
  setIsActive(true);
  setAutoAdvance(pb.auto_advance_journey || false);
  setAdvanceToStageId(pb.advance_to_stage_id || '');
  const acts = Array.isArray(pb.activities)
    ? pb.activities.map((a: any) => ({ ...a, id: genId() }))
    : [emptyActivity()];
  setActivities(acts);
  setEditorOpen(true);
};
```

Then in the table row actions, add between Edit and Delete:
```tsx
<Button size="sm" variant="ghost" onClick={() => handleDuplicate(pb)}>
  <Copy className="h-4 w-4" />
</Button>
```

Single file change, minimal and consistent with existing patterns.

