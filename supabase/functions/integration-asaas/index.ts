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
    PENDING: "Pendente",
    RECEIVED: "Pago",
    CONFIRMED: "Confirmado",
    OVERDUE: "Vencido",
    REFUNDED: "Estornado",
    RECEIVED_IN_CASH: "Pago em dinheiro",
    REFUND_REQUESTED: "Estorno solicitado",
    REFUND_IN_PROGRESS: "Estorno em andamento",
    CHARGEBACK_REQUESTED: "Chargeback",
    CHARGEBACK_DISPUTE: "Disputa chargeback",
    AWAITING_CHARGEBACK_REVERSAL: "Aguardando reversão",
    DUNNING_REQUESTED: "Negativação solicitada",
    DUNNING_RECEIVED: "Negativado",
    AWAITING_RISK_ANALYSIS: "Análise de risco",
    DELETED: "Excluída",
  };
  return map[status] || status;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    const { action } = body;

    // Webhook bypass — external services don't send JWT
    if (action === "webhook") {
      const { payment } = body;
      if (payment?.customer) {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data: offices } = await supabase
          .from("offices")
          .select("id")
          .eq("asaas_customer_id", payment.customer);

        if (offices?.length) {
          const result = await asaasGet(`/payments?customer=${payment.customer}&status=OVERDUE`);
          const overduePayments = result.data || [];
          const overdueCount = overduePayments.length;
          const overdueValue = overduePayments.reduce((s: number, p: any) => s + p.value, 0);
          for (const office of offices) {
            await supabase.from("offices").update({
              installments_overdue: overdueCount,
              total_overdue_value: overdueValue,
            }).eq("id", office.id);
          }
        }
      }
      return jsonResponse({ success: true });
    }

    // --- Auth: validate JWT and require admin/manager/csm role ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleCheck } = await supabase.rpc("get_user_role", { _user_id: user.id });
    if (!roleCheck || !["admin", "manager", "csm"].includes(roleCheck)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    // ─── ACTION: getFinancialByOffice ───
    if (action === "getFinancialByOffice") {
      const { office_id } = body;
      if (!office_id) return jsonResponse({ error: "office_id is required" }, 400);

      const { data: office, error: officeErr } = await supabase
        .from("offices")
        .select("id, cnpj, name, asaas_customer_id")
        .eq("id", office_id)
        .single();

      if (officeErr || !office) return jsonResponse({ error: "Escritório não encontrado" }, 404);
      if (!office.cnpj) return jsonResponse({ error: "Escritório sem CNPJ cadastrado", noCnpj: true }, 400);

      const cnpjDigits = office.cnpj.replace(/\D/g, "");
      let customerId = office.asaas_customer_id;

      if (!customerId) {
        const customerRes = await asaasGet(`/customers?cpfCnpj=${cnpjDigits}`);
        if (customerRes.data && customerRes.data.length > 0) {
          customerId = customerRes.data[0].id;
          await supabase.from("offices").update({ asaas_customer_id: customerId }).eq("id", office_id);
        } else {
          return jsonResponse({ error: "Cliente não encontrado no Asaas", cnpj: office.cnpj, notFound: true }, 404);
        }
      }

      const allPayments: any[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const paymentsRes = await asaasGet(`/payments?customer=${customerId}&limit=100&offset=${offset}`);
        if (paymentsRes.data && paymentsRes.data.length > 0) {
          allPayments.push(...paymentsRes.data);
          offset += 100;
          hasMore = paymentsRes.data.length === 100;
        } else {
          hasMore = false;
        }
      }

      const now = new Date();
      const classified = allPayments.map((p: any) => {
        const dueDate = new Date(p.dueDate);
        const isPaid = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(p.status);
        const isCancelled = ["REFUNDED", "REFUND_REQUESTED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL", "DUNNING_REQUESTED", "DUNNING_RECEIVED", "DELETED"].includes(p.status);
        const isOverdue = p.status === "OVERDUE";
        const isPending = !isPaid && !isCancelled && !isOverdue;
        const isDeleted = p.status === "DELETED";
        let daysOverdue = 0;
        if (isOverdue) daysOverdue = Math.ceil((now.getTime() - dueDate.getTime()) / 86400000);

        return {
          id: p.id, value: p.value, netValue: p.netValue, dueDate: p.dueDate,
          paymentDate: p.paymentDate || p.confirmedDate, status: p.status,
          billingType: p.billingType, description: p.description,
          invoiceUrl: p.invoiceUrl, bankSlipUrl: p.bankSlipUrl,
          isPaid, isOverdue, isPending, isCancelled, isDeleted, daysOverdue,
          statusLabel: translateAsaasStatus(p.status),
        };
      });

      const paid = classified.filter((p) => p.isPaid);
      const overdue = classified.filter((p) => p.isOverdue);
      const pending = classified.filter((p) => p.isPending);
      const cancelled = classified.filter((p) => p.isCancelled);
      const sortedPending = [...pending].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const sortedOverdue = [...overdue].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

      const summary = {
        totalPaid: paid.reduce((sum, p) => sum + p.value, 0),
        totalOverdue: overdue.reduce((sum, p) => sum + p.value, 0),
        totalPending: pending.reduce((sum, p) => sum + p.value, 0),
        countPaid: paid.length, countOverdue: overdue.length,
        countPending: pending.length, countCancelled: cancelled.length,
        nextPayment: sortedPending[0] || null, oldestOverdue: sortedOverdue[0] || null,
      };

      await supabase.from("offices").update({
        installments_overdue: overdue.length, total_overdue_value: summary.totalOverdue,
      }).eq("id", office_id);

      return jsonResponse({
        customer_id: customerId, office_id, cnpj: office.cnpj, summary,
        payments: classified.sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
      });
    }

    // ─── ACTION: testConnection ───
    if (action === "testConnection") {
      const result = await asaasGet("/finance/balance");
      return jsonResponse({ success: true, balance: result.balance, totalBalance: result.totalBalance });
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
      const payments = (result.data || []).map((p: any) => ({
        id: p.id, value: p.value, netValue: p.netValue, dueDate: p.dueDate,
        paymentDate: p.paymentDate, status: p.status, billingType: p.billingType, description: p.description,
      }));
      const overduePayments = payments.filter((p: any) => p.status === "OVERDUE");
      const totalOverdue = overduePayments.reduce((s: number, p: any) => s + p.value, 0);
      return jsonResponse({ payments, totalOverdue, overdueCount: overduePayments.length });
    }

    // ─── ACTION: syncAll (optimized with throttling + retry) ───
    if (action === "syncAll") {
      const { data: offices } = await supabase
        .from("offices")
        .select("id, cnpj, asaas_customer_id")
        .not("cnpj", "is", null)
        .neq("cnpj", "");

      const allOffices = offices || [];
      // Sort: offices with cached asaas_customer_id first (fewer API calls needed)
      allOffices.sort((a, b) => {
        const aHas = a.asaas_customer_id ? 0 : 1;
        const bHas = b.asaas_customer_id ? 0 : 1;
        return aHas - bHas;
      });

      const total = allOffices.length;
      let synced = 0;
      let notFound = 0;
      let errors = 0;
      let timedOut = false;
      const startTime = Date.now();
      const TIMEOUT_MS = 50000;
      const DELAY_MS = 350;

      for (const office of allOffices) {
        if (Date.now() - startTime > TIMEOUT_MS) {
          timedOut = true;
          console.log(`[ASAAS] Timeout reached after ${synced + notFound + errors}/${total} offices`);
          break;
        }

        let customerId = office.asaas_customer_id;

        // If no cached customer ID, lookup by CNPJ
        if (!customerId) {
          const cnpjDigits = (office.cnpj || "").replace(/\D/g, "");
          if (!cnpjDigits) { notFound++; continue; }

          try {
            await delay(DELAY_MS);
            const customerRes = await asaasGet(`/customers?cpfCnpj=${cnpjDigits}`);
            if (customerRes.data && customerRes.data.length > 0) {
              customerId = customerRes.data[0].id;
              await supabase.from("offices").update({ asaas_customer_id: customerId }).eq("id", office.id);
            } else {
              notFound++;
              continue;
            }
          } catch (e) {
            console.error(`[ASAAS] CNPJ lookup failed for office ${office.id}:`, e);
            errors++;
            continue;
          }
        }

        // Fetch overdue payments
        try {
          await delay(DELAY_MS);
          const result = await asaasGet(`/payments?customer=${customerId}&status=OVERDUE`);
          const overduePayments = result.data || [];
          const overdueCount = overduePayments.length;
          const overdueValue = overduePayments.reduce((s: number, p: any) => s + p.value, 0);
          await supabase.from("offices").update({
            installments_overdue: overdueCount,
            total_overdue_value: overdueValue,
          }).eq("id", office.id);
          synced++;
        } catch (e) {
          console.error(`[ASAAS] Payment sync failed for office ${office.id}:`, e);
          errors++;
        }
      }

      const processed = synced + notFound + errors;
      return jsonResponse({ success: true, synced, notFound, errors, total, timedOut, processed });
    }

    return jsonResponse(
      { error: "Unknown action. Supported: testConnection, searchCustomer, getPayments, syncAll, webhook, getFinancialByOffice" },
      400
    );
  } catch (err) {
    console.error("[ASAAS]", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
