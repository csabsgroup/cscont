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
    if (code === 503 || code === 502 || code === 504) return { status: 200, message: `API do Piperun temporariamente indisponível (${code}). Tente novamente em alguns minutos.` };
    return { status: 200, message: `Erro na API do Piperun (${code}).` };
  }
  return { status: 200, message: "Erro interno ao conectar com o Piperun. Verifique os logs." };
}

async function piperunGet(path: string, token?: string) {
  const t = token || getToken();
  const separator = path.includes('?') ? '&' : '?';
  const url = `${PIPERUN_BASE}${path}${separator}show=200`;
  console.log(`[PIPERUN] GET ${url}`);
  const res = await fetch(url, { headers: { Token: t } });
  console.log(`[PIPERUN] Response status: ${res.status}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Piperun API [${res.status}]: ${body.substring(0, 200)}`);
  }
  return res.json();
}

async function piperunGetAll(path: string, token?: string) {
  const t = token || getToken();
  let page = 1;
  let allData: any[] = [];
  while (true) {
    const separator = path.includes('?') ? '&' : '?';
    const url = `${PIPERUN_BASE}${path}${separator}show=200&page=${page}`;
    console.log(`[PIPERUN] GET ALL ${url} (page ${page})`);
    const res = await fetch(url, { headers: { Token: t } });
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

function resolveNestedValue(source: any, path: string): any {
  // Handle custom fields: fields.find.{id}
  if (path.startsWith('fields.find.')) {
    const fieldId = parseInt(path.split('.')[2]);
    const field = source.fields?.find((f: any) => f.id === fieldId);
    return field?.valor ?? field?.value ?? null;
  }

  // Handle paths with array indices like proposals[0].value
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

// ---- Smart field resolvers ----

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
      // Try matching by significant words
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
      'ativo': 'ativo', 'active': 'ativo',
      'churn': 'churn', 'cancelado': 'churn',
      'não renovado': 'nao_renovado', 'nao renovado': 'nao_renovado', 'nao_renovado': 'nao_renovado',
      'não iniciado': 'nao_iniciado', 'nao iniciado': 'nao_iniciado', 'nao_iniciado': 'nao_iniciado',
      'upsell': 'upsell', 'upgrade': 'upsell',
      'bônus elite': 'bonus_elite', 'bonus elite': 'bonus_elite', 'bonus_elite': 'bonus_elite',
      'pausado': 'pausado', 'paused': 'pausado',
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

// ---- Shared processAndCreateOffice ----

async function processAndCreateOffice(
  supabase: any,
  sourceData: any,
  mappings: Array<{ piperun: string; local: string }>,
  dealId: string,
  userId: string
): Promise<{ office_id: string; warnings: string[] }> {
  const warnings: string[] = [];
  const officeFields: Record<string, any> = { piperun_deal_id: dealId, status: 'ativo' };
  const contractFields: Record<string, any> = {};
  const contactBuckets: Record<string, Record<string, any>> = {};

  for (const mapping of mappings) {
    const value = resolveNestedValue(sourceData, mapping.piperun);
    if (value === undefined || value === null || value === '') continue;

    const [table, ...colParts] = mapping.local.split('.');
    const col = colParts.join('.');

    if (table === 'offices') {
      officeFields[col] = value;
    } else if (table === 'contracts') {
      contractFields[col] = value;
    } else if (table.startsWith('contacts')) {
      if (!contactBuckets[table]) contactBuckets[table] = {};
      contactBuckets[table][col] = value;
    }
  }

  // Smart field resolution
  let resolvedProductId: string | null = null;
  for (const mapping of mappings) {
    if (SMART_FIELDS.includes(mapping.local)) {
      const rawValue = resolveNestedValue(sourceData, mapping.piperun);
      const col = mapping.local.split('.')[1];
      const resolved = await resolveSmartField(supabase, mapping.local, rawValue);
      if (resolved.warning) warnings.push(`${resolved.warning} (Deal ${dealId})`);
      if (resolved.value !== null) {
        officeFields[col] = resolved.value;
        if (mapping.local === 'offices.active_product_id') resolvedProductId = resolved.value;
      } else {
        delete officeFields[col];
      }
    }
  }

  if (!officeFields.name) officeFields.name = sourceData.title || sourceData.deal?.title || `Deal ${dealId}`;

  // Insert office
  const { data: newOffice, error: officeErr } = await supabase.from("offices").insert(officeFields).select("id").single();
  if (officeErr || !newOffice) throw new Error(`Failed to insert office: ${officeErr?.message}`);
  const officeId = newOffice.id;

  // Contract
  if (Object.keys(contractFields).length > 0) {
    contractFields.office_id = officeId;
    contractFields.product_id = resolvedProductId || officeFields.active_product_id;
    if (contractFields.product_id) {
      contractFields.status = contractFields.status || 'pendente';
      const { error: contractErr } = await supabase.from("contracts").insert(contractFields);
      if (contractErr) console.error(`[PIPERUN] Contract insert failed for deal ${dealId}:`, contractErr.message);
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
      if (contactErr) console.error(`[PIPERUN] Contact insert failed for deal ${dealId}:`, contactErr.message);
    }
  }

  // Download PDF if action.document_url is mapped
  const pdfMapping = mappings.find(m => m.piperun === 'action.document_url');
  const pdfUrl = sourceData.action?.document_url;
  if (pdfMapping && pdfUrl) {
    try {
      const pdfResponse = await fetch(pdfUrl, { signal: AbortSignal.timeout(30000) });
      if (pdfResponse.ok) {
        const pdfBuffer = await pdfResponse.arrayBuffer();
        await supabase.storage
          .from('office-files')
          .upload(`${officeId}/contrato-piperun-${dealId}.pdf`, pdfBuffer, { contentType: 'application/pdf' });
      }
    } catch (e: any) {
      console.log('[PIPERUN] PDF download failed:', e.message);
    }
  }

  // Trigger automations
  if (resolvedProductId) {
    try {
      await triggerAutomations(supabase, officeId, resolvedProductId, userId);
    } catch (e) {
      console.error(`[PIPERUN] Automation error for deal ${dealId}:`, e);
    }
  }

  // Audit log
  const { error: auditErr } = await supabase.from("audit_logs").insert({
    user_id: userId,
    entity_type: "office",
    entity_id: officeId,
    action: "piperun_contract_signed_import",
    details: { deal_id: dealId, product_id: resolvedProductId },
  });
  if (auditErr) console.error(`[PIPERUN] Audit log error:`, auditErr.message);

  return { office_id: officeId, warnings };
}

// ---- Fetch full deal source data ----

async function fetchFullSourceData(dealId: number | string, token: string): Promise<any> {
  const fullDealRes = await piperunGet(`/deals/${dealId}?with=person,company,proposals,customFields,stage,pipeline,owner`, token);
  const dealData = fullDealRes.data || fullDealRes;

  // Company
  let companyData = dealData.company;
  if (!companyData && dealData.company_id) {
    try {
      const companyRes = await piperunGet(`/companies/${dealData.company_id}`, token);
      companyData = companyRes.data || companyRes;
    } catch (e) { console.warn('[PIPERUN] Company fetch failed:', e); }
  }

  // Person
  let personData = dealData.person;
  if (!personData && dealData.person_id) {
    try {
      const personRes = await piperunGet(`/persons/${dealData.person_id}`, token);
      personData = personRes.data || personRes;
    } catch (e) { console.warn('[PIPERUN] Person fetch failed:', e); }
  }

  // Proposals
  let proposalsArray = dealData.proposals || [];
  if (proposalsArray.length === 0) {
    try {
      const proposalsRes = await piperunGet(`/proposals?deal_id=${dealId}`, token);
      proposalsArray = proposalsRes.data || [];
    } catch (e) { console.warn('[PIPERUN] Proposals fetch failed:', e); }
  }
  const proposalData = proposalsArray[0] || null;

  // Build unified sourceData — flat structure matching real Piperun JSON
  return {
    // Deal root fields spread at top level
    ...dealData,
    // Related entities
    company: companyData || {},
    person: personData || {},
    proposals: proposalsArray,
    fields: dealData.fields || [],
    action: dealData.action || {},
    // Backward compat
    deal: {
      ...dealData,
      owner: dealData.owner || dealData.user || {},
      stage: dealData.stage || {},
      pipeline: dealData.pipeline || {},
    },
    proposal: proposalData || {},
  };
}

// ---- Automations ----

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

  // 3. Journey stage
  const { data: firstStage } = await supabase
    .from("journey_stages").select("id")
    .eq("product_id", productId).order("position", { ascending: true }).limit(1).maybeSingle();

  if (firstStage) {
    const { data: existingJourney } = await supabase.from("office_journey").select("id")
      .eq("office_id", officeId).maybeSingle();
    if (!existingJourney) {
      await supabase.from("office_journey").insert({ office_id: officeId, journey_stage_id: firstStage.id });
      results.push(`Posicionado na jornada`);
    }
  }

  // 4. Health score
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
        body: { action: 'sendMessage', message: `🆕 Novo cliente importado do Piperun: *${office?.name}* — Produto: ${product?.name} — CSM: ${csmName}` },
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

    const token = getToken();

    // ========== testConnection ==========
    if (action === "testConnection") {
      try {
        const result = await piperunGet("/pipelines", token);
        const count = result.data?.length || 0;
        return new Response(
          JSON.stringify({ success: true, pipelines_count: count, message: `Conectado! ${count} funis encontrados.` }),
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
      const allPipelines = await piperunGetAll("/pipelines", token);
      const pipelines = allPipelines.map((p: any) => ({ id: p.id, name: p.name }));
      return new Response(JSON.stringify({ pipelines }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== listStages ==========
    if (action === "listStages") {
      const { pipeline_id } = body;
      const allStages = await piperunGetAll(`/stages?pipeline_id=${pipeline_id}`, token);
      const stages = allStages.map((s: any) => ({ id: s.id, name: s.name }));
      return new Response(JSON.stringify({ stages }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== listFields ==========
    if (action === "listFields") {
      const fields: Array<{ key: string; label: string; example_value: string; category: string }> = [];

      // Deal fields (root-level paths matching real Piperun JSON)
      const dealFields = [
        { key: 'title', label: 'Título da oportunidade', category: 'Oportunidade' },
        { key: 'value', label: 'Valor da oportunidade', category: 'Oportunidade' },
        { key: 'closed_at', label: 'Data de fechamento', category: 'Oportunidade' },
        { key: 'created_at', label: 'Data de criação', category: 'Oportunidade' },
        { key: 'observation', label: 'Observação', category: 'Oportunidade' },
        { key: 'stage.name', label: 'Etapa do funil', category: 'Oportunidade' },
        { key: 'pipeline.name', label: 'Nome do funil', category: 'Oportunidade' },
        { key: 'user.name', label: 'Responsável (vendedor)', category: 'Oportunidade' },
        { key: 'user.email', label: 'Email do responsável', category: 'Oportunidade' },
        { key: 'city.name', label: 'Cidade da oportunidade', category: 'Oportunidade' },
        { key: 'city.uf', label: 'Estado da oportunidade', category: 'Oportunidade' },
      ];

      const companyFields = [
        { key: 'company.name', label: 'Nome da empresa', category: 'Empresa' },
        { key: 'company.company_name', label: 'Razão social', category: 'Empresa' },
        { key: 'company.cnpj', label: 'CNPJ', category: 'Empresa' },
        { key: 'company.contact_phones[0].number', label: 'Telefone da empresa', category: 'Empresa' },
        { key: 'company.contact_emails[0].address', label: 'Email da empresa', category: 'Empresa' },
        { key: 'company.website', label: 'Site', category: 'Empresa' },
        { key: 'company.address.street', label: 'Rua', category: 'Empresa' },
        { key: 'company.address.number', label: 'Número', category: 'Empresa' },
        { key: 'company.address.district', label: 'Bairro', category: 'Empresa' },
        { key: 'company.address.complement', label: 'Complemento', category: 'Empresa' },
        { key: 'company.address.postal_code', label: 'CEP', category: 'Empresa' },
        { key: 'company.city.name', label: 'Cidade da empresa', category: 'Empresa' },
        { key: 'company.city.uf', label: 'Estado da empresa (UF)', category: 'Empresa' },
        { key: 'company.segment.name', label: 'Segmento', category: 'Empresa' },
        { key: 'company.cnae', label: 'CNAE', category: 'Empresa' },
        { key: 'company.open_at', label: 'Data de abertura', category: 'Empresa' },
      ];

      const personFields = [
        { key: 'person.name', label: 'Nome do contato', category: 'Contato' },
        { key: 'person.contact_emails[0].address', label: 'Email do contato', category: 'Contato' },
        { key: 'person.contact_phones[0].number', label: 'Telefone/Celular do contato', category: 'Contato' },
        { key: 'person.cpf', label: 'CPF', category: 'Contato' },
        { key: 'person.birth_day', label: 'Data de nascimento', category: 'Contato' },
        { key: 'person.job_title', label: 'Cargo', category: 'Contato' },
        { key: 'person.city.name', label: 'Cidade do contato', category: 'Contato' },
        { key: 'person.city.uf', label: 'Estado do contato (UF)', category: 'Contato' },
        { key: 'person.address.street', label: 'Endereço do contato', category: 'Contato' },
        { key: 'person.address.postal_code', label: 'CEP do contato', category: 'Contato' },
      ];

      const proposalFields = [
        { key: 'proposals[0].value', label: 'Valor da proposta', category: 'Proposta' },
        { key: 'proposals[0].status', label: 'Status da proposta', category: 'Proposta' },
        { key: 'proposals[0].items[0].name', label: 'Nome do produto/item', category: 'Proposta' },
        { key: 'proposals[0].items[0].code', label: 'Código do produto', category: 'Proposta' },
        { key: 'proposals[0].items[0].value', label: 'Valor do item', category: 'Proposta' },
        { key: 'proposals[0].items[0].characteristics[0].name', label: 'Característica do item', category: 'Proposta' },
        { key: 'proposals[0].parcels.length', label: 'Quantidade de parcelas', category: 'Proposta' },
        { key: 'proposals[0].parcels[0].value', label: 'Valor da entrada/1ª parcela', category: 'Proposta' },
        { key: 'proposals[0].parcels[0].due_date', label: 'Data da 1ª parcela', category: 'Proposta' },
        { key: 'proposals[0].parcels[1].value', label: 'Valor da mensalidade', category: 'Proposta' },
        { key: 'proposals[0].valid_until', label: 'Validade da proposta', category: 'Proposta' },
        { key: 'proposals[0].created_at', label: 'Data de criação da proposta', category: 'Proposta' },
        { key: 'proposals[0].user.name', label: 'Vendedor da proposta', category: 'Proposta' },
      ];

      const actionFields = [
        { key: 'action.create', label: 'Data da assinatura/ação', category: 'Ação' },
        { key: 'action.trigger_type', label: 'Tipo do trigger', category: 'Ação' },
        { key: 'action.stage', label: 'Etapa no momento da ação', category: 'Ação' },
        { key: 'action.pipeline', label: 'Funil no momento da ação', category: 'Ação' },
      ];

      // Merge static fields
      const staticFields = [...dealFields, ...companyFields, ...personFields, ...proposalFields, ...actionFields];
      for (const f of staticFields) {
        fields.push({ ...f, example_value: '' });
      }

      // Try to fetch custom fields (deal fields array) from a sample deal
      try {
        const { pipeline_id, stage_id } = body;
        let samplePath = '/deals?show=1';
        if (pipeline_id) samplePath += `&pipeline_id=${pipeline_id}`;
        if (stage_id) samplePath += `&stage_id=${stage_id}`;
        samplePath += '&with=person,company,proposals';

        const sampleRes = await piperunGet(samplePath, token);
        const sampleDeal = (sampleRes.data || [])[0];
        if (sampleDeal) {
          // Add custom fields from deal.fields array
          if (sampleDeal.fields && Array.isArray(sampleDeal.fields)) {
            for (const cf of sampleDeal.fields) {
              fields.push({
                key: `fields.find.${cf.id}`,
                label: `${cf.nome || cf.name || `Custom ${cf.id}`} (custom)`,
                example_value: cf.valor != null ? String(cf.valor) : '',
                category: 'Campos Customizados',
              });
            }
          }

          // Build sample sourceData for enriching example values
          const sampleSource = {
            ...sampleDeal,
            company: sampleDeal.company || {},
            person: sampleDeal.person || {},
            proposals: sampleDeal.proposals || [],
            fields: sampleDeal.fields || [],
            signature: {},
            action: {},
            deal: { ...sampleDeal, owner: sampleDeal.owner || sampleDeal.user || {}, stage: sampleDeal.stage || {}, pipeline: sampleDeal.pipeline || {} },
            proposal: (sampleDeal.proposals || [])[0] || {},
          };

          // Enrich example values
          for (const f of fields) {
            if (f.key.startsWith('fields.find.')) continue; // already set
            const val = resolveNestedValue(sampleSource, f.key);
            if (val !== undefined && val !== null && val !== '') {
              f.example_value = typeof val === 'object' ? JSON.stringify(val) : String(val);
            }
          }
        }
      } catch (e) {
        console.warn('[PIPERUN] Failed to fetch sample deal for examples:', e);
      }

      return new Response(JSON.stringify({ fields }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== previewDeals ==========
    if (action === "previewDeals") {
      const { pipeline_id, stage_id } = body;
      if (!pipeline_id || !stage_id) throw new Error("pipeline_id and stage_id are required");

      let path = `/deals?pipeline_id=${pipeline_id}&stage_id=${stage_id}&show=100`;
      const result = await piperunGet(path, token);
      const deals = result.data || [];

      // Check which are already imported
      const { data: existing } = await supabase.from("offices").select("piperun_deal_id").not("piperun_deal_id", "is", null);
      const existingIds = new Set((existing || []).map((o: any) => o.piperun_deal_id));

      const eligible = deals
        .filter((d: any) => !existingIds.has(String(d.id)))
        .map((d: any) => ({
          id: d.id,
          title: d.title || `Deal ${d.id}`,
          company_name: d.company?.name || d.organization?.name || '—',
          person_name: d.person?.name || '—',
          value: d.value || 0,
          won_at: d.won_at || d.closed_at || d.updated_at || '',
        }));

      const already_imported = deals.length - eligible.length;

      return new Response(JSON.stringify({ success: true, deals: eligible, total: deals.length, already_imported }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== importDeals ==========
    if (action === "importDeals") {
      const { pipeline_id, stage_id, field_mappings, deal_ids } = body;
      if (!pipeline_id || !stage_id) throw new Error("pipeline_id and stage_id are required");

      let path = `/deals?pipeline_id=${pipeline_id}&stage_id=${stage_id}&show=100`;
      const result = await piperunGet(path, token);
      let deals = result.data || [];

      const { data: existing } = await supabase.from("offices").select("piperun_deal_id").not("piperun_deal_id", "is", null);
      const existingIds = new Set((existing || []).map((o: any) => o.piperun_deal_id));

      // Filter to selected deals if deal_ids provided
      if (deal_ids && Array.isArray(deal_ids) && deal_ids.length > 0) {
        deals = deals.filter((d: any) => deal_ids.includes(String(d.id)));
        console.log(`[PIPERUN] Filtered to ${deals.length} selected deals out of deal_ids:`, deal_ids);
      }

      let imported = 0;
      let skipped = 0;
      const allWarnings: string[] = [];

      for (const deal of deals) {
        const dealId = String(deal.id);
        if (existingIds.has(dealId)) { skipped++; continue; }

        try {
          const sourceData = await fetchFullSourceData(deal.id, token);
          const result = await processAndCreateOffice(supabase, sourceData, field_mappings || [], dealId, user.id);
          imported++;
          allWarnings.push(...result.warnings);
        } catch (e: any) {
          console.error(`[PIPERUN] Failed to import deal ${dealId}:`, e);
          allWarnings.push(`Erro ao importar deal ${dealId}: ${e.message}`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true, imported, skipped, total: deals.length,
          automations_triggered: imported,
          warnings: allWarnings.length > 0 ? allWarnings : undefined,
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
