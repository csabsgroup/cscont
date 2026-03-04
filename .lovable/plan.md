

# Plan: Expand Piperun Field Mapping + Product-Triggered Automations

## 1. Database Migration — Add Missing Columns

**offices** — add: `whatsapp`, `cep`, `address`, `cpf`, `segment`, `first_signature_date` (date), `faturamento_mensal` (numeric), `faturamento_anual` (numeric), `qtd_clientes` (integer), `qtd_colaboradores` (integer)

**contacts** — add: `whatsapp`, `cpf`, `contact_type` (text, for decisor/usuario/financeiro)

All nullable, no defaults needed.

## 2. Frontend — Expand CRM_FIELDS in PiperunConfig.tsx

Replace current 8-item `CRM_FIELDS` with grouped list covering all entities:

- **Escritorio** (~20 fields): name, email, whatsapp, phone, city, state, cep, address, cnpj, cpf, segment, active_product_id (with lightning icon), status, csm_id, first_signature_date, onboarding_date, faturamento_mensal, faturamento_anual, qtd_clientes, qtd_colaboradores, notes
- **Contrato** (~6 fields): contracts.value, contracts.monthly_value, contracts.installments_total, contracts.start_date, contracts.end_date, contracts.status
- **Contato Principal** (~9 fields): contacts.name, contacts.email, contacts.phone, contacts.whatsapp, contacts.instagram, contacts.role_title, contacts.contact_type, contacts.birthday, contacts.cpf
- **Socio 2** (~7 fields): contacts_2.name/email/phone/whatsapp/role_title/cpf/birthday
- **Socio 3** (~7 fields): contacts_3.name/email/phone/whatsapp/role_title/cpf/birthday

Use `<SelectGroup>` with `<SelectLabel>` for visual grouping. The `active_product_id` option gets a lightning icon and special styling.

## 3. Product Value Mapping Section (new UI block)

Add a new section below field mappings: "Mapeamento de Produto ⚡"

- Array of rows: `[{ piperun_value: string, product_id: string }]`
- Left side: free text input (what Piperun sends, e.g. "Start", "Programa Start CEO")
- Right side: dropdown of products from `products` table
- Saved in `config.product_value_mappings`
- Warning banner if no mappings configured: "Sem mapeamento de produto, automacoes nao serao disparadas"
- Validation on save: no duplicate CRM targets

## 4. Edge Function — Rewrite importDeals Logic

Restructure the import loop in `integration-piperun/index.ts`:

**Step 1 — Build office object**: Map all `offices.*` fields from mappings.

**Step 2 — Resolve product**: If `active_product_id` is mapped, get the raw value from the deal, look it up in `product_value_mappings` (case-insensitive match), set the `active_product_id`. If no match found, log warning, leave product null.

**Step 3 — Insert office**: Insert into `offices` table, get back the new ID.

**Step 4 — Create contract**: If any `contracts.*` fields are mapped, insert a contract row linked to the office. Use the resolved product_id.

**Step 5 — Create contacts**: For each contact group (contacts, contacts_2, contacts_3), if any fields are mapped and have values, insert a contact row. Mark the first as `is_main_contact = true`.

**Step 6 — Trigger automations**: If product was resolved, call the existing `execute-automations` function logic inline (or invoke it):
- Distribution (assign CSM)
- Onboarding tasks generation
- Position in first journey stage
- Calculate health score
- Slack notification (if integrated)

**Step 7 — Audit log**: Insert audit_logs entry with details.

## 5. Updated Default Mappings

```
offices.name      ← title
offices.email     ← person.email  
offices.phone     ← person.phone
offices.city      ← person.city
offices.state     ← person.state
offices.cnpj      ← organization.cnpj
contracts.value   ← value
contacts.name     ← person.name
contacts.email    ← person.email
contacts.phone    ← person.phone
```

## Files to Modify

| File | Action |
|---|---|
| SQL Migration | Add columns to offices + contacts |
| `PiperunConfig.tsx` | Expand CRM_FIELDS with groups, add product mapping section, validation |
| `integration-piperun/index.ts` | Rewrite importDeals to handle multi-entity mapping, product resolution, automation triggers |

