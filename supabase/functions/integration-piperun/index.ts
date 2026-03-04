import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PIPERUN_BASE = "https://api.pipe.run/v1";

function getToken() {
  const token = Deno.env.get("PIPERUN_API_TOKEN");
  if (!token) throw new Error("PIPERUN_API_TOKEN not configured");
  return token;
}

async function piperunGet(path: string) {
  const separator = path.includes('?') ? '&' : '?';
  const res = await fetch(`${PIPERUN_BASE}${path}${separator}show=200`, {
    headers: { token: getToken() },
  });
  if (!res.ok) throw new Error(`Piperun API error [${res.status}]: ${await res.text()}`);
  return res.json();
}

async function piperunGetAll(path: string) {
  let page = 1;
  let allData: any[] = [];
  while (true) {
    const separator = path.includes('?') ? '&' : '?';
    const res = await fetch(`${PIPERUN_BASE}${path}${separator}show=200&page=${page}`, {
      headers: { token: getToken() },
    });
    if (!res.ok) throw new Error(`Piperun API error [${res.status}]: ${await res.text()}`);
    const json = await res.json();
    const data = json.data || [];
    allData = allData.concat(data);
    if (!json.meta || page >= (json.meta.last_page || 1)) break;
    page++;
  }
  return allData;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "testConnection") {
      const result = await piperunGet("/pipelines");
      return new Response(
        JSON.stringify({ success: true, pipelines_count: result.data?.length || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "listPipelines") {
      const allPipelines = await piperunGetAll("/pipelines");
      const pipelines = allPipelines.map((p: any) => ({
        id: p.id,
        name: p.name,
        stages: (p.stages || []).map((s: any) => ({ id: s.id, name: s.name })),
      }));
      return new Response(JSON.stringify({ pipelines }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "listStages") {
      const { pipeline_id } = body;
      const allStages = await piperunGetAll(`/stages?pipeline_id=${pipeline_id}`);
      const stages = allStages.map((s: any) => ({ id: s.id, name: s.name }));
      return new Response(JSON.stringify({ stages }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "importDeals") {
      const { pipeline_id, stage_id, default_product_id, default_csm_id } = body;
      if (!pipeline_id || !stage_id) throw new Error("pipeline_id and stage_id are required");

      const result = await piperunGet(`/deals?pipeline_id=${pipeline_id}&stage_id=${stage_id}&show=100`);
      const deals = result.data || [];

      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // Get existing piperun_deal_ids
      const { data: existing } = await supabase.from("offices").select("piperun_deal_id").not("piperun_deal_id", "is", null);
      const existingIds = new Set((existing || []).map((o: any) => o.piperun_deal_id));

      let imported = 0;
      let skipped = 0;

      for (const deal of deals) {
        const dealId = String(deal.id);
        if (existingIds.has(dealId)) { skipped++; continue; }

        const contact = deal.person || deal.organization || {};
        const { error } = await supabase.from("offices").insert({
          name: deal.title || contact.name || `Deal ${dealId}`,
          email: contact.email || null,
          phone: contact.phone || null,
          status: "nao_iniciado",
          active_product_id: default_product_id || null,
          csm_id: default_csm_id || null,
          piperun_deal_id: dealId,
        });

        if (error) {
          console.error(`[PIPERUN] Failed to import deal ${dealId}:`, error);
        } else {
          imported++;
          // Optionally create contract
          if (deal.value && default_product_id) {
            await supabase.from("contracts").insert({
              office_id: (await supabase.from("offices").select("id").eq("piperun_deal_id", dealId).single()).data?.id,
              product_id: default_product_id,
              value: deal.value,
              status: "pendente",
            }).catch(() => {});
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, imported, skipped, total: deals.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Supported: testConnection, listPipelines, listStages, importDeals" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[PIPERUN]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
