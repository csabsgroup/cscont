import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIREFLIES_API = "https://api.fireflies.ai/graphql";

function getApiKey() {
  const key = Deno.env.get("FIREFLIES_API_KEY");
  if (!key) throw new Error("FIREFLIES_API_KEY not configured");
  return key;
}

async function firefliesQuery(query: string, variables?: Record<string, any>) {
  const res = await fetch(FIREFLIES_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Fireflies API error [${res.status}]: ${await res.text()}`);
  const result = await res.json();
  if (result.errors) throw new Error(`Fireflies GraphQL error: ${JSON.stringify(result.errors)}`);
  return result.data;
}

async function authenticateRequest(req: Request): Promise<{ userId: string } | Response> {
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
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const serviceClient = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roleCheck } = await serviceClient.rpc("get_user_role", { _user_id: user.id });
  if (!roleCheck || !["admin", "manager", "csm"].includes(roleCheck)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return { userId: user.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    const { action } = body;

    // Webhook action — called by external Fireflies service, no JWT
    if (action === "webhook") {
      const { meeting_id: fireflies_id, title, date, transcript, summary, action_items, attendees } = body;

      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      let matched = false;
      let matchedMeetingId: string | null = null;

      if (title) {
        const { data: meetings } = await supabase
          .from("meetings")
          .select("id, title, office_id, scheduled_at")
          .order("scheduled_at", { ascending: false })
          .limit(50);

        if (meetings?.length) {
          const titleLower = title.toLowerCase();
          for (const m of meetings) {
            if (titleLower.includes(m.title.toLowerCase()) || m.title.toLowerCase().includes(titleLower)) {
              matchedMeetingId = m.id;
              matched = true;
              break;
            }
          }

          if (!matched && date) {
            const transcriptDate = new Date(date).getTime();
            for (const m of meetings) {
              const meetingDate = new Date(m.scheduled_at).getTime();
              if (Math.abs(transcriptDate - meetingDate) < 30 * 60 * 1000) {
                matchedMeetingId = m.id;
                matched = true;
                break;
              }
            }
          }
        }
      }

      await supabase.from("meeting_transcripts").insert({
        meeting_id: matchedMeetingId,
        fireflies_meeting_id: fireflies_id || null,
        title: title || "Untitled",
        date: date ? new Date(date).toISOString() : new Date().toISOString(),
        transcript: transcript || "",
        summary: summary || "",
        action_items: action_items || [],
        attendees: attendees || [],
        matched,
      });

      return new Response(
        JSON.stringify({ success: true, matched, meeting_id: matchedMeetingId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // All other actions require authentication
    const authResult = await authenticateRequest(req);
    if (authResult instanceof Response) return authResult;

    if (action === "testConnection") {
      const data = await firefliesQuery(`{ user { name email } }`);
      return new Response(
        JSON.stringify({ success: true, user: data.user }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "getTranscript") {
      const { meeting_id } = body;
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data } = await supabase
        .from("meeting_transcripts")
        .select("*")
        .eq("meeting_id", meeting_id)
        .single();

      return new Response(
        JSON.stringify({ transcript: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Supported: testConnection, webhook, getTranscript" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[FIREFLIES]", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
