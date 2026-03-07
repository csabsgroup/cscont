import { supabase } from '@/integrations/supabase/client';

export async function applyPlaybook(playbookId: string, officeId: string, userId: string) {
  // 1. Fetch template
  const { data: playbook, error: pbErr } = await supabase
    .from('playbook_templates' as any)
    .select('*')
    .eq('id', playbookId)
    .single();
  if (pbErr || !playbook) throw new Error(pbErr?.message || 'Playbook não encontrado');

  const acts = Array.isArray((playbook as any).activities) ? (playbook as any).activities : [];

  // 2. Create instance
  const { data: instance, error: instErr } = await supabase
    .from('playbook_instances' as any)
    .insert({
      playbook_template_id: playbookId,
      office_id: officeId,
      applied_by: userId,
      total_activities: acts.length,
      completed_activities: 0,
    })
    .select()
    .single();
  if (instErr || !instance) throw new Error(instErr?.message || 'Erro ao criar instância');

  // 3. Get office CSM
  const { data: office } = await supabase
    .from('offices')
    .select('csm_id')
    .eq('id', officeId)
    .single();

  // 4. Create all activities
  const now = new Date();
  const activitiesToInsert = acts.map((act: any, index: number) => ({
    title: act.title,
    description: act.description || null,
    type: act.type || 'task',
    priority: act.priority || 'medium',
    office_id: officeId,
    user_id: act.responsible_type === 'office_csm' ? (office?.csm_id || userId) : userId,
    due_date: new Date(now.getTime() + (act.due_days_offset || 1) * 86400000).toISOString().split('T')[0],
    playbook_instance_id: (instance as any).id,
    playbook_order: index + 1,
  }));

  if (activitiesToInsert.length > 0) {
    const { error: actErr } = await supabase.from('activities').insert(activitiesToInsert);
    if (actErr) throw new Error(actErr.message);
  }

  return instance;
}

export async function checkPlaybookCompletion(playbookInstanceId: string, userId: string) {
  // Get instance with template
  const { data: instance } = await supabase
    .from('playbook_instances' as any)
    .select('*, playbook_templates(*)')
    .eq('id', playbookInstanceId)
    .single();
  if (!instance) return;

  const inst = instance as any;

  // Count completed activities for this instance
  const { count } = await (supabase
    .from('activities')
    .select('*', { count: 'exact', head: true }) as any)
    .eq('playbook_instance_id', playbookInstanceId)
    .not('completed_at', 'is', null);

  const completedCount = count || 0;
  const isComplete = completedCount >= inst.total_activities;

  // Update instance
  await supabase.from('playbook_instances' as any).update({
    completed_activities: completedCount,
    ...(isComplete ? { status: 'completed', completed_at: new Date().toISOString() } : {}),
  }).eq('id', playbookInstanceId);

  // Auto-advance journey if complete
  if (isComplete && inst.playbook_templates?.auto_advance_journey && inst.playbook_templates?.advance_to_stage_id) {
    const template = inst.playbook_templates;

    await supabase.from('office_journey').upsert({
      office_id: inst.office_id,
      journey_stage_id: template.advance_to_stage_id,
      entered_at: new Date().toISOString(),
    }, { onConflict: 'office_id' });

    await supabase.from('office_stage_history').insert({
      office_id: inst.office_id,
      to_stage_id: template.advance_to_stage_id,
      reason: `Playbook "${template.name}" concluído`,
      changed_by: userId,
      change_type: 'playbook_auto',
    });

    try {
      await supabase.functions.invoke('execute-automations', {
        body: {
          action: 'triggerV2',
          trigger_type: 'office.stage_changed',
          office_id: inst.office_id,
          context: {
            from_playbook: template.name,
            new_stage_id: template.advance_to_stage_id,
            suffix: `playbook_${playbookInstanceId}`,
          },
        },
      });
    } catch (e) {
      console.error('Failed to trigger stage_changed automation after playbook:', e);
    }
  }

  return { completed: isComplete, completedCount };
}
