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
    if (code === 401 || code === 403) return { status: 200, message: "Token do Piperun inválido ou sem permissão." };
    if (code === 503 || code === 502 || code === 504) return { status: 200, message: `API do Piperun temporariamente indisponível (${code}).` };
    return { status: 200, message: `Erro na API do Piperun (${code}).` };
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

// ---- Import helpers ----

function resolveProductId(rawValue: string | null | undefined, productMappings: any[]): string | null {
  if (!rawValue || !productMappings?.length) return null;
  const normalized = String(rawValue).trim().toLowerCase();
  const match = productMappings.find((m: any) => String(m.piperun_value).trim().toLowerCase() === normalized);
  return match?.product_id || null;
}

function buildEntityFields(deal: any, fieldMappings: any[], prefix: string): Record<string, any> {
  const result: Record<string, any> = {};
  for (const mapping of fieldMappings) {
    if (!mapping.local.startsWith(prefix + '.')) continue;
    const col = mapping.local.substring(prefix.length + 1);
    const value = getNestedValue(deal, mapping.piperun);
    if (value !== undefined && value !== null && value !== '') {
      result[col] = value;
    }
  }
  return result;
}

async function triggerAutomations(supabase: any, officeId: string, productId: string, userId: string) {
  const results: string[] = [];

  // 1. Distribution
  const { data: distRule } = await supabase
    .from("automation_rules").select("*")
    .eq("product_id", productId).eq("rule_type", "distribution").eq("is_active", true)
    .maybeSingle();

  let assignedCsmId: string | null = null;

  if (distRule) {
    const config = distRule.config as any;
    if (config.method === "fixed" && config.fixed_csm_id) {
      assignedCsmId = config.fixed_csm_id;
    } else if (config.method === "least_clients") {
      const eligible = config.eligible_csm_ids || [];
      if (eligible.length > 0) {
        const { data: offices } = await supabase.from("offices").select("csm_id")
          .eq("active_product_id", productId).in("csm_id", eligible);
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
          rule_id: distRule.id, office_id: officeId,
          context_key: `distribution_${Date.now()}`,
          result: { csm_index: nextIndex, csm_id: assignedCsmId },
        });
      }
    }

    if (assignedCsmId) {
      await supabase.from("offices").update({ csm_id: assignedCsmId }).eq("id", officeId);
      results.push(`CSM atribuído`);
    }
  }

  // 2. Onboarding tasks
  const { data: onbRule } = await supabase
    .from("automation_rules").select("*")
    .eq("product_id", productId).eq("rule_type", "onboarding_tasks").eq("is_active", true)
    .maybeSingle();

  if (onbRule) {
    const { data: existing } = await supabase.from("automation_executions").select("id")
      .eq("rule_id", onbRule.id).eq("office_id", officeId).eq("context_key", "onboarding").maybeSingle();

    if (!existing) {
      const templates = (onbRule.config as any)?.templates || [];
      const taskOwner = assignedCsmId || userId;
      const createdIds: string[] = [];

      for (const t of templates) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (t.due_days || 0));
        const { data: act } = await supabase.from("activities").insert({
          title: t.title, type: t.type || "task", description: t.description || null,
          office_id: officeId, user_id: taskOwner,
          due_date: dueDate.toISOString().split("T")[0], priority: "medium",
        }).select("id").single();
        if (act) createdIds.push(act.id);
      }

      await supabase.from("automation_executions").insert({
        rule_id: onbRule.id, office_id: officeId, context_key: "onboarding",
        result: { created_activity_ids: createdIds },
      });
      results.push(`${createdIds.length} atividades de onboarding criadas`);
    }
  }

  // 3. Position in first journey stage
  const { data: firstStage } = await supabase
    .from("journey_stages").select("id")
    .eq("product_id", productId).order("position", { ascending: true }).limit(1).maybeSingle();

  if (firstStage) {
    const { data: existingJourney } = await supabase.from("office_journey").select("id")
      .eq("office_id", officeId).maybeSingle();
    if (!existingJourney) {
      await supabase.from("office_journey").insert({
        office_id: officeId, journey_stage_id: firstStage.id,
      });
      results.push(`Posicionado na jornada`);
    }
  }

  // 4. Calculate health score
  try {
    await supabase.functions.invoke('calculate-health-score', { body: { office_id: officeId } });
    results.push(`Health score calculado`);
  } catch (e) {
    console.error(`[PIPERUN] Health score calc failed for ${officeId}:`, e);
  }

  // 5. Slack notification
  try {
    const { data: slackSetting } = await supabase.from("integration_settings").select("*")
      .eq("provider", "slack").maybeSingle();
    if (slackSetting?.is_connected) {
      const { data: office } = await supabase.from("offices").select("name, csm_id").eq("id", officeId).single();
      const { data: product } = await supabase.from("products").select("name").eq("id", productId).single();
      let csmName = 'Não atribuído';
      if (office?.csm_id) {
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", office.csm_id).single();
        csmName = profile?.full_name || 'CSM';
      }
      await supabase.functions.invoke('integration-slack', {
        body: {
          action: 'sendMessage',
          message: `🆕 Novo cliente importado do Piperun: *${office?.name}* — Produto: ${product?.name} — CSM: ${csmName}`,
        },
      });
      results.push(`Notificação Slack enviada`);
    }
  } catch (e) {
    console.error(`[PIPERUN] Slack notification failed:`, e);
  }

  return { assignedCsmId, results };
}

// ---- Main handler ----

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    const { action } = body;

    // Auth
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

    // ========== testConnection ==========
    if (action === "testConnection") {
      try {
        const result = await piperunGet("/pipelines");
        return new Response(
          JSON.stringify({ success: true, pipelines_count: result.data?.length || 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e: any) {
        const classified = classifyError(e);
        return new Response(
          JSON.stringify({ success: false, error: classified.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ========== listPipelines ==========
    if (action === "listPipelines") {
      const allPipelines = await piperunGetAll("/pipelines");
      const pipelines = allPipelines.map((p: any) => ({ id: p.id, name: p.name }));
      return new Response(JSON.stringify({ pipelines }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== listStages ==========
    if (action === "listStages") {
      const { pipeline_id } = body;
      const allStages = await piperunGetAll(`/stages?pipeline_id=${pipeline_id}`);
      const stages = allStages.map((s: any) => ({ id: s.id, name: s.name }));
      return new Response(JSON.stringify({ stages }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== listFields ==========
    if (action === "listFields") {
      try {
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

        const allFields: Array<{key: string; label: string; example_value: string}> = [];
        const seenKeys = new Set<string>();

        const addFields = (list: Array<{key: string; label: string; example_value: string}>) => {
          for (const f of list) {
            if (!seenKeys.has(f.key)) {
              seenKeys.add(f.key);
              allFields.push(f);
            }
          }
        };

        // 1. Fetch deal with expanded relations
        try {
          const dealResult = await piperunGet("/deals?show=1");
          const sampleDeal = (dealResult.data || [])[0] || {};
          addFields(extractFields(sampleDeal));
        } catch (e) {
          console.warn("[PIPERUN] Failed to fetch deals for listFields:", e);
        }

        // 2. Fetch person fields separately
        try {
          const personResult = await piperunGet("/persons?show=1");
          const samplePerson = (personResult.data || [])[0] || {};
          addFields(extractFields(samplePerson, "person"));
        } catch (e) {
          console.warn("[PIPERUN] Failed to fetch persons for listFields:", e);
        }

        // 3. Fetch organization fields separately
        try {
          const orgResult = await piperunGet("/organizations?show=1");
          const sampleOrg = (orgResult.data || [])[0] || {};
          addFields(extractFields(sampleOrg, "organization"));
        } catch (e) {
          console.warn("[PIPERUN] Failed to fetch organizations for listFields:", e);
        }

        return new Response(JSON.stringify({ fields: allFields }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ fields: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ========== importDeals ==========
    if (action === "importDeals") {
      const { pipeline_id, stage_id, filter_won, field_mappings, product_value_mappings } = body;
      if (!pipeline_id || !stage_id) throw new Error("pipeline_id and stage_id are required");

      let path = `/deals?pipeline_id=${pipeline_id}&stage_id=${stage_id}&show=100`;
      if (filter_won) path += `&status=won`;

      const result = await piperunGet(path);
      const deals = result.data || [];

      const { data: existing } = await supabase.from("offices").select("piperun_deal_id").not("piperun_deal_id", "is", null);
      const existingIds = new Set((existing || []).map((o: any) => o.piperun_deal_id));

      let imported = 0;
      let skipped = 0;
      let automationsTriggered = 0;
      const warnings: string[] = [];

      for (const deal of deals) {
        const dealId = String(deal.id);
        if (existingIds.has(dealId)) { skipped++; continue; }

        // Step 1: Build office object
        const officeFields = buildEntityFields(deal, field_mappings || [], 'offices');
        officeFields.piperun_deal_id = dealId;
        officeFields.status = 'ativo';

        // Step 2: Resolve product
        let resolvedProductId: string | null = null;
        const productMapping = (field_mappings || []).find((m: any) => m.local === 'offices.active_product_id');
        if (productMapping) {
          const rawProductValue = getNestedValue(deal, productMapping.piperun);
          resolvedProductId = resolveProductId(rawProductValue, product_value_mappings || []);
          if (rawProductValue && !resolvedProductId) {
            warnings.push(`Produto não mapeado: "${rawProductValue}" (Deal ${dealId})`);
            console.warn(`[PIPERUN] Unmapped product value: "${rawProductValue}" for deal ${dealId}`);
          }
          // Remove raw text from office fields, set resolved ID
          delete officeFields.active_product_id;
          if (resolvedProductId) {
            officeFields.active_product_id = resolvedProductId;
            officeFields.status = 'ativo';
          }
        }

        if (!officeFields.name) officeFields.name = deal.title || `Deal ${dealId}`;

        // Step 3: Insert office
        const { data: newOffice, error: officeErr } = await supabase.from("offices").insert(officeFields).select("id").single();
        if (officeErr || !newOffice) {
          console.error(`[PIPERUN] Failed to import deal ${dealId}:`, officeErr);
          continue;
        }
        imported++;
        const officeId = newOffice.id;

        // Step 4: Create contract
        const contractFields = buildEntityFields(deal, field_mappings || [], 'contracts');
        if (Object.keys(contractFields).length > 0) {
          contractFields.office_id = officeId;
          contractFields.product_id = resolvedProductId || officeFields.active_product_id;
          if (!contractFields.product_id) {
            // Need a product_id for contracts — skip if none
            console.warn(`[PIPERUN] Skipping contract for deal ${dealId}: no product_id`);
          } else {
            contractFields.status = contractFields.status || 'pendente';
            await supabase.from("contracts").insert(contractFields).catch((e: any) => {
              console.error(`[PIPERUN] Contract insert failed for deal ${dealId}:`, e);
            });
          }
        }

        // Step 5: Create contacts (up to 3)
        const contactPrefixes = ['contacts', 'contacts_2', 'contacts_3'];
        for (let i = 0; i < contactPrefixes.length; i++) {
          const contactFields = buildEntityFields(deal, field_mappings || [], contactPrefixes[i]);
          if (Object.keys(contactFields).length > 0 && contactFields.name) {
            contactFields.office_id = officeId;
            contactFields.is_main_contact = i === 0;
            await supabase.from("contacts").insert(contactFields).catch((e: any) => {
              console.error(`[PIPERUN] Contact insert failed for deal ${dealId}:`, e);
            });
          }
        }

        // Step 6: Trigger automations if product resolved
        if (resolvedProductId) {
          try {
            const autoResult = await triggerAutomations(supabase, officeId, resolvedProductId, user.id);
            automationsTriggered++;
            console.log(`[PIPERUN] Automations for deal ${dealId}:`, autoResult.results);
          } catch (e) {
            console.error(`[PIPERUN] Automation error for deal ${dealId}:`, e);
          }
        }

        // Step 7: Audit log
        await supabase.from("audit_logs").insert({
          user_id: user.id,
          entity_type: "office",
          entity_id: officeId,
          action: "piperun_import",
          details: {
            deal_id: dealId,
            product_id: resolvedProductId,
            product_resolved: !!resolvedProductId,
            automations_triggered: !!resolvedProductId,
          },
        }).catch(() => {});
      }

      return new Response(
        JSON.stringify({
          success: true, imported, skipped, total: deals.length,
          automations_triggered: automationsTriggered,
          warnings: warnings.length > 0 ? warnings : undefined,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
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
