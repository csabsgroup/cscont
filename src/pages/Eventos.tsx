import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Loader2, Calendar, MapPin, Users, Eye } from 'lucide-react';
import { format, isFuture, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { ParticipantManager } from '@/components/eventos/ParticipantManager';

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  end_date: string | null;
  location: string | null;
  type: string;
  max_participants: number | null;
  eligible_product_ids: string[] | null;
  created_by: string;
}

interface Product { id: string; name: string; }

export default function Eventos() {
  const { session, isViewer } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<Event | null>(null);
  const [creating, setCreating] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('presencial');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('events').select('*').order('event_date', { ascending: false });
    setEvents((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEvents();
    supabase.from('products').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setProducts(data || []));
  }, [fetchEvents]);

  const toggleProduct = (id: string) => {
    setSelectedProductIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) return;
    setCreating(true);
    const { error } = await supabase.from('events').insert({
      title, description: description || null,
      event_date: new Date(eventDate).toISOString(),
      end_date: endDate ? new Date(endDate).toISOString() : null,
      location: location || null, type,
      max_participants: maxParticipants ? parseInt(maxParticipants) : null,
      eligible_product_ids: selectedProductIds.length > 0 ? selectedProductIds : null,
      created_by: session.user.id,
    });
    if (error) toast.error('Erro: ' + error.message);
    else {
      toast.success('Evento criado!');
      setDialogOpen(false);
      setTitle(''); setDescription(''); setEventDate(''); setEndDate('');
      setLocation(''); setType('presencial'); setMaxParticipants(''); setSelectedProductIds([]);
      fetchEvents();
    }
    setCreating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Eventos</h1>
          <p className="text-sm text-muted-foreground">
            {events.filter(e => isFuture(new Date(e.event_date))).length} próximo{events.filter(e => isFuture(new Date(e.event_date))).length !== 1 ? 's' : ''} • {events.length} total
          </p>
        </div>
        {!isViewer && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Novo Evento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
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
                  <Label>Produtos Elegíveis</Label>
                  <div className="flex flex-wrap gap-2">
                    {products.map(p => (
                      <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={selectedProductIds.includes(p.id)}
                          onCheckedChange={() => toggleProduct(p.id)}
                        />
                        {p.name}
                      </label>
                    ))}
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
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="bg-muted/50 h-11 flex items-center px-4 gap-12">
            {[...Array(5)].map((_, i) => <div key={i} className="h-3 w-16 rounded skeleton-shimmer" />)}
          </div>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border-b border-border/50 px-4 py-3 flex items-center gap-12">
              {[...Array(5)].map((_, j) => <div key={j} className="h-4 w-20 rounded skeleton-shimmer" />)}
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <Calendar className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
        </CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Produtos</TableHead>
                <TableHead></TableHead>
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
                    {ev.location ? <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{ev.location}</div> : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs capitalize">{ev.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {(ev.eligible_product_ids || []).map(pid => {
                        const prod = products.find(p => p.id === pid);
                        return prod ? <Badge key={pid} variant="outline" className="text-xs">{prod.name}</Badge> : null;
                      })}
                      {(!ev.eligible_product_ids || ev.eligible_product_ids.length === 0) && <span className="text-xs text-muted-foreground">Todos</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => setDetailEvent(ev)}>
                      <Eye className="h-4 w-4 mr-1" /> Detalhes
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Detail dialog with participant management */}
      <Dialog open={!!detailEvent} onOpenChange={(open) => !open && setDetailEvent(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detailEvent?.title}</DialogTitle></DialogHeader>
          {detailEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Data:</span>
                  <p className="font-medium">{format(new Date(detailEvent.event_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <p className="font-medium capitalize">{detailEvent.type}</p>
                </div>
                {detailEvent.location && (
                  <div>
                    <span className="text-muted-foreground">Local:</span>
                    <p className="font-medium">{detailEvent.location}</p>
                  </div>
                )}
              </div>
              {detailEvent.description && <p className="text-sm text-muted-foreground">{detailEvent.description}</p>}
              <hr />
              <ParticipantManager
                eventId={detailEvent.id}
                eligibleProductIds={detailEvent.eligible_product_ids || []}
                readOnly={isViewer}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
