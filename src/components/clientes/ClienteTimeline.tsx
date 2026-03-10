import { useEffect, useState, useCallback, useMemo } from 'react';
import { ActivityEditDrawer } from '@/components/atividades/ActivityEditDrawer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Circle, Calendar, FileText, MoreVertical, RotateCcw, Trash2, Loader2, Plus, X, Filter, ArrowUpDown, ChevronRight, ChevronDown, ClipboardList } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Constants } from '@/integrations/supabase/types';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';

interface Props { officeId: string; readOnly?: boolean; }

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  task: 'Tarefa', follow_up: 'Follow-up', onboarding: 'Onboarding', renewal: 'Renovação',
  other: 'Outra', ligacao: 'Ligação', check_in: 'Check-in', email: 'E-mail',
  whatsapp: 'WhatsApp', planejamento: 'Planejamento', meeting: 'Reunião',
};
const PRIORITY_LABELS: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' };

export function ClienteTimeline({ officeId, readOnly = false }: Props) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [checklists, setChecklists] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [internalUsers, setInternalUsers] = useState<any[]>([]);
  const [playbookInstances, setPlaybookInstances] = useState<any[]>([]);
  const [expandedPlaybooks, setExpandedPlaybooks] = useState<Set<string>>(new Set());

  // Filters
  const [filterType, setFilterType] = useState<'all' | 'activity' | 'meeting'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'done'>('all');
  const [sortAsc, setSortAsc] = useState(true);

  // Detail dialog
  const [detailItem, setDetailItem] = useState<{ type: 'activity' | 'meeting'; data: any } | null>(null);
  const [editActivityId, setEditActivityId] = useState<string | null>(null);

  // Complete dialog (requires observations)
  const [completeItem, setCompleteItem] = useState<any>(null);
  const [completeObs, setCompleteObs] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string } | null>(null);

  // New activity dialog
  const [showNewActivity, setShowNewActivity] = useState(false);
  const [actForm, setActForm] = useState({ type: 'task', title: '', description: '', due_date: '', user_id: '', priority: 'medium' });
  const [actChecklist, setActChecklist] = useState<string[]>([]);
  const [newCheckItem, setNewCheckItem] = useState('');

  // New meeting dialog
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [meetForm, setMeetForm] = useState({ title: '', scheduled_at: '', share_with_client: false });

  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [actRes, meetRes, usersRes, pbRes] = await Promise.all([
      supabase.from('activities').select('*').eq('office_id', officeId).order('created_at', { ascending: false }),
      supabase.from('meetings').select('*').eq('office_id', officeId).order('scheduled_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, avatar_url').order('full_name'),
      supabase.from('playbook_instances').select('*, playbook_templates(name)').eq('office_id', officeId),
    ]);
    const acts = actRes.data || [];
    setActivities(acts);
    setMeetings(meetRes.data || []);
    setInternalUsers(usersRes.data || []);
    setPlaybookInstances(pbRes.data || []);

    // Fetch checklists for all activities
    if (acts.length > 0) {
      const { data: cl } = await supabase.from('activity_checklists').select('*')
        .in('activity_id', acts.map(a => a.id)).order('position');
      const map: Record<string, any[]> = {};
      (cl || []).forEach(c => { if (!map[c.activity_id]) map[c.activity_id] = []; map[c.activity_id].push(c); });
      setChecklists(map);
    }
    setLoading(false);
  }, [officeId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Group activities: playbook vs standalone
  const { playbookGroups, standaloneActivities } = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const standalone: any[] = [];

    for (const act of activities) {
      if (act.playbook_instance_id) {
        if (!groups[act.playbook_instance_id]) groups[act.playbook_instance_id] = [];
        groups[act.playbook_instance_id].push(act);
      } else {
        standalone.push(act);
      }
    }

    // Sort activities within each playbook by playbook_order
    for (const key in groups) {
      groups[key].sort((a: any, b: any) => (a.playbook_order || 0) - (b.playbook_order || 0));
    }

    return { playbookGroups: groups, standaloneActivities: standalone };
  }, [activities]);

  // Build unified timeline items
  const items = useMemo(() => {
    const result: Array<{ type: 'activity' | 'meeting' | 'playbook'; data: any; date: string; done: boolean; instanceId?: string }> = [];

    // Standalone activities
    standaloneActivities.forEach(a => {
      result.push({ type: 'activity', data: a, date: a.due_date || a.created_at, done: !!a.completed_at });
    });

    // Meetings
    meetings.forEach(m => {
      result.push({ type: 'meeting', data: m, date: m.scheduled_at, done: m.status === 'completed' });
    });

    // Playbook groups as single items
    for (const instanceId in playbookGroups) {
      const acts = playbookGroups[instanceId];
      if (acts.length === 0) continue; // BUG 9 fix: skip empty playbook groups
      const instance = playbookInstances.find(pi => pi.id === instanceId);
      const completedCount = acts.filter((a: any) => !!a.completed_at).length;
      const allDone = completedCount === acts.length;

      // Sort date = earliest pending due_date, or latest completed
      const pendingActs = acts.filter((a: any) => !a.completed_at);
      const sortDate = pendingActs.length > 0
        ? pendingActs.reduce((min: string, a: any) => (!min || (a.due_date && a.due_date < min) ? a.due_date : min), '')
        : acts[acts.length - 1]?.due_date || acts[acts.length - 1]?.created_at;

      result.push({
        type: 'playbook',
        data: { instance, acts, completedCount, totalCount: acts.length },
        date: sortDate || acts[0]?.created_at,
        done: allDone,
        instanceId,
      });
    }

    // Apply filters
    return result
      .filter(i => {
        if (filterType === 'meeting') return i.type === 'meeting';
        if (filterType === 'activity') return i.type === 'activity' || i.type === 'playbook';
        return true;
      })
      .filter(i => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'done') return i.done;
        return !i.done;
      })
      .sort((a, b) => {
        const da = new Date(a.date).getTime() || 0;
        const db = new Date(b.date).getTime() || 0;
        return sortAsc ? da - db : db - da;
      });
  }, [standaloneActivities, meetings, playbookGroups, playbookInstances, filterType, filterStatus, sortAsc]);

  const togglePlaybook = (instanceId: string) => {
    setExpandedPlaybooks(prev => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });
  };

  const handleComplete = async (item: any) => {
    if (item.type === 'activity') {
      setCompleteItem(item.data);
      setCompleteObs('');
      return;
    }
    await supabase.from('meetings').update({ status: 'completed' as any }).eq('id', item.data.id);
    toast.success('Reunião concluída!'); fetchData();
  };

  const confirmComplete = async () => {
    if (!completeObs.trim()) { toast.error('Observações são obrigatórias para concluir.'); return; }
    setSaving(true);
    const completedAt = new Date().toISOString();
    await supabase.from('activities').update({ completed_at: completedAt, observations: completeObs }).eq('id', completeItem.id);

    // BUG 1 fix: Trigger automation for activity completion (mirrors ActivityEditDrawer logic)
    if (completeItem.office_id) {
      try {
        const wasLate = completeItem.due_date && new Date(completeItem.due_date) < new Date(completedAt);
        const daysLate = wasLate ? Math.ceil((new Date(completedAt).getTime() - new Date(completeItem.due_date).getTime()) / 86400000) : 0;
        await supabase.functions.invoke('execute-automations', {
          body: {
            action: 'triggerV2',
            trigger_type: 'activity.completed',
            office_id: completeItem.office_id,
            context: {
              activity_id: completeItem.id,
              activity_name: completeItem.title,
              activity_type: completeItem.type,
              was_late: !!wasLate,
              days_late: daysLate,
              completed_by: completeItem.user_id,
              suffix: `activity_${completeItem.id}`,
            },
          },
        });
      } catch (e) {
        console.error('Failed to trigger activity.completed automation:', e);
      }
    }

    // Check playbook completion if activity belongs to a playbook
    if (completeItem.playbook_instance_id) {
      try {
        const { checkPlaybookCompletion } = await import('@/lib/playbook-helpers');
        await checkPlaybookCompletion(completeItem.playbook_instance_id, completeItem.user_id);
      } catch (e) {
        console.error('Failed to check playbook completion:', e);
      }
    }

    toast.success('Atividade concluída!');
    setSaving(false); setCompleteItem(null); fetchData();
  };

  const handleReopen = async (type: string, id: string) => {
    if (type === 'activity') await supabase.from('activities').update({ completed_at: null }).eq('id', id);
    else await supabase.from('meetings').update({ status: 'scheduled' as any }).eq('id', id);
    toast.success('Reaberto!'); fetchData(); setDetailItem(null);
  };

  const handleDelete = async (type: string, id: string) => {
    if (type === 'activity') await supabase.from('activities').delete().eq('id', id);
    else await supabase.from('meetings').delete().eq('id', id);
    toast.success('Removido!'); fetchData(); setDetailItem(null);
    setDeleteTarget(null);
  };

  const saveNewActivity = async () => {
    if (!actForm.title.trim() || !actForm.due_date) { toast.error('Título e data de vencimento são obrigatórios.'); return; }
    setSaving(true);
    const userId = actForm.user_id || user?.id;
    const { data: act, error } = await supabase.from('activities').insert({
      office_id: officeId, title: actForm.title, description: actForm.description || null,
      type: actForm.type as any, due_date: actForm.due_date, user_id: userId!,
      priority: actForm.priority as any,
    }).select().single();
    if (error) { toast.error('Erro ao criar atividade.'); setSaving(false); return; }
    if (actChecklist.length > 0 && act) {
      await supabase.from('activity_checklists').insert(
        actChecklist.map((title, i) => ({ activity_id: act.id, title, position: i }))
      );
    }
    toast.success('Atividade criada!');
    setSaving(false); setShowNewActivity(false);
    setActForm({ type: 'task', title: '', description: '', due_date: '', user_id: '', priority: 'medium' });
    setActChecklist([]); fetchData();
  };

  const saveNewMeeting = async () => {
    if (!meetForm.title.trim() || !meetForm.scheduled_at) { toast.error('Título e data são obrigatórios.'); return; }
    setSaving(true);
    await supabase.from('meetings').insert({
      office_id: officeId, title: meetForm.title,
      scheduled_at: meetForm.scheduled_at, share_with_client: meetForm.share_with_client,
      user_id: user!.id,
    });
    toast.success('Reunião criada!');
    setSaving(false); setShowNewMeeting(false);
    setMeetForm({ title: '', scheduled_at: '', share_with_client: false }); fetchData();
  };

  const getUserName = (uid: string) => internalUsers.find(u => u.id === uid)?.full_name || '—';

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Top bar: buttons + filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {!readOnly && (
          <>
            <Button size="sm" onClick={() => setShowNewActivity(true)}><Plus className="mr-1 h-4 w-4" />Nova Atividade</Button>
            <Button size="sm" variant="outline" onClick={() => setShowNewMeeting(true)}><Plus className="mr-1 h-4 w-4" />Nova Reunião</Button>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline"><Filter className="mr-1 h-4 w-4" />Filtros</Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="activity">Atividades</SelectItem>
                    <SelectItem value="meeting">Reuniões</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="done">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
          <Button size="sm" variant="outline" onClick={() => setSortAsc(v => !v)} title="Alternar ordenação">
            <ArrowUpDown className="mr-1 h-4 w-4" />
            {sortAsc ? '↑ Mais próximas' : '↓ Mais distantes'}
          </Button>
        </div>
      </div>

      {items.length === 0 && <div className="text-center py-12 text-sm text-muted-foreground">Nenhum item encontrado.</div>}

      {items.map(item => {
        // Playbook group card
        if (item.type === 'playbook') {
          const { instance, acts, completedCount, totalCount } = item.data;
          const instanceId = item.instanceId!;
          const isExpanded = expandedPlaybooks.has(instanceId);
          const templateName = instance?.playbook_templates?.name || 'Playbook';
          const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
          const allDone = completedCount === totalCount;

          return (
            <Card key={`playbook-${instanceId}`} className="overflow-hidden">
              {/* Playbook header */}
              <button
                className="w-full p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => togglePlaybook(instanceId)}
                aria-expanded={isExpanded}
              >
                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                <ClipboardList className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{templateName}</span>
                    <Badge variant={allDone ? 'default' : 'outline'} className="text-xs">
                      {allDone ? '✅ Concluído' : '⏳ Em progresso'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <Progress value={pct} className="h-2 flex-1 max-w-[200px]" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{completedCount}/{totalCount} ({pct}%)</span>
                  </div>
                </div>
              </button>

              {/* Expanded activities */}
              {isExpanded && (
                <div className="border-t border-border space-y-1 p-3 pl-10">
                  {acts.map((act: any, idx: number) => {
                    const actDone = !!act.completed_at;
                    return (
                      <Card
                        key={act.id}
                        className="p-3 flex items-start gap-3 cursor-pointer hover:bg-muted/30 transition-colors border-l-4 border-l-primary/30"
                        onClick={() => setEditActivityId(act.id)}
                      >
                        {actDone
                          ? <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          : <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">{(act.playbook_order || idx + 1)}.</span>
                            <span className={`text-sm font-medium ${actDone ? 'line-through text-muted-foreground' : ''}`}>{act.title}</span>
                            <Badge variant="outline" className="text-xs">
                              <FileText className="h-3 w-3 mr-1" />{ACTIVITY_TYPE_LABELS[act.type] || act.type}
                            </Badge>
                            {act.priority !== 'medium' && (
                              <Badge variant={act.priority === 'high' || act.priority === 'urgent' ? 'destructive' : 'secondary'} className="text-xs">
                                {PRIORITY_LABELS[act.priority]}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {act.due_date ? formatDistanceToNow(new Date(act.due_date), { addSuffix: true, locale: ptBR }) : 'Sem data'}
                            {' · '}{getUserName(act.user_id)}
                          </p>
                        </div>
                        {!readOnly && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                              {actDone ? (
                                <DropdownMenuItem onClick={() => handleReopen('activity', act.id)}><RotateCcw className="mr-2 h-4 w-4" />Reabrir</DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => { setCompleteItem(act); setCompleteObs(''); }}><CheckCircle2 className="mr-2 h-4 w-4" />Concluir</DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget({ type: 'activity', id: act.id })}><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        }

        // Regular activity or meeting card
        const d = item.data;
        const title = d.title;
        return (
          <Card key={`${item.type}-${d.id}`} className="p-4 flex items-start gap-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => item.type === 'activity' ? setEditActivityId(d.id) : setDetailItem(item as any)}>
            {item.done ? <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" /> : <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{title}</span>
                <Badge variant="outline" className="text-xs">
                  {item.type === 'activity' ? <><FileText className="h-3 w-3 mr-1" />{ACTIVITY_TYPE_LABELS[d.type] || d.type}</> : <><Calendar className="h-3 w-3 mr-1" />Reunião</>}
                </Badge>
                {item.type === 'activity' && d.priority !== 'medium' && (
                  <Badge variant={d.priority === 'high' || d.priority === 'urgent' ? 'destructive' : 'secondary'} className="text-xs">
                    {PRIORITY_LABELS[d.priority]}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDistanceToNow(new Date(item.date), { addSuffix: true, locale: ptBR })}
                {item.type === 'activity' && <> · {getUserName(d.user_id)}</>}
              </p>
              {d.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{d.description}</p>}
            </div>
            {!readOnly && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}><Button size="sm" variant="ghost"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                  {item.done ? (
                    <DropdownMenuItem onClick={() => handleReopen(item.type, d.id)}><RotateCcw className="mr-2 h-4 w-4" />Reabrir</DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => handleComplete(item as any)}><CheckCircle2 className="mr-2 h-4 w-4" />Concluir</DropdownMenuItem>
                  )}
                  <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget({ type: item.type, id: d.id })}><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </Card>
        );
      })}

      {/* Detail Dialog */}
      <Dialog open={!!detailItem} onOpenChange={o => !o && setDetailItem(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {detailItem && (
            <>
              <DialogHeader>
                <DialogTitle>{detailItem.data.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                {detailItem.type === 'activity' ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="text-muted-foreground">Tipo:</span> {ACTIVITY_TYPE_LABELS[detailItem.data.type]}</div>
                      <div><span className="text-muted-foreground">Prioridade:</span> {PRIORITY_LABELS[detailItem.data.priority]}</div>
                      <div><span className="text-muted-foreground">Responsável:</span> {getUserName(detailItem.data.user_id)}</div>
                      <div><span className="text-muted-foreground">Status:</span> {detailItem.data.completed_at ? 'Concluída' : 'Pendente'}</div>
                    </div>
                    {detailItem.data.due_date && <div><span className="text-muted-foreground">Vencimento:</span> {format(new Date(detailItem.data.due_date), 'dd/MM/yyyy', { locale: ptBR })}</div>}
                    {detailItem.data.completed_at && <div><span className="text-muted-foreground">Concluída em:</span> {format(new Date(detailItem.data.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>}
                    {detailItem.data.description && <div><span className="text-muted-foreground">Descrição:</span><p className="mt-1 whitespace-pre-wrap">{detailItem.data.description}</p></div>}
                    {detailItem.data.observations && <div><span className="text-muted-foreground">Observações:</span><p className="mt-1 whitespace-pre-wrap">{detailItem.data.observations}</p></div>}
                    {checklists[detailItem.data.id]?.length > 0 && (
                      <div>
                        <span className="text-muted-foreground">Checklist:</span>
                        <ul className="mt-1 space-y-1">
                          {checklists[detailItem.data.id].map(c => (
                            <li key={c.id} className="flex items-center gap-2">
                              {c.completed ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                              <span className={c.completed ? 'line-through text-muted-foreground' : ''}>{c.title}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="text-muted-foreground">Data:</span> {format(new Date(detailItem.data.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
                      <div><span className="text-muted-foreground">Status:</span> {detailItem.data.status === 'completed' ? 'Realizada' : detailItem.data.status === 'cancelled' ? 'Cancelada' : 'Agendada'}</div>
                      <div><span className="text-muted-foreground">Compartilhar:</span> {detailItem.data.share_with_client ? 'Sim' : 'Não'}</div>
                    </div>
                    {detailItem.data.notes && <div><span className="text-muted-foreground">Notas:</span><p className="mt-1 whitespace-pre-wrap">{detailItem.data.notes}</p></div>}
                    {detailItem.data.transcript && <div><span className="text-muted-foreground">Transcrição:</span><p className="mt-1 whitespace-pre-wrap">{detailItem.data.transcript}</p></div>}
                  </>
                )}
              </div>
              {!readOnly && (
                <DialogFooter className="flex-wrap gap-2 mt-4">
                  {detailItem.type === 'activity' && !detailItem.data.completed_at && (
                    <Button size="sm" onClick={() => { setDetailItem(null); handleComplete({ type: 'activity', data: detailItem.data }); }}>Concluir</Button>
                  )}
                  {(detailItem.type === 'activity' ? detailItem.data.completed_at : detailItem.data.status === 'completed') && (
                    <Button size="sm" variant="outline" onClick={() => handleReopen(detailItem.type, detailItem.data.id)}>
                      <RotateCcw className="mr-1 h-4 w-4" />Reabrir
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => setDeleteTarget({ type: detailItem.type, id: detailItem.data.id })}>
                    <Trash2 className="mr-1 h-4 w-4" />Excluir
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Complete with observations dialog */}
      <Dialog open={!!completeItem} onOpenChange={o => !o && setCompleteItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Concluir Atividade</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Informe as observações para concluir "{completeItem?.title}".</p>
            <Textarea placeholder="Observações obrigatórias..." value={completeObs} onChange={e => setCompleteObs(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button onClick={confirmComplete} disabled={saving || !completeObs.trim()}>{saving ? 'Salvando...' : 'Concluir'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Activity Dialog */}
      <Dialog open={showNewActivity} onOpenChange={setShowNewActivity}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Atividade</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={actForm.type} onValueChange={v => setActForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Constants.public.Enums.activity_type.map(t => (
                      <SelectItem key={t} value={t}>{ACTIVITY_TYPE_LABELS[t] || t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prioridade</Label>
                <Select value={actForm.priority} onValueChange={v => setActForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Constants.public.Enums.activity_priority.map(p => (
                      <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Título *</Label>
              <Input value={actForm.title} onChange={e => setActForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Textarea value={actForm.description} onChange={e => setActForm(p => ({ ...p, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Data de vencimento *</Label>
                <Input type="date" value={actForm.due_date} onChange={e => setActForm(p => ({ ...p, due_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Responsável</Label>
                <Select value={actForm.user_id} onValueChange={v => setActForm(p => ({ ...p, user_id: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {internalUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.full_name || u.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Checklist</Label>
              <div className="space-y-1">
                {actChecklist.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm flex-1">{item}</span>
                    <Button size="sm" variant="ghost" onClick={() => setActChecklist(p => p.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input placeholder="Novo item..." value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && newCheckItem.trim()) { e.preventDefault(); setActChecklist(p => [...p, newCheckItem.trim()]); setNewCheckItem(''); } }}
                    className="h-8 text-sm" />
                  <Button size="sm" variant="outline" disabled={!newCheckItem.trim()} onClick={() => { setActChecklist(p => [...p, newCheckItem.trim()]); setNewCheckItem(''); }}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveNewActivity} disabled={saving}>{saving ? 'Salvando...' : 'Criar Atividade'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Meeting Dialog */}
      <Dialog open={showNewMeeting} onOpenChange={setShowNewMeeting}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Reunião</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Título *</Label>
              <Input value={meetForm.title} onChange={e => setMeetForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data e hora *</Label>
              <Input type="datetime-local" value={meetForm.scheduled_at} onChange={e => setMeetForm(p => ({ ...p, scheduled_at: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={meetForm.share_with_client} onCheckedChange={v => setMeetForm(p => ({ ...p, share_with_client: v }))} />
              <Label className="text-xs">Compartilhar com cliente</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveNewMeeting} disabled={saving}>{saving ? 'Salvando...' : 'Criar Reunião'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activity Edit Drawer */}
      <ActivityEditDrawer activityId={editActivityId} isOpen={!!editActivityId} onClose={() => setEditActivityId(null)} onSave={fetchData} readOnly={readOnly} />
      <ConfirmDeleteDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)} onConfirm={() => deleteTarget && handleDelete(deleteTarget.type, deleteTarget.id)} title="Excluir item" description={`Deseja realmente excluir ${deleteTarget?.type === 'activity' ? 'esta atividade' : 'esta reunião'}?`} />
    </div>
  );
}
