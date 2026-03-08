import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Variable Substitution ───────────────────────────────────
function resolveVariables(template: string, office: any, csm: any, extra?: Record<string, any>): string {
  if (!template) return template;
  return template
    .replace(/\{\{escritorio\}\}/g, office?.name || '')
    .replace(/\{\{produto\}\}/g, office?.product_name || office?.products?.name || '')
    .replace(/\{\{csm\}\}/g, csm?.full_name || 'Não atribuído')
    .replace(/\{\{health_score\}\}/g, extra?.health_score?.toString() || '--')
    .replace(/\{\{health_faixa\}\}/g, extra?.health_band || '--')
    .replace(/\{\{status\}\}/g, office?.status || '')
    .replace(/\{\{etapa\}\}/g, extra?.stage_name || '--')
    .replace(/\{\{parcelas_vencidas\}\}/g, extra?.installments_overdue?.toString() || '0')
    .replace(/\{\{dias_renovacao\}\}/g, extra?.days_to_renewal?.toString() || '--')
    .replace(/\{\{data_hoje\}\}/g, new Date().toLocaleDateString('pt-BR'))
    .replace(/\{\{mrr\}\}/g, office?.mrr?.toString() || office?.faturamento_mensal?.toString() || '0')
    .replace(/\{\{nps\}\}/g, office?.last_nps?.toString() || '--')
    .replace(/\{\{ltv\}\}/g, extra?.ltv?.toString() || '0');
}

// ─── Action Handlers ─────────────────────────────────────────
async function handleAction(supabase: any, action: any, office_id: string, office: any, assignedCsm: string | null, userId: string, csmProfile: any, dryRun = false) {
  const c = action.config || {};

  // Resolve variables in text fields
  const resolveText = (text: string) => resolveVariables(text, office, csmProfile);

  switch (action.type) {
    case "create_activity": {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (parseInt(c.due_days) || 0));
      const payload = {
        title: resolveText(c.title || "Atividade automática"),
        type: c.activity_type || "task",
        description: resolveText(c.description || ""),
        office_id,
        user_id: assignedCsm || userId,
        due_date: dueDate.toISOString().split("T")[0],
        priority: c.priority || "medium",
      };
      if (dryRun) return { type: "create_activity", would_create: payload };
      const { data: act, error: actErr } = await supabase.from("activities").insert(payload).select("id").single();
      if (actErr) {
        console.error('[AUTOMATIONS] Activity insert error:', actErr.message, 'payload:', JSON.stringify(payload));
        return { type: "create_activity", error: actErr.message };
      }
      return { type: "create_activity", id: act?.id };
    }

    case "move_stage":
    case "move_journey_stage": {
      if (c.stage_id) {
        if (!dryRun) {
          await supabase.from("office_journey").upsert({
            office_id,
            journey_stage_id: c.stage_id,
            entered_at: new Date().toISOString(),
          }, { onConflict: "office_id" });
        }
      }
      return { type: "move_stage", stage_id: c.stage_id };
    }

    case "change_status": {
      if (c.new_status) {
        if (!dryRun) {
          await supabase.from("offices").update({ status: c.new_status }).eq("id", office_id);
        }
      }
      return { type: "change_status", new_status: c.new_status };
    }

    case "send_notification": {
      const recipientId = c.recipient === "csm" ? assignedCsm : userId;
      if (recipientId && !dryRun) {
        const { error: notifErr } = await supabase.from("notifications").insert({
          user_id: recipientId,
          title: resolveText(c.title || "Notificação automática"),
          message: resolveText(c.message || ""),
          type: "info",
          entity_type: "office",
          entity_id: office_id,
        });
        if (notifErr) {
          console.error('[AUTOMATIONS] Notification insert error:', notifErr.message);
          return { type: "send_notification", error: notifErr.message };
        }
      }
      return { type: "send_notification" };
    }

    case "send_email": {
      if (!dryRun) {
        try {
          // Resolve recipient email
          let toEmail: string | null = null;
          if (c.recipient === 'cliente') {
            toEmail = office?.email;
          } else if (c.recipient === 'contato_principal') {
            const { data: mainContact } = await supabase.from('contacts')
              .select('email').eq('office_id', office_id).eq('is_main_contact', true).limit(1).maybeSingle();
            toEmail = mainContact?.email || null;
          } else if (c.recipient === 'csm' || !c.recipient) {
            // Default: resolve CSM email from profiles
            if (office?.csm_id) {
              const { data: csmProfile } = await supabase.from('profiles')
                .select('id').eq('id', office.csm_id).maybeSingle();
              // profiles doesn't have email, get from auth via user metadata
              const { data: { users } } = await supabase.auth.admin.listUsers();
              const csmUser = users?.find((u: any) => u.id === office.csm_id);
              toEmail = csmUser?.email || null;
            }
          }
          const subject = resolveText(c.subject || '');
          const body = resolveText(c.body || '');

          if (!toEmail) {
            console.warn('[AUTOMATIONS] Email skipped: no recipient resolved');
            return { type: "send_email", error: "No recipient email resolved" };
          }

          const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
          if (!RESEND_API_KEY) {
            console.error('[AUTOMATIONS] RESEND_API_KEY not configured');
            return { type: "send_email", error: "Email provider not configured" };
          }

          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Contador CEO <onboarding@resend.dev>",
              to: [toEmail],
              subject,
              html: body.replace(/\n/g, '<br/>'),
            }),
          });

          const emailData = await emailRes.json();
          if (!emailRes.ok) {
            console.error('[AUTOMATIONS] Resend API error:', JSON.stringify(emailData));
            return { type: "send_email", error: `Email API error: ${emailRes.status}` };
          }
          console.log(`[AUTOMATIONS] Email sent to ${toEmail}, id=${emailData.id}`);
        } catch (e) {
          console.error('[AUTOMATIONS] Email failed:', e);
          return { type: "send_email", error: String(e) };
        }
      }
      return { type: "send_email" };
    }

    case "send_slack": {
      if (!dryRun) {
        try {
          const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
          const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
          if (!LOVABLE_API_KEY || !SLACK_API_KEY) {
            console.error('[AUTOMATIONS] Slack keys not configured');
            return { type: "send_slack", error: "Slack not configured (missing API keys)" };
          }

          // Get channel from integration_settings
          const { data: slackSetting } = await supabase.from('integration_settings')
            .select('config').eq('provider', 'slack').maybeSingle();
          const channelId = slackSetting?.config?.channel_id;
          if (!channelId) {
            console.error('[AUTOMATIONS] Slack channel not configured in integration_settings');
            return { type: "send_slack", error: "Slack channel not configured" };
          }

          const message = resolveText(c.message || `Automação executada para ${office?.name}`);
          const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";
          const slackRes = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": SLACK_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              channel: channelId,
              text: message,
              username: "Contador CEO",
              icon_emoji: ":chart_with_upwards_trend:",
            }),
          });
          const slackData = await slackRes.json();
          if (!slackRes.ok || !slackData.ok) {
            console.error('[AUTOMATIONS] Slack API error:', JSON.stringify(slackData));
            return { type: "send_slack", error: `Slack API error: ${slackData.error || slackRes.status}` };
          }
          console.log('[AUTOMATIONS] Slack message sent to', channelId);
        } catch (e) {
          console.error('[AUTOMATIONS] Slack failed:', e);
          return { type: "send_slack", error: String(e) };
        }
      }
      return { type: "send_slack" };
    }

    case "send_whatsapp": {
      if (!dryRun) {
        try {
          await supabase.functions.invoke('integration-whatsapp', {
            body: {
              action: 'sendMessage',
              to: c.phone || office?.whatsapp || office?.phone,
              message: resolveText(c.message || ''),
              office_id,
            },
          });
        } catch (e) {
          console.error('[AUTOMATIONS] WhatsApp failed:', e);
          return { type: "send_whatsapp", error: String(e) };
        }
      }
      return { type: "send_whatsapp" };
    }

    case "create_action_plan": {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (parseInt(c.due_days) || 7));
      if (!dryRun) {
        const { error: apErr } = await supabase.from("action_plans").insert({
          title: resolveText(c.title || "Plano de ação automático"),
          description: resolveText(c.description || ""),
          office_id,
          created_by: assignedCsm || userId,
          due_date: dueDate.toISOString().split("T")[0],
        });
        if (apErr) {
          console.error('[AUTOMATIONS] Action plan insert error:', apErr.message);
          return { type: "create_action_plan", error: apErr.message };
        }
      }
      return { type: "create_action_plan" };
    }

    case "change_csm": {
      let newCsmId: string | null = null;
      if (c.method === "fixed" && c.fixed_csm_id) {
        newCsmId = c.fixed_csm_id;
      } else if (c.method === "least_clients") {
        const eligible = c.eligible_csm_ids || [];
        if (eligible.length > 0) {
          const { data: offices } = await supabase.from("offices").select("csm_id").in("csm_id", eligible);
          const counts: Record<string, number> = {};
          eligible.forEach((id: string) => { counts[id] = 0; });
          (offices || []).forEach((o: any) => { if (o.csm_id && counts[o.csm_id] !== undefined) counts[o.csm_id]++; });
          newCsmId = eligible.reduce((a: string, b: string) => (counts[a] || 0) <= (counts[b] || 0) ? a : b);
        }
      } else if (c.method === "round_robin") {
        const eligible = c.eligible_csm_ids || [];
        if (eligible.length > 0) {
          const hash = office_id.split("").reduce((acc: number, ch: string) => acc + ch.charCodeAt(0), 0);
          newCsmId = eligible[hash % eligible.length];
        }
      }
      if (newCsmId && !dryRun) {
        await supabase.from("offices").update({ csm_id: newCsmId }).eq("id", office_id);
      }
      return { type: "change_csm", csm_id: newCsmId };
    }

    case "create_contract": {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + (parseInt(c.start_days) || 0));
      const endDate = c.duration_days ? new Date(startDate.getTime() + parseInt(c.duration_days) * 86400000) : null;
      const renewalDate = c.renewal_days ? new Date(startDate.getTime() + parseInt(c.renewal_days) * 86400000) : null;
      if (!dryRun) {
        await supabase.from("contracts").insert({
          office_id,
          product_id: c.product_id,
          status: c.status || "pendente",
          value: c.value ? parseFloat(c.value) : null,
          monthly_value: c.monthly_value ? parseFloat(c.monthly_value) : null,
          start_date: startDate.toISOString().split("T")[0],
          end_date: endDate ? endDate.toISOString().split("T")[0] : null,
          renewal_date: renewalDate ? renewalDate.toISOString().split("T")[0] : null,
        });
      }
      return { type: "create_contract" };
    }

    case "cancel_contract": {
      const newStatus = c.cancel_action || "cancelado";
      if (c.target_product_id && !dryRun) {
        await supabase.from("contracts")
          .update({ status: newStatus, end_date: new Date().toISOString().split("T")[0] })
          .eq("office_id", office_id)
          .eq("product_id", c.target_product_id)
          .in("status", ["ativo", "pendente"]);
      }
      return { type: "cancel_contract", status: newStatus };
    }

    case "set_product": {
      if (c.product_id && !dryRun) {
        await supabase.from("offices").update({ active_product_id: c.product_id }).eq("id", office_id);
        const { data: firstStage } = await supabase.from("journey_stages")
          .select("id").eq("product_id", c.product_id).order("position").limit(1).maybeSingle();
        if (firstStage) {
          await supabase.from("office_journey").upsert({
            office_id,
            journey_stage_id: firstStage.id,
            entered_at: new Date().toISOString(),
          }, { onConflict: "office_id" });
        }
      }
      return { type: "set_product", product_id: c.product_id };
    }

    case "add_note": {
      if (!dryRun) {
        const { error: noteErr } = await supabase.from("office_notes").insert({
          office_id,
          note_type: c.note_type || "observacao",
          content: resolveText(c.content || "Nota automática"),
          created_by: assignedCsm || userId,
        });
        if (noteErr) {
          console.error('[AUTOMATIONS] Note insert error:', noteErr.message);
          return { type: "add_note", error: noteErr.message };
        }
      }
      return { type: "add_note" };
    }

    case "grant_bonus": {
      if (c.catalog_item_id && !dryRun) {
        const qty = parseInt(c.quantity) || 1;
        const validityDays = parseInt(c.validity_days) || 90;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + validityDays);
        await supabase.from("bonus_grants").insert({
          office_id,
          catalog_item_id: c.catalog_item_id,
          quantity: qty,
          available: qty,
          expires_at: expiresAt.toISOString(),
        });
      }
      return { type: "grant_bonus" };
    }

    case "create_meeting": {
      if (!dryRun) {
        const scheduledAt = new Date();
        scheduledAt.setDate(scheduledAt.getDate() + (parseInt(c.days_from_now) || 1));
        await supabase.from("meetings").insert({
          office_id,
          user_id: assignedCsm || userId,
          title: resolveText(c.title || "Reunião automática"),
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: parseInt(c.duration_minutes) || 30,
        });
      }
      return { type: "create_meeting" };
    }

    case "force_health_band": {
      if (c.band && !dryRun) {
        const { error: hsErr } = await supabase.from("health_scores").upsert({
          office_id,
          band: c.band,
          score: c.band === 'red' ? 0 : c.band === 'yellow' ? 50 : 100,
          calculated_at: new Date().toISOString(),
        }, { onConflict: "office_id" });
        if (hsErr) {
          console.error('[AUTOMATIONS] force_health_band error:', hsErr.message);
          return { type: "force_health_band", error: hsErr.message };
        }
      }
      return { type: "force_health_band", band: c.band };
    }

    case "create_alert": {
      if (!dryRun) {
        const recipientId = assignedCsm || userId;
        await supabase.from("notifications").insert({
          user_id: recipientId,
          title: resolveText(c.title || "⚠️ Atenção Hoje"),
          message: resolveText(c.message || `Alerta automático para ${office?.name}`),
          type: "warning",
          entity_type: "office",
          entity_id: office_id,
        });
      }
      return { type: "create_alert" };
    }

    case "apply_playbook": {
      if (c.playbook_id && !dryRun) {
        try {
          const { data: playbook, error: pbErr } = await supabase
            .from('playbook_templates')
            .select('*')
            .eq('id', c.playbook_id)
            .single();
          if (pbErr || !playbook) {
            console.error('[AUTOMATIONS] Playbook not found:', c.playbook_id);
            return { type: "apply_playbook", error: pbErr?.message || 'Playbook not found' };
          }
          const acts = Array.isArray(playbook.activities) ? playbook.activities : [];
          const { data: instance, error: instErr } = await supabase
            .from('playbook_instances')
            .insert({
              playbook_template_id: c.playbook_id,
              office_id,
              applied_by: userId,
              total_activities: acts.length,
              completed_activities: 0,
            })
            .select('id')
            .single();
          if (instErr || !instance) {
            console.error('[AUTOMATIONS] Playbook instance error:', instErr?.message);
            return { type: "apply_playbook", error: instErr?.message || 'Instance creation failed' };
          }
          const now = new Date();
          const activitiesToInsert = acts.map((act: any, index: number) => ({
            title: act.title,
            description: act.description || null,
            type: act.type || 'task',
            priority: act.priority || 'medium',
            office_id,
            user_id: act.responsible_type === 'office_csm' ? (assignedCsm || userId) : userId,
            due_date: new Date(now.getTime() + (act.due_days_offset || 1) * 86400000).toISOString().split('T')[0],
            playbook_instance_id: instance.id,
            playbook_order: index + 1,
          }));
          if (activitiesToInsert.length > 0) {
            const { error: actErr } = await supabase.from('activities').insert(activitiesToInsert);
            if (actErr) {
              console.error('[AUTOMATIONS] Playbook activities error:', actErr.message);
              return { type: "apply_playbook", error: actErr.message };
            }
          }
          console.log(`[AUTOMATIONS] Applied playbook ${playbook.name} to office ${office_id}, ${acts.length} activities created`);
        } catch (e) {
          console.error('[AUTOMATIONS] apply_playbook failed:', e);
          return { type: "apply_playbook", error: String(e) };
        }
      }
      return { type: "apply_playbook" };
    }

    default:
      return { type: action.type, skipped: true };
  }
}

// ─── Condition Evaluation Helpers ─────────────────────────────
function daysBetween(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / 86400000);
}

async function resolveConditionValue(supabase: any, cond: any, office: any, officeId: string) {
  const field = cond.field;

  const officeFieldMap: Record<string, string> = {
    office_name: 'name', office_cnpj: 'cnpj', office_cpf: 'cpf', office_cep: 'cep',
    office_address: 'address', office_city: 'city', office_state: 'state',
    office_segment: 'segment', office_instagram: 'instagram', office_whatsapp: 'whatsapp',
    office_email: 'email', office_phone: 'phone', office_tags: 'tags',
    office_qtd_clientes: 'qtd_clientes', office_qtd_colaboradores: 'qtd_colaboradores',
    office_faturamento_mensal: 'faturamento_mensal', office_faturamento_anual: 'faturamento_anual',
  };
  if (officeFieldMap[field]) return office?.[officeFieldMap[field]] ?? null;

  if (field.startsWith('contact_')) {
    const contactCol: Record<string, string> = {
      contact_name: 'name', contact_email: 'email', contact_phone: 'phone',
      contact_whatsapp: 'whatsapp', contact_role_title: 'role_title',
      contact_cpf: 'cpf', contact_instagram: 'instagram', contact_type: 'contact_type',
    };
    const col = contactCol[field];
    if (!col) return null;
    const scope = cond.contact_scope || 'main';
    let q = supabase.from('contacts').select(col).eq('office_id', officeId);
    if (scope === 'main') q = q.eq('is_main_contact', true);
    const { data } = await q;
    if (!data || data.length === 0) return null;
    if (scope === 'any') return data.map((r: any) => r[col]).filter((v: any) => v != null);
    return data[0]?.[col] ?? null;
  }

  if (field.startsWith('contract_') || field === 'installments_overdue' || field === 'installments_total') {
    const { data: contracts } = await supabase.from('contracts').select('*')
      .eq('office_id', officeId).order('created_at', { ascending: false }).limit(1);
    const contract = contracts?.[0];
    if (!contract) return null;
    const contractFieldMap: Record<string, any> = {
      contract_status: contract.status,
      contract_monthly_value: contract.monthly_value,
      contract_total_value: contract.value,
      installments_overdue: contract.installments_overdue,
      installments_total: contract.installments_total,
      contract_start_date: daysBetween(contract.start_date),
      contract_end_date: daysUntil(contract.end_date),
      contract_renewal_date: daysUntil(contract.renewal_date),
      contract_product_id: contract.product_id,
      contract_negotiation_notes: contract.negotiation_notes,
    };
    return contractFieldMap[field] ?? null;
  }

  if (field.startsWith('cf_')) {
    const slug = field.substring(3);
    const { data: cfData } = await supabase.from('custom_field_values')
      .select('value_text, value_number, value_boolean, value_date, value_json, custom_fields!inner(slug, field_type)')
      .eq('office_id', officeId)
      .eq('custom_fields.slug', slug)
      .limit(1);
    if (!cfData || cfData.length === 0) return null;
    const row = cfData[0];
    const ft = (row as any).custom_fields?.field_type;
    if (ft === 'number' || ft === 'currency' || ft === 'percentage') return row.value_number;
    if (ft === 'boolean') return row.value_boolean;
    if (ft === 'date') return daysBetween(row.value_date);
    if (ft === 'select' || ft === 'multi_select') return row.value_json ?? row.value_text;
    return row.value_text;
  }

  // Common condition field aliases
  if (field === 'product_id') return office?.active_product_id ?? null;
  if (field === 'days_since_creation') return daysBetween(office?.created_at);
  if (field === 'days_since_activation') return daysBetween(office?.activation_date);
  if (field === 'days_since_onboarding') return daysBetween(office?.onboarding_date);
  if (field === 'journey_stage_id') {
    const { data: oj } = await supabase.from('office_journey').select('journey_stage_id').eq('office_id', officeId).maybeSingle();
    return oj?.journey_stage_id ?? null;
  }
  if (field === 'health_score' || field === 'health_band') {
    const { data: hs } = await supabase.from('health_scores').select('score, band').eq('office_id', officeId).maybeSingle();
    return field === 'health_score' ? hs?.score ?? null : hs?.band ?? null;
  }

  return office?.[field] ?? null;
}

function evaluateCondition(resolvedValue: any, operator: string, condValue: any, condValue2?: any): boolean {
  if (Array.isArray(resolvedValue) && !['is_in', 'contains'].includes(operator)) {
    return resolvedValue.some(v => evaluateCondition(v, operator, condValue, condValue2));
  }
  const v = resolvedValue;
  switch (operator) {
    case 'equals': return String(v) === String(condValue);
    case 'not_equals': return String(v) !== String(condValue);
    case 'contains': return String(v ?? '').toLowerCase().includes(String(condValue ?? '').toLowerCase());
    case 'greater_than': case 'days_greater_than': return Number(v) > Number(condValue);
    case 'less_than': case 'days_less_than': return Number(v) < Number(condValue);
    case 'days_equal': return Number(v) === Number(condValue);
    case 'between': return Number(v) >= Number(condValue) && Number(v) <= Number(condValue2);
    case 'is_in': {
      const list = String(condValue).split(',').map(s => s.trim().toLowerCase());
      return list.includes(String(v).toLowerCase());
    }
    case 'is_empty': return v == null || v === '';
    case 'is_not_empty': return v != null && v !== '';
    case 'is_true': return v === true;
    case 'is_false': return v === false;
    default: return true;
  }
}

// ─── Execute v2 rules for a given trigger ────────────────────
async function executeV2Rules(supabase: any, triggerType: string, office_id: string, csm_id: string | null, userId: string, extraContext?: Record<string, any>, dryRun = false) {
  const startTime = Date.now();
  console.log(`[AUTOMATIONS] Trigger received: ${triggerType} for office: ${office_id}${dryRun ? ' (DRY RUN)' : ''}`);

  // If force_rule_id is provided (from runNowAll), only load that specific rule
  let v2Rules: any[];
  if (extraContext?.force_rule_id) {
    const { data } = await supabase
      .from("automation_rules_v2")
      .select("*")
      .eq("id", extraContext.force_rule_id)
      .eq("is_active", true);
    v2Rules = data || [];
  } else {
    const { data } = await supabase
      .from("automation_rules_v2")
      .select("*")
      .eq("trigger_type", triggerType)
      .eq("is_active", true);
    v2Rules = data || [];
  }

  if (!v2Rules || v2Rules.length === 0) {
    console.log(`[AUTOMATIONS] No active rules for trigger: ${triggerType}`);
    return { executed: 0, skipped: 0, errors: 0, results: [] };
  }

  console.log(`[AUTOMATIONS] Found ${v2Rules.length} active rules for trigger: ${triggerType}`);

  const { data: office } = await supabase.from("offices").select("*").eq("id", office_id).single();

  const effectiveCsmId = csm_id || office?.csm_id;
  let csmProfile: any = null;
  if (effectiveCsmId) {
    const { data: p } = await supabase.from("profiles").select("full_name").eq("id", effectiveCsmId).maybeSingle();
    csmProfile = p;
  }

  const results: any[] = [];
  let executed = 0, skipped = 0, errors = 0;

  for (const rule of v2Rules) {
    const ruleStart = Date.now();
    console.log(`[AUTOMATIONS] Evaluating rule: "${rule.name}" (id: ${rule.id})`);
    console.log(`[AUTOMATIONS] Rule product_id: ${rule.product_id}, Office product: ${office?.active_product_id}`);

    try {
      // Product scope check
      if (rule.product_id && office?.active_product_id && rule.product_id !== office.active_product_id) {
        console.log(`[AUTOMATIONS] Skipping rule (product mismatch): "${rule.name}"`);
        skipped++;
        if (!dryRun) {
          const { error: logErr } = await supabase.from("automation_logs").insert({
            rule_id: rule.id, rule_name: rule.name, office_id, trigger_type: triggerType,
            conditions_met: false, actions_executed: [], error: 'Product mismatch',
            execution_time_ms: Date.now() - ruleStart,
          });
          if (logErr) console.error('[AUTOMATIONS] Log insert error:', logErr.message);
        }
        continue;
      }

      // Idempotency check
      const contextKey = `${triggerType}_${office_id}_${extraContext?.suffix || ""}`.replace(/_+$/, "");
      if (!dryRun) {
        const { data: existing } = await supabase
          .from("automation_executions")
          .select("id")
          .eq("rule_id", rule.id)
          .eq("office_id", office_id)
          .eq("context_key", contextKey)
          .maybeSingle();
        if (existing) {
          console.log(`[AUTOMATIONS] Skipping rule (already executed): "${rule.name}"`);
          skipped++;
          continue;
        }
      }

      // Evaluate conditions
      const conditionsPayload = rule.conditions as any;
      const groups = conditionsPayload?.groups || (Array.isArray(conditionsPayload) ? [{ logic: rule.condition_logic || 'and', conditions: conditionsPayload }] : []);
      const groupLogic = conditionsPayload?.logic || rule.condition_logic || 'and';

      console.log(`[AUTOMATIONS] Conditions: ${JSON.stringify(conditionsPayload)?.substring(0, 200)}`);

      let ruleMatches = true;
      if (groups.length > 0) {
        const groupResults: boolean[] = [];
        for (const group of groups) {
          const conds = group.conditions || [];
          if (conds.length === 0) { groupResults.push(true); continue; }
          const condResults: boolean[] = [];
          for (const cond of conds) {
            if (!cond.field || !cond.operator) { condResults.push(true); continue; }
            const resolved = await resolveConditionValue(supabase, cond, office, office_id);
            const condResult = evaluateCondition(resolved, cond.operator, cond.value, cond.value2);
            console.log(`[AUTOMATIONS] Condition: ${cond.field} ${cond.operator} ${cond.value} → resolved=${JSON.stringify(resolved)}, result=${condResult}`);
            condResults.push(condResult);
          }
          const groupMatch = (group.logic || 'and') === 'and' ? condResults.every(Boolean) : condResults.some(Boolean);
          groupResults.push(groupMatch);
        }
        ruleMatches = groupLogic === 'and' ? groupResults.every(Boolean) : groupResults.some(Boolean);
      }

      console.log(`[AUTOMATIONS] Conditions met: ${ruleMatches}`);

      if (!ruleMatches) {
        console.log(`[AUTOMATIONS] Skipping rule (conditions not met): "${rule.name}"`);
        skipped++;
        if (!dryRun) {
          const { error: logErr } = await supabase.from("automation_logs").insert({
            rule_id: rule.id, rule_name: rule.name, office_id, trigger_type: triggerType,
            conditions_met: false, actions_executed: [],
            execution_time_ms: Date.now() - ruleStart,
          });
          if (logErr) console.error('[AUTOMATIONS] Log insert error:', logErr.message);
        }
        continue;
      }

      // Execute actions
      const actions = (rule.actions as any[]) || [];
      const assignedCsm = effectiveCsmId;
      const actionResults: any[] = [];

      console.log(`[AUTOMATIONS] Executing ${actions.length} actions for rule: "${rule.name}"`);

      for (const action of actions) {
        try {
          console.log(`[AUTOMATIONS] Executing action: ${action.type} ${JSON.stringify(action.config)?.substring(0, 150)}`);
          const result = await handleAction(supabase, action, office_id, office, assignedCsm, userId, csmProfile, dryRun);
          actionResults.push(result);
          console.log(`[AUTOMATIONS] Action SUCCESS: ${action.type}`);
        } catch (actionErr: any) {
          console.error(`[AUTOMATIONS] Action FAILED: ${action.type}`, actionErr?.message);
          actionResults.push({ type: action.type, error: actionErr?.message || String(actionErr) });
        }
      }

      if (!dryRun) {
        const { error: execErr } = await supabase.from("automation_executions").insert({
          rule_id: rule.id, office_id, context_key: contextKey,
          result: { trigger: triggerType, actions: actionResults },
        });
        if (execErr) console.error('[AUTOMATIONS] Execution insert error:', execErr.message);

        const { error: logErr } = await supabase.from("automation_logs").insert({
          rule_id: rule.id, rule_name: rule.name, office_id, trigger_type: triggerType,
          conditions_met: true, actions_executed: actionResults,
          execution_time_ms: Date.now() - ruleStart,
        });
        if (logErr) console.error('[AUTOMATIONS] Log insert error:', logErr.message);
      }

      executed++;
      results.push({ rule_id: rule.id, rule_name: rule.name, actions: actionResults });
      console.log(`[AUTOMATIONS] Rule executed successfully: "${rule.name}"`);
    } catch (ruleErr: any) {
      errors++;
      console.error(`[AUTOMATIONS] Rule "${rule.name}" (${rule.id}) FAILED:`, ruleErr?.message);
      if (!dryRun) {
        const { error: logErr } = await supabase.from("automation_logs").insert({
          rule_id: rule.id, rule_name: rule.name, office_id, trigger_type: triggerType,
          conditions_met: false, actions_executed: [],
          error: ruleErr?.message || String(ruleErr),
          execution_time_ms: Date.now() - ruleStart,
        });
        if (logErr) console.error('[AUTOMATIONS] Log insert error:', logErr.message);
      }
    }
  }

  console.log(`[AUTOMATIONS] Summary: executed=${executed}, skipped=${skipped}, errors=${errors}, time=${Date.now() - startTime}ms`);
  return { executed, skipped, errors, results, total_time_ms: Date.now() - startTime };
}

// ─── Periodic Trigger Helpers ─────────────────────────────────
function checkShouldRun(triggerParams: any): boolean {
  if (!triggerParams) return true;
  const lastRun = triggerParams.last_run_at;
  if (!lastRun) return true; // never ran, run now
  const frequency = triggerParams.frequency || 'daily';
  const hoursSinceLast = (Date.now() - new Date(lastRun).getTime()) / 3600000;
  switch (frequency) {
    case 'hourly': return hoursSinceLast >= 1;
    case 'every_6h': return hoursSinceLast >= 6;
    case 'every_12h': return hoursSinceLast >= 12;
    case 'daily': return hoursSinceLast >= 23;
    case 'weekly': return hoursSinceLast >= 167;
    default: return hoursSinceLast >= 23;
  }
}

async function checkRepeatMode(rule: any, officeId: string, supabase: any): Promise<boolean> {
  const mode = rule.trigger_params?.repeat_mode || 'once';
  if (mode === 'always') return true;

  const { data: lastExec } = await supabase
    .from('automation_executions')
    .select('executed_at')
    .eq('rule_id', rule.id)
    .eq('office_id', officeId)
    .order('executed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastExec) return true; // never executed

  if (mode === 'once') return false; // already executed

  if (mode === 'interval') {
    const intervalDays = rule.trigger_params?.repeat_interval_days || 7;
    const daysSinceLast = (Date.now() - new Date(lastExec.executed_at).getTime()) / 86400000;
    return daysSinceLast >= intervalDays;
  }

  return true;
}

async function enrichOfficeData(office: any, supabase: any): Promise<any> {
  const now = new Date();

  // Active contract
  const activeContract = office.contracts?.find((c: any) => c.status === 'ativo') || office.contracts?.[0];

  // Journey stage
  const { data: journeyData } = await supabase
    .from('office_journey')
    .select('journey_stage_id')
    .eq('office_id', office.id)
    .maybeSingle();

  // Health score
  const { data: healthData } = await supabase
    .from('health_scores')
    .select('score, band')
    .eq('office_id', office.id)
    .maybeSingle();

  return {
    ...office,
    // Calculated fields
    days_to_renewal: office.cycle_end_date
      ? Math.ceil((new Date(office.cycle_end_date).getTime() - now.getTime()) / 86400000)
      : null,
    days_without_meeting: office.last_meeting_date
      ? Math.ceil((now.getTime() - new Date(office.last_meeting_date).getTime()) / 86400000)
      : null,
    days_since_creation: Math.ceil((now.getTime() - new Date(office.created_at).getTime()) / 86400000),
    // Contract data
    contract_value: activeContract?.value || null,
    installments_overdue: activeContract?.installments_overdue || office.asaas_total_overdue || 0,
    // Journey
    journey_stage_id: journeyData?.journey_stage_id || null,
    // Health
    health_score: healthData?.score ?? null,
    health_band: healthData?.band || null,
  };
}

// ─── Main Handler ────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(url, serviceRoleKey);
    let userId: string;

    if (token === serviceRoleKey) {
      // Internal service-to-service call (e.g. piperun-webhook)
      console.log('[AUTOMATIONS] Internal service call detected');
      const { data: adminUsers } = await supabase.from('user_roles').select('user_id').eq('role', 'admin').limit(1);
      userId = adminUsers?.[0]?.user_id || '00000000-0000-0000-0000-000000000000';
    } else {
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
      const { data: roleCheck } = await supabase.rpc("get_user_role", { _user_id: user.id });
      if (!roleCheck || !["admin", "manager", "csm"].includes(roleCheck)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    const body = await req.json();
    const { action, office_id, product_id, stage_id, csm_id } = body;

    // ========== triggerV2 (generic trigger) ==========
    if (action === "triggerV2") {
      const { trigger_type, context } = body;
      if (!trigger_type || !office_id) throw new Error("trigger_type and office_id required");

      // For activity.completed trigger, pre-filter rules by trigger_params before executing
      if (trigger_type === 'activity.completed') {
        const { data: actRules } = await supabase
          .from('automation_rules_v2')
          .select('*')
          .eq('trigger_type', 'activity.completed')
          .eq('is_active', true);

        const ctx = context || {};
        const filteredRuleIds: string[] = [];

        for (const rule of (actRules || [])) {
          const params = rule.trigger_params || {};

          // Filter by name
          if (params.name_contains && !ctx.activity_name?.toLowerCase().includes(params.name_contains.toLowerCase())) {
            console.log(`[AUTOMATIONS] activity.completed: skipping rule "${rule.name}" (name mismatch)`);
            continue;
          }

          // Filter by type
          if (params.activity_types?.length > 0 && !params.activity_types.includes(ctx.activity_type)) {
            console.log(`[AUTOMATIONS] activity.completed: skipping rule "${rule.name}" (type mismatch)`);
            continue;
          }

          // Filter by completion timing
          if (params.completion_filter === 'on_time' && ctx.was_late) continue;
          if (params.completion_filter === 'late' && !ctx.was_late) continue;
          if (params.completion_filter === 'late_by_days' && (ctx.days_late || 0) < (params.late_by_days || 0)) continue;

          filteredRuleIds.push(rule.id);
        }

        // Execute each matching rule
        const allResults: any[] = [];
        for (const ruleId of filteredRuleIds) {
          const result = await executeV2Rules(supabase, trigger_type, office_id, csm_id || null, userId, { ...context, force_rule_id: ruleId });
          allResults.push(result);
        }

        return new Response(JSON.stringify({ success: true, rules_checked: (actRules || []).length, rules_matched: filteredRuleIds.length, results: allResults }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const result = await executeV2Rules(supabase, trigger_type, office_id, csm_id || null, userId, context);
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== dryRun ==========
    if (action === "dryRun") {
      const { trigger_type, context } = body;
      if (!trigger_type) throw new Error("trigger_type required");

      let officeQuery = supabase.from("offices").select("id, name, active_product_id, csm_id, status")
        .in("status", ["ativo", "upsell", "bonus_elite"]).limit(5);
      if (body.product_id) officeQuery = officeQuery.eq("active_product_id", body.product_id);
      const { data: testOffices } = await officeQuery;

      const previews: any[] = [];
      for (const off of (testOffices || [])) {
        const result = await executeV2Rules(supabase, trigger_type, off.id, off.csm_id, userId, context, true);
        previews.push({ office_id: off.id, office_name: off.name, ...result });
      }

      return new Response(JSON.stringify({ success: true, previews }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== reachCount ==========
    if (action === "reachCount") {
      let q = supabase.from("offices").select("id", { count: "exact", head: true })
        .in("status", ["ativo", "upsell", "bonus_elite"]);
      if (body.product_id && body.product_id !== '__all__') q = q.eq("active_product_id", body.product_id);
      const { count } = await q;
      return new Response(JSON.stringify({ count: count || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== onNewOffice (legacy v1 + v2) ==========
    if (action === "onNewOffice") {
      if (!office_id || !product_id) throw new Error("office_id and product_id required");

      const { data: distRule } = await supabase
        .from("automation_rules").select("*")
        .eq("product_id", product_id).eq("rule_type", "distribution").eq("is_active", true).maybeSingle();

      if (distRule) {
        const config = distRule.config as any;
        let assignedCsmId: string | null = null;
        if (config.method === "fixed" && config.fixed_csm_id) {
          assignedCsmId = config.fixed_csm_id;
        } else if (config.method === "least_clients") {
          const eligible = config.eligible_csm_ids || [];
          if (eligible.length > 0) {
            const { data: offices } = await supabase.from("offices").select("csm_id").eq("active_product_id", product_id).in("csm_id", eligible);
            const counts: Record<string, number> = {};
            eligible.forEach((id: string) => { counts[id] = 0; });
            (offices || []).forEach((o: any) => { if (o.csm_id && counts[o.csm_id] !== undefined) counts[o.csm_id]++; });
            assignedCsmId = eligible.reduce((a: string, b: string) => (counts[a] || 0) <= (counts[b] || 0) ? a : b);
          }
        } else if (config.method === "round_robin") {
          const eligible = config.eligible_csm_ids || [];
          if (eligible.length > 0) {
            const { data: lastExec } = await supabase.from("automation_executions").select("result")
              .eq("rule_id", distRule.id).order("executed_at", { ascending: false }).limit(1).maybeSingle();
            const lastIndex = (lastExec?.result as any)?.csm_index ?? -1;
            const nextIndex = (lastIndex + 1) % eligible.length;
            assignedCsmId = eligible[nextIndex];
            await supabase.from("automation_executions").insert({
              rule_id: distRule.id, office_id,
              context_key: `distribution_${Date.now()}`,
              result: { csm_index: nextIndex, csm_id: assignedCsmId },
            });
          }
        }
        if (assignedCsmId) {
          await supabase.from("offices").update({ csm_id: assignedCsmId }).eq("id", office_id);
        }
      }

      const { data: onbRule } = await supabase
        .from("automation_rules").select("*")
        .eq("product_id", product_id).eq("rule_type", "onboarding_tasks").eq("is_active", true).maybeSingle();

      if (onbRule) {
        const { data: existing } = await supabase.from("automation_executions").select("id")
          .eq("rule_id", onbRule.id).eq("office_id", office_id).eq("context_key", "onboarding").maybeSingle();
        if (!existing) {
          const templates = (onbRule.config as any)?.templates || [];
          const assignedCsm = csm_id || (await supabase.from("offices").select("csm_id").eq("id", office_id).single()).data?.csm_id;
          const createdIds: string[] = [];
          for (const t of templates) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + (t.due_days || 0));
            const { data: act } = await supabase.from("activities").insert({
              title: t.title, type: t.type || "task", description: t.description || null,
              office_id, user_id: assignedCsm,
              due_date: dueDate.toISOString().split("T")[0], priority: "medium",
            }).select("id").single();
            if (act) createdIds.push(act.id);
          }
          await supabase.from("automation_executions").insert({
            rule_id: onbRule.id, office_id, context_key: "onboarding",
            result: { created_activity_ids: createdIds },
          });
        }
      }

      await executeV2Rules(supabase, "office.registered", office_id, csm_id, userId);
      await executeV2Rules(supabase, "office.created", office_id, csm_id, userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== onStageChange (legacy v1 + v2) ==========
    if (action === "onStageChange") {
      if (!office_id || !product_id || !stage_id) throw new Error("office_id, product_id, stage_id required");

      const { data: rule } = await supabase
        .from("automation_rules").select("*")
        .eq("product_id", product_id).eq("rule_type", "stage_tasks").eq("is_active", true).maybeSingle();

      if (rule) {
        const contextKey = `stage_${stage_id}`;
        const { data: existing } = await supabase.from("automation_executions").select("id")
          .eq("rule_id", rule.id).eq("office_id", office_id).eq("context_key", contextKey).maybeSingle();
        if (!existing) {
          const stageTemplates = (rule.config as any)?.stages?.[stage_id] || [];
          const assignedCsm = csm_id || (await supabase.from("offices").select("csm_id").eq("id", office_id).single()).data?.csm_id;
          const createdIds: string[] = [];
          for (const t of stageTemplates) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + (t.due_days || 0));
            const { data: act } = await supabase.from("activities").insert({
              title: t.title, type: t.type || "task", description: t.description || null,
              office_id, user_id: assignedCsm,
              due_date: dueDate.toISOString().split("T")[0], priority: "medium",
            }).select("id").single();
            if (act) createdIds.push(act.id);
          }
          await supabase.from("automation_executions").insert({
            rule_id: rule.id, office_id, context_key: contextKey,
            result: { created_activity_ids: createdIds },
          });
        }
      }

      await executeV2Rules(supabase, "office.stage_changed", office_id, csm_id, userId, { suffix: stage_id });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== previewMatchedOffices ==========
    if (action === "previewMatchedOffices") {
      const { conditions, condition_logic } = body;
      let officeQuery = supabase.from("offices").select("id, name, csm_id, status, active_product_id")
        .in("status", ["ativo", "upsell", "bonus_elite"]).limit(500);
      if (body.product_id) officeQuery = officeQuery.eq("active_product_id", body.product_id);
      const { data: allOffices } = await officeQuery;

      const matchedOffices: any[] = [];
      const groups = conditions?.groups || [];
      const groupLogic = conditions?.logic || condition_logic || "and";

      for (const office of (allOffices || [])) {
        let officeMatches = true;
        if (groups.length > 0) {
          const groupResults: boolean[] = [];
          for (const group of groups) {
            const condResults: boolean[] = [];
            for (const cond of (group.conditions || [])) {
              try {
                const actual = await resolveConditionValue(supabase, cond, office, office.id);
                const result = evaluateCondition(actual, cond.operator, cond.value, cond.value2);
                condResults.push(result);
              } catch { condResults.push(false); }
            }
            const gLogic = group.logic || "and";
            const gResult = condResults.length === 0 ? true : gLogic === "and" ? condResults.every(Boolean) : condResults.some(Boolean);
            groupResults.push(gResult);
          }
          officeMatches = groupLogic === "and" ? groupResults.every(Boolean) : groupResults.some(Boolean);
        }
        if (officeMatches) {
          // Resolve CSM name
          let csm_name: string | null = null;
          if (office.csm_id) {
            const { data: csmP } = await supabase.from("profiles").select("full_name").eq("id", office.csm_id).maybeSingle();
            csm_name = csmP?.full_name || null;
          }
          matchedOffices.push({ id: office.id, name: office.name, csm_name });
          if (matchedOffices.length >= 100) break;
        }
      }

      return new Response(JSON.stringify({ success: true, offices: matchedOffices, total: matchedOffices.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== runNowAll ==========
    if (action === "runNowAll") {
      const { rule_id } = body;
      if (!rule_id) throw new Error("rule_id required");

      const { data: rule } = await supabase.from("automation_rules_v2").select("*").eq("id", rule_id).single();
      if (!rule) throw new Error("Rule not found");

      let officeQuery = supabase.from("offices").select("id, csm_id, status, active_product_id")
        .in("status", ["ativo", "upsell", "bonus_elite"]);
      if (rule.product_id) officeQuery = officeQuery.eq("active_product_id", rule.product_id);
      const { data: offices } = await officeQuery;

      let executed = 0;
      let errors = 0;
      for (const office of (offices || [])) {
        try {
          await executeV2Rules(supabase, rule.trigger_type, office.id, office.csm_id, userId, { force_rule_id: rule_id });
          executed++;
        } catch (e) {
          console.error(`[AUTOMATIONS] runNowAll error for office ${office.id}:`, e);
          errors++;
        }
      }

      return new Response(JSON.stringify({ success: true, executed, errors, total: (offices || []).length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== runPeriodicRules ==========
    if (action === "runPeriodicRules") {
      console.log('[PERIODIC] Starting periodic rules check');

      const periodicTriggerTypes = ['client_contains', 'office.no_meeting', 'office.renewal_approaching', 'activity.overdue', 'payment.overdue'];
      const { data: periodicRules, error: rulesError } = await supabase
        .from('automation_rules_v2')
        .select('*')
        .eq('is_active', true)
        .in('trigger_type', periodicTriggerTypes);

      if (rulesError) {
        console.error('[PERIODIC] Error fetching rules:', rulesError.message);
        return new Response(JSON.stringify({ error: rulesError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('[PERIODIC] Found', periodicRules?.length || 0, 'active periodic rules');
      const results: any[] = [];

      for (const rule of (periodicRules || [])) {
        const ruleStart = Date.now();
        console.log('[PERIODIC] Evaluating rule:', rule.name, '(id:', rule.id, ')');

        // Check if it's time to run based on frequency
        const shouldRun = checkShouldRun(rule.trigger_params);
        console.log('[PERIODIC] Should run:', shouldRun, 'Frequency:', rule.trigger_params?.frequency, 'Last run:', rule.trigger_params?.last_run_at);

        if (!shouldRun) {
          results.push({ rule: rule.name, status: 'skipped', reason: 'Not time yet' });
          continue;
        }

        // Fetch offices (filter by product if set, exclude pausado)
        let officeQuery = supabase
          .from('offices')
          .select('*, contracts!contracts_office_id_fkey(*)')
          .neq('status', 'pausado');

        if (rule.product_id) {
          officeQuery = officeQuery.eq('active_product_id', rule.product_id);
        }

        const { data: offices, error: officesError } = await officeQuery;

        if (officesError) {
          console.error('[PERIODIC] Error fetching offices:', officesError.message);
          results.push({ rule: rule.name, status: 'error', reason: officesError.message });
          continue;
        }

        console.log('[PERIODIC] Rule "' + rule.name + '": checking', offices?.length || 0, 'offices');

        let matchCount = 0;
        let actionCount = 0;
        let skipCount = 0;

        for (const office of (offices || [])) {
          try {
            // Enrich office with calculated fields
            const enriched = await enrichOfficeData(office, supabase);

            // Evaluate conditions using existing group-based logic
            const conditionsPayload = rule.conditions as any;
            const groups = conditionsPayload?.groups || (Array.isArray(conditionsPayload) ? [{ logic: rule.condition_logic || 'and', conditions: conditionsPayload }] : []);
            const groupLogic = conditionsPayload?.logic || rule.condition_logic || 'and';

            let conditionsMet = true;
            if (groups.length > 0) {
              const groupResults: boolean[] = [];
              for (const group of groups) {
                const conds = group.conditions || [];
                if (conds.length === 0) { groupResults.push(true); continue; }
                const condResults: boolean[] = [];
                for (const cond of conds) {
                  if (!cond.field || !cond.operator) { condResults.push(true); continue; }
                  try {
                    const resolved = await resolveConditionValue(supabase, cond, enriched, office.id);
                    const condResult = evaluateCondition(resolved, cond.operator, cond.value, cond.value2);
                    console.log(`[PERIODIC] Condition: ${cond.field} ${cond.operator} ${cond.value} → resolved=${JSON.stringify(resolved)}, result=${condResult}`);
                    condResults.push(condResult);
                  } catch (condErr: any) {
                    console.error('[PERIODIC] Condition eval error:', condErr?.message);
                    condResults.push(false);
                  }
                }
                const groupMatch = (group.logic || 'and') === 'and' ? condResults.every(Boolean) : condResults.some(Boolean);
                groupResults.push(groupMatch);
              }
              conditionsMet = groupLogic === 'and' ? groupResults.every(Boolean) : groupResults.some(Boolean);
            }

            if (!conditionsMet) continue;
            matchCount++;

            // Check repeat mode / idempotency
            const canExecute = await checkRepeatMode(rule, office.id, supabase);
            if (!canExecute) {
              skipCount++;
              console.log('[PERIODIC] Skipping office', office.name, '(already executed per repeat_mode)');
              continue;
            }

            // Get CSM profile for variable resolution
            let csmProfile: any = null;
            if (office.csm_id) {
              const { data: p } = await supabase.from('profiles').select('full_name').eq('id', office.csm_id).maybeSingle();
              csmProfile = p;
            }

            // Execute ALL actions (individual try/catch per action)
            const executedActions: any[] = [];
            for (const ruleAction of ((rule.actions as any[]) || [])) {
              try {
                const result = await handleAction(supabase, ruleAction, office.id, enriched, office.csm_id, userId, csmProfile, false);
                executedActions.push({ ...result, success: true });
                actionCount++;
                console.log('[PERIODIC] Action SUCCESS:', ruleAction.type, 'for', office.name);
              } catch (actionErr: any) {
                executedActions.push({ type: ruleAction.type, success: false, error: actionErr?.message });
                console.error('[PERIODIC] Action FAILED:', ruleAction.type, 'for', office.name, actionErr?.message);
              }
            }

            // Register execution for idempotency
            const { error: execInsertErr } = await supabase.from('automation_executions').insert({
              rule_id: rule.id,
              office_id: office.id,
              context_key: `periodic_${rule.id}_${office.id}`,
              result: { actions: executedActions },
            });
            if (execInsertErr) {
              console.error('[PERIODIC] Failed to register execution:', execInsertErr.message);
            }

            // Log
            const { error: logErr } = await supabase.from('automation_logs').insert({
              rule_id: rule.id,
              rule_name: rule.name,
              office_id: office.id,
              trigger_type: rule.trigger_type,
              conditions_met: true,
              actions_executed: executedActions,
              execution_time_ms: Date.now() - ruleStart,
            });
            if (logErr) {
              console.error('[PERIODIC] Failed to insert log:', logErr.message);
            }

          } catch (officeErr: any) {
            console.error('[PERIODIC] Error processing office', office.name, ':', officeErr?.message);
          }
        }

        // Update last_run_at
        const updatedParams = {
          ...(rule.trigger_params || {}),
          last_run_at: new Date().toISOString(),
        };
        const { error: updateErr } = await supabase
          .from('automation_rules_v2')
          .update({ trigger_params: updatedParams })
          .eq('id', rule.id);

        if (updateErr) {
          console.error('[PERIODIC] Failed to update last_run_at:', updateErr.message);
        }

        console.log(`[PERIODIC] Rule "${rule.name}" done: ${matchCount} matched, ${actionCount} actions, ${skipCount} skipped (repeat)`);
        results.push({ rule: rule.name, status: 'executed', matched: matchCount, actions: actionCount, skipped: skipCount });
      }

      console.log('[PERIODIC] All periodic rules done:', JSON.stringify(results));
      return new Response(JSON.stringify({ success: true, results }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[AUTOMATIONS]", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
