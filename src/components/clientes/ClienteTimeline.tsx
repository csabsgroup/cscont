import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Circle, Calendar, FileText, MoreVertical, RotateCcw, Trash2, Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Props { officeId: string; }

interface TimelineItem {
  id: string;
  type: 'activity' | 'meeting';
  title: string;
  date: string;
  status: string;
  description?: string | null;
}

export function ClienteTimeline({ officeId }: Props) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<TimelineItem | null>(null);
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    const [actRes, meetRes] = await Promise.all([
      supabase.from('activities').select('*').eq('office_id', officeId).order('created_at', { ascending: false }),
      supabase.from('meetings').select('*').eq('office_id', officeId).order('scheduled_at', { ascending: false }),
    ]);

    const activities: TimelineItem[] = (actRes.data || []).map(a => ({
      id: a.id, type: 'activity', title: a.title,
      date: a.due_date || a.created_at,
      status: a.completed_at ? 'done' : 'pending',
      description: a.description,
    }));
    const meetings: TimelineItem[] = (meetRes.data || []).map(m => ({
      id: m.id, type: 'meeting', title: m.title,
      date: m.scheduled_at,
      status: m.status,
      description: m.notes,
    }));

    const all = [...activities, ...meetings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setItems(all);
    setLoading(false);
  }, [officeId]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleComplete = async (item: TimelineItem) => {
    if (item.type === 'activity') {
      await supabase.from('activities').update({ completed_at: new Date().toISOString() }).eq('id', item.id);
    } else {
      await supabase.from('meetings').update({ status: 'completed' as any }).eq('id', item.id);
    }
    toast.success('Concluído!'); fetch();
  };

  const handleReopen = async (item: TimelineItem) => {
    if (item.type === 'activity') {
      await supabase.from('activities').update({ completed_at: null }).eq('id', item.id);
    } else {
      await supabase.from('meetings').update({ status: 'scheduled' as any }).eq('id', item.id);
    }
    toast.success('Reaberto!'); fetch();
  };

  const handleDelete = async (item: TimelineItem) => {
    if (item.type === 'activity') {
      await supabase.from('activities').delete().eq('id', item.id);
    } else {
      await supabase.from('meetings').delete().eq('id', item.id);
    }
    toast.success('Removido!'); fetch();
  };

  const openEdit = (item: TimelineItem) => { setEditItem(item); setObs(item.description || ''); };

  const saveEdit = async () => {
    if (!editItem) return;
    setSaving(true);
    if (editItem.type === 'activity') {
      await supabase.from('activities').update({ description: obs || null }).eq('id', editItem.id);
    } else {
      await supabase.from('meetings').update({ notes: obs || null }).eq('id', editItem.id);
    }
    toast.success('Atualizado!'); setSaving(false); setEditItem(null); fetch();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  if (items.length === 0) {
    return <div className="text-center py-12 text-sm text-muted-foreground">Nenhuma atividade ou reunião registrada.</div>;
  }

  const isDone = (item: TimelineItem) => item.status === 'done' || item.status === 'completed';

  return (
    <div className="space-y-3">
      {items.map(item => (
        <Card key={`${item.type}-${item.id}`} className="p-4 flex items-start gap-3">
          {isDone(item) ? (
            <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{item.title}</span>
              <Badge variant="outline" className="text-xs">
                {item.type === 'activity' ? <FileText className="h-3 w-3 mr-1" /> : <Calendar className="h-3 w-3 mr-1" />}
                {item.type === 'activity' ? 'Atividade' : 'Reunião'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(item.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
            {item.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.description}</p>}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="sm" variant="ghost"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(item)}>Editar</DropdownMenuItem>
              {isDone(item) ? (
                <DropdownMenuItem onClick={() => handleReopen(item)}><RotateCcw className="mr-2 h-4 w-4" />Reabrir</DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleComplete(item)}><CheckCircle2 className="mr-2 h-4 w-4" />Concluir</DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(item)}>
                <Trash2 className="mr-2 h-4 w-4" />Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Card>
      ))}

      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Observações</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Observações</Label><Textarea value={obs} onChange={e => setObs(e.target.value)} rows={4} /></div>
            <Button className="w-full" onClick={saveEdit} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
