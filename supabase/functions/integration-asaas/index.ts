import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE = "https://api.asaas.com/v3";

function getApiKey() {
  const key = Deno.env.get("ASAAS_API_KEY");
  if (!key) throw new Error("ASAAS_API_KEY not configured");
  return key;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function asaasGet(path: string, retries = 2): Promise<any> {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    headers: { access_token: getApiKey() },
  });
  if (res.status === 429 && retries > 0) {
    console.log(`[ASAAS] Rate limited on ${path}, waiting 5s (retries left: ${retries})`);
    await delay(5000);
    return asaasGet(path, retries - 1);
  }
  if (!res.ok) throw new Error(`Asaas API error [${res.status}]: ${await res.text()}`);
  return res.json();
}

function translateAsaasStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING: "Pendente", RECEIVED: "Pago", CONFIRMED: "Confirmado", OVERDUE: "Vencido",
    REFUNDED: "Estornado", RECEIVED_IN_CASH: "Pago em dinheiro", REFUND_REQUESTED: "Estorno solicitado",
    REFUND_IN_PROGRESS: "Estorno em andamento", CHARGEBACK_REQUESTED: "Chargeback",
    CHARGEBACK_DISPUTE: "Disputa chargeback", AWAITING_CHARGEBACK_REVERSAL: "Aguardando reversão",
    DUNNING_REQUESTED: "Negativação solicitada", DUNNING_RECEIVED: "Negativado",
    AWAITING_RISK_ANALYSIS: "Análise de risco", DELETED: "Excluída",
  };
  return map[status] || status;
}

function classifyPayment(p: any) {
  const now = new Date();
  const dueDate = new Date(p.dueDate);
  const isPaid = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(p.status);
  const isCancelled = ["REFUNDED", "REFUND_REQUESTED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL", "DUNNING_REQUESTED", "DUNNING_RECEIVED", "DELETED"].includes(p.status);
  const isOverdue = p.status === "OVERDUE";
  const isPending = !isPaid && !isCancelled && !isOverdue;
  const isDeleted = p.status === "DELETED";
  let daysOverdue = 0;
  if (isOverdue) daysOverdue = Math.ceil((now.getTime() - dueDate.getTime()) / 86400000);
  return { isPaid, isOverdue, isPending, isCancelled, isDeleted, daysOverdue, statusLabel: translateAsaasStatus(p.status) };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Fetch ALL payments for a customer (paginated)
async function fetchAllPayments(customerId: string): Promise<any[]> {
  const allPayments: any[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const res = await asaasGet(`/payments?customer=${customerId}&limit=100&offset=${offset}`);
    if (res.data && res.data.length > 0) {
      allPayments.push(...res.data);
      offset += 100;
      hasMore = res.data.length === 100;
      if (hasMore) await delay(350);
    } else {
      hasMore = false;
    }
  }
  return allPayments;
}

// Upsert payments into local DB and update office totals
async function syncOfficePayments(supabase: any, officeId: string, customerId: string) {
  const payments = await fetchAllPayments(customerId);

  // Upsert payments
  if (payments.length > 0) {
    const rows = payments.map((p: any) => {
      const c = classifyPayment(p);
      return {
        asaas_id: p.id,
        office_id: officeId,
        value: p.value,
        net_value: p.netValue,
        due_date: p.dueDate,
        payment_date: p.paymentDate || p.confirmedDate || null,
        status: p.status,
        status_label: c.statusLabel,
        billing_type: p.billingType,
        description: p.description,
        invoice_url: p.invoiceUrl,
        bank_slip_url: p.bankSlipUrl,
        days_overdue: c.daysOverdue,
        is_paid: c.isPaid,
        is_overdue: c.isOverdue,
        is_pending: c.isPending,
        is_cancelled: c.isCancelled,
        is_deleted: c.isDeleted,
        synced_at: new Date().toISOString(),
      };
    });

    // Batch upsert in chunks of 500
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from("asaas_payments").upsert(chunk, { onConflict: "asaas_id" });
      if (error) console.error(`[ASAAS] Upsert error for office ${officeId}:`, error.message);
    }
  }

  // Calculate overdue totals from local data
  const { data: overdueData } = await supabase
    .from("asaas_payments")
    .select("value")
    .eq("office_id", officeId)
    .eq("is_overdue", true);

  const overdueCount = overdueData?.length || 0;
  const overdueValue = (overdueData || []).reduce((s: number, p: any) => s + Number(p.value), 0);

  await supabase.from("offices").update({
    installments_overdue: overdueCount,
    total_overdue_value: overdueValue,
    asaas_last_sync: new Date().toISOString(),
  }).eq("id", officeId);

  return { payments: payments.length, overdue: overdueCount, overdueValue };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    const { action } = body;

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ─── ACTION: webhook (no auth) ───
    if (action === "webhook") {
      const { payment } = body;
      if (payment?.customer) {
        const supabase = createClient(url, serviceKey);
        const { data: offices } = await supabase
          .from("offices").select("id").eq("asaas_customer_id", payment.customer);
        if (offices?.length) {
          for (const office of offices) {
            try { await syncOfficePayments(supabase, office.id, payment.customer); } catch (e) {
              console.error(`[ASAAS] Webhook sync failed for office ${office.id}:`, e);
            }
          }
        }
      }
      return jsonResponse({ success: true });
    }

    // ─── ACTION: syncBatch (can be called by cron without user JWT) ───
    if (action === "syncBatch") {
      const supabase = createClient(url, serviceKey);

      // If called by a user, validate auth; if called by cron/self-invoke with service key, skip
      const authHeader = req.headers.get("Authorization");
      const isCronOrSelfInvoke = body._internal === true;
      if (!isCronOrSelfInvoke && authHeader?.startsWith("Bearer ")) {
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
        const { data: { user }, error: userErr } = await userClient.auth.getUser();
        if (userErr || !user) return jsonResponse({ error: "Unauthorized" }, 401);
        const { data: roleCheck } = await supabase.rpc("get_user_role", { _user_id: user.id });
        if (!roleCheck || !["admin", "manager", "csm"].includes(roleCheck)) return jsonResponse({ error: "Forbidden" }, 403);
      }

      const offset = body.offset || 0;
      const batchSize = body.batchSize || 30;

      const { data: allOffices } = await supabase
        .from("offices")
        .select("id, cnpj, asaas_customer_id")
        .not("cnpj", "is", null)
        .neq("cnpj", "")
        .order("asaas_last_sync", { ascending: true, nullsFirst: true })
        .range(offset, offset + batchSize - 1);

      const offices = allOffices || [];
      let synced = 0, notFound = 0, errors = 0;
      const DELAY_MS = 350;
      const startTime = Date.now();
      const TIMEOUT_MS = 45000;

      for (const office of offices) {
        if (Date.now() - startTime > TIMEOUT_MS) break;

        let customerId = office.asaas_customer_id;
        if (!customerId) {
          const cnpjDigits = (office.cnpj || "").replace(/\D/g, "");
          if (!cnpjDigits) { notFound++; continue; }
          try {
            await delay(DELAY_MS);
            const customerRes = await asaasGet(`/customers?cpfCnpj=${cnpjDigits}`);
            if (customerRes.data?.length > 0) {
              customerId = customerRes.data[0].id;
              await supabase.from("offices").update({ asaas_customer_id: customerId }).eq("id", office.id);
            } else { notFound++; continue; }
          } catch (e) { console.error(`[ASAAS] CNPJ lookup failed for ${office.id}:`, e); errors++; continue; }
        }

        try {
          await delay(DELAY_MS);
          await syncOfficePayments(supabase, office.id, customerId);
          synced++;
        } catch (e) { console.error(`[ASAAS] Sync failed for ${office.id}:`, e); errors++; }
      }

      // Check if there are more offices to process
      const { count: totalCount } = await supabase
        .from("offices")
        .select("id", { count: "exact", head: true })
        .not("cnpj", "is", null)
        .neq("cnpj", "");

      const total = totalCount || 0;
      const nextOffset = offset + batchSize;
      const hasMore = nextOffset < total && offices.length === batchSize;

      // Auto-invoke next batch in background
      if (hasMore) {
        const functionUrl = `${url}/functions/v1/integration-asaas`;
        fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ action: "syncBatch", offset: nextOffset, batchSize, _internal: true }),
        }).catch(e => console.error("[ASAAS] Failed to invoke next batch:", e));
      }

      return jsonResponse({ success: true, synced, notFound, errors, total, processed: offset + synced + notFound + errors, hasMore, nextOffset: hasMore ? nextOffset : null });
    }

    // ─── Auth required for remaining actions ───
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabase = createClient(url, serviceKey);
    const { data: roleCheck } = await supabase.rpc("get_user_role", { _user_id: user.id });
    if (!roleCheck || !["admin", "manager", "csm"].includes(roleCheck)) return jsonResponse({ error: "Forbidden" }, 403);

    // ─── ACTION: getFinancialByOffice (reads from local DB) ───
    if (action === "getFinancialByOffice") {
      const { office_id } = body;
      if (!office_id) return jsonResponse({ error: "office_id is required" }, 400);

      const { data: office } = await supabase.from("offices").select("id, cnpj, asaas_customer_id, asaas_last_sync").eq("id", office_id).single();
      if (!office) return jsonResponse({ error: "Escritório não encontrado" }, 404);
      if (!office.cnpj) return jsonResponse({ error: "Escritório sem CNPJ cadastrado", noCnpj: true }, 400);

      // Read from local asaas_payments table
      const { data: payments } = await supabase
        .from("asaas_payments")
        .select("*")
        .eq("office_id", office_id)
        .order("due_date", { ascending: false });

      const allPayments = payments || [];

      // If no local data and office has customer_id, try to sync first
      if (allPayments.length === 0 && office.asaas_customer_id) {
        try {
          await syncOfficePayments(supabase, office_id, office.asaas_customer_id);
          const { data: freshPayments } = await supabase
            .from("asaas_payments").select("*").eq("office_id", office_id).order("due_date", { ascending: false });
          allPayments.push(...(freshPayments || []));
        } catch (e) {
          console.error(`[ASAAS] On-demand sync failed:`, e);
        }
      }

      // If still no data and no customer_id, try lookup
      if (allPayments.length === 0 && !office.asaas_customer_id) {
        const cnpjDigits = office.cnpj.replace(/\D/g, "");
        try {
          const customerRes = await asaasGet(`/customers?cpfCnpj=${cnpjDigits}`);
          if (customerRes.data?.length > 0) {
            const customerId = customerRes.data[0].id;
            await supabase.from("offices").update({ asaas_customer_id: customerId }).eq("id", office_id);
            await syncOfficePayments(supabase, office_id, customerId);
            const { data: freshPayments } = await supabase
              .from("asaas_payments").select("*").eq("office_id", office_id).order("due_date", { ascending: false });
            allPayments.push(...(freshPayments || []));
          } else {
            return jsonResponse({ error: "Cliente não encontrado no Asaas", cnpj: office.cnpj, notFound: true }, 404);
          }
        } catch (e) {
          return jsonResponse({ error: "Erro ao buscar cliente no Asaas: " + (e as Error).message }, 500);
        }
      }

      // Build response matching existing frontend format
      const classified = allPayments.map((p: any) => ({
        id: p.asaas_id,
        value: Number(p.value),
        netValue: p.net_value ? Number(p.net_value) : null,
        dueDate: p.due_date,
        paymentDate: p.payment_date,
        status: p.status,
        billingType: p.billing_type,
        description: p.description,
        invoiceUrl: p.invoice_url,
        bankSlipUrl: p.bank_slip_url,
        isPaid: p.is_paid,
        isOverdue: p.is_overdue,
        isPending: p.is_pending,
        isCancelled: p.is_cancelled,
        isDeleted: p.is_deleted,
        daysOverdue: p.days_overdue,
        statusLabel: p.status_label,
      }));

      const paid = classified.filter((p) => p.isPaid);
      const overdue = classified.filter((p) => p.isOverdue);
      const pending = classified.filter((p) => p.isPending);
      const cancelled = classified.filter((p) => p.isCancelled);
      const sortedPending = [...pending].sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
      const sortedOverdue = [...overdue].sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));

      const summary = {
        totalPaid: paid.reduce((sum, p) => sum + p.value, 0),
        totalOverdue: overdue.reduce((sum, p) => sum + p.value, 0),
        totalPending: pending.reduce((sum, p) => sum + p.value, 0),
        countPaid: paid.length, countOverdue: overdue.length,
        countPending: pending.length, countCancelled: cancelled.length,
        nextPayment: sortedPending[0] || null, oldestOverdue: sortedOverdue[0] || null,
      };

      return jsonResponse({
        customer_id: office.asaas_customer_id, office_id, cnpj: office.cnpj, summary,
        payments: classified,
        last_sync: office.asaas_last_sync,
      });
    }

    // ─── ACTION: syncOffice (individual sync for a single office) ───
    if (action === "syncOffice") {
      const { office_id } = body;
      if (!office_id) return jsonResponse({ error: "office_id is required" }, 400);

      const { data: office } = await supabase.from("offices").select("id, cnpj, asaas_customer_id").eq("id", office_id).single();
      if (!office) return jsonResponse({ error: "Escritório não encontrado" }, 404);
      if (!office.cnpj) return jsonResponse({ error: "Escritório sem CNPJ cadastrado" }, 400);

      let customerId = office.asaas_customer_id;
      if (!customerId) {
        const cnpjDigits = office.cnpj.replace(/\D/g, "");
        const customerRes = await asaasGet(`/customers?cpfCnpj=${cnpjDigits}`);
        if (customerRes.data?.length > 0) {
          customerId = customerRes.data[0].id;
          await supabase.from("offices").update({ asaas_customer_id: customerId }).eq("id", office_id);
        } else {
          return jsonResponse({ error: "Cliente não encontrado no Asaas" }, 404);
        }
      }

      const result = await syncOfficePayments(supabase, office_id, customerId);
      return jsonResponse({ success: true, ...result });
    }

    // ─── ACTION: testConnection ───
    if (action === "testConnection") {
      const result = await asaasGet("/finance/balance");
      return jsonResponse({ success: true, balance: result.balance, totalBalance: result.totalBalance });
    }

    // ─── ACTION: syncAll (wrapper for syncBatch) ───
    if (action === "syncAll") {
      // Fire-and-forget: start batch sync in background
      const functionUrl = `${url}/functions/v1/integration-asaas`;
      fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ action: "syncBatch", offset: 0, batchSize: 30, _internal: true }),
      }).catch(e => console.error("[ASAAS] Failed to start syncBatch:", e));

      return jsonResponse({ success: true, message: "Sincronização iniciada em background" });
    }

    // ─── ACTION: searchCustomer ───
    if (action === "searchCustomer") {
      const { query } = body;
      const result = await asaasGet(`/customers?name=${encodeURIComponent(query)}`);
      return jsonResponse({ customers: result.data || [] });
    }

    // ─── ACTION: getPayments ───
    if (action === "getPayments") {
      const { customer_id } = body;
      if (!customer_id) throw new Error("customer_id is required");
      const result = await asaasGet(`/payments?customer=${customer_id}&limit=50&sort=dueDate&order=desc`);
      const paymentsData = (result.data || []).map((p: any) => ({
        id: p.id, value: p.value, netValue: p.netValue, dueDate: p.dueDate,
        paymentDate: p.paymentDate, status: p.status, billingType: p.billingType, description: p.description,
      }));
      const overduePayments = paymentsData.filter((p: any) => p.status === "OVERDUE");
      const totalOverdue = overduePayments.reduce((s: number, p: any) => s + p.value, 0);
      return jsonResponse({ payments: paymentsData, totalOverdue, overdueCount: overduePayments.length });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[ASAAS]", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
