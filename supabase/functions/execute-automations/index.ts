import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // --- Auth: validate JWT and require admin/manager role ---
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

    // Check role: only admin, manager, or csm can trigger automations
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

      // 1. Distribution
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
              .from("offices")
              .select("csm_id")
              .eq("active_product_id", product_id)
              .in("csm_id", eligible);
            const counts: Record<string, number> = {};
            eligible.forEach((id: string) => { counts[id] = 0; });
            (offices || []).forEach((o: any) => { if (o.csm_id && counts[o.csm_id] !== undefined) counts[o.csm_id]++; });
            assignedCsmId = eligible.reduce((a: string, b: string) => (counts[a] || 0) <= (counts[b] || 0) ? a : b);
          }
        } else if (config.method === "round_robin") {
          const eligible = config.eligible_csm_ids || [];
          if (eligible.length > 0) {
            const { data: lastExec } = await supabase
              .from("automation_executions")
              .select("result")
              .eq("rule_id", distRule.id)
              .order("executed_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            const lastIndex = (lastExec?.result as any)?.csm_index ?? -1;
            const nextIndex = (lastIndex + 1) % eligible.length;
            assignedCsmId = eligible[nextIndex];
            // Record execution for round-robin tracking
            await supabase.from("automation_executions").insert({
              rule_id: distRule.id,
              office_id,
              context_key: `distribution_${Date.now()}`,
              result: { csm_index: nextIndex, csm_id: assignedCsmId },
            });
          }
        }

        if (assignedCsmId) {
          await supabase.from("offices").update({ csm_id: assignedCsmId }).eq("id", office_id);
        }
      }

      // 2. Onboarding tasks
      const { data: onbRule } = await supabase
        .from("automation_rules")
        .select("*")
        .eq("product_id", product_id)
        .eq("rule_type", "onboarding_tasks")
        .eq("is_active", true)
        .maybeSingle();

      if (onbRule) {
        // Idempotency check
        const { data: existing } = await supabase
          .from("automation_executions")
          .select("id")
          .eq("rule_id", onbRule.id)
          .eq("office_id", office_id)
          .eq("context_key", "onboarding")
          .maybeSingle();

        if (!existing) {
          const templates = (onbRule.config as any)?.templates || [];
          const assignedCsm = csm_id || (await supabase.from("offices").select("csm_id").eq("id", office_id).single()).data?.csm_id;
          const createdIds: string[] = [];

          for (const t of templates) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + (t.due_days || 0));
            const { data: act } = await supabase.from("activities").insert({
              title: t.title,
              type: t.type || "task",
              description: t.description || null,
              office_id,
              user_id: assignedCsm,
              due_date: dueDate.toISOString().split("T")[0],
              priority: "medium",
            }).select("id").single();
            if (act) createdIds.push(act.id);
          }

          await supabase.from("automation_executions").insert({
            rule_id: onbRule.id,
            office_id,
            context_key: "onboarding",
            result: { created_activity_ids: createdIds },
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "onStageChange") {
      if (!office_id || !product_id || !stage_id) throw new Error("office_id, product_id, stage_id required");

      const { data: rule } = await supabase
        .from("automation_rules")
        .select("*")
        .eq("product_id", product_id)
        .eq("rule_type", "stage_tasks")
        .eq("is_active", true)
        .maybeSingle();

      if (rule) {
        const contextKey = `stage_${stage_id}`;
        const { data: existing } = await supabase
          .from("automation_executions")
          .select("id")
          .eq("rule_id", rule.id)
          .eq("office_id", office_id)
          .eq("context_key", contextKey)
          .maybeSingle();

        if (!existing) {
          const stageTemplates = (rule.config as any)?.stages?.[stage_id] || [];
          const assignedCsm = csm_id || (await supabase.from("offices").select("csm_id").eq("id", office_id).single()).data?.csm_id;
          const createdIds: string[] = [];

          for (const t of stageTemplates) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + (t.due_days || 0));
            const { data: act } = await supabase.from("activities").insert({
              title: t.title,
              type: t.type || "task",
              description: t.description || null,
              office_id,
              user_id: assignedCsm,
              due_date: dueDate.toISOString().split("T")[0],
              priority: "medium",
            }).select("id").single();
            if (act) createdIds.push(act.id);
          }

          await supabase.from("automation_executions").insert({
            rule_id: rule.id,
            office_id,
            context_key: contextKey,
            result: { created_activity_ids: createdIds },
          });
        }
      }

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
