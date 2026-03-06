import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Loader2, CheckSquare, Calendar, AlertCircle, X } from 'lucide-react';
import { format, isToday, isPast, isFuture } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { ActivityPopup } from '@/components/atividades/ActivityPopup';
import { ActivityEditDrawer } from '@/components/atividades/ActivityEditDrawer';

interface Activity {
  id: string;
  office_id: string | null;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed_at: string | null;
  type: string;
  priority: string;
  created_at: string;
  observations?: string | null;
  offices?: { name: string } | null;
}

interface Office { id: string; name: string; }
interface UserProfile { id: string; full_name: string | null; }

const priorityColors: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-primary/10 text-primary',
  high: 'bg-warning/10 text-warning',
  urgent: 'bg-destructive/10 text-destructive',
};

const priorityLabels: Record<string, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente',
};

const typeLabels: Record<string, string> = {
  task: 'Tarefa', follow_up: 'Follow-up', onboarding: 'Onboarding', renewal: 'Renovação',
  ligacao: 'Ligação', check_in: 'Check-in', email: 'E-mail', whatsapp: 'WhatsApp',
  planejamento: 'Planejamento', other: 'Outro',
};

export default function Atividades() {
  const { session, isViewer } = useAuth();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editActivityId, setEditActivityId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [type, setType] = useState('task');
  const [priority, setPriority] = useState('medium');
  const [officeId, setOfficeId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [newCheckItem, setNewCheckItem] = useState('');

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('activities')
      .select('*, offices(name)')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    setActivities((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchActivities();
    supabase.from('offices').select('id, name').order('name')
      .then(({ data }) => setOffices(data || []));
    // Fetch internal users for assignee dropdown
    (async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('role', ['admin', 'manager', 'csm']);
      if (roles && roles.length > 0) {
        const ids = [...new Set(roles.map(r => r.user_id))];
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids);
        setUsers(profiles || []);
      }
    })();
  }, [fetchActivities]);

  useEffect(() => {
    if (session?.user?.id && !assigneeId) setAssigneeId(session.user.id);
  }, [session?.user?.id, assigneeId]);

  const addCheckItem = () => {
    if (!newCheckItem.trim()) return;
    setChecklistItems(prev => [...prev, newCheckItem.trim()]);
    setNewCheckItem('');
  };

  const removeCheckItem = (idx: number) => {
    setChecklistItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = assigneeId || session?.user?.id;
    if (!userId) return;
    setCreating(true);
    const { data: inserted, error } = await supabase.from('activities').insert({
      title, description: description || null, due_date: dueDate || null,
      type: type as any, priority: priority as any,
      office_id: officeId || null, user_id: userId,
    }).select('id').single();
    if (error) { toast.error('Erro: ' + error.message); setCreating(false); return; }
    // Save checklist items
    if (inserted && checklistItems.length > 0) {
      const items = checklistItems.map((t, i) => ({ activity_id: inserted.id, title: t, position: i }));
      await supabase.from('activity_checklists').insert(items);
    }
    toast.success('Atividade criada!');
    setDialogOpen(false);
    resetForm();
    fetchActivities();
    setCreating(false);
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setDueDate(''); setType('task'); setPriority('medium');
    setOfficeId(''); setAssigneeId(session?.user?.id || ''); setChecklistItems([]); setNewCheckItem('');
  };

  const hoje = activities.filter(a => !a.completed_at && a.due_date && isToday(new Date(a.due_date)));
  const atrasadas = activities.filter(a => !a.completed_at && a.due_date && isPast(new Date(a.due_date)) && !isToday(new Date(a.due_date)));
  const futuras = activities.filter(a => !a.completed_at && (!a.due_date || (isFuture(new Date(a.due_date)) && !isToday(new Date(a.due_date)))));
  const concluidas = activities.filter(a => a.completed_at);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Atividades</h1>
          <p className="text-sm text-muted-foreground">
            Sua rotina diária — {activities.filter(a => !a.completed_at).length} pendente{activities.filter(a => !a.completed_at).length !== 1 ? 's' : ''}
          </p>
        </div>
        {!isViewer && <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Nova Atividade</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova Atividade</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Vencimento *</Label>
                  <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Select value={officeId} onValueChange={setOfficeId}>
                    <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.id.slice(0, 8)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Checklist builder */}
              <div className="space-y-2">
                <Label>Subtarefas</Label>
                {checklistItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">• {item}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeCheckItem(idx)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)} placeholder="Nova subtarefa..."
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCheckItem(); } }} className="text-sm" />
                  <Button type="button" variant="outline" size="sm" onClick={addCheckItem}>+</Button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? 'Criando...' : 'Criar Atividade'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hoje</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{hoje.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{atrasadas.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Futuras</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{futuras.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
            <CheckSquare className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{concluidas.length}</div></CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
              <div className="h-4 w-48 rounded skeleton-shimmer" />
              <div className="h-3 w-32 rounded skeleton-shimmer" />
            </div>
          ))}
        </div>
      ) : (
        <Tabs defaultValue="hoje">
          <TabsList>
            <TabsTrigger value="hoje">Hoje ({hoje.length})</TabsTrigger>
            <TabsTrigger value="atrasadas">Atrasadas ({atrasadas.length})</TabsTrigger>
            <TabsTrigger value="futuras">Futuras ({futuras.length})</TabsTrigger>
            <TabsTrigger value="concluidas">Concluídas ({concluidas.length})</TabsTrigger>
          </TabsList>
          {(['hoje', 'atrasadas', 'futuras', 'concluidas'] as const).map(tab => {
            const list = tab === 'hoje' ? hoje : tab === 'atrasadas' ? atrasadas : tab === 'futuras' ? futuras : concluidas;
            return (
              <TabsContent key={tab} value={tab} className="space-y-2 mt-4">
                {list.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <CheckSquare className="mb-3 h-10 w-10 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">
                        {tab === 'hoje' ? 'Nenhuma atividade para hoje. 🎉' :
                         tab === 'atrasadas' ? 'Nenhuma atividade atrasada. ✅' :
                         tab === 'futuras' ? 'Nenhuma atividade futura.' :
                         'Nenhuma atividade concluída ainda.'}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  list.map(a => <ActivityCard key={a.id} activity={a} onRefresh={fetchActivities} isViewer={isViewer} navigate={navigate} onEdit={setEditActivityId} />)
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {/* Activity Edit Drawer */}
      <ActivityEditDrawer activityId={editActivityId} isOpen={!!editActivityId} onClose={() => setEditActivityId(null)} onSave={fetchActivities} readOnly={isViewer} />
    </div>
  );
}

function ActivityCard({ activity, onRefresh, isViewer, navigate, onEdit }: { activity: Activity; onRefresh: () => void; isViewer?: boolean; navigate: (path: string) => void; onEdit: (id: string) => void }) {
  const isOverdue = activity.due_date && isPast(new Date(activity.due_date)) && !isToday(new Date(activity.due_date)) && !activity.completed_at;

  return (
    <Card className={`transition-opacity cursor-pointer hover:bg-muted/30 ${activity.completed_at ? 'opacity-60' : ''}`} onClick={() => onEdit(activity.id)}>
      <CardContent className="flex items-start gap-3 py-3 px-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium ${activity.completed_at ? 'line-through' : ''}`}>
              {activity.title}
            </span>
            <Badge variant="outline" className={`text-xs ${priorityColors[activity.priority] || ''}`}>
              {priorityLabels[activity.priority]}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {typeLabels[activity.type] || activity.type}
            </Badge>
          </div>
          {activity.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{activity.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {activity.offices?.name && activity.office_id && (
              <span
                className="cursor-pointer hover:text-primary hover:underline"
                onClick={(e) => { e.stopPropagation(); navigate(`/clientes/${activity.office_id}`); }}
              >
                📋 {activity.offices.name}
              </span>
            )}
            {activity.due_date && (
              <span className={isOverdue ? 'text-destructive font-medium' : ''}>
                📅 {format(new Date(activity.due_date), "dd/MM/yyyy", { locale: ptBR })}
                {isOverdue && ' (atrasada)'}
              </span>
            )}
          </div>
        </div>
        <ActivityPopup activity={activity} onRefresh={onRefresh} readOnly={isViewer} />
      </CardContent>
    </Card>
  );
}
