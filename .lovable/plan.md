

# Plan: Remove Legacy Automation Tabs + Add Dark Mode

## BLOCO 1 — Remove Legacy Automation Pages

### Files to DELETE:
- `src/components/configuracoes/AutomationDistributionTab.tsx`
- `src/components/configuracoes/AutomationOnboardingTab.tsx`
- `src/components/configuracoes/AutomationStageTasksTab.tsx`

### Changes in `src/pages/Configuracoes.tsx`:
1. Remove imports (lines 14-16): `AutomationDistributionTab`, `AutomationOnboardingTab`, `AutomationStageTasksTab`
2. Remove from `SIDEBAR_SECTIONS` (lines 355-358): `auto_distribuicao`, `auto_onboarding`, `auto_etapas`, `auto_playbooks`
3. Remove from `renderContent()` (lines 444-447): the 4 corresponding cases
4. "Automações" category keeps only `auto_regras` ("Regras de Automação") — since it's a single item, it'll render as a standalone button (no accordion), clicking "Automações" directly opens the rules tab

## BLOCO 2 — Dark Mode

### Approach: Use CSS variables (already in place) + class toggle

The project already has `darkMode: ["class"]` in `tailwind.config.ts` and `.dark` CSS variables defined in `index.css`. The existing HSL-based variables already cover both modes for all shadcn components. This means all shadcn primitives (Card, Button, Input, Dialog, Table, Badge, etc.) **already support dark mode** through the CSS variable system.

What's needed:

### 1. Create `src/contexts/ThemeContext.tsx`
- State: `theme` from localStorage (default `'light'`)
- `toggleTheme()` toggles between light/dark, saves to localStorage, toggles `dark` class on `document.documentElement`
- Export `useTheme` hook

### 2. Wrap App with ThemeProvider
- In `src/App.tsx`, wrap everything with `<ThemeProvider>`

### 3. Add toggle button in `src/components/AppLayout.tsx`
- Sun/Moon icon between notifications bell and avatar
- Calls `toggleTheme()`

### 4. Fix hardcoded colors in components
These components use hardcoded Tailwind colors instead of CSS variables, which won't respond to dark mode:

| Component | Hardcoded colors to fix |
|---|---|
| `NavigationTabs.tsx` | `bg-white`, `border-gray-200`, `text-red-700`, `bg-red-50`, `text-gray-500`, `hover:bg-gray-50` → use semantic classes (`bg-card`, `border-border`, `text-primary`, etc.) |
| `Configuracoes.tsx` (line 512) | `bg-white` → `bg-card` |
| `AppLayout.tsx` | Already uses semantic classes mostly, minor fixes |

### 5. Add smooth transition
Add to `index.css`:
```css
html.transitioning * {
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}
```
Apply class briefly during toggle to avoid permanent transition overhead.

### 6. Portal dark mode toggle
Add the same Sun/Moon toggle in `src/components/portal/PortalLayout.tsx` header.

### Key insight
Since the entire UI is built on shadcn/ui with HSL CSS variables, and dark mode variables are already defined in `index.css`, **most components will automatically switch** once we toggle the `dark` class. The main work is:
- Creating the ThemeContext + toggle
- Fixing ~3-4 components with hardcoded colors

### Files to create/modify:

| File | Action |
|---|---|
| `src/contexts/ThemeContext.tsx` | **Create** — ThemeProvider + useTheme hook |
| `src/App.tsx` | Wrap with ThemeProvider |
| `src/components/AppLayout.tsx` | Add Sun/Moon toggle |
| `src/components/NavigationTabs.tsx` | Replace hardcoded colors with semantic classes |
| `src/pages/Configuracoes.tsx` | Remove legacy tabs + fix `bg-white` |
| `src/components/portal/PortalLayout.tsx` | Add dark mode toggle |
| `src/index.css` | Add transition utility |
| Delete 3 legacy automation files | |

