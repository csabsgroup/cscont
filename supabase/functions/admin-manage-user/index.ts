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

    const { data: isAdmin } = await anonClient.rpc("has_role", { _user_id: callerId, _role: "admin" });
    const { data: isManager } = await anonClient.rpc("has_role", { _user_id: callerId, _role: "manager" });
    const { data: isCSM } = await anonClient.rpc("has_role", { _user_id: callerId, _role: "csm" });

    if (!isAdmin && !isManager && !isCSM) {
      return new Response(JSON.stringify({ error: "Forbidden: admin, manager or csm required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action } = body;

    // ─── LIST ────────────────────────────────────────────────
    if (action === "list") {
      const { data: authUsers, error: listErr } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (listErr) {
        return new Response(JSON.stringify({ error: listErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const users = (authUsers?.users || []).map((u: any) => ({
        id: u.id,
        email: u.email,
        banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
        last_sign_in: u.last_sign_in_at,
        created_at: u.created_at,
      }));

      return new Response(JSON.stringify({ users }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions need user_id
    const { user_id } = body;
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-modification for destructive actions
    if (user_id === callerId && ["deactivate", "delete"].includes(action)) {
      return new Response(JSON.stringify({ error: "Cannot perform this action on yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // RBAC: manager can only manage csm/client
    if (isManager && !isAdmin) {
      const { data: targetRole } = await adminClient.from("user_roles").select("role").eq("user_id", user_id).single();
      if (targetRole && !["csm", "client"].includes(targetRole.role)) {
        return new Response(JSON.stringify({ error: "Managers can only manage CSM or client users" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ─── UPDATE PASSWORD ─────────────────────────────────────
    if (action === "update_password") {
      const { password } = body;
      if (!password || password.length < 6) {
        return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await adminClient.auth.admin.updateUserById(user_id, { password });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── DEACTIVATE ──────────────────────────────────────────
    if (action === "deactivate") {
      const { error } = await adminClient.auth.admin.updateUserById(user_id, { ban_duration: "876000h" });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── REACTIVATE ──────────────────────────────────────────
    if (action === "reactivate") {
      const { error } = await adminClient.auth.admin.updateUserById(user_id, { ban_duration: "none" });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── DELETE ──────────────────────────────────────────────
    if (action === "delete") {
      const { error } = await adminClient.auth.admin.deleteUser(user_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── UPDATE PROFILE ─────────────────────────────────────
    if (action === "update_profile") {
      const { full_name, role, product_id } = body;

      if (full_name !== undefined) {
        await adminClient.from("profiles").update({ full_name }).eq("id", user_id);
      }

      if (role) {
        // RBAC check for managers
        if (isManager && !isAdmin && !["csm", "client"].includes(role)) {
          return new Response(JSON.stringify({ error: "Managers can only assign CSM or client roles" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: existing } = await adminClient.from("user_roles").select("id").eq("user_id", user_id).single();
        if (existing) {
          await adminClient.from("user_roles").update({ role }).eq("user_id", user_id);
        } else {
          await adminClient.from("user_roles").insert({ user_id, role });
        }
      }

      if (product_id !== undefined) {
        await adminClient.from("profiles").update({ product_id: product_id || null }).eq("id", user_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action: " + action }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ADMIN-MANAGE-USER]", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
