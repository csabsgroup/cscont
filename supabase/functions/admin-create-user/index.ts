import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsErr } = await anonClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claims.claims.sub as string;

    // Check admin role
    const { data: isAdmin } = await anonClient.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    const { data: isManager } = await anonClient.rpc("has_role", {
      _user_id: callerId,
      _role: "manager",
    });
    const { data: isCSM } = await anonClient.rpc("has_role", {
      _user_id: callerId,
      _role: "csm",
    });

    if (!isAdmin && !isManager && !isCSM) {
      return new Response(
        JSON.stringify({ error: "Forbidden: admin, manager or csm required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { email, password, full_name, role, office_id } = await req.json();

    if (!email || !password || !role) {
      return new Response(
        JSON.stringify({ error: "email, password, and role are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Managers can only create CSM and client roles
    if (isManager && !isAdmin && !["csm", "client"].includes(role)) {
      return new Response(
        JSON.stringify({ error: "Managers can only create CSM or client users" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use service role to create user
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: newUser, error: createErr } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name || email },
      });

    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;

    // Assign role
    await adminClient
      .from("user_roles")
      .insert({ user_id: userId, role });

    // If client, link to office
    if (role === "client" && office_id) {
      await adminClient
        .from("client_office_links")
        .insert({ user_id: userId, office_id });
    }

    // If CSM and caller is manager, create manager_csm_link
    if (role === "csm" && isManager) {
      await adminClient
        .from("manager_csm_links")
        .insert({ manager_id: callerId, csm_id: userId });
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[ADMIN-CREATE-USER]", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
