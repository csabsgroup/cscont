import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Loader2, Edit2, Trash2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Props { officeId: string; }

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  in_progress: 'Em Andamento',
  done: 'Concluído',
  cancelled: 'Cancelado',
};

const statusColors: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-primary/10 text-primary',
  done: 'bg-success/10 text-success',
  cancelled: 'bg-destructive/10 text-destructive',
};

export function ClienteOKR({ officeId }: Props) {
  const { session, isViewer } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('pending');
  const [observations, setObservations] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('action_plans').select('*').eq('office_id', officeId).order('created_at', { ascending: false });
    setPlans(data || []);
    setLoading(false);
  }, [officeId]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const openNew = () => { setEdit(null); setTitle(''); setDescription(''); setDueDate(''); setStatus('pending'); setObservations(''); setDialogOpen(true); };
  const openEdit = (p: any) => { setEdit(p); setTitle(p.title); setDescription(p.description || ''); setDueDate(p.due_date || ''); setStatus(p.status); setObservations(p.observations || ''); setDialogOpen(true); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const payload: any = { title, description: description || null, due_date: dueDate || null, status: status as any, observations: observations || null, office_id: officeId };
    if (edit) {
      await supabase.from('action_plans').update(payload).eq('id', edit.id);
      toast.success('Tarefa atualizada!');
    } else {
      payload.created_by = session?.user?.id;
      await supabase.from('action_plans').insert(payload);
      toast.success('Tarefa criada!');
    }
    setSaving(false); setDialogOpen(false); fetchPlans();
  };

  const remove = async (id: string) => {
    await supabase.from('action_plans').delete().eq('id', id);
    toast.success('Removido!'); fetchPlans();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const doneCount = plans.filter(p => p.status === 'done').length;
  const progress = plans.length > 0 ? Math.round((doneCount / plans.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">{plans.length} tarefa(s)</p>
          <div className="flex items-center gap-2 min-w-[200px]">
            <Progress value={progress} className="h-2" />
            <span className="text-sm font-medium">{progress}%</span>
          </div>
        </div>
        {!isViewer && <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Nova Tarefa</Button>}
      </div>

      {plans.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Nenhuma tarefa no Plano de Ação.</div>
      ) : (
        <div className="space-y-2">
          {plans.map(p => (
            <Card key={p.id} className="p-4 flex items-start gap-3">
              <CheckCircle2 className={`h-5 w-5 mt-0.5 flex-shrink-0 ${p.status === 'done' ? 'text-success' : 'text-muted-foreground/40'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${p.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{p.title}</span>
                  <Badge variant="outline" className={`text-xs ${statusColors[p.status] || ''}`}>{statusLabels[p.status]}</Badge>
                </div>
                {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                {p.due_date && <p className="text-xs text-muted-foreground mt-0.5">Vencimento: {format(new Date(p.due_date), 'dd/MM/yyyy')}</p>}
                {p.observations && <p className="text-xs text-muted-foreground mt-1 italic">"{p.observations}"</p>}
              </div>
              {!isViewer && (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Edit2 className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2"><Label>Título *</Label><Input value={title} onChange={e => setTitle(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Vencimento</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Observações</Label><Textarea value={observations} onChange={e => setObservations(e.target.value)} rows={2} /></div>
            <Button type="submit" className="w-full" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
