import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getCredentials() {
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneId) throw new Error("WhatsApp credentials not configured (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID)");
  return { token, phoneId };
}

const GRAPH_API = "https://graph.facebook.com/v18.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "testConnection") {
      const { token, phoneId } = getCredentials();
      const res = await fetch(`${GRAPH_API}/${phoneId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`WhatsApp API error: ${await res.text()}`);
      const data = await res.json();
      return new Response(
        JSON.stringify({ success: true, profile: data.data?.[0] || {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "sendTemplate") {
      const { token, phoneId } = getCredentials();
      const { to, template_name, language, components, office_id, contact_id } = body;

      const res = await fetch(`${GRAPH_API}/${phoneId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: template_name,
            language: { code: language || "pt_BR" },
            components: components || [],
          },
        }),
      });

      if (!res.ok) throw new Error(`WhatsApp send failed: ${await res.text()}`);
      const result = await res.json();
      const wamid = result.messages?.[0]?.id;

      // Log message
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase.from("whatsapp_messages").insert({
        office_id: office_id || null,
        contact_id: contact_id || null,
        direction: "sent",
        message_type: "template",
        template_name,
        phone_to: to,
        wamid,
        status: "sent",
      });

      return new Response(
        JSON.stringify({ success: true, wamid }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "logNote") {
      const { office_id, contact_id, content, direction, phone_to, phone_from } = body;
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      await supabase.from("whatsapp_messages").insert({
        office_id,
        contact_id: contact_id || null,
        direction: direction || "sent",
        message_type: "manual",
        content,
        phone_to: phone_to || null,
        phone_from: phone_from || null,
        status: "logged",
      });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "webhook") {
      // Receive incoming messages from WhatsApp webhook
      const { entry } = body;
      if (!entry?.length) {
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      for (const e of entry) {
        for (const change of e.changes || []) {
          const messages = change.value?.messages || [];
          for (const msg of messages) {
            // Try to find office by phone
            const phone = msg.from;
            const { data: contacts } = await supabase
              .from("contacts")
              .select("id, office_id")
              .eq("phone", phone)
              .limit(1);

            await supabase.from("whatsapp_messages").insert({
              office_id: contacts?.[0]?.office_id || null,
              contact_id: contacts?.[0]?.id || null,
              direction: "received",
              message_type: "incoming",
              content: msg.text?.body || msg.type,
              phone_from: phone,
              wamid: msg.id,
              status: "received",
            });
          }

          // Status updates
          const statuses = change.value?.statuses || [];
          for (const s of statuses) {
            await supabase
              .from("whatsapp_messages")
              .update({ status: s.status })
              .eq("wamid", s.id);
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Supported: testConnection, sendTemplate, logNote, webhook" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[WHATSAPP]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
