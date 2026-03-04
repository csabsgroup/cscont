import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

function getSupabase(authHeader?: string) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials not configured");

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  return res.json();
}

async function getValidToken(supabase: any, userId: string): Promise<string> {
  const { data: token } = await supabase
    .from("integration_tokens")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google_calendar")
    .single();

  if (!token) throw new Error("Google Calendar not connected for this user");

  const now = new Date();
  const expiry = new Date(token.token_expiry);

  if (now < expiry) return token.access_token;

  // Refresh
  const refreshed = await refreshAccessToken(token.refresh_token);
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000);

  await supabase
    .from("integration_tokens")
    .update({ access_token: refreshed.access_token, token_expiry: newExpiry.toISOString() })
    .eq("id", token.id);

  return refreshed.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, user_id, data } = await req.json();
    const supabase = getSupabase();

    if (action === "exchangeCode") {
      const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
      const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
      if (!clientId || !clientSecret) throw new Error("Google OAuth credentials not configured");

      const res = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: data.code,
          redirect_uri: data.redirect_uri,
          grant_type: "authorization_code",
        }),
      });
      if (!res.ok) throw new Error(`OAuth exchange failed: ${await res.text()}`);
      const tokens = await res.json();

      // Get user email
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userInfoRes.json();

      const expiry = new Date(Date.now() + tokens.expires_in * 1000);

      await supabase.from("integration_tokens").upsert({
        user_id: data.user_id,
        provider: "google_calendar",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: expiry.toISOString(),
        provider_email: userInfo.email,
      }, { onConflict: "user_id,provider" });

      return new Response(JSON.stringify({ success: true, email: userInfo.email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      await supabase.from("integration_tokens").delete().eq("user_id", user_id).eq("provider", "google_calendar");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "getClientId") {
      const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
      return new Response(JSON.stringify({ client_id: clientId || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "getStatus") {
      const { data: token } = await supabase
        .from("integration_tokens")
        .select("provider_email")
        .eq("user_id", user_id)
        .eq("provider", "google_calendar")
        .single();

      return new Response(JSON.stringify({ connected: !!token, email: token?.provider_email || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "syncMeetings") {
      const accessToken = await getValidToken(supabase, user_id);
      const now = new Date();
      const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const timeMax = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

      const res = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) throw new Error(`Calendar API error: ${await res.text()}`);
      const cal = await res.json();

      return new Response(JSON.stringify({ events: cal.items || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "createEvent") {
      const accessToken = await getValidToken(supabase, user_id);
      const event = {
        summary: data.title,
        description: data.description || "",
        start: { dateTime: data.start_time, timeZone: "America/Sao_Paulo" },
        end: { dateTime: data.end_time, timeZone: "America/Sao_Paulo" },
        attendees: (data.attendees || []).map((email: string) => ({ email })),
      };

      const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events?sendUpdates=all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
      if (!res.ok) throw new Error(`Create event failed: ${await res.text()}`);
      const created = await res.json();

      // Save google_event_id on meeting
      if (data.meeting_id) {
        await supabase.from("meetings").update({ google_event_id: created.id }).eq("id", data.meeting_id);
      }

      return new Response(JSON.stringify({ eventId: created.id, success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "updateEvent") {
      const accessToken = await getValidToken(supabase, user_id);
      const event: any = {};
      if (data.title) event.summary = data.title;
      if (data.start_time) event.start = { dateTime: data.start_time, timeZone: "America/Sao_Paulo" };
      if (data.end_time) event.end = { dateTime: data.end_time, timeZone: "America/Sao_Paulo" };

      const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events/${data.google_event_id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
      if (!res.ok) throw new Error(`Update event failed: ${await res.text()}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "deleteEvent") {
      const accessToken = await getValidToken(supabase, user_id);
      const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events/${data.google_event_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok && res.status !== 410) throw new Error(`Delete event failed: ${await res.text()}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Supported: exchangeCode, disconnect, getStatus, syncMeetings, createEvent, updateEvent, deleteEvent" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[GOOGLE CALENDAR]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
