const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, office_id } = await req.json();

    console.log(`[ASAAS STUB] action=${action}, office_id=${office_id}`);

    if (action === "getInvoices") {
      return new Response(
        JSON.stringify({
          invoices: [
            { id: "mock-1", value: 1500, due_date: "2026-03-15", status: "paid" },
            { id: "mock-2", value: 1500, due_date: "2026-04-15", status: "pending" },
          ],
          stub: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "getOverdue") {
      return new Response(
        JSON.stringify({ invoices: [], total_overdue: 0, stub: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Supported: getInvoices, getOverdue" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
