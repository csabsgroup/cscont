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

async function asaasGet(path: string) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    headers: { access_token: getApiKey() },
  });
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
          const totalOverdue = (result.data || []).reduce((s: number, p: any) => s + p.value, 0);
          for (const office of offices) {
            await supabase.from("offices").update({ asaas_total_overdue: totalOverdue }).eq("id", office.id);
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

      // 1. Buscar CNPJ do escritório
      const { data: office, error: officeErr } = await supabase
        .from("offices")
        .select("id, cnpj, name, asaas_customer_id")
        .eq("id", office_id)
        .single();

      if (officeErr || !office) return jsonResponse({ error: "Escritório não encontrado" }, 404);
      if (!office.cnpj) return jsonResponse({ error: "Escritório sem CNPJ cadastrado", noCnpj: true }, 400);

      // 2. Normalizar CNPJ
      const cnpjDigits = office.cnpj.replace(/\D/g, "");

      // 3. Buscar customer no Asaas pelo CNPJ (ou usar cache)
      let customerId = office.asaas_customer_id;

      if (!customerId) {
        const customerRes = await asaasGet(`/customers?cpfCnpj=${cnpjDigits}`);
        if (customerRes.data && customerRes.data.length > 0) {
          customerId = customerRes.data[0].id;
          await supabase.from("offices").update({ asaas_customer_id: customerId }).eq("id", office_id);
        } else {
          return jsonResponse({
            error: "Cliente não encontrado no Asaas",
            cnpj: office.cnpj,
            notFound: true,
          }, 404);
        }
      }

      // 4. Buscar TODAS as cobranças (paginar)
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

      // 5. Classificar
      const now = new Date();
      const today = now.toISOString().split("T")[0];

      const classified = allPayments.map((p: any) => {
        const dueDate = new Date(p.dueDate);
        const isPaid = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(p.status);
        const isCancelled = ["REFUNDED", "REFUND_REQUESTED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL", "DUNNING_REQUESTED", "DUNNING_RECEIVED"].includes(p.status);
        const isOverdue = !isPaid && !isCancelled && p.dueDate < today;
        const isPending = !isPaid && !isCancelled && !isOverdue;

        let daysOverdue = 0;
        if (isOverdue) {
          daysOverdue = Math.ceil((now.getTime() - dueDate.getTime()) / 86400000);
        }

        return {
          id: p.id,
          value: p.value,
          netValue: p.netValue,
          dueDate: p.dueDate,
          paymentDate: p.paymentDate || p.confirmedDate,
          status: p.status,
          billingType: p.billingType,
          description: p.description,
          invoiceUrl: p.invoiceUrl,
          bankSlipUrl: p.bankSlipUrl,
          isPaid,
          isOverdue,
          isPending,
          isCancelled,
          daysOverdue,
          statusLabel: translateAsaasStatus(p.status),
        };
      });

      // 6. Resumo
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
        countPaid: paid.length,
        countOverdue: overdue.length,
        countPending: pending.length,
        countCancelled: cancelled.length,
        nextPayment: sortedPending[0] || null,
        oldestOverdue: sortedOverdue[0] || null,
      };

      // 7. Atualizar inadimplência no escritório
      await supabase.from("offices").update({
        installments_overdue: overdue.length,
        total_overdue_value: summary.totalOverdue,
      }).eq("id", office_id);

      return jsonResponse({
        customer_id: customerId,
        office_id,
        cnpj: office.cnpj,
        summary,
        payments: classified.sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
      });
    }

    // ─── Existing actions ───

    if (action === "testConnection") {
      const result = await asaasGet("/finance/balance");
      return jsonResponse({ success: true, balance: result.balance, totalBalance: result.totalBalance });
    }

    if (action === "searchCustomer") {
      const { query } = body;
      const result = await asaasGet(`/customers?name=${encodeURIComponent(query)}`);
      return jsonResponse({ customers: result.data || [] });
    }

    if (action === "getPayments") {
      const { customer_id } = body;
      if (!customer_id) throw new Error("customer_id is required");
      const result = await asaasGet(`/payments?customer=${customer_id}&limit=50&sort=dueDate&order=desc`);
      const payments = (result.data || []).map((p: any) => ({
        id: p.id,
        value: p.value,
        netValue: p.netValue,
        dueDate: p.dueDate,
        paymentDate: p.paymentDate,
        status: p.status,
        billingType: p.billingType,
        description: p.description,
      }));
      const overduePayments = payments.filter((p: any) => p.status === "OVERDUE");
      const totalOverdue = overduePayments.reduce((s: number, p: any) => s + p.value, 0);

      return jsonResponse({ payments, totalOverdue, overdueCount: overduePayments.length });
    }

    if (action === "syncAll") {
      const { data: offices } = await supabase
        .from("offices")
        .select("id, asaas_customer_id")
        .not("asaas_customer_id", "is", null);

      let synced = 0;
      for (const office of offices || []) {
        try {
          const result = await asaasGet(`/payments?customer=${office.asaas_customer_id}&status=OVERDUE`);
          const totalOverdue = (result.data || []).reduce((s: number, p: any) => s + p.value, 0);
          await supabase.from("offices").update({ asaas_total_overdue: totalOverdue }).eq("id", office.id);
          synced++;
        } catch (e) {
          console.error(`[ASAAS] Sync failed for office ${office.id}:`, e);
        }
      }

      return jsonResponse({ success: true, synced });
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
