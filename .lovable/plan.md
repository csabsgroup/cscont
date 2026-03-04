

## Plan: Complete the Client Portal

### Current State
The portal is already ~80% implemented. All 9 pages exist with routes, layout, sidebar, and basic functionality. The gaps are specific enhancements rather than new pages.

### What's Missing

**1. PortalHome** — Missing cards: Health Score, Bonus balance, Next event, Next meeting. Greeting shows generic text instead of office name.

**2. PortalMembros** — Missing search/filter by name and city.

**3. PortalEventos** — Missing participation status (confirmed/attended/absent) per office.

**4. PortalLayout** — Shows hardcoded "Contador CEO" instead of the client's office name.

**5. No separate /portal/login** — Currently uses same /auth page. The spec requests a dedicated portal login. However, since Auth already redirects clients to /portal automatically, a separate branded login page at `/portal/login` is straightforward.

### Changes

**1. `src/pages/portal/PortalHome.tsx`** (rewrite)
- Fetch office name for greeting: "Bem-vindo, [Office Name]"
- Add Health Score card (latest from `health_scores`)
- Add Bonus balance card (sum of `bonus_grants.available`)
- Add Next event card (from `events` filtered by product eligibility)
- Add Next meeting card (from `meetings` where `share_with_client=true` and future)
- Keep existing: contract status, OKR progress

**2. `src/pages/portal/PortalMembros.tsx`** (small addition)
- Add search Input that filters members by name or city (client-side)

**3. `src/pages/portal/PortalEventos.tsx`** (small addition)
- Fetch `event_participants` for the client's office
- Show participation badge on each event card (Convidado/Confirmado/Participou/Faltou)

**4. `src/components/portal/PortalLayout.tsx`** (small change)
- Fetch office name from `client_office_links` → `offices` and display it instead of hardcoded text

**5. `src/pages/portal/PortalLogin.tsx`** (new file)
- Simple login-only page (no signup tab) branded for portal
- Route at `/portal/login`
- Redirects to `/portal` on success, to `/auth` if not a client

**6. `src/App.tsx`** (add route)
- Add `/portal/login` route pointing to PortalLogin

### No DB changes needed.

