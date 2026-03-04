

## Design System Redesign Plan

This is a visual-only refactoring — no logic or functionality changes. The work spans the global CSS tokens, layout components (sidebar, topbar), and all page-level styling across ~20 files.

### Approach

Rather than editing every single page file individually (which would be massive), the most efficient approach is to:

1. **Update the global design tokens** (CSS variables + Tailwind config) so all existing component primitives automatically inherit the new look
2. **Restyle the layout shell** (AppLayout, AppSidebar, PortalLayout) for the sidebar/topbar redesign
3. **Update shared UI primitives** (Card, Button, Input, Table, Badge, Dialog) at the component level so all pages benefit
4. **Touch each page file** only for page-specific styling (grid layouts, section headers, loading/empty states)

### Phase 1 — Global Design Tokens & CSS

**File: `src/index.css`**
- Update CSS variables: background to `#F9FAFB` (page bg), card stays white, border to `#E5E7EB`
- Add utility classes for card hover effects, skeleton shimmer animation
- Set default border-radius to 12px (rounded-xl for cards)

**File: `tailwind.config.ts`**
- Update `--radius` to `0.75rem` (12px)
- Add gray scale colors matching the spec (#F9FAFB, #F3F4F6, #E5E7EB, #6B7280, #111827)
- Ensure primary maps to `#DC2626`

### Phase 2 — UI Primitives (7 files)

**`src/components/ui/card.tsx`**: rounded-xl, shadow-sm, border-gray-100, hover:shadow-md transition on clickable cards. CardHeader gets mb-4, CardTitle gets text-base font-semibold text-gray-900.

**`src/components/ui/button.tsx`**: rounded-lg, transition-all duration-200. Primary variant bg-red-600 hover:bg-red-700 shadow-sm. Secondary with border-gray-300. Ghost with hover:bg-gray-100.

**`src/components/ui/input.tsx`**: rounded-md, focus:ring-2 focus:ring-red-500 focus:border-red-500, text-sm.

**`src/components/ui/table.tsx`**: Header bg-gray-50 text-xs uppercase tracking-wider text-gray-500. Rows border-b border-gray-50 hover:bg-gray-50 transition. Cells py-3 px-4 text-sm text-gray-700.

**`src/components/ui/badge.tsx`**: rounded-full px-2.5 py-0.5 text-xs font-medium.

**`src/components/ui/dialog.tsx`**: Overlay backdrop-blur-sm bg-black/50. Content rounded-2xl shadow-2xl.

**`src/components/ui/sheet.tsx`**: Same overlay treatment, smooth transitions.

### Phase 3 — Layout Shell (3 files)

**`src/components/AppSidebar.tsx`**: 
- White background sidebar (not dark), border-r border-gray-100
- Group labels: text-xs text-gray-400 uppercase tracking-wider
- Items: py-2.5 px-4 rounded-lg text-gray-600, hover:bg-gray-50
- Active: bg-red-50 text-red-700 font-medium with left border accent
- Logo area: generous padding py-6 px-5
- Footer: user profile with avatar, name, role badge

**`src/components/AppLayout.tsx`**:
- Topbar height 64px (h-16), white bg, shadow-sm
- Left side: breadcrumb in text-sm text-gray-500
- Right side: search input (rounded-full bg-gray-100), notification bell, user avatar with dropdown
- Main content: bg-gray-50 (page background), p-6

**`src/components/portal/PortalLayout.tsx`**:
- Same white sidebar treatment, red accent for active items
- Top bar consistent with main app

**`src/components/ui/sidebar.tsx`**:
- Update sidebar CSS variables: bg white, foreground gray-700, accent bg-red-50, border gray-100
- Width 260px (currently 16rem/256px — close enough, adjust to match)

### Phase 4 — Page-Level Styling (~15 files)

Apply consistent patterns across all pages:

**`src/pages/Dashboard.tsx`**: 
- Page bg inherited from layout (gray-50)
- Cards with rounded-xl shadow-sm border-gray-100
- KPI values: text-2xl font-bold
- Loading state: replace Loader2 spinner with skeleton shimmer blocks

**`src/pages/Clientes.tsx`**: 
- Table container rounded-xl shadow-sm border-gray-100 overflow-hidden
- Table header bg-gray-50 uppercase tracking-wider
- Row hover:bg-gray-50 transition
- Loading: skeleton rows instead of spinner

**`src/pages/Jornada.tsx`**: 
- Kanban columns with rounded-xl bg-gray-50 border
- Cards inside with rounded-lg shadow-sm bg-white hover:shadow-md
- Loading: skeleton columns

**`src/pages/Atividades.tsx`**: Same card/table treatment

**`src/pages/Reunioes.tsx`**: Same treatment

**`src/pages/Eventos.tsx`**: Same treatment

**`src/pages/ContratosGlobal.tsx`**: Same table treatment

**`src/pages/ContatosGlobal.tsx`**: Same table treatment

**`src/pages/Relatorios.tsx`**: Cards rounded-xl, chart containers styled

**`src/pages/Configuracoes.tsx`**: Tab panels with consistent card styling

**`src/pages/Cliente360.tsx`**: Tab content with rounded-xl cards

**`src/pages/Auth.tsx`**: Centered card with rounded-2xl shadow-lg

**Portal pages** (9 files): Same rounded-xl card treatment, consistent with main app

### Phase 5 — Loading/Empty/Error States

Create a shared set of state components:
- **`src/components/ui/skeleton-card.tsx`**: Reusable skeleton shimmer for cards (animated bg-gray-200 pulse)
- Update all pages to use skeleton shimmer instead of Loader2 spinner
- Ensure empty states have icon + title + subtitle pattern
- Error states with alert icon + retry button

### Key Files Summary

| Category | Files | Count |
|----------|-------|-------|
| CSS/Config | index.css, tailwind.config.ts | 2 |
| UI Primitives | card, button, input, table, badge, dialog, sheet, sidebar | 8 |
| Layout | AppLayout, AppSidebar, PortalLayout | 3 |
| Pages (internal) | Dashboard, Clientes, Cliente360, Jornada, Atividades, Reunioes, Eventos, ContratosGlobal, ContatosGlobal, Relatorios, Configuracoes, Auth | 12 |
| Pages (portal) | 9 portal pages | 9 |
| New components | skeleton helpers | 1 |
| **Total** | | **~35 files** |

### Technical Notes

- The sidebar currently uses Radix UI `Sidebar` component with dark theme CSS variables. The redesign switches to white bg by updating the CSS variables in `index.css` (--sidebar-background, --sidebar-foreground, etc.)
- No package additions needed — everything uses existing Tailwind classes
- The `App.css` file with its legacy styles should be cleaned up (max-width, text-align center, logo spin animation are unused)
- All changes are purely CSS/className modifications — zero logic changes

