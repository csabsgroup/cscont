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

    // Validate user
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

    const { office_id, product_id, new_band, old_band } = await req.json();

    if (!office_id || !product_id || !new_band || new_band === old_band) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No band change" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user has visibility on this office
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

    // Service role client for writes
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Check idempotency
    const { data: existing } = await serviceClient
      .from("health_playbook_executions")
      .select("id")
      .eq("office_id", office_id)
      .eq("band", new_band)
      .eq("period_key", periodKey)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: "Already executed this period",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get playbook for product + band
    const { data: playbook } = await serviceClient
      .from("health_playbooks")
      .select("*")
      .eq("product_id", product_id)
      .eq("band", new_band)
      .maybeSingle();

    if (!playbook || !playbook.activity_template) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "No playbook configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get CSM for office
    const { data: office } = await serviceClient
      .from("offices")
      .select("csm_id")
      .eq("id", office_id)
      .single();

    const csmId = office?.csm_id || userId;
    const template = playbook.activity_template as any;
    const templates = Array.isArray(template) ? template : [template];
    const createdIds: string[] = [];

    for (const t of templates) {
      if (!t.title) continue;
      const dueDate = t.due_days
        ? new Date(
            now.getTime() + t.due_days * 24 * 60 * 60 * 1000
          ).toISOString().split("T")[0]
        : null;

      const { data: activity, error } = await serviceClient
        .from("activities")
        .insert({
          user_id: csmId,
          office_id,
          title: t.title,
          description:
            t.description ||
            `Auto-gerada pelo playbook (${new_band}) em ${periodKey}`,
          type: t.type || "task",
          priority: t.priority || "high",
          due_date: dueDate,
        })
        .select("id")
        .single();

      if (activity) createdIds.push(activity.id);
    }

    // Record execution
    await serviceClient.from("health_playbook_executions").insert({
      office_id,
      product_id,
      band: new_band,
      period_key: periodKey,
      created_activity_ids: createdIds,
    });

    return new Response(
      JSON.stringify({ success: true, created_activity_ids: createdIds }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
