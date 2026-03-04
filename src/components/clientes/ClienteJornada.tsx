import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, ArrowRight, History } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props { officeId: string; productId: string | null; }

export function ClienteJornada({ officeId, productId }: Props) {
  const [currentStage, setCurrentStage] = useState<any>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [journey, setJourney] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!productId) { setLoading(false); return; }
    setLoading(true);
    const [stagesRes, journeyRes, histRes] = await Promise.all([
      supabase.from('journey_stages').select('*').eq('product_id', productId).order('position'),
      supabase.from('office_journey').select('*, journey_stages(*)').eq('office_id', officeId).maybeSingle(),
      supabase.from('office_stage_history').select('*, from_stage:from_stage_id(name), to_stage:to_stage_id(name)')
        .eq('office_id', officeId).order('created_at', { ascending: false }),
    ]);
    setStages(stagesRes.data || []);
    setJourney(journeyRes.data);
    if (journeyRes.data?.journey_stages) setCurrentStage(journeyRes.data.journey_stages);
    setHistory(histRes.data || []);
    setLoading(false);
  }, [officeId, productId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!productId) return <div className="text-center py-12 text-sm text-muted-foreground">Nenhum produto ativo definido.</div>;

  return (
    <div className="space-y-6">
      {/* Current stage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />Etapa Atual
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentStage ? (
            <div>
              <p className="font-medium">{currentStage.name}</p>
              {currentStage.description && <p className="text-sm text-muted-foreground mt-1">{currentStage.description}</p>}
              {journey?.entered_at && <p className="text-xs text-muted-foreground mt-2">Desde {format(new Date(journey.entered_at), 'dd/MM/yyyy', { locale: ptBR })}</p>}
              {currentStage.sla_days && <Badge variant="outline" className="mt-2 text-xs">SLA: {currentStage.sla_days} dias</Badge>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Escritório não vinculado a nenhuma etapa.</p>
          )}
        </CardContent>
      </Card>

      {/* Stage progression */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Progressão</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            {stages.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <Badge variant={currentStage?.id === s.id ? 'default' : 'outline'} className={currentStage?.id === s.id ? '' : 'text-muted-foreground'}>{s.name}</Badge>
                {i < stages.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stage history */}
      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />Histórico de Movimentações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.map(h => (
                <div key={h.id} className="flex items-start gap-3 text-sm border-l-2 border-border pl-3 py-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {h.from_stage?.name && (
                        <><span className="text-muted-foreground">{h.from_stage.name}</span><ArrowRight className="h-3 w-3 text-muted-foreground" /></>
                      )}
                      <span className="font-medium">{h.to_stage?.name || '—'}</span>
                      <Badge variant="outline" className="text-xs">{h.change_type}</Badge>
                    </div>
                    {h.reason && <p className="text-xs text-muted-foreground mt-0.5">{h.reason}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(h.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
