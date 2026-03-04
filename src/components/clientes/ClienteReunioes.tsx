import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Calendar, Clock, Video, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Props { officeId: string; }

const statusLabels: Record<string, string> = { scheduled: 'Agendada', completed: 'Realizada', cancelled: 'Cancelada' };
const statusColors: Record<string, string> = { scheduled: 'bg-primary/10 text-primary', completed: 'bg-success/10 text-success', cancelled: 'bg-destructive/10 text-destructive' };

export function ClienteReunioes({ officeId }: Props) {
  const { isViewer } = useAuth();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('meetings').select('*').eq('office_id', officeId).order('scheduled_at', { ascending: false });
    setMeetings(data || []);
    setLoading(false);
  }, [officeId]);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  const toggleShare = async (m: any) => {
    const { error } = await supabase.from('meetings').update({ share_with_client: !m.share_with_client }).eq('id', m.id);
    if (error) toast.error('Erro: ' + error.message);
    else {
      toast.success(m.share_with_client ? 'Reunião ocultada do portal' : 'Reunião compartilhada no portal');
      fetchMeetings();
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  if (meetings.length === 0) {
    return <div className="text-center py-12 text-sm text-muted-foreground">Nenhuma reunião registrada.</div>;
  }

  return (
    <div className="space-y-3">
      {meetings.map(m => (
        <Card key={m.id} className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Video className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">{m.title}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(m.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                  {m.duration_minutes && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{m.duration_minutes}min</span>}
                </div>
                {m.notes && <p className="text-sm text-muted-foreground mt-2">{m.notes}</p>}
                {m.transcript && (
                  <details className="mt-2">
                    <summary className="text-xs text-primary cursor-pointer">Ver transcrição</summary>
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{m.transcript}</p>
                  </details>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isViewer && (
                <div className="flex items-center gap-1.5" title={m.share_with_client ? 'Visível no portal' : 'Oculto no portal'}>
                  {m.share_with_client ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground/40" />}
                  <Switch
                    checked={m.share_with_client}
                    onCheckedChange={() => toggleShare(m)}
                    className="scale-75"
                  />
                </div>
              )}
              <Badge variant="outline" className={`text-xs ${statusColors[m.status] || ''}`}>{statusLabels[m.status] || m.status}</Badge>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
