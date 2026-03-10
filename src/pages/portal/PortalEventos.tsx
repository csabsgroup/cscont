import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePortal } from '@/contexts/PortalContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Calendar, List, Grid3x3, MapPin, Clock, CheckCircle2, XCircle, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, isFuture, isPast, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PortalCalendar } from '@/components/portal/PortalCalendar';
import { PaginationWithPageSize } from '@/components/shared/PaginationWithPageSize';
import { RichTextDisplay } from '@/components/ui/rich-text-editor';
import { toast } from 'sonner';

const CATEGORY_LABELS: Record<string, string> = {
  encontro: 'Encontro', imersao: 'Imersão', workshop: 'Workshop',
  treinamento: 'Treinamento', confraternizacao: 'Confraternização', outro: 'Outro',
};

const TYPE_LABELS: Record<string, string> = {
  presencial: 'Presencial', online: 'Online', hibrido: 'Híbrido',
};

export default function PortalEventos() {
  const { officeId } = usePortal();
  const [events, setEvents] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [participation, setParticipation] = useState<Record<string, { status: string; id: string }>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'lista' | 'calendario'>('lista');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [filterCategory, setFilterCategory] = useState('__all__');

  useEffect(() => {
    if (!officeId) { setLoading(false); return; }
    (async () => {
      const { data: office } = await supabase.from('offices').select('active_product_id').eq('id', officeId).single();
      const productId = office?.active_product_id;

      const [eventsRes, participantsRes, meetingsRes] = await Promise.all([
        supabase.from('events').select('*').order('event_date', { ascending: true }),
        supabase.from('event_participants').select('id, event_id, status').eq('office_id', officeId),
        supabase.from('meetings').select('*').eq('office_id', officeId).eq('share_with_client', true).order('scheduled_at', { ascending: true }),
      ]);

      const pMap: Record<string, { status: string; id: string }> = {};
      (participantsRes.data || []).forEach(p => { pMap[p.event_id] = { status: p.status, id: p.id }; });
      setParticipation(pMap);

      const filtered = (eventsRes.data || []).filter(ev => {
        if (!productId) return true;
        const eligible = ev.eligible_product_ids as string[] | null;
        if (!eligible || eligible.length === 0) return true;
        return eligible.includes(productId);
      });

      setEvents(filtered);
      setMeetings(meetingsRes.data || []);
      setLoading(false);
    })();
  }, [officeId]);

  const handleConfirm = async (eventId: string, newStatus: string) => {
    const p = participation[eventId];
    if (!p) return;
    setConfirming(true);
    const confirmed = newStatus === 'confirmado';
    const { error } = await supabase.from('event_participants').update({ status: newStatus, confirmed }).eq('id', p.id);
    if (error) { toast.error('Erro: ' + error.message); setConfirming(false); return; }
    setParticipation(prev => ({ ...prev, [eventId]: { ...prev[eventId], status: newStatus } }));
    toast.success(newStatus === 'confirmado' ? 'Presença confirmada!' : 'Resposta registrada.');
    setConfirming(false);
  };

  const canConfirm = (ev: any) => {
    const deadlineDays = ev.confirmation_deadline_days ?? 3;
    const deadline = subDays(new Date(ev.event_date), deadlineDays);
    return new Date() <= deadline;
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const categoryFiltered = filterCategory === '__all__' ? events : events.filter(e => e.category === filterCategory);
  const upcoming = categoryFiltered.filter(e => isFuture(new Date(e.event_date)));
  const past = categoryFiltered.filter(e => isPast(new Date(e.event_date)));
  const allListEvents = [...upcoming, ...past];

  const startIdx = (page - 1) * pageSize;
  const paginatedEvents = allListEvents.slice(startIdx, startIdx + pageSize);

  const calendarItems = [
    ...categoryFiltered.map(ev => ({
      id: ev.id, title: ev.title, date: new Date(ev.event_date),
      endDate: ev.end_date ? new Date(ev.end_date) : undefined,
      type: 'event' as const, subtype: ev.type === 'online' ? 'Online' : 'Presencial',
      location: ev.location || undefined,
    })),
    ...meetings.map(m => ({
      id: m.id, title: m.title, date: new Date(m.scheduled_at),
      type: 'meeting' as const, subtype: `${m.duration_minutes || 30}min`,
    })),
  ];

  const getStatusBadge = (eventId: string) => {
    const p = participation[eventId];
    if (!p) return null;
    switch (p.status) {
      case 'confirmado': return <Badge className="bg-emerald-500 text-white border-0 text-xs">Confirmado</Badge>;
      case 'nao_vai': return <Badge variant="destructive" className="text-xs">Não vai</Badge>;
      case 'compareceu': return <Badge className="bg-emerald-500 text-white border-0 text-xs">Compareceu</Badge>;
      case 'nao_compareceu': return <Badge variant="destructive" className="text-xs">Não compareceu</Badge>;
      default: return <Badge variant="outline" className="text-xs">A confirmar</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Eventos</h1>
        <div className="flex items-center gap-2">
          <Select value={filterCategory} onValueChange={v => { setFilterCategory(v); setPage(1); }}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <Filter className="mr-1 h-3.5 w-3.5 shrink-0" />
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas categorias</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        <div className="flex gap-1 rounded-lg border p-0.5">
          <Button size="sm" variant={view === 'lista' ? 'default' : 'ghost'} className="h-7 px-2 text-xs" onClick={() => setView('lista')}>
            <List className="mr-1 h-3.5 w-3.5" /> Lista
          </Button>
          <Button size="sm" variant={view === 'calendario' ? 'default' : 'ghost'} className="h-7 px-2 text-xs" onClick={() => setView('calendario')}>
            <Grid3x3 className="mr-1 h-3.5 w-3.5" /> Calendário
          </Button>
        </div>
        </div>
      </div>

      {view === 'calendario' ? (
        <PortalCalendar events={calendarItems} />
      ) : (
        <>
          {allListEvents.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center py-8">
              <Calendar className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum evento disponível.</p>
            </CardContent></Card>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {paginatedEvents.map(ev => {
                  const isUpcoming = isFuture(new Date(ev.event_date));
                  return (
                    <Card
                      key={ev.id}
                      className={`cursor-pointer overflow-hidden transition-all hover:shadow-lg hover:scale-[1.01] group ${!isUpcoming ? 'opacity-60' : ''}`}
                      onClick={() => setSelectedEvent(ev)}
                    >
                      {/* Cover image */}
                      <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5">
                        {ev.cover_url ? (
                          <img src={ev.cover_url} alt={ev.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Calendar className="h-12 w-12 text-primary/30" />
                          </div>
                        )}
                        {/* Badges overlay */}
                        <div className="absolute top-2 right-2 flex gap-1.5">
                          <Badge variant="secondary" className="text-xs backdrop-blur-sm bg-background/80">
                            {TYPE_LABELS[ev.type] || ev.type}
                          </Badge>
                          <Badge variant="outline" className="text-xs backdrop-blur-sm bg-background/80">
                            {CATEGORY_LABELS[ev.category] || ev.category}
                          </Badge>
                        </div>
                        {/* Status badge overlay bottom-left */}
                        {getStatusBadge(ev.id) && (
                          <div className="absolute bottom-2 left-2">
                            {getStatusBadge(ev.id)}
                          </div>
                        )}
                      </div>

                      <CardContent className="p-4 space-y-2">
                        <h3 className="font-semibold text-base line-clamp-1">{ev.title}</h3>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          {format(new Date(ev.event_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                        {ev.location && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="line-clamp-1">{ev.location}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <PaginationWithPageSize
                totalItems={allListEvents.length}
                currentPage={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                itemLabel="eventos"
              />
            </>
          )}
        </>
      )}

      {/* Event detail dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={open => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedEvent && (
            <>
              {selectedEvent.cover_url && (
                <div className="rounded-lg overflow-hidden -mx-6 -mt-6 mb-4">
                  <img src={selectedEvent.cover_url} alt={selectedEvent.title} className="w-full h-48 object-cover" />
                </div>
              )}
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedEvent.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{TYPE_LABELS[selectedEvent.type] || selectedEvent.type}</Badge>
                  <Badge variant="outline">{CATEGORY_LABELS[selectedEvent.category] || selectedEvent.category}</Badge>
                  {getStatusBadge(selectedEvent.id)}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(selectedEvent.event_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    {selectedEvent.end_date && (
                      <span className="text-muted-foreground">até {format(new Date(selectedEvent.end_date), "HH:mm", { locale: ptBR })}</span>
                    )}
                  </div>
                  {selectedEvent.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedEvent.location}</span>
                    </div>
                  )}
                </div>

                {selectedEvent.description && (
                  <RichTextDisplay html={selectedEvent.description} className="text-sm" />
                )}

                {selectedEvent.observations && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs font-medium mb-1">Observações</p>
                    <p className="text-sm text-muted-foreground">{selectedEvent.observations}</p>
                  </div>
                )}

                {/* Confirmation section */}
                {participation[selectedEvent.id] && isFuture(new Date(selectedEvent.event_date)) && (
                  <div className="border-t pt-4 space-y-3">
                    <p className="text-sm font-medium">Confirmar Presença</p>
                    {canConfirm(selectedEvent) ? (
                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          variant={participation[selectedEvent.id]?.status === 'confirmado' ? 'default' : 'outline'}
                          onClick={() => handleConfirm(selectedEvent.id, 'confirmado')}
                          disabled={confirming}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Vou participar
                        </Button>
                        <Button
                          className="flex-1"
                          variant={participation[selectedEvent.id]?.status === 'nao_vai' ? 'destructive' : 'outline'}
                          onClick={() => handleConfirm(selectedEvent.id, 'nao_vai')}
                          disabled={confirming}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> Não vou
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Prazo para confirmação encerrado.</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
