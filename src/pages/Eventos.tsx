import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Loader2, Calendar, ChevronDown } from 'lucide-react';
import { isFuture, isPast } from 'date-fns';
import { toast } from 'sonner';
import { EventCard } from '@/components/eventos/EventCard';

const CATEGORIES = [
  { value: 'encontro', label: 'Encontro' },
  { value: 'imersao', label: 'Imersão' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'treinamento', label: 'Treinamento' },
  { value: 'confraternizacao', label: 'Confraternização' },
  { value: 'outro', label: 'Outro' },
];

interface Product { id: string; name: string; }

export default function Eventos() {
  const { session, isViewer } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [participantCounts, setParticipantCounts] = useState<Record<string, { confirmed: number; total: number }>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);

  // Filters
  const [filterProduct, setFilterProduct] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  // Create form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('presencial');
  const [category, setCategory] = useState('encontro');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const [eventsRes, participantsRes] = await Promise.all([
      supabase.from('events').select('*').order('event_date', { ascending: true }),
      supabase.from('event_participants').select('event_id, status'),
    ]);
    setEvents((eventsRes.data as any[]) || []);

    // Build counts
    const counts: Record<string, { confirmed: number; total: number }> = {};
    (participantsRes.data || []).forEach((p: any) => {
      if (!counts[p.event_id]) counts[p.event_id] = { confirmed: 0, total: 0 };
      counts[p.event_id].total++;
      if (p.status === 'confirmado' || p.status === 'compareceu') counts[p.event_id].confirmed++;
    });
    setParticipantCounts(counts);
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
    const { data: created, error } = await supabase.from('events').insert({
      title, description: description || null,
      event_date: new Date(eventDate).toISOString(),
      end_date: endDate ? new Date(endDate).toISOString() : null,
      location: location || null, type, category,
      max_participants: maxParticipants ? parseInt(maxParticipants) : null,
      eligible_product_ids: selectedProductIds.length > 0 ? selectedProductIds : null,
      created_by: session.user.id,
    }).select('id').single();
    if (error) { toast.error('Erro: ' + error.message); setCreating(false); return; }

    if (selectedProductIds.length > 0 && created) {
      const { data: offices } = await supabase
        .from('offices').select('id')
        .in('active_product_id', selectedProductIds)
        .eq('status', 'ativo');
      if (offices && offices.length > 0) {
        await supabase.from('event_participants').insert(
          offices.map(o => ({ event_id: created.id, office_id: o.id, confirmed: false, status: 'a_confirmar' }))
        );
        toast.success(`Evento criado com ${offices.length} participante(s)!`);
      } else {
        toast.success('Evento criado!');
      }
    } else {
      toast.success('Evento criado!');
    }

    setDialogOpen(false);
    setTitle(''); setDescription(''); setEventDate(''); setEndDate('');
    setLocation(''); setType('presencial'); setCategory('encontro');
    setMaxParticipants(''); setSelectedProductIds([]);
    fetchEvents();
    setCreating(false);
  };

  // Filter events
  const filtered = events.filter(ev => {
    if (filterProduct !== 'all') {
      const eligible = ev.eligible_product_ids as string[] | null;
      if (!eligible || !eligible.includes(filterProduct)) return false;
    }
    if (filterCategory !== 'all' && ev.category !== filterCategory) return false;
    return true;
  });

  const upcoming = filtered.filter(e => isFuture(new Date(e.event_date)));
  const past = filtered.filter(e => isPast(new Date(e.event_date))).reverse();

  return (
    <div className="space-y-6">
      {/* Header */}
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
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
                  <Label>Categoria</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Produtos Elegíveis</Label>
                  <div className="flex flex-wrap gap-2">
                    {products.map(p => (
                      <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={selectedProductIds.includes(p.id)} onCheckedChange={() => toggleProduct(p.id)} />
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

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={filterProduct} onValueChange={setFilterProduct}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar produto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os produtos</SelectItem>
            {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <Calendar className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhum evento encontrado.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-8">
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Próximos Eventos</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map(ev => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    confirmedCount={participantCounts[ev.id]?.confirmed || 0}
                    totalCount={participantCounts[ev.id]?.total || 0}
                    onClick={() => setDetailEvent(ev)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Past - collapsible */}
          {past.length > 0 && (
            <Collapsible open={pastOpen} onOpenChange={setPastOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between text-muted-foreground hover:text-foreground">
                  <span>Eventos Passados ({past.length})</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${pastOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
                  {past.map(ev => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      confirmedCount={participantCounts[ev.id]?.confirmed || 0}
                      totalCount={participantCounts[ev.id]?.total || 0}
                      onClick={() => setDetailEvent(ev)}
                      isPast
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}

      {/* Detail drawer */}
      <EventDetailDrawer
        event={detailEvent}
        open={!!detailEvent}
        onOpenChange={(open) => !open && setDetailEvent(null)}
        products={products}
        onSaved={() => { fetchEvents(); setDetailEvent(null); }}
        readOnly={isViewer}
      />
    </div>
  );
}
