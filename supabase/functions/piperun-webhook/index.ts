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
  // Handle custom fields: fields.find.{id}
  if (path.startsWith('fields.find.')) {
    const fieldId = parseInt(path.split('.')[2]);
    const field = source.fields?.find((f: any) => f.id === fieldId);
    return field?.valor ?? field?.value ?? null;
  }

  // Handle paths with array indices like proposals[0].value, company.contact_emails[0].address
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current = source;
  for (const part of parts) {
    if (current === null || current === undefined) return null;
    if (part === 'length' && Array.isArray(current)) {
      return current.length;
    }
    if (/^\d+$/.test(part)) {
      current = current[parseInt(part)];
    } else {
      current = current[part];
    }
  }
  return current ?? null;
}

const SMART_FIELDS = ['offices.active_product_id', 'offices.status', 'offices.csm_id'];

async function resolveSmartField(supabase: any, localField: string, rawValue: any): Promise<{ value: any; warning?: string }> {
  if (rawValue === undefined || rawValue === null || rawValue === '') return { value: null };
  const strVal = String(rawValue).trim();

  if (localField === 'offices.active_product_id') {
    // CONTAINS matching: fetch all products and find best match
    const { data: products } = await supabase.from('products').select('id, name');
    if (products && products.length > 0) {
      const lowerVal = strVal.toLowerCase();
      const matched = products.find((p: any) => {
        const pName = p.name.toLowerCase();
        return lowerVal.includes(pName) || pName.includes(lowerVal);
      });
      if (matched) return { value: matched.id };
      // Try matching by last word
      const words = lowerVal.split(/\s+/).filter((w: string) => w.length > 3);
      for (const word of words.reverse()) {
        const m = products.find((p: any) => p.name.toLowerCase().includes(word));
        if (m) return { value: m.id };
      }
    }
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
    console.log(`[PIPERUN-WEBHOOK] Mapping: ${mapping.piperun} → ${mapping.local} = ${JSON.stringify(value)?.substring(0, 100)}`);
    if (value === undefined || value === null || value === '') {
      console.log(`[PIPERUN-WEBHOOK] SKIP: ${mapping.piperun} is empty`);
      continue;
    }
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

  if (!officeFields.name) officeFields.name = sourceData.title || sourceData.deal?.title || `Deal ${dealId}`;

  console.log('[PIPERUN-WEBHOOK] Final officeFields:', JSON.stringify(officeFields).substring(0, 500));
  console.log('[PIPERUN-WEBHOOK] Final contractFields:', JSON.stringify(contractFields).substring(0, 300));
  console.log('[PIPERUN-WEBHOOK] Final contactBuckets:', JSON.stringify(contactBuckets).substring(0, 300));

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
      const { error: contractErr } = await supabase.from("contracts").insert(contractFields);
      if (contractErr) console.error('[PIPERUN-WEBHOOK] Contract insert error:', contractErr.message);
      else console.log('[PIPERUN-WEBHOOK] Contract created');
    }
  }

  // Contacts
  const contactPrefixes = ['contacts', 'contacts_2', 'contacts_3'];
  for (let i = 0; i < contactPrefixes.length; i++) {
    const cFields = contactBuckets[contactPrefixes[i]];
    if (cFields && Object.keys(cFields).length > 0 && cFields.name) {
      cFields.office_id = officeId;
      cFields.is_main_contact = i === 0;
      const { error: contactErr } = await supabase.from("contacts").insert(cFields);
      if (contactErr) console.error('[PIPERUN-WEBHOOK] Contact insert error:', contactErr.message);
      else console.log('[PIPERUN-WEBHOOK] Contact created:', cFields.name);
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

  // Journey + Health
  if (resolvedProductId) {
    try {
      const { data: firstStage } = await supabase.from("journey_stages").select("id")
        .eq("product_id", resolvedProductId).order("position", { ascending: true }).limit(1).maybeSingle();
      if (firstStage) {
        const { error: journeyErr } = await supabase.from("office_journey").insert({ office_id: officeId, journey_stage_id: firstStage.id });
        if (journeyErr) console.error('[PIPERUN-WEBHOOK] Journey insert error:', journeyErr.message);
        else console.log('[PIPERUN-WEBHOOK] Journey stage set');
      }
      try {
        await supabase.functions.invoke('calculate-health-score', { body: { office_id: officeId } });
      } catch (e: any) { console.log('[PIPERUN-WEBHOOK] Health score calc failed:', e.message); }
    } catch (e) { console.error('[PIPERUN-WEBHOOK] Automation error:', e); }
  }

  // Audit log
  const { error: auditErr } = await supabase.from("audit_logs").insert({
    user_id: userId,
    entity_type: "office",
    entity_id: officeId,
    action: "piperun_contract_signed_import",
    details: { deal_id: dealId, product_id: resolvedProductId },
  });
  if (auditErr) console.error('[PIPERUN-WEBHOOK] Audit log error:', auditErr.message);

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

    // Extract deal from body
    const deal = extractDeal(body);
    if (!deal || !deal.id) {
      const errMsg = 'Could not extract deal from webhook body';
      console.error('[PIPERUN-WEBHOOK]', errMsg);
      if (webhookLogId) await supabase.from('webhook_logs').update({ error: errMsg }).eq('id', webhookLogId);
      return jsonResponse({ success: false, error: errMsg }, 400);
    }

    console.log('[PIPERUN-WEBHOOK] Deal ID:', deal.id, 'Title:', deal.title);

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

    // Validate pipeline/stage
    const dealPipelineId = String(deal.pipeline_id ?? '');
    const configPipelineId = String(pipeline_id ?? '');
    const dealStageId = String(deal.stage_id ?? '');
    const configStageId = String(stage_id ?? '');

    if (configPipelineId && dealPipelineId && dealPipelineId !== configPipelineId) {
      const msg = `Pipeline mismatch: deal=${dealPipelineId}, config=${configPipelineId}`;
      if (webhookLogId) await supabase.from('webhook_logs').update({ error: msg }).eq('id', webhookLogId);
      return jsonResponse({ success: false, message: 'Deal não é do funil configurado' });
    }
    if (configStageId && dealStageId && dealStageId !== configStageId) {
      const msg = `Stage mismatch: deal=${dealStageId}, config=${configStageId}`;
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

    let companyData = deal.company || deal.person?.company;
    if (!companyData && deal.company_id) {
      try {
        const res = await piperunGet(`/companies/${deal.company_id}?with=city,address,contact_phones,contact_emails,segment`, token);
        companyData = res.data || res;
      } catch (e) { /* ok */ }
    }

    let personData = deal.person;
    if (!personData && deal.person_id) {
      try {
        const res = await piperunGet(`/persons/${deal.person_id}?with=city,address,contact_phones,contact_emails`, token);
        personData = res.data || res;
      } catch (e) { /* ok */ }
    }

    // Fetch proposals
    let proposalsArray = deal.proposals || [];
    if (proposalsArray.length === 0) {
      try {
        const res = await piperunGet(`/proposals?deal_id=${deal.id}`, token);
        proposalsArray = res.data || [];
      } catch (e) { /* ok */ }
    }
    const proposalData = proposalsArray[0] || null;

    // Fetch signature
    let signatureData = null;
    if (proposalData) {
      try {
        const res = await piperunGet(`/signatures?proposal_id=${proposalData.id}`, token);
        const sigs = res.data || [];
        signatureData = sigs.find((s: any) => s.status === 'signed' || s.status === 'assinado') || sigs[0] || null;
      } catch (e) { /* ok */ }
    }

    // Build sourceData — flat structure matching real Piperun JSON
    const sourceData = {
      // Deal root fields (title, value, status, closed_at, created_at, etc.)
      ...deal,
      // Nested objects already on deal: stage, pipeline, user, city
      // Explicit overrides for related entities
      company: companyData || {},
      person: personData || {},
      proposals: proposalsArray,
      fields: deal.fields || [],
      signature: signatureData || {},
      action: body.action || {},
      // Backward compat
      deal: { ...deal, owner: deal.owner || deal.user || {}, stage: deal.stage || {}, pipeline: deal.pipeline || {} },
      proposal: proposalData || {},
    };

    console.log('[PIPERUN-WEBHOOK] sourceData top keys:', Object.keys(sourceData));
    console.log('[PIPERUN-WEBHOOK] company name:', sourceData.company?.name);
    console.log('[PIPERUN-WEBHOOK] person name:', sourceData.person?.name);
    console.log('[PIPERUN-WEBHOOK] proposals count:', sourceData.proposals?.length);
    console.log('[PIPERUN-WEBHOOK] fields count:', sourceData.fields?.length);

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
      const { error: logUpErr } = await supabase.from('webhook_logs').update({ processed: true, error: null }).eq('id', webhookLogId);
      if (logUpErr) console.error('[PIPERUN-WEBHOOK] webhook_logs update error:', logUpErr.message);
    }

    // Trigger automations (non-blocking)
    try {
      await supabase.functions.invoke('execute-automations', {
        body: { action: 'triggerV2', trigger_type: 'office.registered', office_id: result.office_id },
      });
      await supabase.functions.invoke('execute-automations', {
        body: { action: 'triggerV2', trigger_type: 'office.imported_piperun', office_id: result.office_id },
      });
      console.log('[PIPERUN-WEBHOOK] Automations triggered for office:', result.office_id);
    } catch (autoErr: any) {
      console.error('[PIPERUN-WEBHOOK] Automation trigger failed:', autoErr?.message);
    }

    // Update last webhook timestamp in settings
    const { error: settingsErr } = await supabase.from('integration_settings')
      .update({ config: { ...config, last_webhook_at: new Date().toISOString() } })
      .eq('provider', 'piperun');
    if (settingsErr) console.error('[PIPERUN-WEBHOOK] Settings update error:', settingsErr.message);

    console.log('[PIPERUN-WEBHOOK] Contrato assinado — escritório criado:', result.office_id);
    return jsonResponse({ success: true, office_id: result.office_id });
  } catch (err: any) {
    console.error("[PIPERUN-WEBHOOK] ERROR:", err?.message, err?.stack);
    if (webhookLogId) {
      await supabase.from('webhook_logs').update({ error: err?.message || 'Erro interno' }).eq('id', webhookLogId);
    }
    return jsonResponse({ success: false, message: err?.message || 'Erro interno' }, 500);
  }
});
