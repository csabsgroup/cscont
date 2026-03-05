

# Plan: Remove Product Value Mapping Section + Add Variable Picker to Automation Actions

## Correction 1 — Remove Product Value Mapping from PiperunConfig

### `src/components/configuracoes/integrations/PiperunConfig.tsx`

**Remove** the entire "Product Value Mapping" section (lines 354-404) including:
- The `ProductMapping` interface (line 100)
- State: `productMappings`, `products` (lines 118-129)
- Handlers: `addProductMapping`, `removeProductMapping`, `updateProductMapping` (lines 172-182)
- Computed: `hasProductField`, `hasProductMappings` (lines 184-185)
- The amber-bordered UI section (lines 354-404)
- Remove `product_value_mappings` from `importNow` body (line 209) and `handleSave` config (line 230)

**Keep** the `products` state load (needed for reference) — actually not needed anymore since product mapping is removed. Remove the `useEffect` at lines 126-129 and the `products` state.

Remove unused imports: `AlertTriangle`, `Zap` (if no longer used — but `Zap` is still used in the CRM field icon rendering, so keep it). Remove `AlertTriangle`.

### `supabase/functions/integration-piperun/index.ts`

In the `importDeals` action, update the field application logic:
- When `local` field is `offices.active_product_id`: do case-insensitive name lookup in `products` table instead of using `product_value_mappings`
- When `local` field is `offices.status`: normalize value to match valid enum values
- When `local` field is `offices.csm_id`: lookup by name/email in `profiles` table
- Remove any `product_value_mappings` processing logic

## Correction 2 — Variable Picker for Automation Action Text Fields

### New file: `src/components/shared/VariableTextInput.tsx`

Create a reusable component with:
- Props: `value`, `onChange`, `placeholder`, `multiline` (boolean), `label` (string)
- Layout: flex row with textarea/input on left, variable list panel on right (w-56)
- Variable list: grouped by category with emoji headers, sticky group labels
- Click behavior: insert variable at cursor position using `selectionStart`
- Variables defined as constant array (~40 items in 8 groups)
- Dark mode support via standard Tailwind dark classes

### `src/components/configuracoes/AutomationRulesTab.tsx`

Replace plain `Input`/`Textarea` with `VariableTextInput` in these action config fields:
- `create_activity`: title (line 776), description (line 777)
- `send_notification`: title (line 834), message (line 835)
- `send_email`: subject (line 854), body (line 855)
- `create_action_plan`: title (line 884), description (line 885)
- `add_note`: content field (need to check exact location)

Do NOT apply to `send_whatsapp` (WhatsApp templates have fixed variables from Meta).

## Files Changed

| File | Change |
|------|--------|
| `src/components/configuracoes/integrations/PiperunConfig.tsx` | Remove product value mapping section, state, handlers, and UI |
| `supabase/functions/integration-piperun/index.ts` | Smart match for product/status/csm fields by name |
| `src/components/shared/VariableTextInput.tsx` | New reusable component with variable picker sidebar |
| `src/components/configuracoes/AutomationRulesTab.tsx` | Replace Input/Textarea with VariableTextInput in action configs |

