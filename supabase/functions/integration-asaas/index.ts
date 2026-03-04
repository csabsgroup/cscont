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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "testConnection") {
      const result = await asaasGet("/finance/balance");
      return new Response(
        JSON.stringify({ success: true, balance: result.balance, totalBalance: result.totalBalance }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "searchCustomer") {
      const { query } = body;
      const result = await asaasGet(`/customers?name=${encodeURIComponent(query)}`);
      return new Response(
        JSON.stringify({ customers: result.data || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      const overdue = payments.filter((p: any) => p.status === "OVERDUE");
      const totalOverdue = overdue.reduce((s: number, p: any) => s + p.value, 0);

      return new Response(
        JSON.stringify({ payments, totalOverdue, overdueCount: overdue.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "syncAll") {
      // Sync all offices with asaas_customer_id
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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

      return new Response(
        JSON.stringify({ success: true, synced }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Webhook handler
    if (action === "webhook") {
      const { event, payment } = body;
      if (payment?.customer) {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data: offices } = await supabase
          .from("offices")
          .select("id")
          .eq("asaas_customer_id", payment.customer);

        if (offices?.length) {
          // Recalculate overdue for this customer
          const result = await asaasGet(`/payments?customer=${payment.customer}&status=OVERDUE`);
          const totalOverdue = (result.data || []).reduce((s: number, p: any) => s + p.value, 0);
          for (const office of offices) {
            await supabase.from("offices").update({ asaas_total_overdue: totalOverdue }).eq("id", office.id);
          }
        }
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Supported: testConnection, searchCustomer, getPayments, syncAll, webhook" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[ASAAS]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
