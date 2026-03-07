import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Loader2, Trash2, RotateCcw, CheckCircle2, Save, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Props {
  activityId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  readOnly?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  task: 'Tarefa', follow_up: 'Follow-up', onboarding: 'Onboarding', renewal: 'Renovação',
  ligacao: 'Ligação', check_in: 'Check-in', email: 'E-mail', whatsapp: 'WhatsApp',
  planejamento: 'Planejamento', meeting: 'Reunião', other: 'Outro',
};

const PRIORITY_LABELS: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' };

export function ActivityEditDrawer({ activityId, isOpen, onClose, onSave, readOnly = false }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activity, setActivity] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [mentions, setMentions] = useState<string[]>([]);
  const [officeName, setOfficeName] = useState<string | null>(null);
  const [newCheckItem, setNewCheckItem] = useState('');

  // Form fields
  const [title, setTitle] = useState('');
  const [type, setType] = useState('task');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('medium');
  const [userId, setUserId] = useState('');
  const [observations, setObservations] = useState('');

  // Complete sub-dialog
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeObs, setCompleteObs] = useState('');

  const fetchData = useCallback(async () => {
    if (!activityId) return;
    setLoading(true);

    const [actRes, clRes, mentRes, usersRes] = await Promise.all([
      supabase.from('activities').select('*, offices(name)').eq('id', activityId).single(),
      supabase.from('activity_checklists').select('*').eq('activity_id', activityId).order('position'),
      supabase.from('activity_mentions' as any).select('user_id').eq('activity_id', activityId),
      supabase.from('profiles').select('id, full_name').order('full_name'),
    ]);

    const act = actRes.data;
    if (act) {
      setActivity(act);
      setTitle(act.title);
      setType(act.type);
      setDescription(act.description || '');
      setDueDate(act.due_date || '');
      setPriority(act.priority);
      setUserId(act.user_id);
      setObservations(act.observations || '');
      setOfficeName((act as any).offices?.name || null);
    }
    setChecklist((clRes.data as any[]) || []);
    setMentions(((mentRes.data as any[]) || []).map((m: any) => m.user_id));
    setUsers((usersRes.data as any[]) || []);
    setLoading(false);
  }, [activityId]);

  useEffect(() => {
    if (isOpen && activityId) fetchData();
  }, [isOpen, activityId, fetchData]);

  const handleSave = async () => {
    if (!title.trim() || !activityId) return;
    setSaving(true);
    const { error } = await supabase.from('activities').update({
      title, type: type as any, description: description || null,
      due_date: dueDate || null, priority: priority as any,
      user_id: userId, observations: observations || null,
    }).eq('id', activityId);
    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return; }

    // Sync mentions
    await supabase.from('activity_mentions' as any).delete().eq('activity_id', activityId);
    if (mentions.length > 0) {
      await supabase.from('activity_mentions' as any).insert(
        mentions.map(uid => ({ activity_id: activityId, user_id: uid }))
      );
    }

    toast.success('Atividade salva!');
    setSaving(false);
    onSave();
    onClose();
  };

  const handleComplete = async () => {
    if (!completeObs.trim()) { toast.error('Observações são obrigatórias.'); return; }
    setSaving(true);
    const completedAt = new Date().toISOString();
    await supabase.from('activities').update({
      completed_at: completedAt,
      observations: completeObs,
    }).eq('id', activityId!);

    // Fire automation trigger for activity completion
    if (activity?.office_id) {
      try {
        const wasLate = activity.due_date && new Date(activity.due_date) < new Date(completedAt);
        const daysLate = wasLate ? Math.ceil((new Date(completedAt).getTime() - new Date(activity.due_date).getTime()) / 86400000) : 0;
        await supabase.functions.invoke('execute-automations', {
          body: {
            action: 'triggerV2',
            trigger_type: 'activity.completed',
            office_id: activity.office_id,
            context: {
              activity_id: activity.id,
              activity_name: activity.title,
              activity_type: activity.type,
              was_late: !!wasLate,
              days_late: daysLate,
              completed_by: activity.user_id,
              suffix: `activity_${activity.id}`,
            },
          },
        });
      } catch (e) {
        console.error('Failed to trigger activity.completed automation:', e);
      }
    }

    // Check playbook completion if activity belongs to a playbook
    if (activity?.playbook_instance_id) {
      try {
        const { checkPlaybookCompletion } = await import('@/lib/playbook-helpers');
        await checkPlaybookCompletion(activity.playbook_instance_id, activity.user_id);
      } catch (e) {
        console.error('Failed to check playbook completion:', e);
      }
    }

    toast.success('Atividade concluída!');
    setSaving(false);
    setCompleteOpen(false);
    onSave();
    onClose();
  };

  const handleReopen = async () => {
    setSaving(true);
    await supabase.from('activities').update({ completed_at: null }).eq('id', activityId!);
    toast.success('Atividade reaberta!');
    setSaving(false);
    onSave();
    onClose();
  };

  const handleDelete = async () => {
    if (!confirm('Excluir esta atividade?')) return;
    setSaving(true);
    await supabase.from('activities').delete().eq('id', activityId!);
    toast.success('Atividade excluída!');
    setSaving(false);
    onSave();
    onClose();
  };

  // Checklist handlers
  const toggleCheck = async (item: any) => {
    await supabase.from('activity_checklists').update({ completed: !item.completed } as any).eq('id', item.id);
    setChecklist(prev => prev.map(c => c.id === item.id ? { ...c, completed: !c.completed } : c));
  };

  const addCheckItem = async () => {
    if (!newCheckItem.trim() || !activityId) return;
    const { data } = await supabase.from('activity_checklists').insert({
      activity_id: activityId, title: newCheckItem.trim(), position: checklist.length,
    } as any).select().single();
    if (data) setChecklist(prev => [...prev, data]);
    setNewCheckItem('');
  };

  const removeCheckItem = async (id: string) => {
    await supabase.from('activity_checklists').delete().eq('id', id);
    setChecklist(prev => prev.filter(c => c.id !== id));
  };

  const toggleMention = (uid: string) => {
    setMentions(prev => prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]);
  };

  const checkDone = checklist.filter(c => c.completed).length;
  const checkTotal = checklist.length;
  const checkPercent = checkTotal > 0 ? Math.round((checkDone / checkTotal) * 100) : 0;

  const getUserName = (uid: string) => users.find(u => u.id === uid)?.full_name || uid.slice(0, 8);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={o => !o && onClose()}>
        <SheetContent side="right" className="w-[560px] sm:max-w-[560px] overflow-y-auto flex flex-col">
          <SheetHeader>
            <SheetTitle>{readOnly ? 'Visualizar Atividade' : '✏️ Editar Atividade'}</SheetTitle>
          </SheetHeader>

          {loading ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !activity ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">Atividade não encontrada.</div>
          ) : (
            <div className="flex-1 space-y-5 py-4">
              {/* Title */}
              <div className="space-y-1.5">
                <Label>Título *</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} disabled={readOnly} />
              </div>

              {/* Type */}
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select value={type} onValueChange={setType} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} disabled={readOnly} />
              </div>

              {/* Status + Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Badge variant={activity.completed_at ? 'default' : 'outline'} className="text-sm">
                    {activity.completed_at ? 'Concluída' : 'Pendente'}
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  <Label>Prioridade</Label>
                  <Select value={priority} onValueChange={setPriority} disabled={readOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Dates */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Datas</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data de vencimento *</Label>
                    <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={readOnly} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data de conclusão</Label>
                    <Input type="text" value={activity.completed_at ? new Date(activity.completed_at).toLocaleString('pt-BR') : '—'} disabled className="bg-muted" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Assignee */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Responsável</Label>
                <Select value={userId} onValueChange={setUserId} disabled={readOnly}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.id.slice(0, 8)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Mentions */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Menções</Label>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {mentions.map(uid => (
                    <Badge key={uid} variant="secondary" className="text-xs gap-1">
                      {getUserName(uid)}
                      {!readOnly && <X className="h-3 w-3 cursor-pointer" onClick={() => toggleMention(uid)} />}
                    </Badge>
                  ))}
                </div>
                {!readOnly && (
                  <Select value="" onValueChange={uid => { if (uid && !mentions.includes(uid)) toggleMention(uid); }}>
                    <SelectTrigger className="mt-2 h-8 text-xs"><SelectValue placeholder="Adicionar menção..." /></SelectTrigger>
                    <SelectContent>
                      {users.filter(u => !mentions.includes(u.id)).map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.full_name || u.id.slice(0, 8)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Separator />

              {/* Checklist */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Checklist</Label>
                {checkTotal > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{checkDone}/{checkTotal} ({checkPercent}%)</span>
                    </div>
                    <Progress value={checkPercent} className="h-1.5" />
                  </div>
                )}
                <div className="mt-2 space-y-1.5">
                  {checklist.map(item => (
                    <div key={item.id} className="flex items-center gap-2">
                      <Checkbox checked={item.completed} onCheckedChange={() => !readOnly && toggleCheck(item)} disabled={readOnly} />
                      <span className={`text-sm flex-1 ${item.completed ? 'line-through text-muted-foreground' : ''}`}>{item.title}</span>
                      {!readOnly && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeCheckItem(item.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {!readOnly && (
                    <div className="flex gap-2">
                      <Input placeholder="Novo item..." value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCheckItem(); } }} className="h-8 text-sm" />
                      <Button variant="outline" size="sm" className="h-8" onClick={addCheckItem}><Plus className="h-3 w-3" /></Button>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Observations */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Observações</Label>
                <Textarea value={observations} onChange={e => setObservations(e.target.value)} rows={3} disabled={readOnly} />
              </div>

              {/* Office link */}
              {activity.office_id && officeName && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Escritório</Label>
                    <Button variant="link" className="p-0 h-auto mt-1 text-sm" onClick={() => { onClose(); navigate(`/clientes/${activity.office_id}`); }}>
                      📋 {officeName}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Footer actions */}
          {!loading && activity && !readOnly && (
            <SheetFooter className="flex-row justify-between gap-2 border-t pt-4 mt-auto">
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={saving}>
                <Trash2 className="mr-1 h-4 w-4" />Excluir
              </Button>
              <div className="flex gap-2">
                {activity.completed_at ? (
                  <Button variant="outline" size="sm" onClick={handleReopen} disabled={saving}>
                    <RotateCcw className="mr-1 h-4 w-4" />Reabrir
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="text-green-600 border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                    onClick={() => { setCompleteObs(''); setCompleteOpen(true); }} disabled={saving}>
                    <CheckCircle2 className="mr-1 h-4 w-4" />Concluir
                  </Button>
                )}
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                  Salvar
                </Button>
              </div>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      {/* Complete sub-dialog */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Concluir Atividade</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Informe as observações para concluir "{activity?.title}".</p>
            <Textarea placeholder="Observações obrigatórias..." value={completeObs} onChange={e => setCompleteObs(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>Cancelar</Button>
            <Button onClick={handleComplete} disabled={saving || !completeObs.trim()}>
              {saving ? 'Concluindo...' : 'Concluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
