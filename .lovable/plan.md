

# Fix: Portal Settings Not Persisting

## Root Cause
The `portal_settings` table has **zero rows**. The save handler uses `.update()` which requires existing rows to match — so nothing is ever saved. The `usePortalSettings` hook defaults everything to `true` when no data exists, masking the problem.

## Solution

### 1. PortalSettingsTab.tsx — Use upsert instead of update
Change `handleSave` to use `.upsert()` with `setting_key` as the conflict target. This creates rows on first save and updates them on subsequent saves.

### 2. Seed rows on component load (optional safety)
On `fetchSettings`, if the table is empty, insert all 14 default rows so the switches reflect real DB state. This also prevents the "all true" illusion.

### 3. DB: Ensure portal_settings has proper unique constraint
Check if `setting_key` has a unique constraint (needed for upsert). If not, add one via migration.

## Files
| File | Change |
|------|--------|
| `PortalSettingsTab.tsx` | Replace `.update()` with `.upsert()`, add seed logic on empty fetch |
| Migration (if needed) | Add unique constraint on `setting_key` |

