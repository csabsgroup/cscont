

# Plan: Delete Client Feature (Cascade, Admin/Manager only)

## Overview
Add a "Excluir Cliente" option in the existing dropdown menu (⋮) on `ClienteHeader`, visible only to admin and manager roles. Requires typing "EXCLUIR" to confirm. Deletes all related data in cascade.

## Changes

### 1. ClienteHeader.tsx
- Add `onDelete` prop and `Trash2` icon import
- Add a new `DropdownMenuItem` "Excluir Cliente" with destructive styling, visible only when `isAdmin || isManager`
- The item calls `onDelete`

### 2. Cliente360.tsx
- Import `AlertDialog` components and `Input`
- Add state: `showDeleteConfirm`, `deleteConfirmText`, `deleting`
- Add `handleDeleteClient` function that deletes related data in order:
  1. `activity_checklists` (via activity IDs)
  2. `activities` (by office_id)
  3. `form_submissions` (by office_id)
  4. `form_action_executions` (via submission IDs)
  5. `meeting_transcripts` (via meeting IDs)
  6. `meetings` (by office_id)
  7. `contacts` (by office_id)
  8. `contracts` (by office_id)
  9. `action_plans` (by office_id)
  10. `bonus_grants` / `bonus_requests` (by office_id)
  11. `health_scores` (by office_id)
  12. `health_playbook_executions` (by office_id)
  13. `office_stage_history` (by office_id)
  14. `office_journey` (by office_id)
  15. `automation_executions` (by office_id)
  16. `event_participants` (by office_id)
  17. `client_office_links` (by office_id)
  18. `offices` (by id)
- On success: toast, navigate to `/clientes`
- Log deletion to `audit_logs`
- Add AlertDialog with input requiring "EXCLUIR" to enable the confirm button
- Pass `onDelete={() => setShowDeleteConfirm(true)}` to `ClienteHeader`
- Use `isAdmin` and `isManager` from `useAuth`

### 3. AuthContext usage
- `Cliente360` already imports `useAuth`. Will destructure `isAdmin` and `isManager` in addition to existing `isViewer`.

### No DB migration needed
All deletes use existing tables. RLS policies already allow admin full access. The cascade is handled client-side in sequence.

