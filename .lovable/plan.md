

## Plan: Add Company Logo Throughout the CRM

The uploaded images are variations of the "CEO" logo (an infinity-style design). I'll use **Prancheta_3.png** (red version) as the primary logo and **Prancheta_5.png** (black version) as a secondary variant for contexts where red doesn't fit.

### Where the logo will be added

Currently, 3 places show a placeholder red square with "C":

1. **Sidebar header** (`AppSidebar.tsx`) — replace the red square "C" with the actual logo image
2. **Auth/Login page** (`Auth.tsx`) — replace the red square "C" with the logo
3. **Portal Login page** (`PortalLogin.tsx`) — replace the red square "C" with the logo
4. **Portal Layout header** (`PortalLayout.tsx`) — the topbar already shows office logo, but we can add the platform logo as a secondary branding element

### Files

| File | Action |
|------|--------|
| `src/assets/logo.png` | Copy Prancheta_3.png (red logo) |
| `src/assets/logo-dark.png` | Copy Prancheta_5.png (black logo) |
| `src/components/AppSidebar.tsx` | Replace the `div` with "C" in `SidebarHeader` with an `<img>` of the logo (sized ~36px). When collapsed, show just the logo icon. |
| `src/pages/Auth.tsx` | Replace the red square "C" placeholder with the logo image (~56px). |
| `src/pages/portal/PortalLogin.tsx` | Replace the red square "C" placeholder with the logo image. |
| `src/components/AppLayout.tsx` | No changes needed — topbar uses breadcrumbs, not logo. |

### Implementation details

- Import logo as ES6 module: `import logo from "@/assets/logo.png"`
- Sidebar header: `<img src={logo} alt="Contador CEO" className="h-9 w-auto" />`
- Auth page: `<img src={logo} alt="Contador CEO" className="h-14 w-auto" />`
- Portal login: `<img src={logo} alt="Contador CEO" className="h-12 w-auto" />`
- Keep the text "Contador CEO" / "Customer Success" next to the logo where it currently exists

