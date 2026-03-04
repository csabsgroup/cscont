import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const { office_id } = await req.json();
    if (!office_id) {
      return new Response(JSON.stringify({ error: "office_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate visibility
    const { data: officeVisible } = await userClient
      .from("offices")
      .select("id")
      .eq("id", office_id)
      .maybeSingle();
    if (!officeVisible) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get office + product
    const { data: office } = await sc
      .from("offices")
      .select("id, active_product_id, csm_id")
      .eq("id", office_id)
      .single();

    if (!office?.active_product_id) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No active product" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const productId = office.active_product_id;

    // 2. Get pillars + indicators
    const { data: pillars } = await sc
      .from("health_pillars")
      .select("id, name, weight, position")
      .eq("product_id", productId)
      .order("position");

    if (!pillars || pillars.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No pillars configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pillarIds = pillars.map((p) => p.id);
    const { data: indicators } = await sc
      .from("health_indicators")
      .select("id, name, weight, data_source, data_key, pillar_id")
      .in("pillar_id", pillarIds);

    // 3. Resolve data for each indicator
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000).toISOString();

    // Pre-fetch all data sources in parallel
    const [meetingsRes, contractRes, actionPlansRes, activitiesRes, eventsInvitedRes, eventsParticipatedRes, formSubmissionsRes] =
      await Promise.all([
        sc.from("meetings").select("id, scheduled_at, status").eq("office_id", office_id).eq("status", "completed").order("scheduled_at", { ascending: false }).limit(50),
        sc.from("contracts").select("installments_overdue, status").eq("office_id", office_id).eq("status", "ativo").limit(1),
        sc.from("action_plans").select("id, status").eq("office_id", office_id),
        sc.from("activities").select("id, completed_at, created_at").eq("office_id", office_id).gte("created_at", thirtyDaysAgo),
        sc.from("event_participants").select("id, status").eq("office_id", office_id),
        sc.from("event_participants").select("id").eq("office_id", office_id).eq("status", "participou"),
        sc.from("form_submissions").select("id, data, template_id, submitted_at").eq("office_id", office_id).order("submitted_at", { ascending: false }).limit(20),
      ]);

    const meetings = meetingsRes.data || [];
    const activeContract = contractRes.data?.[0] || null;
    const actionPlans = actionPlansRes.data || [];
    const activities = activitiesRes.data || [];
    const eventsInvited = eventsInvitedRes.data || [];
    const eventsParticipated = eventsParticipatedRes.data || [];
    const formSubmissions = formSubmissionsRes.data || [];

    // Helper: resolve indicator score (0-100) and whether data exists
    function resolveIndicator(ind: any): { score: number; hasData: boolean } {
      const src = ind.data_source || "";
      const key = ind.data_key || "";

      switch (src) {
        case "meetings": {
          if (key === "days_since_last" || key === "cadencia") {
            if (meetings.length === 0) return { score: 0, hasData: false };
            const lastDate = new Date(meetings[0].scheduled_at);
            const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / 86400000);
            // 0 days = 100, 30 days = 70, 60+ days = 20, 90+ = 0
            if (daysSince <= 7) return { score: 100, hasData: true };
            if (daysSince <= 14) return { score: 90, hasData: true };
            if (daysSince <= 30) return { score: 70, hasData: true };
            if (daysSince <= 60) return { score: 40, hasData: true };
            if (daysSince <= 90) return { score: 20, hasData: true };
            return { score: 0, hasData: true };
          }
          if (key === "count_period") {
            const recent = meetings.filter((m) => m.scheduled_at >= thirtyDaysAgo);
            if (meetings.length === 0) return { score: 0, hasData: false };
            const count = recent.length;
            if (count >= 4) return { score: 100, hasData: true };
            if (count >= 2) return { score: 70, hasData: true };
            if (count >= 1) return { score: 40, hasData: true };
            return { score: 10, hasData: true };
          }
          return { score: 0, hasData: false };
        }

        case "contracts": {
          if (key === "installments_overdue" || key === "inadimplencia") {
            if (!activeContract) return { score: 0, hasData: false };
            const overdue = activeContract.installments_overdue || 0;
            if (overdue === 0) return { score: 100, hasData: true };
            if (overdue <= 1) return { score: 60, hasData: true };
            if (overdue <= 2) return { score: 30, hasData: true };
            return { score: 0, hasData: true };
          }
          return { score: 0, hasData: false };
        }

        case "form_submission": {
          if (key === "nps") {
            const npsSubmission = formSubmissions.find((s: any) => {
              const d = s.data as any;
              return d?.nps !== undefined || d?.NPS !== undefined;
            });
            if (!npsSubmission) return { score: 0, hasData: false };
            const d = npsSubmission.data as any;
            const nps = Number(d?.nps ?? d?.NPS ?? 0);
            // NPS 0-10 → score
            if (nps >= 9) return { score: 100, hasData: true };
            if (nps >= 7) return { score: 70, hasData: true };
            if (nps >= 5) return { score: 40, hasData: true };
            return { score: 10, hasData: true };
          }
          if (key === "csat") {
            const csatSubmission = formSubmissions.find((s: any) => {
              const d = s.data as any;
              return d?.csat !== undefined || d?.CSAT !== undefined || d?.satisfacao !== undefined;
            });
            if (!csatSubmission) return { score: 0, hasData: false };
            const d = csatSubmission.data as any;
            const csat = Number(d?.csat ?? d?.CSAT ?? d?.satisfacao ?? 0);
            // CSAT 1-5 → score
            if (csat >= 5) return { score: 100, hasData: true };
            if (csat >= 4) return { score: 80, hasData: true };
            if (csat >= 3) return { score: 50, hasData: true };
            return { score: 20, hasData: true };
          }
          if (key === "percepcao" || key === "perception") {
            // Generic perception from latest form
            if (formSubmissions.length === 0) return { score: 0, hasData: false };
            return { score: 70, hasData: true }; // Default perception when form exists
          }
          return { score: 0, hasData: false };
        }

        case "events": {
          if (eventsInvited.length === 0) return { score: 0, hasData: false };
          const rate = eventsParticipated.length / eventsInvited.length;
          return { score: Math.round(rate * 100), hasData: true };
        }

        case "action_plans": {
          if (actionPlans.length === 0) return { score: 0, hasData: false };
          const done = actionPlans.filter((p) => p.status === "done").length;
          const rate = done / actionPlans.length;
          return { score: Math.round(rate * 100), hasData: true };
        }

        case "activities": {
          if (activities.length === 0) return { score: 0, hasData: false };
          const completed = activities.filter((a) => a.completed_at).length;
          const count = activities.length;
          // More activity = better
          let score = Math.min(100, count * 15);
          if (count > 0) score = Math.max(score, Math.round((completed / count) * 100));
          return { score, hasData: true };
        }

        default:
          return { score: 0, hasData: false };
      }
    }

    // 4. Calculate per-pillar scores with neutralization
    const breakdown: any = {};
    const pillarScores: { pillarId: string; score: number; weight: number; hasData: boolean }[] = [];

    for (const pillar of pillars) {
      const pillarIndicators = (indicators || []).filter((ind) => ind.pillar_id === pillar.id);
      if (pillarIndicators.length === 0) {
        pillarScores.push({ pillarId: pillar.id, score: 0, weight: pillar.weight, hasData: false });
        breakdown[pillar.name] = { score: 0, weight: pillar.weight, hasData: false, indicators: [] };
        continue;
      }

      const resolved = pillarIndicators.map((ind) => ({
        ...ind,
        ...resolveIndicator(ind),
      }));

      const withData = resolved.filter((r) => r.hasData);
      const hasAnyData = withData.length > 0;

      let pillarScore = 0;
      const indBreakdown: any[] = [];

      if (hasAnyData) {
        // Neutralize: redistribute weights of missing indicators
        const totalActiveWeight = withData.reduce((sum, r) => sum + r.weight, 0);
        if (totalActiveWeight > 0) {
          pillarScore = withData.reduce((sum, r) => sum + (r.score * r.weight) / totalActiveWeight, 0);
        }
        for (const r of resolved) {
          indBreakdown.push({
            name: r.name,
            score: r.score,
            weight: r.weight,
            hasData: r.hasData,
            data_source: r.data_source,
            data_key: r.data_key,
          });
        }
      }

      pillarScores.push({ pillarId: pillar.id, score: pillarScore, weight: pillar.weight, hasData: hasAnyData });
      breakdown[pillar.name] = { score: Math.round(pillarScore), weight: pillar.weight, hasData: hasAnyData, indicators: indBreakdown };
    }

    // 5. Calculate final score with pillar neutralization
    const activePillars = pillarScores.filter((p) => p.hasData);
    let rawScore = 0;

    if (activePillars.length > 0) {
      const totalActiveWeight = activePillars.reduce((sum, p) => sum + p.weight, 0);
      if (totalActiveWeight > 0) {
        rawScore = activePillars.reduce((sum, p) => sum + (p.score * p.weight) / totalActiveWeight, 0);
      }
    }

    // 6. Apply overrides
    const { data: overrides } = await sc
      .from("health_overrides")
      .select("*")
      .eq("product_id", productId);

    let finalScore = Math.round(rawScore);
    let forcedBand: string | null = null;
    const overridesApplied: any[] = [];

    // Calculate override condition values
    const daysSinceLastMeeting = meetings.length > 0
      ? Math.floor((now.getTime() - new Date(meetings[0].scheduled_at).getTime()) / 86400000)
      : 999;
    const installmentsOverdue = activeContract?.installments_overdue || 0;

    for (const override of overrides || []) {
      let conditionMet = false;
      const condType = override.condition_type;
      const threshold = override.threshold;

      switch (condType) {
        case "installments_overdue":
        case "parcelas_vencidas":
          conditionMet = installmentsOverdue >= threshold;
          break;
        case "days_without_meeting":
        case "dias_sem_reuniao":
          conditionMet = daysSinceLastMeeting >= threshold;
          break;
        default:
          break;
      }

      if (conditionMet) {
        overridesApplied.push({
          condition_type: condType,
          threshold,
          action: override.action,
          reduction_points: override.reduction_points,
        });

        if (override.action === "force_red") {
          forcedBand = "red";
        } else if (override.action === "reduce_score") {
          finalScore = Math.max(0, finalScore - (override.reduction_points || 0));
        }
      }
    }

    // 7. Determine band
    let band: string;
    if (forcedBand) {
      band = forcedBand;
    } else if (finalScore >= 70) {
      band = "green";
    } else if (finalScore >= 40) {
      band = "yellow";
    } else {
      band = "red";
    }

    // 8. Get previous score
    const { data: prevScore } = await sc
      .from("health_scores")
      .select("id, band, score")
      .eq("office_id", office_id)
      .maybeSingle();

    const oldBand = prevScore?.band || null;

    // 9. Upsert health_scores
    if (prevScore) {
      await sc
        .from("health_scores")
        .update({
          score: finalScore,
          band: band as any,
          breakdown: { pillars: breakdown, overrides_applied: overridesApplied },
          calculated_at: now.toISOString(),
        })
        .eq("id", prevScore.id);
    } else {
      await sc.from("health_scores").insert({
        office_id,
        score: finalScore,
        band: band as any,
        breakdown: { pillars: breakdown, overrides_applied: overridesApplied },
        calculated_at: now.toISOString(),
      });
    }

    // 10. If band changed, execute playbook
    let playbookResult = null;
    if (oldBand && band !== oldBand) {
      const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      // Check idempotency
      const { data: existing } = await sc
        .from("health_playbook_executions")
        .select("id")
        .eq("office_id", office_id)
        .eq("band", band)
        .eq("period_key", periodKey)
        .maybeSingle();

      if (!existing) {
        const { data: playbook } = await sc
          .from("health_playbooks")
          .select("*")
          .eq("product_id", productId)
          .eq("band", band)
          .maybeSingle();

        if (playbook?.activity_template) {
          const csmId = office.csm_id || userId;
          const template = playbook.activity_template as any;
          const templates = Array.isArray(template) ? template : [template];
          const createdIds: string[] = [];

          for (const t of templates) {
            if (!t.title) continue;
            const dueDate = t.due_days
              ? new Date(now.getTime() + t.due_days * 86400000).toISOString().split("T")[0]
              : null;

            const { data: activity } = await sc
              .from("activities")
              .insert({
                user_id: csmId,
                office_id,
                title: t.title,
                description: t.description || `Auto-gerada pelo playbook (${band}) em ${periodKey}`,
                type: t.type || "task",
                priority: t.priority || "high",
                due_date: dueDate,
              })
              .select("id")
              .single();

            if (activity) createdIds.push(activity.id);
          }

          await sc.from("health_playbook_executions").insert({
            office_id,
            product_id: productId,
            band: band as any,
            period_key: periodKey,
            created_activity_ids: createdIds,
          });

          // Audit log
          await sc.from("audit_logs").insert({
            user_id: userId,
            action: "playbook_executed",
            entity_type: "health_score",
            entity_id: office_id,
            details: { band, old_band: oldBand, created_activities: createdIds.length },
          });

          playbookResult = { executed: true, band, created_activities: createdIds.length };
        }
      }
    }

    return new Response(
      JSON.stringify({
        score: finalScore,
        band,
        old_band: oldBand,
        breakdown,
        overrides_applied: overridesApplied,
        playbook: playbookResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
