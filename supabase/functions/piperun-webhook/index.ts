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

// Status validation removed — trigger is now "proposta assinada" (signed contract), not "deal won"

function extractDeal(body: any): any {
  // Try different formats Piperun may send
  if (body.data) {
    const d = Array.isArray(body.data) ? body.data[0] : body.data;
    if (d?.id) return d;
  }
  if (body.deal) {
    const d = Array.isArray(body.deal) ? body.deal[0] : body.deal;
    if (d?.id) return d;
  }
  if (body.id && (body.title || body.pipeline_id)) {
    return body;
  }
  if (Array.isArray(body) && body[0]?.id) {
    return body[0];
  }
  // Last resort: return body itself if it has an id
  if (body.id) return body;
  return null;
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

  console.log('[PIPERUN-WEBHOOK] Inserting office with fields:', JSON.stringify(officeFields).substring(0, 500));

  const { data: newOffice, error: officeErr } = await supabase.from("offices").insert(officeFields).select("id").single();
  if (officeErr || !newOffice) throw new Error(`Failed to insert office: ${officeErr?.message}`);
  const officeId = newOffice.id;

  console.log('[PIPERUN-WEBHOOK] Office created:', officeId);

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

  // Automations
  if (resolvedProductId) {
    try {
      const { data: firstStage } = await supabase.from("journey_stages").select("id")
        .eq("product_id", resolvedProductId).order("position", { ascending: true }).limit(1).maybeSingle();
      if (firstStage) {
        await supabase.from("office_journey").insert({ office_id: officeId, journey_stage_id: firstStage.id }).catch(() => {});
      }
      await supabase.functions.invoke('calculate-health-score', { body: { office_id: officeId } }).catch(() => {});
    } catch (e) { console.error('[PIPERUN-WEBHOOK] Automation error:', e); }
  }

  // Audit log
  await supabase.from("audit_logs").insert({
    user_id: userId,
    entity_type: "office",
    entity_id: officeId,
    action: "piperun_contract_signed_import",
    details: { deal_id: dealId, product_id: resolvedProductId },
  }).catch(() => {});

  return { office_id: officeId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let webhookLogId: string | null = null;

  try {
    console.log('[PIPERUN-WEBHOOK] Webhook received');
    console.log('[PIPERUN-WEBHOOK] Method:', req.method);

    const rawBody = await req.text();
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error('[PIPERUN-WEBHOOK] Failed to parse JSON body');
      return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400);
    }

    console.log('[PIPERUN-WEBHOOK] Body keys:', Object.keys(body));
    console.log('[PIPERUN-WEBHOOK] Full body (first 2000 chars):', rawBody.substring(0, 2000));

    // Save raw payload for debug
    const { data: logRow } = await supabase.from('webhook_logs').insert({
      provider: 'piperun',
      payload: body,
      processed: false,
    }).select('id').single();
    webhookLogId = logRow?.id || null;
    console.log('[PIPERUN-WEBHOOK] Webhook log saved:', webhookLogId);

    // Extract deal from body (robust multi-format)
    const deal = extractDeal(body);
    if (!deal || !deal.id) {
      const errMsg = 'Could not extract deal from webhook body';
      console.error('[PIPERUN-WEBHOOK]', errMsg);
      if (webhookLogId) await supabase.from('webhook_logs').update({ error: errMsg }).eq('id', webhookLogId);
      return jsonResponse({ success: false, error: errMsg }, 400);
    }

    console.log('[PIPERUN-WEBHOOK] Deal ID:', deal.id);
    console.log('[PIPERUN-WEBHOOK] Deal title:', deal.title);
    console.log('[PIPERUN-WEBHOOK] Deal status:', deal.status);
    console.log('[PIPERUN-WEBHOOK] Deal pipeline_id:', deal.pipeline_id);
    console.log('[PIPERUN-WEBHOOK] Deal stage_id:', deal.stage_id);

    // No status validation — webhook is triggered by "proposta assinada" event
    console.log('[PIPERUN-WEBHOOK] Accepting deal (trigger: proposta assinada)');

    // Fetch integration settings
    const { data: settings } = await supabase
      .from('integration_settings')
      .select('config')
      .eq('provider', 'piperun')
      .single();

    if (!settings?.config) {
      const msg = 'Integração Piperun não configurada';
      if (webhookLogId) await supabase.from('webhook_logs').update({ error: msg }).eq('id', webhookLogId);
      return jsonResponse({ success: false, message: msg });
    }

    const config = settings.config as any;
    const { pipeline_id, stage_id, field_mappings_v2 } = config;

    console.log('[PIPERUN-WEBHOOK] Config pipeline_id:', pipeline_id);
    console.log('[PIPERUN-WEBHOOK] Config stage_id:', stage_id);

    // Validate pipeline/stage with type normalization
    const dealPipelineId = String(deal.pipeline_id ?? '');
    const configPipelineId = String(pipeline_id ?? '');
    const dealStageId = String(deal.stage_id ?? '');
    const configStageId = String(stage_id ?? '');

    console.log('[PIPERUN-WEBHOOK] Pipeline check:', dealPipelineId, '===', configPipelineId);
    console.log('[PIPERUN-WEBHOOK] Stage check:', dealStageId, '===', configStageId);

    if (configPipelineId && dealPipelineId && dealPipelineId !== configPipelineId) {
      const msg = `Pipeline mismatch: deal=${dealPipelineId}, config=${configPipelineId}`;
      console.log('[PIPERUN-WEBHOOK]', msg);
      if (webhookLogId) await supabase.from('webhook_logs').update({ error: msg }).eq('id', webhookLogId);
      return jsonResponse({ success: false, message: 'Deal não é do funil configurado' });
    }
    if (configStageId && dealStageId && dealStageId !== configStageId) {
      const msg = `Stage mismatch: deal=${dealStageId}, config=${configStageId}`;
      console.log('[PIPERUN-WEBHOOK]', msg);
      if (webhookLogId) await supabase.from('webhook_logs').update({ error: msg }).eq('id', webhookLogId);
      return jsonResponse({ success: false, message: 'Deal não é da etapa configurada' });
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from('offices')
      .select('id')
      .eq('piperun_deal_id', String(deal.id))
      .maybeSingle();

    if (existing) {
      const msg = 'Deal já importado';
      if (webhookLogId) await supabase.from('webhook_logs').update({ processed: true, error: msg }).eq('id', webhookLogId);
      return jsonResponse({ success: false, message: msg, office_id: existing.id });
    }

    // Fetch related data via API
    const token = Deno.env.get("PIPERUN_API_TOKEN");
    if (!token) {
      const msg = 'PIPERUN_API_TOKEN não configurado';
      if (webhookLogId) await supabase.from('webhook_logs').update({ error: msg }).eq('id', webhookLogId);
      return jsonResponse({ success: false, message: msg });
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
        const sigs = res.data || [];
        signatureData = sigs.find((s: any) => s.status === 'signed' || s.status === 'assinado') || sigs[0] || null;
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

    console.log('[PIPERUN-WEBHOOK] sourceData keys:', Object.keys(sourceData));
    console.log('[PIPERUN-WEBHOOK] company name:', sourceData.company?.name);
    console.log('[PIPERUN-WEBHOOK] person name:', sourceData.person?.name);

    // Convert field_mappings_v2 to the format processAndCreateOffice expects
    const mappings = (field_mappings_v2 || [])
      .filter((m: any) => m.crm && m.piperun_key)
      .map((m: any) => ({ piperun: m.piperun_key, local: m.crm }));

    console.log('[PIPERUN-WEBHOOK] Mappings count:', mappings.length);

    // Use a system user ID for audit
    const { data: adminUsers } = await supabase.from('user_roles').select('user_id').eq('role', 'admin').limit(1);
    const systemUserId = adminUsers?.[0]?.user_id || '00000000-0000-0000-0000-000000000000';

    const result = await processAndCreateOffice(supabase, sourceData, mappings, String(deal.id), systemUserId);

    // Update webhook log as processed
    if (webhookLogId) {
      await supabase.from('webhook_logs').update({ processed: true, error: null }).eq('id', webhookLogId);
    }

    // Update last webhook timestamp in settings
    await supabase.from('integration_settings')
      .update({ config: { ...config, last_webhook_at: new Date().toISOString() } })
      .eq('provider', 'piperun')
      .catch(() => {});

    console.log('[PIPERUN-WEBHOOK] Successfully imported deal', deal.id, 'as office', result.office_id);
    return jsonResponse({ success: true, office_id: result.office_id });
  } catch (err: any) {
    console.error("[PIPERUN-WEBHOOK] ERROR:", err?.message, err?.stack);
    if (webhookLogId) {
      await supabase.from('webhook_logs').update({ error: err?.message || 'Erro interno' }).eq('id', webhookLogId);
    }
    return jsonResponse({ success: false, message: err?.message || 'Erro interno' }, 500);
  }
});
