import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, to, subject, body, office_id } = await req.json();

    // STUB: Return mock success
    console.log(`[EMAIL STUB] action=${action}, to=${to}, subject=${subject}`);

    if (action === "sendEmail") {
      const mockMessageId = crypto.randomUUID();

      // If office_id provided, log as activity
      if (office_id) {
        const sc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        console.log(`[EMAIL STUB] Would log email activity for office ${office_id}`);
      }

      return new Response(
        JSON.stringify({ success: true, messageId: mockMessageId, stub: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Supported: sendEmail" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
