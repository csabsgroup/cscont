

# Auto-load Default Global View on Clients Page

## What happens today
- Admin can mark a view as "Padrão" (default) — this sets `is_default = true` on `user_table_views`
- The default view is fetched but **never auto-loaded** when the page opens
- Users always see the hardcoded `DEFAULT_COLUMNS` on page load

## What to build
When any user opens the Clients page, automatically load the global default view (columns, filters, sort). During the session they can change freely, but on reload it resets to the global default.

## Changes

### `src/pages/Clientes.tsx`
1. **Auto-load default view after fetching views**: Add a `useEffect` that watches `savedViews` — when views are loaded, find the one with `is_default === true` and call `loadView()` on it (only once, on initial load).

2. **Track initial load**: Use a `ref` (`defaultViewLoaded`) to ensure the auto-load happens only once per mount, not on every fetchViews call.

```text
Flow:
  Page mounts → fetchViews() → savedViews updated
  → useEffect finds is_default view → loadView(defaultView)
  → User sees Admin's configured columns/filters/sort
  → User can change freely during session
  → Page reload → repeats from top
```

3. **Manager visibility**: The `handleSetDefaultView` button currently shows only for `isAdmin`. Keep it that way per user's answer. No change needed here.

### RLS consideration
The `fetchViews` query already includes `is_default.eq.true` in the OR clause, so all users fetch global defaults. The RLS on `user_table_views` must allow SELECT for rows where `is_default = true` — need to verify this exists. If not, add a policy.

### Implementation detail
- Add `const defaultViewLoadedRef = useRef(false);`  
- Add useEffect watching `savedViews`:
```typescript
useEffect(() => {
  if (defaultViewLoadedRef.current || savedViews.length === 0) return;
  const defaultView = savedViews.find((v: any) => v.is_default);
  if (defaultView) {
    loadView(defaultView);
    defaultViewLoadedRef.current = true;
  }
}, [savedViews]);
```

This ensures the global default is loaded as the initial state, while allowing free customization during the session.

