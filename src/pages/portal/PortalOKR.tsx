import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePortal } from '@/contexts/PortalContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, ChevronDown, ChevronRight, Target, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { recalculateHealth } from '@/lib/health-engine';

const areaLabels: Record<string, string> = {
  gestao_estrategica: 'Gestão Estratégica', marketing: 'Marketing', vendas: 'Vendas',
  sucesso_cliente: 'Sucesso do Cliente', gestao_pessoas: 'Gestão de Pessoas', financeiro: 'Financeiro',
};
const areaColors: Record<string, string> = {
  gestao_estrategica: 'bg-primary/10 text-primary', marketing: 'bg-purple-100 text-purple-700',
  vendas: 'bg-blue-100 text-blue-700', sucesso_cliente: 'bg-green-100 text-green-700',
  gestao_pessoas: 'bg-orange-100 text-orange-700', financeiro: 'bg-yellow-100 text-yellow-700',
};
const statusLabels: Record<string, string> = { pending: 'Pendente', in_progress: 'Em andamento', done: 'Concluído', cancelled: 'Cancelado' };
const krTypeLabels: Record<string, string> = { meta: 'Meta', action: 'Ação' };

export default function PortalOKR() {
  const { officeId } = usePortal();
  const [objectives, setObjectives] = useState<any[]>([]);
  const [krs, setKrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const fetchAll = useCallback(async () => {
    if (!officeId) { setLoading(false); return; }
    const [oRes, kRes] = await Promise.all([
      supabase.from('okr_objectives').select('*').eq('office_id', officeId).order('created_at'),
      supabase.from('action_plans').select('*').eq('office_id', officeId).not('objective_id', 'is', null).order('created_at'),
    ]);
    setObjectives(oRes.data || []);
    setKrs(kRes.data || []);
    // Auto-open all
    if (oRes.data) setOpenIds(new Set(oRes.data.map((o: any) => o.id)));
    setLoading(false);
  }, [officeId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleOpen = (id: string) => {
    setOpenIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const updateKr = async (id: string, patch: any) => {
    const { error } = await supabase.from('action_plans').update(patch).eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else {
      toast.success('Atualizado!');
      if (officeId) recalculateHealth(officeId);
      // Only re-fetch for status changes (not observation edits) to avoid textarea re-render
      if (!('observations' in patch)) fetchAll();
      else {
        // Update local state for observations without full re-fetch
        setKrs(prev => prev.map(k => k.id === id ? { ...k, ...patch } : k));
      }
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const getProgress = (objectiveId: string) => {
    const objKrs = krs.filter(k => k.objective_id === objectiveId);
    if (objKrs.length === 0) return 0;
    return Math.round((objKrs.filter(k => k.status === 'done').length / objKrs.length) * 100);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Plano de Ação (OKR)</h1>

      {objectives.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum objetivo definido.</Card>
      ) : (
        <div className="space-y-4">
          {objectives.map(obj => {
            const progress = getProgress(obj.id);
            const objKrs = krs.filter(k => k.objective_id === obj.id);
            const isOpen = openIds.has(obj.id);
            return (
              <Card key={obj.id} className="overflow-hidden">
                <Collapsible open={isOpen} onOpenChange={() => toggleOpen(obj.id)}>
                  <CollapsibleTrigger asChild>
                    <div className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-3">
                        {isOpen ? <ChevronDown className="h-5 w-5 mt-0.5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 mt-0.5 text-muted-foreground" />}
                        <Target className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{obj.title}</span>
                            <Badge variant="outline" className={`text-xs ${areaColors[obj.area] || ''}`}>{areaLabels[obj.area] || obj.area}</Badge>
                          </div>
                          {obj.description && <p className="text-xs text-muted-foreground mt-0.5">{obj.description}</p>}
                          <div className="flex items-center gap-2 mt-2">
                            <Progress value={progress} className="h-2 flex-1" />
                            <span className="text-sm font-medium">{progress}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t px-4 pb-4 pt-2 space-y-3">
                      {objKrs.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhuma KR adicionada.</p>}
                      {objKrs.map(kr => (
                        <div key={kr.id} className="rounded-md border border-border/40 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2 flex-1">
                              <CheckCircle2 className={`h-4 w-4 mt-0.5 flex-shrink-0 ${kr.status === 'done' ? 'text-green-600' : 'text-muted-foreground/40'}`} />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-sm font-medium ${kr.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{kr.title}</span>
                                  <Badge variant="outline" className="text-xs">{krTypeLabels[kr.kr_type] || 'Ação'}</Badge>
                                  <Badge variant="outline" className={`text-xs ${areaColors[kr.area] || ''}`}>{areaLabels[kr.area] || kr.area}</Badge>
                                </div>
                                {kr.description && <p className="text-xs text-muted-foreground mt-0.5">{kr.description}</p>}
                                {kr.due_date && <p className="text-xs text-muted-foreground mt-0.5">Prazo: {format(new Date(kr.due_date), 'dd/MM/yyyy')}</p>}
                              </div>
                            </div>
                            <Select value={kr.status} onValueChange={val => updateKr(kr.id, { status: val })}>
                              <SelectTrigger className="w-[150px] h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="mt-2 pl-6">
                            <Textarea
                              defaultValue={kr.observations || ''}
                              placeholder="Observações..."
                              rows={2}
                              onBlur={e => {
                                if (e.target.value !== (kr.observations || '')) updateKr(kr.id, { observations: e.target.value });
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
