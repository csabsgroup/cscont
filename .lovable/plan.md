

# Plan: User Management - Edit, Deactivate, Delete

## Overview
Expand the `UsersTab` in Configuracoes and the `admin-create-user` edge function (renamed/extended to `admin-manage-user`) to support editing users: reset password, toggle active/banned status, assign CSM product, and delete/deactivate users.

## 1. Edge Function: `admin-manage-user/index.ts`

Create a new edge function that handles multiple actions via a `action` field in the request body. Reuses the same auth/RBAC pattern from `admin-create-user`.

**Supported actions:**
- `update_password` — calls `adminClient.auth.admin.updateUserById(userId, { password })`
- `deactivate` — calls `adminClient.auth.admin.updateUserById(userId, { ban_duration: "876000h" })` (bans for ~100 years)
- `reactivate` — calls `adminClient.auth.admin.updateUserById(userId, { ban_duration: "none" })`
- `delete` — calls `adminClient.auth.admin.deleteUser(userId)` + cascade handles the rest
- `update_profile` — updates `profiles.full_name`, `user_roles.role`, and optionally links CSM to product offices
- `set_csm_product` — updates which product the CSM is responsible for (stores in a new field or manages office assignments)

**RBAC:** Admin can manage all users. Manager can only manage CSM/client users.

## 2. Database: Add `product_id` to `profiles` table

Add a nullable `product_id` column to the `profiles` table to track which product a CSM is assigned to. This is simpler than creating a separate linking table.

```sql
ALTER TABLE public.profiles ADD COLUMN product_id uuid;
```

## 3. Frontend: Expand `UsersTab` in `Configuracoes.tsx`

### Table columns update
- Add columns: **E-mail** (from profiles or auth), **Produto** (for CSMs), **Status** (ativo/inativo), **Ações** (edit button)

### Edit Dialog
A dialog with tabs/sections:
- **Dados**: Name, Role (select), Product assignment (select, shown for CSM role)
- **Segurança**: Reset password (new password field + confirm)
- **Status**: Toggle active/inactive, Delete button with confirmation

### User status display
- Show badge "Ativo" / "Inativo" based on profile data
- Fetch user metadata via the edge function to check ban status

## 4. Edge Function: Fetch users list

Add a `list` action to `admin-manage-user` that returns users with their auth metadata (banned status, email, last sign in) since the client can't access `auth.users` directly.

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | Add `product_id` to profiles |
| `supabase/functions/admin-manage-user/index.ts` | New edge function for all user management actions |
| `src/pages/Configuracoes.tsx` | Expand UsersTab with edit dialog, status management, product assignment |

