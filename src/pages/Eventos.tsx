import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Loader2, Calendar, MapPin, Users } from 'lucide-react';
import { format, isFuture, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  location: string | null;
  type: string;
  max_participants: number | null;
  created_by: string;
}

export default function Eventos() {
  const { session, isViewer } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('presencial');
  const [maxParticipants, setMaxParticipants] = useState('');

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: false });
    setEvents((data as Event[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) return;
    setCreating(true);
    const { error } = await supabase.from('events').insert({
      title,
      description: description || null,
      event_date: new Date(eventDate).toISOString(),
      end_date: endDate ? new Date(endDate).toISOString() : null,
      location: location || null,
      type,
      max_participants: maxParticipants ? parseInt(maxParticipants) : null,
      created_by: session.user.id,
    });
    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      toast.success('Evento criado!');
      setDialogOpen(false);
      setTitle(''); setDescription(''); setEventDate(''); setEndDate('');
      setLocation(''); setType('presencial'); setMaxParticipants('');
      fetchEvents();
    }
    setCreating(false);
  };

  const upcoming = events.filter(e => isFuture(new Date(e.event_date)));
  const pastEvents = events.filter(e => isPast(new Date(e.event_date)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Eventos</h1>
          <p className="text-sm text-muted-foreground">
            {upcoming.length} próximo{upcoming.length !== 1 ? 's' : ''} • {events.length} total
          </p>
        </div>
        {!isViewer && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Novo Evento</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Evento</DialogTitle></DialogHeader>
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
                    <Label>Início *</Label>
                    <Input type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Fim</Label>
                    <Input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Local</Label>
                    <Input value={location} onChange={e => setLocation(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="presencial">Presencial</SelectItem>
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="hibrido">Híbrido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Máx. participantes</Label>
                  <Input type="number" value={maxParticipants} onChange={e => setMaxParticipants(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? 'Criando...' : 'Criar Evento'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Participantes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map(ev => (
                <TableRow key={ev.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{ev.title}</p>
                      {ev.description && <p className="text-xs text-muted-foreground line-clamp-1">{ev.description}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(ev.event_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {ev.location ? (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {ev.location}
                      </div>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs capitalize">{ev.type}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {ev.max_participants ? (
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        máx. {ev.max_participants}
                      </div>
                    ) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
