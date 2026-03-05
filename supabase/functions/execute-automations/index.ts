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
