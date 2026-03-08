

# Plan: Playbook Activities Card Style + Import Automation Toggle

## Ajuste 1 — Atividades do playbook com card simplificado + ações

### File: `src/components/clientes/ClienteTimeline.tsx`

**Current behavior (lines 331-359):** Activities inside expanded playbook render as minimal rows with tree characters (`├─`, `└─`), only showing status icon, order number, title, date, and user name. No action menu, no badges.

**Change:** Replace the minimal row with a compact card that includes:
- Status icon (CheckCircle2/Circle)
- Title
- Badge de tipo (Tarefa, Follow-up, etc.) + badge de prioridade (if not medium)
- Tempo relativo + responsável
- Dropdown menu with Concluir/Reabrir/Excluir actions
- Clicking card still opens `ActivityEditDrawer`
- Remove the tree characters (`├─`, `└─`) — use left border or indentation instead

Essentially reuse the same card template from lines 369-402 but within the playbook expanded section, keeping `pl-10` indentation.

---

## Ajuste 2 — Toggle de automações na etapa de mapeamento da importação

### File: `src/components/import-export/ImportWizard.tsx`

1. **New state:** `enableAutomations: boolean` (default `false`)
2. **UI in `step === 'map'`**: Add a Switch + label below the mapping table:
   - `🔄 Ativar regras de automação para esta importação`
   - Description: "Se ativado, as regras de automação serão disparadas para cada registro importado após a conclusão."
3. **After import completes** (in `handleImport`, after the batch is saved): if `enableAutomations` is true, loop through all successfully inserted office IDs and call `execute-automations` edge function with `trigger_type: 'office.created'` for each one. Use a batch approach — call once per office but don't block the UI (fire and forget with error logging).

### Logic after import:
```typescript
if (enableAutomations && insertedIds.length > 0) {
  toast.info('Disparando automações...');
  for (const officeId of insertedIds) {
    supabase.functions.invoke('execute-automations', {
      body: { action: 'triggerV2', trigger_type: 'office.created', office_id: officeId }
    }).catch(e => console.error('Automation failed for', officeId, e));
  }
  toast.success(`Automações disparadas para ${insertedIds.length} registros.`);
}
```

This only applies to the `offices` template key. For other entity imports (contacts, contracts, meetings), the toggle can still appear but won't trigger automations (or hide it for non-office imports).

