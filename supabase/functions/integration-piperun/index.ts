import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PIPERUN_BASE = "https://api.pipe.run/v1";

function getToken() {
  const token = Deno.env.get("PIPERUN_API_TOKEN");
  if (!token) throw new Error("PIPERUN_API_TOKEN_NOT_CONFIGURED");
  return token;
}

function classifyError(err: any): { status: number; message: string } {
  const msg = String(err?.message || err);
  if (msg.includes("PIPERUN_API_TOKEN_NOT_CONFIGURED")) {
    return { status: 200, message: "Token do Piperun não configurado. Adicione o secret PIPERUN_API_TOKEN nas configurações." };
  }
  const match = msg.match(/Piperun API \[(\d+)\]/);
  if (match) {
    const code = Number(match[1]);
    if (code === 401 || code === 403) return { status: 200, message: "Token do Piperun inválido ou sem permissão. Verifique o API Token." };
    if (code === 503 || code === 502 || code === 504) return { status: 200, message: `API do Piperun temporariamente indisponível (${code}). Tente novamente em alguns minutos.` };
    return { status: 200, message: `Erro na API do Piperun (${code}). Tente novamente.` };
  }
  return { status: 200, message: "Erro interno ao conectar com o Piperun. Verifique os logs." };
}

async function piperunGet(path: string) {
  const url = `${PIPERUN_BASE}${path}${path.includes('?') ? '&' : '?'}show=200`;
  console.log(`[PIPERUN] GET ${url}`);
  const res = await fetch(url, { headers: { token: getToken() } });
  console.log(`[PIPERUN] Response status: ${res.status}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Piperun API [${res.status}]: ${body.substring(0, 200)}`);
  }
  return res.json();
}

async function piperunGetAll(path: string) {
  let page = 1;
  let allData: any[] = [];
  while (true) {
    const separator = path.includes('?') ? '&' : '?';
    const url = `${PIPERUN_BASE}${path}${separator}show=200&page=${page}`;
    console.log(`[PIPERUN] GET ALL ${url} (page ${page})`);
    const res = await fetch(url, { headers: { token: getToken() } });
    console.log(`[PIPERUN] Response status: ${res.status}`);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Piperun API [${res.status}]: ${body.substring(0, 200)}`);
    }
    const json = await res.json();
    const data = json.data || [];
    allData = allData.concat(data);
    if (!json.meta || page >= (json.meta.last_page || 1)) break;
    page++;
  }
  return allData;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    const { action } = body;

    // --- Auth: validate JWT and require admin/manager/csm role ---
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

    const supabase = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleCheck } = await supabase.rpc("get_user_role", { _user_id: user.id });
    if (!roleCheck || !["admin", "manager", "csm"].includes(roleCheck)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "testConnection") {
      try {
        console.log("[PIPERUN] Testing connection...");
        console.log("[PIPERUN] Token found:", !!Deno.env.get("PIPERUN_API_TOKEN"));
        const result = await piperunGet("/pipelines");
        return new Response(
          JSON.stringify({ success: true, pipelines_count: result.data?.length || 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e: any) {
        console.error("[PIPERUN] testConnection error:", e.message);
        const classified = classifyError(e);
        return new Response(
          JSON.stringify({ success: false, error: classified.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
      const { pipeline_id, stage_id, default_product_id, default_csm_id, filter_won, field_mappings } = body;
      if (!pipeline_id || !stage_id) throw new Error("pipeline_id and stage_id are required");

      let path = `/deals?pipeline_id=${pipeline_id}&stage_id=${stage_id}&show=100`;
      if (filter_won) path += `&status=won`;

      const result = await piperunGet(path);
      const deals = result.data || [];

      const { data: existing } = await supabase.from("offices").select("piperun_deal_id").not("piperun_deal_id", "is", null);
      const existingIds = new Set((existing || []).map((o: any) => o.piperun_deal_id));

      let imported = 0;
      let skipped = 0;

      for (const deal of deals) {
        const dealId = String(deal.id);
        if (existingIds.has(dealId)) { skipped++; continue; }

        const office: Record<string, any> = {
          status: "nao_iniciado",
          active_product_id: default_product_id || null,
          csm_id: default_csm_id || null,
          piperun_deal_id: dealId,
        };

        if (field_mappings && Array.isArray(field_mappings)) {
          for (const mapping of field_mappings) {
            const value = getNestedValue(deal, mapping.piperun);
            if (value !== undefined && value !== null) {
              if (mapping.local === 'contract_value') continue;
              office[mapping.local] = value;
            }
          }
        } else {
          const contact = deal.person || deal.organization || {};
          office.name = deal.title || contact.name || `Deal ${dealId}`;
          office.email = contact.email || null;
          office.phone = contact.phone || null;
        }

        if (!office.name) office.name = `Deal ${dealId}`;

        const { error } = await supabase.from("offices").insert(office);

        if (error) {
          console.error(`[PIPERUN] Failed to import deal ${dealId}:`, error);
        } else {
          imported++;
          const contractValueMapping = field_mappings?.find((m: any) => m.local === 'contract_value');
          const contractValue = contractValueMapping ? getNestedValue(deal, contractValueMapping.piperun) : deal.value;
          if (contractValue && default_product_id) {
            const { data: newOffice } = await supabase.from("offices").select("id").eq("piperun_deal_id", dealId).single();
            if (newOffice) {
              await supabase.from("contracts").insert({
                office_id: newOffice.id,
                product_id: default_product_id,
                value: contractValue,
                status: "pendente",
              }).catch(() => {});
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, imported, skipped, total: deals.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "listFields") {
      try {
        const result = await piperunGet("/deals?show=1");
        const sampleDeal = (result.data || [])[0] || {};
        
        const extractFields = (obj: any, prefix = ""): Array<{key: string; label: string; example_value: string}> => {
          const fields: Array<{key: string; label: string; example_value: string}> = [];
          for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (value && typeof value === "object" && !Array.isArray(value)) {
              fields.push(...extractFields(value, fullKey));
            } else {
              fields.push({ key: fullKey, label: fullKey, example_value: String(value ?? "") });
            }
          }
          return fields;
        };
        
        const fields = extractFields(sampleDeal);
        return new Response(JSON.stringify({ fields }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ fields: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Supported: testConnection, listPipelines, listStages, importDeals, listFields" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[PIPERUN] Unhandled error:", err?.message || err);
    const classified = classifyError(err);
    return new Response(JSON.stringify({ success: false, error: classified.message }), {
      status: classified.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
