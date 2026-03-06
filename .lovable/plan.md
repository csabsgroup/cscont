

# Plan: Update Kanban Card + Diagnose Automation Email/Slack

## Part 1 — Kanban Card in Jornada (Board View)

### Current card shows
Health score + name, CSM avatar + task progress, renewal/overdue badges.

### User wants
Nome do escritório, status, valor (contract), whatsapp, produto.

### Changes needed

**File: `src/pages/Jornada.tsx`**

1. **Update office query** (line 83): Add `whatsapp, active_product_id` to the offices select:
```
offices!office_journey_office_id_fkey(id, name, status, city, state, csm_id, activation_date, whatsapp, active_product_id)
```

2. **Fetch products map**: Query `products` table to map product IDs to names (already have `products` state, just build a lookup map).

3. **Update `OfficeInStage` interface** (line 26): Add `whatsapp` and `active_product_id` to the offices shape.

4. **Redesign card content** (lines 376-414): Replace current 3-line layout with:
   - **Line 1**: Office name (truncated) + health score dot
   - **Line 2**: StatusBadge (small) + product name badge
   - **Line 3**: Contract value (from `contracts` map → `monthly_value`) + WhatsApp icon/number
   
   Keep health color border-left. Remove CSM avatar and task progress bar from card (they stay in list/table views).

### Interface update
```typescript
offices: { 
  id: string; name: string; status: string; 
  city: string | null; state: string | null; 
  csm_id: string | null; activation_date?: string | null;
  whatsapp: string | null; active_product_id: string | null;
};
```

---

## Part 2 — Automation Email & Slack Issues

### Diagnosis from logs

The automation rule "[ELT] Delegação automática" has these action types:
- `change_csm` ✅ worked
- `set_product` ✅ worked  
- 15x `create_activity` ✅ all worked
- `send_notification` ✅ worked (created internal notification)
- `send_email` ⚠️ ran but is a **STUB** — logs `Email stub: to=null` and returns success without actually sending

### Email issue
The `send_email` action in `execute-automations/index.ts` (line 110-111) is a stub — it just logs and returns success. It never calls any email service. Also, `to=null` because the rule config has no `recipient` field set, and the CSM profile email isn't being resolved.

**Fix**: The `send_email` action needs to resolve the recipient (CSM email from profiles table) and actually invoke an email-sending service. Since `integration-email` is also a stub, we need to implement real email sending. This requires an email provider (e.g., Resend, SendGrid) or we can use the Lovable AI gateway to send emails if supported.

### Slack issue  
The automation rule does **NOT** have a `send_slack` action configured. It only has `send_notification` (internal) and `send_email`. To send Slack messages, the user needs to add a `send_slack` action to the rule in the automation editor. The `send_slack` handler in the code (lines 120-167) is already fully implemented and functional.

### Proposed approach for email
Since there's no email provider configured, I'll update the `send_email` action to:
1. Resolve CSM email from `profiles` table when `recipient` is missing or set to `csm`
2. Use Supabase's built-in auth email (not available for custom emails) OR flag this as needing an email provider setup

**Recommendation**: I'll inform you that:
- **Slack**: You need to add a `send_slack` action to your "[ELT] Delegação automática" rule in Settings → Automations. The Slack integration code is ready.
- **Email**: Currently a stub. To send real emails, we need to configure an email provider (like Resend). Would you like me to set that up?

### What I will implement now
1. **Kanban card redesign** with nome, status, valor, whatsapp, produto
2. **Fix `send_email` recipient resolution** so `to` is not null (resolve CSM email from profiles)

