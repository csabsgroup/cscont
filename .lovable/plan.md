

## Plan: Complete Remaining Features

### Analysis of Current vs Required

| Area | Status | Missing |
|------|--------|---------|
| Produtos CRUD | Done | -- |
| Jornada Stages | Done | -- |
| Health Score Config | Done | -- |
| Formulários Builder | Partial | Post-actions config UI, field mapping, preview |
| Catálogo Bônus | Done | -- |
| Integrações | Done (stubs) | -- |
| Usuários & Permissões | Partial | Create user, status toggle, link client→office |
| Eventos | Partial | Auto-pull participants on create, attended/absent status |
| Contratos | Partial | Status/product/period filters |
| Contatos | Partial | CRUD (create/edit/delete), filters |
| Audit Trail | Missing | New page + table |

### Changes

**1. `src/components/configuracoes/FormTemplatesTab.tsx`** — Add post-actions configuration section in the form dialog (create_activity, move_stage, notify toggles with config fields). Add field mapping dropdown per field (map to health indicator or office perception field). Add preview button that renders the form fields read-only.

**2. `src/pages/Configuracoes.tsx` (UsersTab)** — Add "Create User" button that calls `supabase.auth.admin` via edge function to create user with email+password+role. Add status active/inactive indicator. For client role: show office link dropdown. Add manager→CSM linking.

**3. New edge function `supabase/functions/admin-create-user/index.ts`** — Uses service role key to create auth user + assign role + optionally link to office. Required because client-side cannot create users for others.

**4. `src/pages/Eventos.tsx`** — After event creation succeeds, auto-pull active offices from eligible products as participants. Add participation status column (convidado/confirmado/participou/faltou) instead of just confirmed boolean.

**5. `src/pages/ContratosGlobal.tsx`** — Add filter bar: status Select, product Select, date range inputs. Apply filters to the contract list.

**6. `src/pages/ContatosGlobal.tsx`** — Add CRUD: "Novo Contato" button with create dialog (all contact fields). Edit/delete via row actions. Add filters: office, type (decisor/usuário/financeiro), active toggle.

**7. New audit trail table** — DB migration to create `audit_logs` table (id, user_id, action, entity_type, entity_id, details jsonb, created_at) with RLS (admin-only read).

**8. New page `src/pages/AuditLogs.tsx`** — Table listing audit logs with filters (period, user, action type). Admin-only access. Add route in App.tsx and sidebar link.

**9. `src/components/eventos/ParticipantManager.tsx`** — Replace simple confirmed boolean with a status dropdown: convidado → confirmado → participou / faltou.

### DB Migration Required

```sql
-- event_participants: add status column
ALTER TABLE public.event_participants 
ADD COLUMN status text NOT NULL DEFAULT 'convidado';
-- Migrate existing data
UPDATE public.event_participants SET status = CASE WHEN confirmed THEN 'confirmado' ELSE 'convidado' END;

-- audit_logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
```

### Files Summary

| File | Action |
|------|--------|
| `src/components/configuracoes/FormTemplatesTab.tsx` | Add post-actions UI, field mapping, preview |
| `src/pages/Configuracoes.tsx` (UsersTab) | Create user flow, status, client-office link |
| `supabase/functions/admin-create-user/index.ts` | New edge function for user creation |
| `src/pages/Eventos.tsx` | Auto-enroll participants on create |
| `src/components/eventos/ParticipantManager.tsx` | Status dropdown (4 states) |
| `src/pages/ContratosGlobal.tsx` | Add filters |
| `src/pages/ContatosGlobal.tsx` | Add CRUD + filters |
| `src/pages/AuditLogs.tsx` | New audit trail page |
| `src/App.tsx` | Add audit route |
| `src/components/AppSidebar.tsx` | Add audit nav link |
| DB migration | audit_logs table + event_participants status column |

