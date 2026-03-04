import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { submission_id, template_id, office_id } = await req.json();
    if (!submission_id || !template_id || !office_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check visibility
    const { data: visible } = await userClient
      .from("offices")
      .select("id")
      .eq("id", office_id)
      .maybeSingle();
    if (!visible) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get template post_actions
    const { data: template } = await serviceClient
      .from("form_templates")
      .select("post_actions")
      .eq("id", template_id)
      .single();

    if (!template?.post_actions) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No post_actions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const postActions = template.post_actions as any;
    const results: Record<string, any> = {};

    // Get CSM
    const { data: office } = await serviceClient
      .from("offices")
      .select("csm_id, active_product_id")
      .eq("id", office_id)
      .single();
    const csmId = office?.csm_id || userId;

    // 1. create_activity
    if (postActions.create_activity) {
      const actionKey = "create_activity";
      const { data: existing } = await serviceClient
        .from("form_action_executions")
        .select("id")
        .eq("submission_id", submission_id)
        .eq("action_key", actionKey)
        .maybeSingle();

      if (!existing) {
        const cfg = postActions.create_activity;
        const dueDate = cfg.due_days
          ? new Date(
              Date.now() + cfg.due_days * 24 * 60 * 60 * 1000
            ).toISOString().split("T")[0]
          : null;

        const { data: activity } = await serviceClient
          .from("activities")
          .insert({
            user_id: csmId,
            office_id,
            title: cfg.title || "Atividade do formulário",
            description:
              cfg.description || `Criada automaticamente (submission ${submission_id})`,
            type: cfg.type || "task",
            priority: cfg.priority || "medium",
            due_date: dueDate,
          })
          .select("id")
          .single();

        await serviceClient.from("form_action_executions").insert({
          submission_id,
          action_key: actionKey,
          result: { activity_id: activity?.id },
        });
        results[actionKey] = { created: true, activity_id: activity?.id };
      } else {
        results[actionKey] = { skipped: true };
      }
    }

    // 2. move_stage
    if (postActions.move_stage) {
      const actionKey = "move_stage";
      const { data: existing } = await serviceClient
        .from("form_action_executions")
        .select("id")
        .eq("submission_id", submission_id)
        .eq("action_key", actionKey)
        .maybeSingle();

      if (!existing) {
        const cfg = postActions.move_stage;
        const targetStageId = cfg.target_stage_id;

        if (targetStageId) {
          // Validate target stage belongs to office product
          const { data: targetStage } = await serviceClient
            .from("journey_stages")
            .select("id, product_id")
            .eq("id", targetStageId)
            .maybeSingle();

          if (
            targetStage &&
            (!office?.active_product_id ||
              targetStage.product_id === office.active_product_id)
          ) {
            // Get current journey
            const { data: currentJourney } = await serviceClient
              .from("office_journey")
              .select("id, journey_stage_id")
              .eq("office_id", office_id)
              .maybeSingle();

            const fromStageId = currentJourney?.journey_stage_id || null;

            if (currentJourney) {
              await serviceClient
                .from("office_journey")
                .update({
                  journey_stage_id: targetStageId,
                  entered_at: new Date().toISOString(),
                  notes: "Form submission",
                })
                .eq("id", currentJourney.id);
            } else {
              await serviceClient.from("office_journey").insert({
                office_id,
                journey_stage_id: targetStageId,
                notes: "Form submission",
              });
            }

            // Record history
            await serviceClient.from("office_stage_history").insert({
              office_id,
              from_stage_id: fromStageId,
              to_stage_id: targetStageId,
              changed_by: userId,
              reason: "Form submission",
              change_type: "auto_trigger",
            });

            await serviceClient.from("form_action_executions").insert({
              submission_id,
              action_key: actionKey,
              result: {
                from_stage_id: fromStageId,
                to_stage_id: targetStageId,
              },
            });
            results[actionKey] = { moved: true };
          } else {
            results[actionKey] = {
              skipped: true,
              reason: "Invalid target stage",
            };
          }
        }
      } else {
        results[actionKey] = { skipped: true };
      }
    }

    // 3. notify (stub)
    if (postActions.notify) {
      const actionKey = "notify";
      const { data: existing } = await serviceClient
        .from("form_action_executions")
        .select("id")
        .eq("submission_id", submission_id)
        .eq("action_key", actionKey)
        .maybeSingle();

      if (!existing) {
        await serviceClient.from("form_action_executions").insert({
          submission_id,
          action_key: actionKey,
          result: {
            notified: true,
            message: postActions.notify.message || "Form submitted",
            stub: true,
          },
        });
        results[actionKey] = { notified: true, stub: true };
      } else {
        results[actionKey] = { skipped: true };
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
