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
  return path.split('.').reduce((o: any, k: string) => o?.[k], source);
}

// ---- Smart field resolvers ----

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

  if (!officeFields.name) officeFields.name = sourceData.deal?.title || `Deal ${dealId}`;

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
      await supabase.from("contracts").insert(contractFields).catch((e: any) => {
        console.error(`[PIPERUN] Contract insert failed for deal ${dealId}:`, e);
      });
    }
  }

  // Contacts
  const contactPrefixes = ['contacts', 'contacts_2', 'contacts_3'];
  for (let i = 0; i < contactPrefixes.length; i++) {
    const cFields = contactBuckets[contactPrefixes[i]];
    if (cFields && Object.keys(cFields).length > 0 && cFields.name) {
      cFields.office_id = officeId;
      cFields.is_main_contact = i === 0;
      await supabase.from("contacts").insert(cFields).catch((e: any) => {
        console.error(`[PIPERUN] Contact insert failed for deal ${dealId}:`, e);
      });
    }
  }

  // Download PDF if signature.document_url is mapped
  const pdfMapping = mappings.find(m => m.piperun === 'signature.document_url');
  const pdfUrl = sourceData.signature?.document_url;
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
  await supabase.from("audit_logs").insert({
    user_id: userId,
    entity_type: "office",
    entity_id: officeId,
    action: "piperun_import",
    details: { deal_id: dealId, product_id: resolvedProductId },
  }).catch(() => {});

  return { office_id: officeId, warnings };
}

// ---- Fetch full deal source data ----

async function fetchFullSourceData(dealId: number | string, token: string): Promise<any> {
  // Fetch deal with expanded relations
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
  let proposalData = null;
  if (dealData.proposals && dealData.proposals.length > 0) {
    proposalData = dealData.proposals
      .filter((p: any) => p.status === 'accepted' || p.status === 'sent')
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      || dealData.proposals[0];
  } else {
    try {
      const proposalsRes = await piperunGet(`/proposals?deal_id=${dealId}`, token);
      const proposals = proposalsRes.data || [];
      if (proposals.length > 0) {
        proposalData = proposals
          .filter((p: any) => p.status === 'accepted' || p.status === 'sent')
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
          || proposals[0];
      }
    } catch (e) { console.warn('[PIPERUN] Proposals fetch failed:', e); }
  }

  // Signature
  let signatureData = null;
  if (proposalData) {
    try {
      const sigRes = await piperunGet(`/signatures?proposal_id=${proposalData.id}`, token);
      const sigs = sigRes.data || [];
      signatureData = sigs[0] || null;
    } catch (e) { /* no signature, ok */ }
  }

  // Build unified sourceData
  const customFields: Record<string, any> = {};
  if (dealData.custom_fields && Array.isArray(dealData.custom_fields)) {
    for (const cf of dealData.custom_fields) {
      customFields[cf.id || cf.custom_field_id] = cf.value;
    }
  }

  return {
    deal: {
      ...dealData,
      owner: dealData.owner || {},
      stage: dealData.stage || {},
      pipeline: dealData.pipeline || {},
      custom: customFields,
    },
    company: companyData || {},
    person: personData || {},
    proposal: proposalData || {},
    signature: signatureData || {},
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

      // Static deal fields
      const dealFields = [
        { key: 'deal.title', label: 'Título da oportunidade', category: 'Oportunidade' },
        { key: 'deal.value', label: 'Valor da oportunidade', category: 'Oportunidade' },
        { key: 'deal.monthly_value', label: 'Valor mensal', category: 'Oportunidade' },
        { key: 'deal.status', label: 'Status', category: 'Oportunidade' },
        { key: 'deal.won_at', label: 'Data de ganho', category: 'Oportunidade' },
        { key: 'deal.closed_at', label: 'Data de fechamento', category: 'Oportunidade' },
        { key: 'deal.expected_close_date', label: 'Data prevista de fechamento', category: 'Oportunidade' },
        { key: 'deal.close_forecast', label: 'Previsão de fechamento', category: 'Oportunidade' },
        { key: 'deal.observation', label: 'Observação', category: 'Oportunidade' },
        { key: 'deal.origin', label: 'Origem', category: 'Oportunidade' },
        { key: 'deal.tags', label: 'Tags', category: 'Oportunidade' },
        { key: 'deal.created_at', label: 'Criado em', category: 'Oportunidade' },
        { key: 'deal.updated_at', label: 'Atualizado em', category: 'Oportunidade' },
        { key: 'deal.owner.name', label: 'Responsável (vendedor)', category: 'Oportunidade' },
        { key: 'deal.owner.email', label: 'Email do responsável', category: 'Oportunidade' },
        { key: 'deal.stage.name', label: 'Etapa do funil', category: 'Oportunidade' },
        { key: 'deal.pipeline.name', label: 'Nome do funil', category: 'Oportunidade' },
      ];

      const companyFields = [
        { key: 'company.name', label: 'Nome da empresa', category: 'Empresa' },
        { key: 'company.corporate_name', label: 'Razão social', category: 'Empresa' },
        { key: 'company.cnpj', label: 'CNPJ', category: 'Empresa' },
        { key: 'company.phone', label: 'Telefone da empresa', category: 'Empresa' },
        { key: 'company.email', label: 'Email da empresa', category: 'Empresa' },
        { key: 'company.website', label: 'Site', category: 'Empresa' },
        { key: 'company.address', label: 'Endereço', category: 'Empresa' },
        { key: 'company.city.name', label: 'Cidade', category: 'Empresa' },
        { key: 'company.state.abbr', label: 'Estado (UF)', category: 'Empresa' },
        { key: 'company.zip_code', label: 'CEP', category: 'Empresa' },
        { key: 'company.segment.name', label: 'Segmento', category: 'Empresa' },
        { key: 'company.number_of_employees', label: 'Qtd funcionários', category: 'Empresa' },
        { key: 'company.annual_revenue', label: 'Faturamento anual', category: 'Empresa' },
        { key: 'company.observation', label: 'Observações', category: 'Empresa' },
      ];

      const personFields = [
        { key: 'person.name', label: 'Nome do contato', category: 'Contato' },
        { key: 'person.email', label: 'Email do contato', category: 'Contato' },
        { key: 'person.phone', label: 'Telefone', category: 'Contato' },
        { key: 'person.cell_phone', label: 'Celular', category: 'Contato' },
        { key: 'person.cpf', label: 'CPF', category: 'Contato' },
        { key: 'person.birth_date', label: 'Data de nascimento', category: 'Contato' },
        { key: 'person.position', label: 'Cargo', category: 'Contato' },
        { key: 'person.city.name', label: 'Cidade do contato', category: 'Contato' },
        { key: 'person.state.abbr', label: 'Estado do contato', category: 'Contato' },
        { key: 'person.whatsapp', label: 'WhatsApp', category: 'Contato' },
        { key: 'person.instagram', label: 'Instagram', category: 'Contato' },
        { key: 'person.linkedin', label: 'LinkedIn', category: 'Contato' },
        { key: 'person.observation', label: 'Observações do contato', category: 'Contato' },
      ];

      const proposalFields = [
        { key: 'proposal.number', label: 'Número da proposta', category: 'Proposta' },
        { key: 'proposal.value', label: 'Valor da proposta', category: 'Proposta' },
        { key: 'proposal.status', label: 'Status da proposta', category: 'Proposta' },
        { key: 'proposal.sent_at', label: 'Data de envio', category: 'Proposta' },
        { key: 'proposal.accepted_at', label: 'Data de aceite', category: 'Proposta' },
        { key: 'proposal.payment_terms', label: 'Condições de pagamento', category: 'Proposta' },
        { key: 'proposal.items', label: 'Itens/Produtos da proposta', category: 'Proposta' },
        { key: 'proposal.observation', label: 'Observação da proposta', category: 'Proposta' },
      ];

      const signatureFields = [
        { key: 'signature.status', label: 'Status da assinatura', category: 'Assinatura' },
        { key: 'signature.signed_at', label: 'Data da assinatura', category: 'Assinatura' },
        { key: 'signature.document_url', label: 'PDF do contrato assinado (baixar e salvar)', category: 'Assinatura' },
      ];

      // Merge static fields
      const staticFields = [...dealFields, ...companyFields, ...personFields, ...proposalFields, ...signatureFields];
      for (const f of staticFields) {
        fields.push({ ...f, example_value: '' });
      }

      // Try to fetch custom fields from API
      try {
        const customFieldsRes = await piperunGet('/customFields?entity=deal', token);
        const customFieldsList = customFieldsRes.data || [];
        for (const cf of customFieldsList) {
          fields.push({
            key: `deal.custom.${cf.id || cf.custom_field_id}`,
            label: cf.name || cf.label || `Custom ${cf.id}`,
            example_value: '',
            category: 'Oportunidade (Custom)',
          });
        }
      } catch (e) {
        console.warn('[PIPERUN] Failed to fetch custom fields:', e);
      }

      // Try to enrich with example data from a sample deal
      try {
        const { pipeline_id, stage_id } = body;
        let samplePath = '/deals?show=1';
        if (pipeline_id) samplePath += `&pipeline_id=${pipeline_id}`;
        if (stage_id) samplePath += `&stage_id=${stage_id}`;
        samplePath += '&status=won&with=person,company,customFields';
        
        const sampleRes = await piperunGet(samplePath, token);
        const sampleDeal = (sampleRes.data || [])[0];
        if (sampleDeal) {
          const sampleSource = {
            deal: { ...sampleDeal, owner: sampleDeal.owner || {}, stage: sampleDeal.stage || {}, pipeline: sampleDeal.pipeline || {}, custom: {} as Record<string, any> },
            company: sampleDeal.company || {},
            person: sampleDeal.person || {},
            proposal: {},
            signature: {},
          };
          if (sampleDeal.custom_fields && Array.isArray(sampleDeal.custom_fields)) {
            for (const cf of sampleDeal.custom_fields) {
              sampleSource.deal.custom[cf.id || cf.custom_field_id] = cf.value;
            }
          }
          // Enrich example values
          for (const f of fields) {
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

      let path = `/deals?pipeline_id=${pipeline_id}&stage_id=${stage_id}&status=won&show=100`;
      const result = await piperunGet(path, token);
      let deals = result.data || [];
      // Filter won in code as fallback
      deals = deals.filter((d: any) => {
        const s = String(d.status || '').toLowerCase().trim();
        return ['won', 'ganho', 'ganha'].includes(s) || d.won === true;
      });

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
      const { pipeline_id, stage_id, field_mappings } = body;
      if (!pipeline_id || !stage_id) throw new Error("pipeline_id and stage_id are required");

      let path = `/deals?pipeline_id=${pipeline_id}&stage_id=${stage_id}&status=won&show=100`;
      const result = await piperunGet(path, token);
      let deals = result.data || [];
      deals = deals.filter((d: any) => {
        const s = String(d.status || '').toLowerCase().trim();
        return ['won', 'ganho', 'ganha'].includes(s) || d.won === true;
      });

      const { data: existing } = await supabase.from("offices").select("piperun_deal_id").not("piperun_deal_id", "is", null);
      const existingIds = new Set((existing || []).map((o: any) => o.piperun_deal_id));

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
