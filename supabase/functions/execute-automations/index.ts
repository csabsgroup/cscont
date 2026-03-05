import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Action Handlers ─────────────────────────────────────────
async function handleAction(supabase: any, action: any, office_id: string, assignedCsm: string | null, userId: string) {
  const c = action.config || {};

  switch (action.type) {
    case "create_activity": {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (parseInt(c.due_days) || 0));
      const { data: act } = await supabase.from("activities").insert({
        title: c.title || "Atividade automática",
        type: c.activity_type || "task",
        description: c.description || null,
        office_id,
        user_id: assignedCsm || userId,
        due_date: dueDate.toISOString().split("T")[0],
        priority: c.priority || "medium",
      }).select("id").single();
      return { type: "create_activity", id: act?.id };
    }

    case "move_stage":
    case "move_journey_stage": {
      if (c.stage_id) {
        await supabase.from("office_journey").upsert({
          office_id,
          journey_stage_id: c.stage_id,
          entered_at: new Date().toISOString(),
        }, { onConflict: "office_id" });
      }
      return { type: "move_stage", stage_id: c.stage_id };
    }

    case "change_status": {
      if (c.new_status) {
        await supabase.from("offices").update({ status: c.new_status }).eq("id", office_id);
      }
      return { type: "change_status", new_status: c.new_status };
    }

    case "send_notification": {
      const recipientId = c.recipient === "csm" ? assignedCsm : userId;
      if (recipientId) {
        await supabase.from("notifications").insert({
          user_id: recipientId,
          title: c.title || "Notificação automática",
          message: c.message || null,
          type: "info",
          entity_type: "office",
          entity_id: office_id,
        });
      }
      return { type: "send_notification" };
    }

    case "send_email": {
      // Email sending would go through integration-email edge function
      return { type: "send_email", skipped: true };
    }

    case "create_action_plan": {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (parseInt(c.due_days) || 7));
      await supabase.from("action_plans").insert({
        title: c.title || "Plano de ação automático",
        description: c.description || null,
        office_id,
        created_by: assignedCsm || userId,
        due_date: dueDate.toISOString().split("T")[0],
      });
      return { type: "create_action_plan" };
    }

    case "change_csm": {
      let newCsmId: string | null = null;
      if (c.method === "fixed" && c.fixed_csm_id) {
        newCsmId = c.fixed_csm_id;
      } else if (c.method === "least_clients") {
        const eligible = c.eligible_csm_ids || [];
        if (eligible.length > 0) {
          const { data: offices } = await supabase.from("offices").select("csm_id").in("csm_id", eligible);
          const counts: Record<string, number> = {};
          eligible.forEach((id: string) => { counts[id] = 0; });
          (offices || []).forEach((o: any) => { if (o.csm_id && counts[o.csm_id] !== undefined) counts[o.csm_id]++; });
          newCsmId = eligible.reduce((a: string, b: string) => (counts[a] || 0) <= (counts[b] || 0) ? a : b);
        }
      } else if (c.method === "round_robin") {
        const eligible = c.eligible_csm_ids || [];
        if (eligible.length > 0) {
          // Use a simple hash of office_id to pick index for stateless round-robin
          const hash = office_id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
          newCsmId = eligible[hash % eligible.length];
        }
      }
      if (newCsmId) {
        await supabase.from("offices").update({ csm_id: newCsmId }).eq("id", office_id);
      }
      return { type: "change_csm", csm_id: newCsmId };
    }

    case "create_contract": {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + (parseInt(c.start_days) || 0));
      const endDate = c.duration_days ? new Date(startDate.getTime() + parseInt(c.duration_days) * 86400000) : null;
      const renewalDate = c.renewal_days ? new Date(startDate.getTime() + parseInt(c.renewal_days) * 86400000) : null;

      await supabase.from("contracts").insert({
        office_id,
        product_id: c.product_id,
        status: c.status || "pendente",
        value: c.value ? parseFloat(c.value) : null,
        monthly_value: c.monthly_value ? parseFloat(c.monthly_value) : null,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate ? endDate.toISOString().split("T")[0] : null,
        renewal_date: renewalDate ? renewalDate.toISOString().split("T")[0] : null,
      });
      return { type: "create_contract" };
    }

    case "cancel_contract": {
      const newStatus = c.cancel_action || "cancelado";
      if (c.target_product_id) {
        await supabase.from("contracts")
          .update({ status: newStatus, end_date: new Date().toISOString().split("T")[0] })
          .eq("office_id", office_id)
          .eq("product_id", c.target_product_id)
          .in("status", ["ativo", "pendente"]);
      }
      return { type: "cancel_contract", status: newStatus };
    }

    case "set_product": {
      if (c.product_id) {
        await supabase.from("offices").update({ active_product_id: c.product_id }).eq("id", office_id);
        // Get first stage of the product
        const { data: firstStage } = await supabase.from("journey_stages")
          .select("id").eq("product_id", c.product_id).order("position").limit(1).maybeSingle();
        if (firstStage) {
          await supabase.from("office_journey").upsert({
            office_id,
            journey_stage_id: firstStage.id,
            entered_at: new Date().toISOString(),
          }, { onConflict: "office_id" });
        }
      }
      return { type: "set_product", product_id: c.product_id };
    }

    case "add_note": {
      await supabase.from("office_notes").insert({
        office_id,
        note_type: c.note_type || "observacao",
        content: c.content || "Nota automática",
        created_by: assignedCsm || userId,
      });
      return { type: "add_note" };
    }

    case "grant_bonus": {
      if (c.catalog_item_id) {
        const qty = parseInt(c.quantity) || 1;
        const validityDays = parseInt(c.validity_days) || 90;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + validityDays);
        await supabase.from("bonus_grants").insert({
          office_id,
          catalog_item_id: c.catalog_item_id,
          quantity: qty,
          available: qty,
          expires_at: expiresAt.toISOString(),
        });
      }
      return { type: "grant_bonus" };
    }

    default:
      return { type: action.type, skipped: true };
  }
}

// ─── Condition Evaluation Helpers ─────────────────────────────
function daysBetween(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / 86400000);
}

async function resolveConditionValue(supabase: any, cond: any, office: any, officeId: string) {
  const field = cond.field;

  // Office fields
  const officeFieldMap: Record<string, string> = {
    office_name: 'name', office_cnpj: 'cnpj', office_cpf: 'cpf', office_cep: 'cep',
    office_address: 'address', office_city: 'city', office_state: 'state',
    office_segment: 'segment', office_instagram: 'instagram', office_whatsapp: 'whatsapp',
    office_email: 'email', office_phone: 'phone', office_tags: 'tags',
    office_qtd_clientes: 'qtd_clientes', office_qtd_colaboradores: 'qtd_colaboradores',
    office_faturamento_mensal: 'faturamento_mensal', office_faturamento_anual: 'faturamento_anual',
  };
  if (officeFieldMap[field]) {
    return office?.[officeFieldMap[field]] ?? null;
  }

  // Contact fields
  if (field.startsWith('contact_')) {
    const contactCol: Record<string, string> = {
      contact_name: 'name', contact_email: 'email', contact_phone: 'phone',
      contact_whatsapp: 'whatsapp', contact_role_title: 'role_title',
      contact_cpf: 'cpf', contact_instagram: 'instagram', contact_type: 'contact_type',
    };
    const col = contactCol[field];
    if (!col) return null;
    const scope = cond.contact_scope || 'main';
    let q = supabase.from('contacts').select(col).eq('office_id', officeId);
    if (scope === 'main') q = q.eq('is_main_contact', true);
    const { data } = await q;
    if (!data || data.length === 0) return null;
    if (scope === 'any') {
      // Return array of values for "any" matching
      return data.map((r: any) => r[col]).filter((v: any) => v != null);
    }
    return data[0]?.[col] ?? null;
  }

  // Contract fields
  if (field.startsWith('contract_') || field === 'installments_overdue' || field === 'installments_total') {
    const { data: contracts } = await supabase.from('contracts').select('*')
      .eq('office_id', officeId).order('created_at', { ascending: false }).limit(1);
    const contract = contracts?.[0];
    if (!contract) return null;

    const contractFieldMap: Record<string, any> = {
      contract_status: contract.status,
      contract_monthly_value: contract.monthly_value,
      contract_total_value: contract.value,
      installments_overdue: contract.installments_overdue,
      installments_total: contract.installments_total,
      contract_start_date: daysBetween(contract.start_date),
      contract_end_date: daysUntil(contract.end_date),
      contract_renewal_date: daysUntil(contract.renewal_date),
      contract_product_id: contract.product_id,
      contract_negotiation_notes: contract.negotiation_notes,
    };
    return contractFieldMap[field] ?? null;
  }

  // Custom fields (cf_ prefix)
  if (field.startsWith('cf_')) {
    const slug = field.substring(3);
    const { data: cfData } = await supabase.from('custom_field_values')
      .select('value_text, value_number, value_boolean, value_date, value_json, custom_fields!inner(slug, field_type)')
      .eq('office_id', officeId)
      .eq('custom_fields.slug', slug)
      .limit(1);
    if (!cfData || cfData.length === 0) return null;
    const row = cfData[0];
    const ft = (row as any).custom_fields?.field_type;
    if (ft === 'number' || ft === 'currency' || ft === 'percentage') return row.value_number;
    if (ft === 'boolean') return row.value_boolean;
    if (ft === 'date') return daysBetween(row.value_date);
    if (ft === 'select' || ft === 'multi_select') return row.value_json ?? row.value_text;
    return row.value_text;
  }

  // Fallback: direct office column
  return office?.[field] ?? null;
}

function evaluateCondition(resolvedValue: any, operator: string, condValue: any, condValue2?: any): boolean {
  // Handle "any" contact scope (array of values)
  if (Array.isArray(resolvedValue) && !['is_in', 'contains'].includes(operator)) {
    return resolvedValue.some(v => evaluateCondition(v, operator, condValue, condValue2));
  }

  const v = resolvedValue;
  switch (operator) {
    case 'equals': return String(v) === String(condValue);
    case 'not_equals': return String(v) !== String(condValue);
    case 'contains': return String(v ?? '').toLowerCase().includes(String(condValue ?? '').toLowerCase());
    case 'greater_than': case 'days_greater_than': return Number(v) > Number(condValue);
    case 'less_than': case 'days_less_than': return Number(v) < Number(condValue);
    case 'days_equal': return Number(v) === Number(condValue);
    case 'between': return Number(v) >= Number(condValue) && Number(v) <= Number(condValue2);
    case 'is_in': {
      const list = String(condValue).split(',').map(s => s.trim().toLowerCase());
      return list.includes(String(v).toLowerCase());
    }
    case 'is_empty': return v == null || v === '';
    case 'is_not_empty': return v != null && v !== '';
    case 'is_true': return v === true;
    case 'is_false': return v === false;
    default: return true;
  }
}

// ─── Execute v2 rules for a given trigger ────────────────────
async function executeV2Rules(supabase: any, triggerType: string, office_id: string, csm_id: string | null, userId: string, extraContext?: Record<string, any>) {
  const { data: v2Rules } = await supabase
    .from("automation_rules_v2")
    .select("*")
    .eq("trigger_type", triggerType)
    .eq("is_active", true);

  if (!v2Rules || v2Rules.length === 0) return [];

  const { data: office } = await supabase.from("offices").select("*").eq("id", office_id).single();
  const results: any[] = [];

  for (const rule of v2Rules) {
    const contextKey = `${triggerType}_${office_id}_${extraContext?.suffix || ""}`.replace(/_+$/, "");
    const { data: existing } = await supabase
      .from("automation_executions")
      .select("id")
      .eq("rule_id", rule.id)
      .eq("office_id", office_id)
      .eq("context_key", contextKey)
      .maybeSingle();
    if (existing) continue;

    // Evaluate conditions
    const conditionsPayload = rule.conditions as any;
    const groups = conditionsPayload?.groups || (Array.isArray(conditionsPayload) ? [{ logic: rule.condition_logic || 'and', conditions: conditionsPayload }] : []);
    const groupLogic = conditionsPayload?.logic || rule.condition_logic || 'and';

    let ruleMatches = true;
    if (groups.length > 0) {
      const groupResults: boolean[] = [];
      for (const group of groups) {
        const conds = group.conditions || [];
        if (conds.length === 0) { groupResults.push(true); continue; }
        const condResults: boolean[] = [];
        for (const cond of conds) {
          if (!cond.field || !cond.operator) { condResults.push(true); continue; }
          const resolved = await resolveConditionValue(supabase, cond, office, office_id);
          condResults.push(evaluateCondition(resolved, cond.operator, cond.value, cond.value2));
        }
        const groupMatch = (group.logic || 'and') === 'and' ? condResults.every(Boolean) : condResults.some(Boolean);
        groupResults.push(groupMatch);
      }
      ruleMatches = groupLogic === 'and' ? groupResults.every(Boolean) : groupResults.some(Boolean);
    }

    if (!ruleMatches) continue;

    const actions = (rule.actions as any[]) || [];
    const assignedCsm = csm_id || office?.csm_id;
    const actionResults: any[] = [];

    for (const action of actions) {
      const result = await handleAction(supabase, action, office_id, assignedCsm, userId);
      actionResults.push(result);
    }

    await supabase.from("automation_executions").insert({
      rule_id: rule.id,
      office_id,
      context_key: contextKey,
      result: { trigger: triggerType, actions: actionResults },
    });

    results.push({ rule_id: rule.id, actions: actionResults });
  }

  return results;
}

// ─── Main Handler ────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, serviceRoleKey);

    const { data: roleCheck } = await supabase.rpc("get_user_role", { _user_id: user.id });
    const allowedRoles = ["admin", "manager", "csm"];
    if (!roleCheck || !allowedRoles.includes(roleCheck)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, office_id, product_id, stage_id, csm_id } = body;

    if (action === "onNewOffice") {
      if (!office_id || !product_id) throw new Error("office_id and product_id required");

      // 1. Distribution (legacy v1)
      const { data: distRule } = await supabase
        .from("automation_rules")
        .select("*")
        .eq("product_id", product_id)
        .eq("rule_type", "distribution")
        .eq("is_active", true)
        .maybeSingle();

      if (distRule) {
        const config = distRule.config as any;
        let assignedCsmId: string | null = null;

        if (config.method === "fixed" && config.fixed_csm_id) {
          assignedCsmId = config.fixed_csm_id;
        } else if (config.method === "least_clients") {
          const eligible = config.eligible_csm_ids || [];
          if (eligible.length > 0) {
            const { data: offices } = await supabase
              .from("offices").select("csm_id").eq("active_product_id", product_id).in("csm_id", eligible);
            const counts: Record<string, number> = {};
            eligible.forEach((id: string) => { counts[id] = 0; });
            (offices || []).forEach((o: any) => { if (o.csm_id && counts[o.csm_id] !== undefined) counts[o.csm_id]++; });
            assignedCsmId = eligible.reduce((a: string, b: string) => (counts[a] || 0) <= (counts[b] || 0) ? a : b);
          }
        } else if (config.method === "round_robin") {
          const eligible = config.eligible_csm_ids || [];
          if (eligible.length > 0) {
            const { data: lastExec } = await supabase
              .from("automation_executions").select("result").eq("rule_id", distRule.id)
              .order("executed_at", { ascending: false }).limit(1).maybeSingle();
            const lastIndex = (lastExec?.result as any)?.csm_index ?? -1;
            const nextIndex = (lastIndex + 1) % eligible.length;
            assignedCsmId = eligible[nextIndex];
            await supabase.from("automation_executions").insert({
              rule_id: distRule.id, office_id,
              context_key: `distribution_${Date.now()}`,
              result: { csm_index: nextIndex, csm_id: assignedCsmId },
            });
          }
        }

        if (assignedCsmId) {
          await supabase.from("offices").update({ csm_id: assignedCsmId }).eq("id", office_id);
        }
      }

      // 2. Onboarding tasks (legacy v1)
      const { data: onbRule } = await supabase
        .from("automation_rules").select("*")
        .eq("product_id", product_id).eq("rule_type", "onboarding_tasks").eq("is_active", true).maybeSingle();

      if (onbRule) {
        const { data: existing } = await supabase
          .from("automation_executions").select("id")
          .eq("rule_id", onbRule.id).eq("office_id", office_id).eq("context_key", "onboarding").maybeSingle();

        if (!existing) {
          const templates = (onbRule.config as any)?.templates || [];
          const assignedCsm = csm_id || (await supabase.from("offices").select("csm_id").eq("id", office_id).single()).data?.csm_id;
          const createdIds: string[] = [];

          for (const t of templates) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + (t.due_days || 0));
            const { data: act } = await supabase.from("activities").insert({
              title: t.title, type: t.type || "task", description: t.description || null,
              office_id, user_id: assignedCsm,
              due_date: dueDate.toISOString().split("T")[0], priority: "medium",
            }).select("id").single();
            if (act) createdIds.push(act.id);
          }

          await supabase.from("automation_executions").insert({
            rule_id: onbRule.id, office_id, context_key: "onboarding",
            result: { created_activity_ids: createdIds },
          });
        }
      }

      // 3. Execute v2 rules
      await executeV2Rules(supabase, "office.registered", office_id, csm_id, user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "onStageChange") {
      if (!office_id || !product_id || !stage_id) throw new Error("office_id, product_id, stage_id required");

      // Legacy v1 stage tasks
      const { data: rule } = await supabase
        .from("automation_rules").select("*")
        .eq("product_id", product_id).eq("rule_type", "stage_tasks").eq("is_active", true).maybeSingle();

      if (rule) {
        const contextKey = `stage_${stage_id}`;
        const { data: existing } = await supabase
          .from("automation_executions").select("id")
          .eq("rule_id", rule.id).eq("office_id", office_id).eq("context_key", contextKey).maybeSingle();

        if (!existing) {
          const stageTemplates = (rule.config as any)?.stages?.[stage_id] || [];
          const assignedCsm = csm_id || (await supabase.from("offices").select("csm_id").eq("id", office_id).single()).data?.csm_id;
          const createdIds: string[] = [];

          for (const t of stageTemplates) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + (t.due_days || 0));
            const { data: act } = await supabase.from("activities").insert({
              title: t.title, type: t.type || "task", description: t.description || null,
              office_id, user_id: assignedCsm,
              due_date: dueDate.toISOString().split("T")[0], priority: "medium",
            }).select("id").single();
            if (act) createdIds.push(act.id);
          }

          await supabase.from("automation_executions").insert({
            rule_id: rule.id, office_id, context_key: contextKey,
            result: { created_activity_ids: createdIds },
          });
        }
      }

      // v2 rules for stage change
      await executeV2Rules(supabase, "office.stage_changed", office_id, csm_id, user.id, { suffix: stage_id });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Supported: onNewOffice, onStageChange" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[AUTOMATIONS]", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
