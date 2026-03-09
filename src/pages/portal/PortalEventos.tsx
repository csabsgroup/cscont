import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePortal } from '@/contexts/PortalContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, List, Grid3x3 } from 'lucide-react';
import { format, isFuture, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PortalCalendar } from '@/components/portal/PortalCalendar';
import { PaginationWithPageSize } from '@/components/shared/PaginationWithPageSize';

export default function PortalEventos() {
  const { officeId } = usePortal();
  const [events, setEvents] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [participation, setParticipation] = useState<Record<string, { confirmed: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'lista' | 'calendario'>('lista');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    if (!officeId) { setLoading(false); return; }
    (async () => {
      const { data: office } = await supabase.from('offices').select('active_product_id').eq('id', officeId).single();
      const productId = office?.active_product_id;

      const [eventsRes, participantsRes, meetingsRes] = await Promise.all([
        supabase.from('events').select('*').order('event_date', { ascending: true }),
        supabase.from('event_participants').select('event_id, confirmed').eq('office_id', officeId),
        supabase.from('meetings').select('*').eq('office_id', officeId).eq('share_with_client', true).order('scheduled_at', { ascending: true }),
      ]);

      const pMap: Record<string, { confirmed: boolean }> = {};
      (participantsRes.data || []).forEach(p => { pMap[p.event_id] = { confirmed: p.confirmed }; });
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

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const upcoming = events.filter(e => isFuture(new Date(e.event_date)));
  const past = events.filter(e => isPast(new Date(e.event_date)));
  const allListEvents = [...upcoming, ...past];

  const startIdx = (page - 1) * pageSize;
  const paginatedEvents = allListEvents.slice(startIdx, startIdx + pageSize);

  const calendarItems = [
    ...events.map(ev => ({
      id: ev.id,
      title: ev.title,
      date: new Date(ev.event_date),
      type: 'event' as const,
      subtype: ev.type === 'online' ? 'Online' : 'Presencial',
      location: ev.location || undefined,
    })),
    ...meetings.map(m => ({
      id: m.id,
      title: m.title,
      date: new Date(m.scheduled_at),
      type: 'meeting' as const,
      subtype: `${m.duration_minutes || 30}min`,
    })),
  ];

  const getParticipationBadge = (eventId: string, isPastEvent: boolean) => {
    const p = participation[eventId];
    if (!p) return <Badge variant="outline" className="text-xs">Convidado</Badge>;
    if (isPastEvent) {
      return p.confirmed
        ? <Badge className="bg-emerald-500 text-white border-0 text-xs">Participou</Badge>
        : <Badge variant="destructive" className="text-xs">Faltou</Badge>;
    }
    return p.confirmed
      ? <Badge className="bg-emerald-500 text-white border-0 text-xs">Confirmado</Badge>
      : <Badge variant="outline" className="text-xs">Convidado</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Eventos</h1>
        <div className="flex gap-1 rounded-lg border p-0.5">
          <Button size="sm" variant={view === 'lista' ? 'default' : 'ghost'} className="h-7 px-2 text-xs" onClick={() => setView('lista')}>
            <List className="mr-1 h-3.5 w-3.5" /> Lista
          </Button>
          <Button size="sm" variant={view === 'calendario' ? 'default' : 'ghost'} className="h-7 px-2 text-xs" onClick={() => setView('calendario')}>
            <Grid3x3 className="mr-1 h-3.5 w-3.5" /> Calendário
          </Button>
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
                    <EventCard
                      key={ev.id}
                      event={ev}
                      upcoming={isUpcoming}
                      participationBadge={getParticipationBadge(ev.id, !isUpcoming)}
                    />
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
    </div>
  );
}

function EventCard({ event, upcoming, participationBadge }: { event: any; upcoming?: boolean; participationBadge: React.ReactNode }) {
  return (
    <Card className={upcoming ? '' : 'opacity-70'}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{event.title}</CardTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            {participationBadge}
            <Badge variant={upcoming ? 'default' : 'secondary'}>{event.type === 'online' ? 'Online' : 'Presencial'}</Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{format(new Date(event.event_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
      </CardHeader>
      {(event.description || event.location) && (
        <CardContent className="text-sm text-muted-foreground space-y-1">
          {event.description && <p>{event.description}</p>}
          {event.location && <p>📍 {event.location}</p>}
        </CardContent>
      )}
    </Card>
  );
}
