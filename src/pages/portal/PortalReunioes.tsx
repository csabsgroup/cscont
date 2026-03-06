import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePortal } from '@/contexts/PortalContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Video } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PortalReunioes() {
  const { officeId } = usePortal();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!officeId) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from('meetings').select('*').eq('office_id', officeId).eq('share_with_client', true).order('scheduled_at', { ascending: false });
      setMeetings(data || []);
      setLoading(false);
    })();
  }, [officeId]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reuniões</h1>
      {meetings.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-8"><Video className="h-8 w-8 text-muted-foreground/40 mb-2" /><p className="text-sm text-muted-foreground">Nenhuma reunião compartilhada.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {meetings.map(m => (
            <Card key={m.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{m.title}</CardTitle>
                  <Badge variant={m.status === 'completed' ? 'default' : 'secondary'}>{m.status === 'completed' ? 'Concluída' : m.status === 'scheduled' ? 'Agendada' : 'Cancelada'}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{format(new Date(m.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              </CardHeader>
              {(m.notes || m.transcript) && (
                <CardContent className="space-y-3">
                  {m.notes && <div><p className="text-sm font-medium mb-1">Ata</p><p className="text-sm text-muted-foreground whitespace-pre-wrap">{m.notes}</p></div>}
                  {m.transcript && <div><p className="text-sm font-medium mb-1">Transcrição</p><p className="text-sm text-muted-foreground whitespace-pre-wrap">{m.transcript}</p></div>}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
