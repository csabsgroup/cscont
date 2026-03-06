

# Design System Universal — Implementation Plan

## Scope
Purely visual changes across CSS tokens, Tailwind config, UI primitives, layout components, and page typography. Zero logic changes.

## Files to Modify

### 1. `index.html`
Add Google Fonts link for Inter + Oswald in `<head>`.

### 2. `src/index.css`
- Add new CSS custom properties (`--color-*`, `--shadow-*`, `--transition-*`, `--font-*`) alongside existing HSL tokens (keeping both for backward compatibility with shadcn components)
- Map existing HSL tokens to match new palette (e.g. `--background` light becomes `#f2f2f2` equivalent in HSL, dark becomes `#0d0d0d`)
- Add global scrollbar styles, heading font-family rules, body transitions
- Add utility classes for typography variants (`.text-label-micro`, `.text-section-title`, etc.)

### 3. `tailwind.config.ts`
- Add `fontFamily: { sans: ['Inter', ...], display: ['Oswald', ...] }`
- Add custom border-radius tokens (`card`, `modal`, `sidebar`, `button`, `input`)
- Add `boxShadow: { glow: 'var(--shadow-glow)' }`
- Add surface/elevated color mappings

### 4. UI Primitives (visual-only class changes)

| File | Changes |
|------|---------|
| `card.tsx` | border-radius 12px, surface bg, hover shadow, label typography |
| `button.tsx` | border-radius 6px, glow on primary hover, transition-fast |
| `input.tsx` | border-radius 8px, focus ring with primary color |
| `table.tsx` | Header uppercase/muted, row hover, container border-radius 8px |
| `badge.tsx` | border-radius 8px, font-size 0.72rem |
| `dialog.tsx` | border-radius 16px, overlay blur, z-200 |
| `drawer.tsx` | Same overlay/z-index treatment |
| `label.tsx` | font-size 0.7rem, font-weight 500 |

### 5. Layout Components

| File | Changes |
|------|---------|
| `AppSidebar.tsx` | Surface bg, border-radius 20px (desktop), nav item 50x50 active style (inverted bg), Oswald for brand |
| `AppLayout.tsx` | Page title in Oswald uppercase 1.5rem/800, z-index 50 for header |
| `NavigationTabs.tsx` | Border/transition updates |
| `PortalLayout.tsx` | Same design system tokens applied to portal sidebar and header |

### 6. Pages (typography only)

Dashboard.tsx and other pages: Update KPI card labels to use `font-display uppercase tracking-widest text-xs`, KPI values to use `font-display text-2xl font-bold`. No logic changes — only className updates on headings and card labels.

## Strategy
- Keep existing HSL token system intact (shadcn components depend on it)
- Update HSL values to match new palette colors
- Add new `--color-*` tokens for direct hex usage where needed
- All components continue using Tailwind classes, just updated values
- Dark mode continues via `.dark` class on `<html>` — existing toggle untouched

## What Does NOT Change
- No logic, queries, state, routes, contexts, edge functions
- No component renaming or restructuring
- No new dependencies (fonts loaded via CDN)

