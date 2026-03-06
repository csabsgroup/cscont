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
    const { form_hash, office_id, data } = await req.json();

    if (!form_hash || !office_id || !data) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate form exists and is active
    const { data: template, error: tErr } = await serviceClient
      .from("form_templates")
      .select("id, fields, form_type, is_active")
      .eq("form_hash", form_hash)
      .maybeSingle();

    if (tErr || !template || !template.is_active) {
      return new Response(
        JSON.stringify({ error: "Form not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (template.form_type !== "external") {
      return new Response(
        JSON.stringify({ error: "This form is not publicly accessible" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate office exists
    const { data: office } = await serviceClient
      .from("offices")
      .select("id")
      .eq("id", office_id)
      .maybeSingle();

    if (!office) {
      return new Response(
        JSON.stringify({ error: "Office not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert submission (no user_id for external)
    const { data: submission, error: sErr } = await serviceClient
      .from("form_submissions")
      .insert({
        template_id: template.id,
        office_id,
        data,
        user_id: null,
      })
      .select("id")
      .single();

    if (sErr) {
      console.error("Submission insert error:", sErr);
      return new Response(
        JSON.stringify({ error: "Failed to save submission" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Apply header mappings
    const fields = Array.isArray(template.fields) ? template.fields : [];
    const officeUpdates: Record<string, any> = {};

    for (const field of fields) {
      if (!field.header_mapping?.enabled || !field.header_mapping.target_field) continue;
      const value = data[field.id];
      if (value === undefined || value === null || value === "") continue;

      const target = field.header_mapping.target_field;
      if (target.startsWith("offices.")) {
        officeUpdates[target.replace("offices.", "")] = value;
      } else if (target.startsWith("custom_field:")) {
        const cfId = target.replace("custom_field:", "");
        await serviceClient.from("custom_field_values").upsert(
          {
            custom_field_id: cfId,
            office_id,
            value_text: String(value),
            value_number: isNaN(Number(value)) ? null : Number(value),
          },
          { onConflict: "custom_field_id,office_id" }
        );
      }
    }

    if (Object.keys(officeUpdates).length > 0) {
      await serviceClient.from("offices").update(officeUpdates).eq("id", office_id);
    }

    // Upsert metrics history
    const now = new Date();
    const metricsData: any = {
      office_id,
      period_month: now.getMonth() + 1,
      period_year: now.getFullYear(),
      form_submission_id: submission.id,
    };
    if (officeUpdates.last_nps !== undefined) metricsData.nps_score = officeUpdates.last_nps;
    if (officeUpdates.last_csat !== undefined) metricsData.csat_score = officeUpdates.last_csat;
    if (officeUpdates.faturamento_mensal !== undefined) metricsData.faturamento_mensal = officeUpdates.faturamento_mensal;

    if (Object.keys(metricsData).length > 3) {
      await serviceClient.from("office_metrics_history").upsert(metricsData, {
        onConflict: "office_id,period_month,period_year",
      });
    }

    // Trigger automations
    try {
      await serviceClient.functions.invoke("execute-automations", {
        body: {
          action: "triggerV2",
          trigger_type: "form.submitted",
          office_id,
          context: { form_id: template.id, suffix: `form_${submission.id}` },
        },
      });

      // Check NPS detractor
      const npsField = fields.find(
        (f: any) =>
          f.type === "rating_nps" &&
          f.header_mapping?.enabled &&
          f.header_mapping.target_field === "offices.last_nps"
      );
      if (npsField) {
        const npsVal = Number(data[npsField.id]);
        if (!isNaN(npsVal) && npsVal <= 6) {
          await serviceClient.functions.invoke("execute-automations", {
            body: {
              action: "triggerV2",
              trigger_type: "nps.below_threshold",
              office_id,
              context: { nps_score: npsVal, suffix: `nps_${submission.id}` },
            },
          });
        }
      }
    } catch (autoErr) {
      console.error("Automation trigger error:", autoErr);
    }

    return new Response(
      JSON.stringify({ success: true, submission_id: submission.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[SUBMIT-PUBLIC-FORM]", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
