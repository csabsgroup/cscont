import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Video, CheckCircle2, XCircle, FileText, Eye, EyeOff } from 'lucide-react';
import { format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { FormFillDialog } from '@/components/reunioes/FormFillDialog';
import { recalculateHealth } from '@/lib/health-engine';

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
  share_with_client: boolean;
  offices: { name: string };
}

interface Office { id: string; name: string; }

const statusConfig: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Agendada', color: 'bg-primary/10 text-primary' },
  completed: { label: 'Concluída', color: 'bg-success/10 text-success' },
  cancelled: { label: 'Cancelada', color: 'bg-destructive/10 text-destructive' },
};

export default function Reunioes() {
  const { session, isViewer } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailMeeting, setDetailMeeting] = useState<Meeting | null>(null);
  const [formFillMeeting, setFormFillMeeting] = useState<Meeting | null>(null);
  const [creating, setCreating] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOffice, setFilterOffice] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Create form
  const [title, setTitle] = useState('');
  const [officeId, setOfficeId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [duration, setDuration] = useState('30');
  const [notes, setNotes] = useState('');
  const [shareWithClient, setShareWithClient] = useState(false);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('meetings').select('*, offices(name)').order('scheduled_at', { ascending: false });
    setMeetings((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMeetings();
    supabase.from('offices').select('id, name').order('name').then(({ data }) => setOffices(data || []));
  }, [fetchMeetings]);

  const filteredMeetings = useMemo(() => {
    return meetings.filter(m => {
      if (filterStatus && m.status !== filterStatus) return false;
      if (filterOffice && m.office_id !== filterOffice) return false;
      if (filterDateFrom) {
        const from = startOfDay(new Date(filterDateFrom));
        if (isBefore(new Date(m.scheduled_at), from)) return false;
      }
      if (filterDateTo) {
        const to = endOfDay(new Date(filterDateTo));
        if (isAfter(new Date(m.scheduled_at), to)) return false;
      }
      return true;
    });
  }, [meetings, filterStatus, filterOffice, filterDateFrom, filterDateTo]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) return;
    setCreating(true);
    const { error } = await supabase.from('meetings').insert({
      title, office_id: officeId, user_id: session.user.id,
      scheduled_at: new Date(scheduledAt).toISOString(),
      duration_minutes: parseInt(duration), notes: notes || null,
      share_with_client: shareWithClient,
    });
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Reunião agendada!'); setDialogOpen(false); resetForm(); fetchMeetings(); }
    setCreating(false);
  };

  // "Marcar como realizada" — open form FIRST, then on submit mark completed
  const markCompleted = (m: Meeting) => {
    setFormFillMeeting(m);
  };

  const onFormSubmitted = async () => {
    if (formFillMeeting) {
      await supabase.from('meetings').update({ status: 'completed' as any }).eq('id', formFillMeeting.id);
      toast.success('Reunião marcada como concluída!');
      recalculateHealth(formFillMeeting.office_id);
      // Trigger automations for meeting completed
      try {
        await supabase.functions.invoke('execute-automations', {
          body: { action: 'triggerV2', trigger_type: 'meeting.completed', office_id: formFillMeeting.office_id, context: { meeting_id: formFillMeeting.id, suffix: `meeting_${formFillMeeting.id}` } },
        });
      } catch (autoErr) { console.error('Automation trigger failed:', autoErr); }
      setFormFillMeeting(null);
      fetchMeetings();
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const meeting = meetings.find(m => m.id === id);
    const { error } = await supabase.from('meetings').update({ status: status as any }).eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else {
      toast.success('Status atualizado!');
      if (meeting) recalculateHealth(meeting.office_id);
      fetchMeetings();
    }
  };

  const toggleShare = async (m: Meeting) => {
    const { error } = await supabase.from('meetings').update({ share_with_client: !m.share_with_client }).eq('id', m.id);
    if (error) toast.error('Erro: ' + error.message);
    else { fetchMeetings(); }
  };

  const saveNotes = async (id: string, newNotes: string) => {
    const { error } = await supabase.from('meetings').update({ notes: newNotes }).eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else toast.success('Notas salvas!');
  };

  const saveTranscript = async (id: string, transcript: string) => {
    const { error } = await supabase.from('meetings').update({ transcript }).eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else toast.success('Transcrição salva!');
  };

  const resetForm = () => {
    setTitle(''); setOfficeId(''); setScheduledAt(''); setDuration('30'); setNotes(''); setShareWithClient(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reuniões</h1>
          <p className="text-sm text-muted-foreground">
            {filteredMeetings.filter(m => m.status === 'scheduled').length} agendada{filteredMeetings.filter(m => m.status === 'scheduled').length !== 1 ? 's' : ''} • {filteredMeetings.length} total
          </p>
        </div>
        {!isViewer && <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Nova Reunião</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Agendar Reunião</DialogTitle></DialogHeader>
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
                    {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
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
              <div className="flex items-center gap-3">
                <Switch checked={shareWithClient} onCheckedChange={setShareWithClient} />
                <Label className="text-sm">Compartilhar com cliente no portal</Label>
              </div>
              <Button type="submit" className="w-full" disabled={creating || !officeId}>
                {creating ? 'Agendando...' : 'Agendar Reunião'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>}
      </div>

      {/* Filter bar */}
      <div className="flex gap-3 flex-wrap items-end">
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={filterStatus} onValueChange={v => setFilterStatus(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="scheduled">Agendada</SelectItem>
              <SelectItem value="completed">Concluída</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Cliente</Label>
          <Select value={filterOffice} onValueChange={v => setFilterOffice(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">De</Label>
          <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-[150px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-[150px]" />
        </div>
        {(filterStatus || filterOffice || filterDateFrom || filterDateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterStatus(''); setFilterOffice(''); setFilterDateFrom(''); setFilterDateTo(''); }}>
            Limpar
          </Button>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="bg-muted/50 h-11 flex items-center px-4 gap-12">
            {[...Array(6)].map((_, i) => <div key={i} className="h-3 w-16 rounded skeleton-shimmer" />)}
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="border-b border-border/50 px-4 py-3 flex items-center gap-12">
              {[...Array(6)].map((_, j) => <div key={j} className="h-4 w-20 rounded skeleton-shimmer" />)}
            </div>
          ))}
        </div>
      ) : filteredMeetings.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <Video className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhuma reunião encontrada.</p>
        </CardContent></Card>
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
                <TableHead>Portal</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMeetings.map(m => {
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
                      {m.share_with_client ? (
                        <Eye className="h-4 w-4 text-primary" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground/40" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {!isViewer && m.status === 'scheduled' && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => markCompleted(m)} title="Concluir (preencher formulário)">
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => updateStatus(m.id, 'cancelled')} title="Cancelar">
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        {!isViewer && m.status === 'completed' && (
                          <Button size="sm" variant="ghost" onClick={() => setFormFillMeeting(m)} title="Formulário">
                            <FileText className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setDetailMeeting(m)}>Detalhes</Button>
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
          <DialogHeader><DialogTitle>{detailMeeting?.title}</DialogTitle></DialogHeader>
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
              <div className="flex items-center gap-3">
                <Switch checked={detailMeeting.share_with_client} onCheckedChange={() => { toggleShare(detailMeeting); setDetailMeeting({ ...detailMeeting, share_with_client: !detailMeeting.share_with_client }); }} disabled={isViewer} />
                <Label className="text-sm">Compartilhar com cliente</Label>
              </div>
              <div className="space-y-2">
                <Label>Notas / Ata</Label>
                <Textarea
                  defaultValue={detailMeeting.notes || ''}
                  rows={4}
                  onBlur={e => saveNotes(detailMeeting.id, e.target.value)}
                  placeholder="Escreva as notas da reunião..."
                  disabled={isViewer}
                />
              </div>
              <div className="space-y-2">
                <Label>Transcrição</Label>
                <Textarea
                  defaultValue={detailMeeting.transcript || ''}
                  rows={4}
                  onBlur={e => saveTranscript(detailMeeting.id, e.target.value)}
                  placeholder="Cole a transcrição aqui (Fireflies, etc.)..."
                  disabled={isViewer}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Form fill dialog */}
      {formFillMeeting && (
        <FormFillDialog
          open={!!formFillMeeting}
          onOpenChange={(open) => !open && setFormFillMeeting(null)}
          meetingId={formFillMeeting.id}
          officeId={formFillMeeting.office_id}
          onSubmitted={onFormSubmitted}
        />
      )}
    </div>
  );
}
