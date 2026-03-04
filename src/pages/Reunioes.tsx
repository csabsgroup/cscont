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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Loader2, Video, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Meeting {
  id: string;
  office_id: string;
  user_id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  transcript: string | null;
  offices: { name: string };
}

interface Office {
  id: string;
  name: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Video }> = {
  scheduled: { label: 'Agendada', color: 'bg-primary/10 text-primary', icon: Clock },
  completed: { label: 'Concluída', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  cancelled: { label: 'Cancelada', color: 'bg-destructive/10 text-destructive', icon: XCircle },
};

export default function Reunioes() {
  const { session } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailMeeting, setDetailMeeting] = useState<Meeting | null>(null);
  const [creating, setCreating] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [officeId, setOfficeId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [duration, setDuration] = useState('30');
  const [notes, setNotes] = useState('');

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('meetings')
      .select('*, offices(name)')
      .order('scheduled_at', { ascending: false });
    setMeetings((data as Meeting[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMeetings();
    supabase.from('offices').select('id, name').order('name')
      .then(({ data }) => setOffices(data || []));
  }, [fetchMeetings]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) return;
    setCreating(true);
    const { error } = await supabase.from('meetings').insert({
      title,
      office_id: officeId,
      user_id: session.user.id,
      scheduled_at: new Date(scheduledAt).toISOString(),
      duration_minutes: parseInt(duration),
      notes: notes || null,
    });
    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      toast.success('Reunião agendada!');
      setDialogOpen(false);
      resetForm();
      fetchMeetings();
    }
    setCreating(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('meetings').update({ status: status as any }).eq('id', id);
    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      toast.success('Status atualizado!');
      fetchMeetings();
      if (detailMeeting?.id === id) {
        setDetailMeeting(prev => prev ? { ...prev, status } : null);
      }
    }
  };

  const saveNotes = async (id: string, newNotes: string) => {
    const { error } = await supabase.from('meetings').update({ notes: newNotes }).eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else toast.success('Notas salvas!');
  };

  const resetForm = () => {
    setTitle('');
    setOfficeId('');
    setScheduledAt('');
    setDuration('30');
    setNotes('');
  };

  const upcoming = meetings.filter(m => m.status === 'scheduled');
  const past = meetings.filter(m => m.status !== 'scheduled');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reuniões</h1>
          <p className="text-sm text-muted-foreground">
            {upcoming.length} agendada{upcoming.length !== 1 ? 's' : ''} • {meetings.length} total
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Nova Reunião</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar Reunião</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Select value={officeId} onValueChange={setOfficeId} required>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {offices.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data/Hora *</Label>
                  <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Duração (min)</Label>
                  <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} min="15" step="15" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notas / Pauta</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
              </div>
              <Button type="submit" className="w-full" disabled={creating || !officeId}>
                {creating ? 'Agendando...' : 'Agendar Reunião'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : meetings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Video className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhuma reunião registrada.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meetings.map(m => {
                const cfg = statusConfig[m.status] || statusConfig.scheduled;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.title}</TableCell>
                    <TableCell className="text-muted-foreground">{m.offices?.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(m.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.duration_minutes}min</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cfg.color}>{cfg.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {m.status === 'scheduled' && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => updateStatus(m.id, 'completed')}>
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => updateStatus(m.id, 'cancelled')}>
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setDetailMeeting(m)}>
                          Detalhes
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailMeeting} onOpenChange={(open) => !open && setDetailMeeting(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailMeeting?.title}</DialogTitle>
          </DialogHeader>
          {detailMeeting && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Cliente:</span>
                  <p className="font-medium">{detailMeeting.offices?.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Data:</span>
                  <p className="font-medium">{format(new Date(detailMeeting.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Duração:</span>
                  <p className="font-medium">{detailMeeting.duration_minutes} minutos</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p><Badge variant="outline" className={statusConfig[detailMeeting.status]?.color}>{statusConfig[detailMeeting.status]?.label}</Badge></p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notas / Ata</Label>
                <Textarea
                  defaultValue={detailMeeting.notes || ''}
                  rows={5}
                  onBlur={e => saveNotes(detailMeeting.id, e.target.value)}
                  placeholder="Escreva as notas da reunião..."
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
