import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

async function slackApiCall(method: string, body: Record<string, any>) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  if (!SLACK_API_KEY) throw new Error("SLACK_API_KEY not configured — connect Slack in Lovable");

  const res = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SLACK_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(`Slack API ${method} failed: ${JSON.stringify(data)}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody);
    const { action, channel, data } = body;

    // --- Auth: validate JWT and require admin/manager/csm role ---
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
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleCheck } = await supabase.rpc("get_user_role", { _user_id: user.id });
    if (!roleCheck || !["admin", "manager", "csm"].includes(roleCheck)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "testConnection") {
      const result = await slackApiCall("auth.test", {});
      return new Response(
        JSON.stringify({ success: true, team: result.team, user: result.user, bot_id: result.bot_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "listChannels") {
      const result = await slackApiCall("conversations.list", {
        types: "public_channel",
        exclude_archived: true,
        limit: 200,
      });
      const channels = (result.channels || []).map((c: any) => ({ id: c.id, name: c.name }));
      return new Response(JSON.stringify({ channels }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "sendNotification") {
      if (!channel) throw new Error("channel is required");
      const type = data?.type || "generic";
      let blocks: any[];
      let text: string;

      switch (type) {
        case "healthAlert": {
          const { office_name, prev_band, new_band, score, csm_name, link } = data;
          const emoji = new_band === "red" ? "🔴" : new_band === "yellow" ? "🟡" : "🟢";
          text = `${emoji} Health Score Alert — ${office_name} mudou de ${prev_band} para ${new_band}`;
          blocks = [
            { type: "section", text: { type: "mrkdwn", text: `${emoji} *Health Score Alert*\nEscritório *${office_name}* mudou de *${prev_band}* para *${new_band}*\nScore: ${score} | CSM: ${csm_name}` } },
            ...(link ? [{ type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Ver detalhes" }, url: link }] }] : []),
          ];
          break;
        }
        case "churnAlert": {
          const { office_name, status, months_active, health_score, csm_name, link } = data;
          text = `⚠️ Churn Alert — ${office_name} → ${status}`;
          blocks = [
            { type: "section", text: { type: "mrkdwn", text: `⚠️ *Churn Alert*\nEscritório *${office_name}* mudou para status *${status}*\nTempo ativo: ${months_active} meses | Health: ${health_score} | CSM: ${csm_name}` } },
            ...(link ? [{ type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Ver detalhes" }, url: link }] }] : []),
          ];
          break;
        }
        case "bonusAlert": {
          const { office_name, item_name, quantity, notes, csm_name, link } = data;
          text = `🎁 Nova Solicitação de Bônus — ${office_name}`;
          blocks = [
            { type: "section", text: { type: "mrkdwn", text: `🎁 *Nova Solicitação de Bônus*\nEscritório *${office_name}* solicitou: ${item_name} x${quantity}\n${notes ? `Observação: "${notes}"\n` : ""}CSM: ${csm_name}` } },
            ...(link ? [{ type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Ver solicitação" }, url: link }] }] : []),
          ];
          break;
        }
        case "dailySummary": {
          const { date, active_clients, at_risk, meetings_today, overdue_activities, overdue_invoices, overdue_value, avg_health } = data;
          text = `📊 Resumo Diário — ${date}`;
          blocks = [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `📊 *Resumo Diário — ${date}*\n👥 Clientes ativos: ${active_clients}\n🔴 Em risco: ${at_risk}\n📅 Reuniões hoje: ${meetings_today}\n⏰ Atividades atrasadas: ${overdue_activities}\n💰 Parcelas vencidas: ${overdue_invoices} (R$ ${overdue_value})\n🎯 Health médio: ${avg_health}`,
              },
            },
          ];
          break;
        }
        default: {
          text = data?.message || "Notificação do Contador CEO";
          blocks = [{ type: "section", text: { type: "mrkdwn", text } }];
        }
      }

      await slackApiCall("chat.postMessage", {
        channel,
        text,
        blocks,
        username: "Contador CEO",
        icon_emoji: ":chart_with_upwards_trend:",
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Supported: testConnection, listChannels, sendNotification" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[SLACK]", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
