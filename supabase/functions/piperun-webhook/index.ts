import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PIPERUN_BASE = "https://api.pipe.run/v1";

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function piperunGet(path: string, token: string) {
  const separator = path.includes('?') ? '&' : '?';
  const url = `${PIPERUN_BASE}${path}${separator}show=200`;
  const res = await fetch(url, { headers: { Token: token } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Piperun API [${res.status}]: ${body.substring(0, 200)}`);
  }
  return res.json();
}

function resolveNestedValue(source: any, path: string): any {
  return path.split('.').reduce((o: any, k: string) => o?.[k], source);
}

const SMART_FIELDS = ['offices.active_product_id', 'offices.status', 'offices.csm_id'];

async function resolveSmartField(supabase: any, localField: string, rawValue: any): Promise<{ value: any; warning?: string }> {
  if (rawValue === undefined || rawValue === null || rawValue === '') return { value: null };
  const strVal = String(rawValue).trim();

  if (localField === 'offices.active_product_id') {
    const { data } = await supabase.from('products').select('id').ilike('name', strVal).limit(1).maybeSingle();
    if (data) return { value: data.id };
    return { value: null, warning: `Produto não encontrado: "${strVal}".` };
  }

  if (localField === 'offices.status') {
    const STATUS_MAP: Record<string, string> = {
      'ativo': 'ativo', 'active': 'ativo', 'churn': 'churn', 'cancelado': 'churn',
      'pausado': 'pausado', 'paused': 'pausado', 'upsell': 'upsell', 'upgrade': 'upsell',
    };
    const normalized = strVal.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return { value: STATUS_MAP[normalized] || 'ativo' };
  }

  if (localField === 'offices.csm_id') {
    const { data: byName } = await supabase.from('profiles').select('id').ilike('full_name', strVal).limit(1).maybeSingle();
    if (byName) return { value: byName.id };
    const { data: byEmail } = await supabase.from('profiles').select('id').ilike('email', strVal).limit(1).maybeSingle();
    if (byEmail) return { value: byEmail.id };
    return { value: null, warning: `CSM não encontrado: "${strVal}".` };
  }

  return { value: rawValue };
}

async function processAndCreateOffice(
  supabase: any, sourceData: any, mappings: Array<{ piperun: string; local: string }>,
  dealId: string, userId: string
): Promise<{ office_id: string }> {
  const officeFields: Record<string, any> = { piperun_deal_id: dealId, status: 'ativo' };
  const contractFields: Record<string, any> = {};
  const contactBuckets: Record<string, Record<string, any>> = {};

  for (const mapping of mappings) {
    const value = resolveNestedValue(sourceData, mapping.piperun);
    if (value === undefined || value === null || value === '') continue;
    const [table, ...colParts] = mapping.local.split('.');
    const col = colParts.join('.');
    if (table === 'offices') officeFields[col] = value;
    else if (table === 'contracts') contractFields[col] = value;
    else if (table.startsWith('contacts')) {
      if (!contactBuckets[table]) contactBuckets[table] = {};
      contactBuckets[table][col] = value;
    }
  }

  // Smart fields
  let resolvedProductId: string | null = null;
  for (const mapping of mappings) {
    if (SMART_FIELDS.includes(mapping.local)) {
      const rawValue = resolveNestedValue(sourceData, mapping.piperun);
      const col = mapping.local.split('.')[1];
      const resolved = await resolveSmartField(supabase, mapping.local, rawValue);
      if (resolved.value !== null) {
        officeFields[col] = resolved.value;
        if (mapping.local === 'offices.active_product_id') resolvedProductId = resolved.value;
      } else delete officeFields[col];
    }
  }

  if (!officeFields.name) officeFields.name = sourceData.deal?.title || `Deal ${dealId}`;

  const { data: newOffice, error: officeErr } = await supabase.from("offices").insert(officeFields).select("id").single();
  if (officeErr || !newOffice) throw new Error(`Failed to insert office: ${officeErr?.message}`);
  const officeId = newOffice.id;

  // Contract
  if (Object.keys(contractFields).length > 0) {
    contractFields.office_id = officeId;
    contractFields.product_id = resolvedProductId || officeFields.active_product_id;
    if (contractFields.product_id) {
      contractFields.status = contractFields.status || 'pendente';
      await supabase.from("contracts").insert(contractFields).catch(() => {});
    }
  }

  // Contacts
  const contactPrefixes = ['contacts', 'contacts_2', 'contacts_3'];
  for (let i = 0; i < contactPrefixes.length; i++) {
    const cFields = contactBuckets[contactPrefixes[i]];
    if (cFields && Object.keys(cFields).length > 0 && cFields.name) {
      cFields.office_id = officeId;
      cFields.is_main_contact = i === 0;
      await supabase.from("contacts").insert(cFields).catch(() => {});
    }
  }

  // PDF download
  const pdfMapping = mappings.find(m => m.piperun === 'signature.document_url');
  const pdfUrl = sourceData.signature?.document_url;
  if (pdfMapping && pdfUrl) {
    try {
      const pdfResponse = await fetch(pdfUrl, { signal: AbortSignal.timeout(30000) });
      if (pdfResponse.ok) {
        const pdfBuffer = await pdfResponse.arrayBuffer();
        await supabase.storage.from('office-files')
          .upload(`${officeId}/contrato-piperun-${dealId}.pdf`, pdfBuffer, { contentType: 'application/pdf' });
      }
    } catch (e: any) { console.log('[PIPERUN-WEBHOOK] PDF download failed:', e.message); }
  }

  // Automations (simplified — distribution, onboarding, journey, health, slack)
  if (resolvedProductId) {
    try {
      // Journey stage
      const { data: firstStage } = await supabase.from("journey_stages").select("id")
        .eq("product_id", resolvedProductId).order("position", { ascending: true }).limit(1).maybeSingle();
      if (firstStage) {
        await supabase.from("office_journey").insert({ office_id: officeId, journey_stage_id: firstStage.id }).catch(() => {});
      }
      // Health score
      await supabase.functions.invoke('calculate-health-score', { body: { office_id: officeId } }).catch(() => {});
    } catch (e) { console.error('[PIPERUN-WEBHOOK] Automation error:', e); }
  }

  // Audit log
  await supabase.from("audit_logs").insert({
    user_id: userId,
    entity_type: "office",
    entity_id: officeId,
    action: "piperun_webhook_import",
    details: { deal_id: dealId, product_id: resolvedProductId },
  }).catch(() => {});

  return { office_id: officeId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const deal = await req.json();
    console.log('[PIPERUN-WEBHOOK] Received deal:', deal.id, deal.title, deal.status);

    // Validate status
    if (deal.status !== 'won' && deal.status !== 'ganho') {
      return jsonResponse({ success: false, message: 'Deal não é ganho, ignorando' });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch integration settings
    const { data: settings } = await supabase
      .from('integration_settings')
      .select('config')
      .eq('provider', 'piperun')
      .single();

    if (!settings?.config) {
      return jsonResponse({ success: false, message: 'Integração Piperun não configurada' });
    }

    const config = settings.config as any;
    const { pipeline_id, stage_id, field_mappings_v2 } = config;

    // Validate pipeline/stage
    if (pipeline_id && deal.pipeline_id !== undefined && String(deal.pipeline_id) !== String(pipeline_id)) {
      return jsonResponse({ success: false, message: 'Deal não é do funil configurado' });
    }
    if (stage_id && deal.stage_id !== undefined && String(deal.stage_id) !== String(stage_id)) {
      return jsonResponse({ success: false, message: 'Deal não é da etapa configurada' });
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from('offices')
      .select('id')
      .eq('piperun_deal_id', String(deal.id))
      .maybeSingle();

    if (existing) {
      return jsonResponse({ success: false, message: 'Deal já importado', office_id: existing.id });
    }

    // Fetch related data via API
    const token = Deno.env.get("PIPERUN_API_TOKEN");
    if (!token) {
      return jsonResponse({ success: false, message: 'PIPERUN_API_TOKEN não configurado' });
    }

    let companyData = deal.company;
    if (!companyData && deal.company_id) {
      try {
        const res = await piperunGet(`/companies/${deal.company_id}`, token);
        companyData = res.data || res;
      } catch (e) { /* ok */ }
    }

    let personData = deal.person;
    if (!personData && deal.person_id) {
      try {
        const res = await piperunGet(`/persons/${deal.person_id}`, token);
        personData = res.data || res;
      } catch (e) { /* ok */ }
    }

    let proposalData = null;
    if (deal.proposals && deal.proposals.length > 0) {
      proposalData = deal.proposals[0];
    } else {
      try {
        const res = await piperunGet(`/proposals?deal_id=${deal.id}`, token);
        proposalData = (res.data || [])[0];
      } catch (e) { /* ok */ }
    }

    let signatureData = null;
    if (proposalData) {
      try {
        const res = await piperunGet(`/signatures?proposal_id=${proposalData.id}`, token);
        signatureData = (res.data || [])[0];
      } catch (e) { /* ok */ }
    }

    const customFields: Record<string, any> = {};
    if (deal.custom_fields && Array.isArray(deal.custom_fields)) {
      for (const cf of deal.custom_fields) {
        customFields[cf.id || cf.custom_field_id] = cf.value;
      }
    }

    const sourceData = {
      deal: { ...deal, owner: deal.owner || {}, stage: deal.stage || {}, pipeline: deal.pipeline || {}, custom: customFields },
      company: companyData || {},
      person: personData || {},
      proposal: proposalData || {},
      signature: signatureData || {},
    };

    // Convert field_mappings_v2 to the format processAndCreateOffice expects
    const mappings = (field_mappings_v2 || [])
      .filter((m: any) => m.crm && m.piperun_key)
      .map((m: any) => ({ piperun: m.piperun_key, local: m.crm }));

    // Use a system user ID for audit
    const { data: adminUsers } = await supabase.from('user_roles').select('user_id').eq('role', 'admin').limit(1);
    const systemUserId = adminUsers?.[0]?.user_id || '00000000-0000-0000-0000-000000000000';

    const result = await processAndCreateOffice(supabase, sourceData, mappings, String(deal.id), systemUserId);

    // Update last webhook timestamp in settings
    await supabase.from('integration_settings')
      .update({ config: { ...config, last_webhook_at: new Date().toISOString() } })
      .eq('provider', 'piperun')
      .catch(() => {});

    console.log('[PIPERUN-WEBHOOK] Successfully imported deal', deal.id, 'as office', result.office_id);
    return jsonResponse({ success: true, office_id: result.office_id });
  } catch (err: any) {
    console.error("[PIPERUN-WEBHOOK] Error:", err?.message || err);
    return jsonResponse({ success: false, message: err?.message || 'Erro interno' }, 500);
  }
});
