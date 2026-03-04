import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PortalEventos() {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('events').select('*').order('event_date', { ascending: true });
      setEvents(data || []);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Eventos</h1>
      {events.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-8"><Calendar className="h-8 w-8 text-muted-foreground/40 mb-2" /><p className="text-sm text-muted-foreground">Nenhum evento disponível.</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map(ev => (
            <Card key={ev.id}>
              <CardHeader>
                <CardTitle className="text-base">{ev.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{format(new Date(ev.event_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              </CardHeader>
              {(ev.description || ev.location) && (
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  {ev.description && <p>{ev.description}</p>}
                  {ev.location && <p>📍 {ev.location}</p>}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
