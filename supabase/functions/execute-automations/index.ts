import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Variable Substitution ───────────────────────────────────
function resolveVariables(template: string, office: any, csm: any, extra?: Record<string, any>): string {
  if (!template) return template;
  return template
    .replace(/\{\{escritorio\}\}/g, office?.name || '')
    .replace(/\{\{produto\}\}/g, office?.product_name || office?.products?.name || '')
    .replace(/\{\{csm\}\}/g, csm?.full_name || 'Não atribuído')
    .replace(/\{\{health_score\}\}/g, extra?.health_score?.toString() || '--')
    .replace(/\{\{health_faixa\}\}/g, extra?.health_band || '--')
    .replace(/\{\{status\}\}/g, office?.status || '')
    .replace(/\{\{etapa\}\}/g, extra?.stage_name || '--')
    .replace(/\{\{parcelas_vencidas\}\}/g, extra?.installments_overdue?.toString() || '0')
    .replace(/\{\{dias_renovacao\}\}/g, extra?.days_to_renewal?.toString() || '--')
    .replace(/\{\{data_hoje\}\}/g, new Date().toLocaleDateString('pt-BR'));
}

// ─── Action Handlers ─────────────────────────────────────────
async function handleAction(supabase: any, action: any, office_id: string, office: any, assignedCsm: string | null, userId: string, csmProfile: any, dryRun = false) {
  const c = action.config || {};

  // Resolve variables in text fields
  const resolveText = (text: string) => resolveVariables(text, office, csmProfile);

  switch (action.type) {
    case "create_activity": {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (parseInt(c.due_days) || 0));
      const payload = {
        title: resolveText(c.title || "Atividade automática"),
        type: c.activity_type || "task",
        description: resolveText(c.description || ""),
        office_id,
        user_id: assignedCsm || userId,
        due_date: dueDate.toISOString().split("T")[0],
        priority: c.priority || "medium",
      };
      if (dryRun) return { type: "create_activity", would_create: payload };
      const { data: act } = await supabase.from("activities").insert(payload).select("id").single();
      return { type: "create_activity", id: act?.id };
    }

    case "move_stage":
    case "move_journey_stage": {
      if (c.stage_id) {
        if (!dryRun) {
          await supabase.from("office_journey").upsert({
            office_id,
            journey_stage_id: c.stage_id,
            entered_at: new Date().toISOString(),
          }, { onConflict: "office_id" });
        }
      }
      return { type: "move_stage", stage_id: c.stage_id };
    }

    case "change_status": {
      if (c.new_status) {
        if (!dryRun) {
          await supabase.from("offices").update({ status: c.new_status }).eq("id", office_id);
        }
      }
      return { type: "change_status", new_status: c.new_status };
    }

    case "send_notification": {
      const recipientId = c.recipient === "csm" ? assignedCsm : userId;
      if (recipientId && !dryRun) {
        await supabase.from("notifications").insert({
          user_id: recipientId,
          title: resolveText(c.title || "Notificação automática"),
          message: resolveText(c.message || ""),
          type: "info",
          entity_type: "office",
          entity_id: office_id,
        });
      }
      return { type: "send_notification" };
    }

    case "send_email": {
      if (!dryRun) {
        try {
          await supabase.functions.invoke('integration-email', {
            body: {
              action: 'send',
              to: c.recipient === 'cliente' ? office?.email : c.recipient === 'contato_principal' ? null : null,
              subject: resolveText(c.subject || ''),
              body: resolveText(c.body || ''),
              office_id,
            },
          });
        } catch (e) {
          console.error('[AUTOMATIONS] Email failed:', e);
          return { type: "send_email", error: String(e) };
        }
      }
      return { type: "send_email" };
    }

    case "send_slack": {
      if (!dryRun) {
        try {
          await supabase.functions.invoke('integration-slack', {
            body: {
              action: 'sendMessage',
              message: resolveText(c.message || `Automação executada para ${office?.name}`),
            },
          });
        } catch (e) {
          console.error('[AUTOMATIONS] Slack failed:', e);
          return { type: "send_slack", error: String(e) };
        }
      }
      return { type: "send_slack" };
    }

    case "send_whatsapp": {
      if (!dryRun) {
        try {
          await supabase.functions.invoke('integration-whatsapp', {
            body: {
              action: 'sendMessage',
              to: c.phone || office?.whatsapp || office?.phone,
              message: resolveText(c.message || ''),
              office_id,
            },
          });
        } catch (e) {
          console.error('[AUTOMATIONS] WhatsApp failed:', e);
          return { type: "send_whatsapp", error: String(e) };
        }
      }
      return { type: "send_whatsapp" };
    }

    case "create_action_plan": {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (parseInt(c.due_days) || 7));
      if (!dryRun) {
        await supabase.from("action_plans").insert({
          title: resolveText(c.title || "Plano de ação automático"),
          description: resolveText(c.description || ""),
          office_id,
          created_by: assignedCsm || userId,
          due_date: dueDate.toISOString().split("T")[0],
        });
      }
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
          const hash = office_id.split("").reduce((acc: number, ch: string) => acc + ch.charCodeAt(0), 0);
          newCsmId = eligible[hash % eligible.length];
        }
      }
      if (newCsmId && !dryRun) {
        await supabase.from("offices").update({ csm_id: newCsmId }).eq("id", office_id);
      }
      return { type: "change_csm", csm_id: newCsmId };
    }

    case "create_contract": {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + (parseInt(c.start_days) || 0));
      const endDate = c.duration_days ? new Date(startDate.getTime() + parseInt(c.duration_days) * 86400000) : null;
      const renewalDate = c.renewal_days ? new Date(startDate.getTime() + parseInt(c.renewal_days) * 86400000) : null;
      if (!dryRun) {
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
      }
      return { type: "create_contract" };
    }

    case "cancel_contract": {
      const newStatus = c.cancel_action || "cancelado";
      if (c.target_product_id && !dryRun) {
        await supabase.from("contracts")
          .update({ status: newStatus, end_date: new Date().toISOString().split("T")[0] })
          .eq("office_id", office_id)
          .eq("product_id", c.target_product_id)
          .in("status", ["ativo", "pendente"]);
      }
      return { type: "cancel_contract", status: newStatus };
    }

    case "set_product": {
      if (c.product_id && !dryRun) {
        await supabase.from("offices").update({ active_product_id: c.product_id }).eq("id", office_id);
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
      if (!dryRun) {
        await supabase.from("office_notes").insert({
          office_id,
          note_type: c.note_type || "observacao",
          content: resolveText(c.content || "Nota automática"),
          created_by: assignedCsm || userId,
        });
      }
      return { type: "add_note" };
    }

    case "grant_bonus": {
      if (c.catalog_item_id && !dryRun) {
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

    case "create_meeting": {
      if (!dryRun) {
        const scheduledAt = new Date();
        scheduledAt.setDate(scheduledAt.getDate() + (parseInt(c.days_from_now) || 1));
        await supabase.from("meetings").insert({
          office_id,
          user_id: assignedCsm || userId,
          title: resolveText(c.title || "Reunião automática"),
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: parseInt(c.duration_minutes) || 30,
        });
      }
      return { type: "create_meeting" };
    }

    case "force_health_band": {
      if (c.band && !dryRun) {
        await supabase.from("health_scores").upsert({
          office_id,
          band: c.band,
          score: c.band === 'red' ? 0 : c.band === 'yellow' ? 50 : 100,
          calculated_at: new Date().toISOString(),
        }, { onConflict: "office_id" });
      }
      return { type: "force_health_band", band: c.band };
    }

    case "create_alert": {
      if (!dryRun) {
        const recipientId = assignedCsm || userId;
        await supabase.from("notifications").insert({
          user_id: recipientId,
          title: resolveText(c.title || "⚠️ Atenção Hoje"),
          message: resolveText(c.message || `Alerta automático para ${office?.name}`),
          type: "warning",
          entity_type: "office",
          entity_id: office_id,
        });
      }
      return { type: "create_alert" };
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

  const officeFieldMap: Record<string, string> = {
    office_name: 'name', office_cnpj: 'cnpj', office_cpf: 'cpf', office_cep: 'cep',
    office_address: 'address', office_city: 'city', office_state: 'state',
    office_segment: 'segment', office_instagram: 'instagram', office_whatsapp: 'whatsapp',
    office_email: 'email', office_phone: 'phone', office_tags: 'tags',
    office_qtd_clientes: 'qtd_clientes', office_qtd_colaboradores: 'qtd_colaboradores',
    office_faturamento_mensal: 'faturamento_mensal', office_faturamento_anual: 'faturamento_anual',
  };
  if (officeFieldMap[field]) return office?.[officeFieldMap[field]] ?? null;

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
    if (scope === 'any') return data.map((r: any) => r[col]).filter((v: any) => v != null);
    return data[0]?.[col] ?? null;
  }

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

  return office?.[field] ?? null;
}

function evaluateCondition(resolvedValue: any, operator: string, condValue: any, condValue2?: any): boolean {
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
async function executeV2Rules(supabase: any, triggerType: string, office_id: string, csm_id: string | null, userId: string, extraContext?: Record<string, any>, dryRun = false) {
  const startTime = Date.now();
  const { data: v2Rules } = await supabase
    .from("automation_rules_v2")
    .select("*")
    .eq("trigger_type", triggerType)
    .eq("is_active", true);

  if (!v2Rules || v2Rules.length === 0) return { executed: 0, skipped: 0, errors: 0, results: [] };

  const { data: office } = await supabase.from("offices").select("*").eq("id", office_id).single();
  
  // Fetch CSM profile for variable substitution
  const effectiveCsmId = csm_id || office?.csm_id;
  let csmProfile: any = null;
  if (effectiveCsmId) {
    const { data: p } = await supabase.from("profiles").select("full_name").eq("id", effectiveCsmId).maybeSingle();
    csmProfile = p;
  }

  const results: any[] = [];
  let executed = 0, skipped = 0, errors = 0;

  for (const rule of v2Rules) {
    const ruleStart = Date.now();
    try {
      // Product scope check
      if (rule.product_id && office?.active_product_id && rule.product_id !== office.active_product_id) {
        skipped++;
        if (!dryRun) {
          await supabase.from("automation_logs").insert({
            rule_id: rule.id, rule_name: rule.name, office_id, trigger_type: triggerType,
            conditions_met: false, actions_executed: [], error: 'Product mismatch',
            execution_time_ms: Date.now() - ruleStart,
          }).catch(() => {});
        }
        continue;
      }

      // Idempotency check
      const contextKey = `${triggerType}_${office_id}_${extraContext?.suffix || ""}`.replace(/_+$/, "");
      if (!dryRun) {
        const { data: existing } = await supabase
          .from("automation_executions")
          .select("id")
          .eq("rule_id", rule.id)
          .eq("office_id", office_id)
          .eq("context_key", contextKey)
          .maybeSingle();
        if (existing) {
          skipped++;
          continue;
        }
      }

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

      if (!ruleMatches) {
        skipped++;
        if (!dryRun) {
          await supabase.from("automation_logs").insert({
            rule_id: rule.id, rule_name: rule.name, office_id, trigger_type: triggerType,
            conditions_met: false, actions_executed: [],
            execution_time_ms: Date.now() - ruleStart,
          }).catch(() => {});
        }
        continue;
      }

      // Execute actions
      const actions = (rule.actions as any[]) || [];
      const assignedCsm = effectiveCsmId;
      const actionResults: any[] = [];

      for (const action of actions) {
        try {
          const result = await handleAction(supabase, action, office_id, office, assignedCsm, userId, csmProfile, dryRun);
          actionResults.push(result);
        } catch (actionErr: any) {
          console.error(`[AUTOMATIONS] Action ${action.type} failed:`, actionErr);
          actionResults.push({ type: action.type, error: actionErr?.message || String(actionErr) });
        }
      }

      if (!dryRun) {
        await supabase.from("automation_executions").insert({
          rule_id: rule.id,
          office_id,
          context_key: contextKey,
          result: { trigger: triggerType, actions: actionResults },
        });

        await supabase.from("automation_logs").insert({
          rule_id: rule.id, rule_name: rule.name, office_id, trigger_type: triggerType,
          conditions_met: true, actions_executed: actionResults,
          execution_time_ms: Date.now() - ruleStart,
        }).catch(() => {});
      }

      executed++;
      results.push({ rule_id: rule.id, rule_name: rule.name, actions: actionResults });
    } catch (ruleErr: any) {
      errors++;
      console.error(`[AUTOMATIONS] Rule ${rule.id} failed:`, ruleErr);
      if (!dryRun) {
        await supabase.from("automation_logs").insert({
          rule_id: rule.id, rule_name: rule.name, office_id, trigger_type: triggerType,
          conditions_met: false, actions_executed: [],
          error: ruleErr?.message || String(ruleErr),
          execution_time_ms: Date.now() - ruleStart,
        }).catch(() => {});
      }
    }
  }

  return { executed, skipped, errors, results, total_time_ms: Date.now() - startTime };
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

    // ========== triggerV2 (generic trigger) ==========
    if (action === "triggerV2") {
      const { trigger_type, context } = body;
      if (!trigger_type || !office_id) throw new Error("trigger_type and office_id required");
      
      const result = await executeV2Rules(supabase, trigger_type, office_id, csm_id || null, user.id, context);
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== dryRun ==========
    if (action === "dryRun") {
      const { trigger_type, context } = body;
      if (!trigger_type) throw new Error("trigger_type required");

      // Get offices to test against (first 5 matching product)
      let officeQuery = supabase.from("offices").select("id, name, active_product_id, csm_id, status")
        .in("status", ["ativo", "upsell", "bonus_elite"]).limit(5);
      if (body.product_id) officeQuery = officeQuery.eq("active_product_id", body.product_id);
      const { data: testOffices } = await officeQuery;

      const previews: any[] = [];
      for (const off of (testOffices || [])) {
        const result = await executeV2Rules(supabase, trigger_type, off.id, off.csm_id, user.id, context, true);
        previews.push({
          office_id: off.id,
          office_name: off.name,
          ...result,
        });
      }

      return new Response(JSON.stringify({ success: true, previews }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== reachCount ==========
    if (action === "reachCount") {
      let q = supabase.from("offices").select("id", { count: "exact", head: true })
        .in("status", ["ativo", "upsell", "bonus_elite"]);
      if (body.product_id && body.product_id !== '__all__') q = q.eq("active_product_id", body.product_id);
      const { count } = await q;
      return new Response(JSON.stringify({ count: count || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== onNewOffice (legacy v1 + v2) ==========
    if (action === "onNewOffice") {
      if (!office_id || !product_id) throw new Error("office_id and product_id required");

      // 1. Distribution (legacy v1)
      const { data: distRule } = await supabase
        .from("automation_rules").select("*")
        .eq("product_id", product_id).eq("rule_type", "distribution").eq("is_active", true).maybeSingle();

      if (distRule) {
        const config = distRule.config as any;
        let assignedCsmId: string | null = null;
        if (config.method === "fixed" && config.fixed_csm_id) {
          assignedCsmId = config.fixed_csm_id;
        } else if (config.method === "least_clients") {
          const eligible = config.eligible_csm_ids || [];
          if (eligible.length > 0) {
            const { data: offices } = await supabase.from("offices").select("csm_id").eq("active_product_id", product_id).in("csm_id", eligible);
            const counts: Record<string, number> = {};
            eligible.forEach((id: string) => { counts[id] = 0; });
            (offices || []).forEach((o: any) => { if (o.csm_id && counts[o.csm_id] !== undefined) counts[o.csm_id]++; });
            assignedCsmId = eligible.reduce((a: string, b: string) => (counts[a] || 0) <= (counts[b] || 0) ? a : b);
          }
        } else if (config.method === "round_robin") {
          const eligible = config.eligible_csm_ids || [];
          if (eligible.length > 0) {
            const { data: lastExec } = await supabase.from("automation_executions").select("result")
              .eq("rule_id", distRule.id).order("executed_at", { ascending: false }).limit(1).maybeSingle();
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
        const { data: existing } = await supabase.from("automation_executions").select("id")
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
      await executeV2Rules(supabase, "office.created", office_id, csm_id, user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== onStageChange (legacy v1 + v2) ==========
    if (action === "onStageChange") {
      if (!office_id || !product_id || !stage_id) throw new Error("office_id, product_id, stage_id required");

      const { data: rule } = await supabase
        .from("automation_rules").select("*")
        .eq("product_id", product_id).eq("rule_type", "stage_tasks").eq("is_active", true).maybeSingle();

      if (rule) {
        const contextKey = `stage_${stage_id}`;
        const { data: existing } = await supabase.from("automation_executions").select("id")
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

      await executeV2Rules(supabase, "office.stage_changed", office_id, csm_id, user.id, { suffix: stage_id });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Supported: triggerV2, dryRun, reachCount, onNewOffice, onStageChange" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[AUTOMATIONS]", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
