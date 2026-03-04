import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar } from 'lucide-react';
import { format, isFuture, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PortalEventos() {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [participation, setParticipation] = useState<Record<string, { confirmed: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [officeId, setOfficeId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: links } = await supabase.from('client_office_links').select('office_id').eq('user_id', user.id);
      const oid = links?.[0]?.office_id;
      if (!oid) { setLoading(false); return; }
      setOfficeId(oid);

      const { data: office } = await supabase.from('offices').select('active_product_id').eq('id', oid).single();
      const productId = office?.active_product_id;

      const [eventsRes, participantsRes] = await Promise.all([
        supabase.from('events').select('*').order('event_date', { ascending: true }),
        supabase.from('event_participants').select('event_id, confirmed').eq('office_id', oid),
      ]);

      // Build participation map
      const pMap: Record<string, { confirmed: boolean }> = {};
      (participantsRes.data || []).forEach(p => { pMap[p.event_id] = { confirmed: p.confirmed }; });
      setParticipation(pMap);

      // Filter by eligible product
      const filtered = (eventsRes.data || []).filter(ev => {
        if (!productId) return true;
        const eligible = ev.eligible_product_ids as string[] | null;
        if (!eligible || eligible.length === 0) return true;
        return eligible.includes(productId);
      });

      setEvents(filtered);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const upcoming = events.filter(e => isFuture(new Date(e.event_date)));
  const past = events.filter(e => isPast(new Date(e.event_date)));

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
      <h1 className="text-2xl font-bold">Eventos</h1>

      {events.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-8">
          <Calendar className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum evento disponível.</p>
        </CardContent></Card>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Próximos</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {upcoming.map(ev => (
                  <EventCard key={ev.id} event={ev} upcoming participationBadge={getParticipationBadge(ev.id, false)} />
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 text-muted-foreground">Anteriores</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {past.map(ev => (
                  <EventCard key={ev.id} event={ev} participationBadge={getParticipationBadge(ev.id, true)} />
                ))}
              </div>
            </div>
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
