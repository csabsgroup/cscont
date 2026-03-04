

## Plan: 5 Usability & Control Improvements

### DB Changes Required

1. **Storage buckets**: Create `avatars` (public) and `office-logos` (public) buckets with RLS policies
2. **New table**: `portal_settings` (id, setting_key text UNIQUE, setting_value boolean, updated_at, updated_by) with 14 default rows, RLS: admin/manager write, all authenticated read
3. **Column**: `offices.logo_url` (text, nullable) — does not exist yet

### File Changes

**Melhoria 1 — User Profile Edit**

| File | Action |
|------|--------|
| `src/components/UserProfileDialog.tsx` | New — modal with name, avatar upload (preview, 2MB validation), email/role read-only, save to `profiles` |
| `src/components/AppLayout.tsx` | Replace avatar in topbar with dropdown (DropdownMenu): "Meu Perfil" opens dialog, "Sair" calls signOut. Show `AvatarImage` from `profile.avatar_url` |
| `src/components/AppSidebar.tsx` | Show `AvatarImage` from `profile.avatar_url` in footer avatar |
| `src/contexts/AuthContext.tsx` | Add `refreshProfile()` method so dialog can trigger re-fetch after save |

**Melhoria 2 — Office Logo Upload**

| File | Action |
|------|--------|
| `src/components/clientes/ClienteHeader.tsx` | Make avatar clickable (if !isViewer) to trigger file input, upload to `office-logos` bucket, update `offices.logo_url`. Show `AvatarImage` from `office.logo_url` (already partially there via `photo_url`) |
| `src/components/portal/PortalLayout.tsx` | Fetch and display office logo in topbar header |
| `src/pages/portal/PortalMembros.tsx` | Show office logo in member cards |

Note: The `offices` table already has `photo_url`. We'll add `logo_url` as a new field and use it specifically for the office logo, or reuse `photo_url` if that's the intended field. Given `photo_url` already exists and `ClienteHeader` already references it, we'll use `photo_url` as the logo field and just add the upload capability. No new column needed unless the spec insists on `logo_url` — we'll add `logo_url` to be explicit.

**Melhoria 3 — Move share_with_client toggle**

| File | Action |
|------|--------|
| `src/pages/Reunioes.tsx` | Replace the Switch in the "Portal" column with a read-only eye icon (Eye/EyeOff). Remove `toggleShare` from the table. Keep toggle in detail dialog. |
| `src/components/clientes/ClienteReunioes.tsx` | Add share_with_client toggle per meeting card (editable for CSM/Admin/Gestor) |

**Melhoria 4 — "View as Client" button**

| File | Action |
|------|--------|
| `src/components/clientes/ClienteHeader.tsx` | Add "Ver como cliente" button (Eye icon) that opens `/portal/preview/{office_id}` in new tab. Hidden for Viewer. |
| `src/pages/portal/PortalPreview.tsx` | New — wrapper component that reads `officeId` from URL params, renders PortalLayout + portal pages with a yellow warning banner at top, all interactions disabled (read-only mode via context) |
| `src/contexts/PortalContext.tsx` | New — provides `officeId`, `isPreview`, `portalSettings` to portal pages. Portal pages use this instead of fetching office from `client_office_links` |
| `src/App.tsx` | Add route `/portal/preview/:officeId` protected for CSM/Admin/Manager |

**Melhoria 5 — Portal Visibility Settings**

| File | Action |
|------|--------|
| `src/components/configuracoes/PortalSettingsTab.tsx` | New — list of toggles grouped by section, save to `portal_settings` table |
| `src/pages/Configuracoes.tsx` | Add "Portal do Cliente" tab (admin/manager only) |
| `src/hooks/usePortalSettings.ts` | New — hook that fetches `portal_settings` once and caches in state, returns `{ portal_show_health: true, ... }` |
| `src/components/portal/PortalLayout.tsx` | Use `usePortalSettings` to filter sidebar nav items and redirect disabled pages |
| `src/pages/portal/PortalHome.tsx` | Conditionally render cards based on portal settings |

### Migration SQL

```sql
-- Office logo column
ALTER TABLE public.offices ADD COLUMN logo_url text;

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('office-logos', 'office-logos', true);

-- Storage policies for avatars
CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Users can update own avatars" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "Users can delete own avatars" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars');

-- Storage policies for office-logos
CREATE POLICY "Anyone can view office logos" ON storage.objects FOR SELECT USING (bucket_id = 'office-logos');
CREATE POLICY "Authenticated can upload office logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'office-logos');
CREATE POLICY "Authenticated can update office logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'office-logos');
CREATE POLICY "Authenticated can delete office logos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'office-logos');

-- Portal settings table
CREATE TABLE public.portal_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.portal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read portal settings" ON public.portal_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Manager can manage portal settings" ON public.portal_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Insert default settings
INSERT INTO public.portal_settings (setting_key, setting_value) VALUES
  ('portal_show_health', true),
  ('portal_show_bonus_balance', true),
  ('portal_show_next_event', true),
  ('portal_show_next_meeting', true),
  ('portal_show_contract', true),
  ('portal_show_okr', true),
  ('portal_show_meetings', true),
  ('portal_show_events', true),
  ('portal_show_bonus', true),
  ('portal_show_files', true),
  ('portal_show_contacts', true),
  ('portal_show_members', true),
  ('portal_show_billing_info', true),
  ('portal_show_contract_values', true);
```

### Summary of New Files

| File | Purpose |
|------|---------|
| `src/components/UserProfileDialog.tsx` | Profile edit modal with avatar upload |
| `src/pages/portal/PortalPreview.tsx` | Client view preview wrapper |
| `src/contexts/PortalContext.tsx` | Shared portal state (officeId, preview mode, settings) |
| `src/hooks/usePortalSettings.ts` | Hook to fetch/cache portal visibility settings |
| `src/components/configuracoes/PortalSettingsTab.tsx` | Admin UI for portal visibility toggles |

